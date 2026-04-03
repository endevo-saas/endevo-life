"""
Assessment routes — 40-question life diagnostic.

Business rules:
  - Questions scored via answers[].score looked up from DynamoDB — never trust client.
  - Completing all 40 questions (any score) unlocks ALL modules immediately.
  - There is no pass/fail gate. The score is for the AI recommendation scorecard only.
  - Score drives the Readiness Engine: domain percentages, tiers, and module priority.
  - Each submission stored in endevo-uat-responses keyed by (userId, submittedAt).
  - Schema: endevo-uat-lms-user-modules PK=userId SK=moduleNum, field lockStatus.
  - Schema: endevo-uat-responses PK=userId SK=submittedAt,
      fields: tenantId, scorecard (full engine output), answers={questionId:{selectedLabel,score}},
      attemptNumber.
  - Unlimited retakes, no cooldown. Each retake stores a new response record.

Routes handled:
  GET  /api/lms/assessment/questions   — list assessment questions for tenant
  POST /api/lms/assessment/submit      — submit answers, run engine, unlock all modules
  GET  /api/lms/assessment/status      — get latest attempt including scorecard
  GET  /api/lms/assessment/history     — all attempts with overallScore for progress chart
"""
import json
import logging
import random
from datetime import datetime, timezone
from typing import Optional

from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from utils.auth import require_auth
from utils.db import QUESTIONS_T, RESPONSES_T, USER_MODULES_T
from utils.response import ok, err
from engine.readiness_engine import calculate_scorecard

logger = logging.getLogger(__name__)

REQUIRED_QUESTION_COUNT: int = 40
TOTAL_MODULES: int = 6


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_body(event: dict) -> dict:
    try:
        return json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}


def _unlock_module(user_id: str, module_num: str, tenant_id: str, now: str) -> None:
    """Write an 'unlocked' record to endevo-uat-lms-user-modules.

    Schema: PK=userId, SK=moduleNum, field lockStatus (locked|unlocked|complete).
    Uses a condition so we never downgrade a 'complete' or already 'unlocked' module.
    """
    try:
        USER_MODULES_T.put_item(
            Item={
                "userId": user_id,
                "moduleNum": module_num,
                "lockStatus": "unlocked",
                "tenantId": tenant_id,
                "unlockedAt": now,
            },
            ConditionExpression=(
                "attribute_not_exists(lockStatus) OR lockStatus = :locked"
            ),
            ExpressionAttributeValues={":locked": "locked"},
        )
        logger.info("Module %s unlocked for user %s", module_num, user_id)
    except ClientError as exc:
        # ConditionalCheckFailedException means module already unlocked/complete — not an error
        if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
            logger.error(
                "Failed to unlock module %s for user %s: %s", module_num, user_id, exc
            )
            raise


def _unlock_all_modules(user_id: str, tenant_id: str) -> None:
    """Unlock ALL modules (1-6) simultaneously after assessment completion.

    This is the core design change from the old pass/fail gate:
    completing the assessment (any score) gives full access to the entire course.
    The scorecard guides users where to focus — the lock is gone.
    """
    now = datetime.now(timezone.utc).isoformat()
    for module_num in [str(n) for n in range(1, TOTAL_MODULES + 1)]:
        try:
            _unlock_module(user_id, module_num, tenant_id, now)
        except ClientError:
            # Log and continue — don't fail the whole submission if one unlock fails
            logger.error(
                "Module %s unlock failed for user %s after assessment — continuing",
                module_num,
                user_id,
            )


def _get_latest_response(user_id: str) -> Optional[dict]:
    """Return the most recent assessment response for a user, or None."""
    try:
        resp = RESPONSES_T.query(
            KeyConditionExpression=Key("userId").eq(user_id),
            ScanIndexForward=False,
            Limit=1,
        )
        items = resp.get("Items", [])
        return items[0] if items else None
    except ClientError as exc:
        logger.error("Failed to query responses for user %s: %s", user_id, exc)
        raise


def _get_all_responses(user_id: str) -> list[dict]:
    """Return all assessment responses for a user, newest first."""
    try:
        resp = RESPONSES_T.query(
            KeyConditionExpression=Key("userId").eq(user_id),
            ScanIndexForward=False,
        )
        items: list[dict] = resp.get("Items", [])
        while "LastEvaluatedKey" in resp:
            resp = RESPONSES_T.query(
                KeyConditionExpression=Key("userId").eq(user_id),
                ScanIndexForward=False,
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            items.extend(resp.get("Items", []))
        return items
    except ClientError as exc:
        logger.error("Failed to query all responses for user %s: %s", user_id, exc)
        raise


def _count_previous_attempts(user_id: str) -> int:
    """Count the number of prior assessment submissions for a user."""
    try:
        resp = RESPONSES_T.query(
            KeyConditionExpression=Key("userId").eq(user_id),
            Select="COUNT",
        )
        return int(resp.get("Count", 0))
    except ClientError as exc:
        logger.error("Failed to count attempts for user %s: %s", user_id, exc)
        return 0


def _fetch_all_questions(tenant_id: str) -> list[dict]:
    """
    Return all assessment questions for this tenant as a list.
    Used both for displaying questions and for scoring submissions server-side.
    """
    try:
        resp = QUESTIONS_T.query(
            KeyConditionExpression=Key("tenantId").eq(tenant_id),
            FilterExpression=Attr("type").eq("assessment"),
        )
        items: list[dict] = resp.get("Items", [])
        while "LastEvaluatedKey" in resp:
            resp = QUESTIONS_T.query(
                KeyConditionExpression=Key("tenantId").eq(tenant_id),
                FilterExpression=Attr("type").eq("assessment"),
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            items.extend(resp.get("Items", []))
        return items
    except ClientError as exc:
        logger.error("Failed to fetch questions for tenant %s: %s", tenant_id, exc)
        raise


# ── Route handlers ────────────────────────────────────────────────────────────

def _list_questions(tenant_id: str, user_id: str) -> dict:
    """GET /api/lms/assessment/questions"""
    try:
        questions = _fetch_all_questions(tenant_id)

        # Shuffle order for each user session (keep questionId and number intact for scoring).
        # shuffleIndex reflects the display position in this attempt (1-based).
        random.shuffle(questions)

        # Strip correctLabel / score data before returning to client.
        # Schema answers = [{label, text, score}] — send label and text only.
        safe_questions = []
        for shuffle_idx, q in enumerate(questions, start=1):
            safe_answers = [
                {"label": a.get("label", ""), "text": a.get("text", "")}
                for a in (q.get("answers") or [])
            ]
            safe_questions.append(
                {
                    "questionId": q.get("questionId"),
                    "text": q.get("text", ""),
                    "answers": safe_answers,
                    "domain": q.get("domain", ""),
                    "number": q.get("number"),
                    "order": q.get("order"),
                    "shuffleIndex": shuffle_idx,
                }
            )
        return ok({"questions": safe_questions, "total": len(safe_questions)})
    except ClientError:
        return err(500, "Failed to load questions")


def _submit_assessment(event: dict, tenant_id: str, user_id: str) -> dict:
    """POST /api/lms/assessment/submit

    Expected body:
      {
        "answers": [
          {"questionId": "<uuid>", "selectedLabel": "A"},
          ...
        ]
      }

    Scores are looked up from DynamoDB — client-provided scores are ignored.
    Completing all 40 questions unlocks ALL modules regardless of score.
    The scorecard result tells users where to focus, not whether they can proceed.
    """
    body = get_body(event)
    raw_answers: list = body.get("answers", [])

    if not isinstance(raw_answers, list) or not raw_answers:
        return err(400, "answers must be a non-empty list")

    # Basic structural validation — each answer must have questionId + selectedLabel
    seen_ids: set[str] = set()
    for ans in raw_answers:
        if not isinstance(ans, dict):
            return err(400, "Each answer must be an object")
        if "questionId" not in ans or "selectedLabel" not in ans:
            return err(400, "Each answer requires questionId and selectedLabel")
        seen_ids.add(str(ans["questionId"]))

    # Enforce exactly 40 unique questions answered
    if len(seen_ids) != REQUIRED_QUESTION_COUNT:
        return err(
            400,
            f"Expected {REQUIRED_QUESTION_COUNT} unique questions answered, "
            f"got {len(seen_ids)}",
        )

    # Fetch authoritative question data to score server-side
    try:
        all_questions = _fetch_all_questions(tenant_id)
    except ClientError:
        return err(500, "Failed to load questions for scoring")

    if not all_questions:
        return err(500, "No assessment questions found for this tenant")

    # Validate all submitted questionIds exist in DynamoDB
    question_ids = {str(q["questionId"]) for q in all_questions if "questionId" in q}
    for qid in seen_ids:
        if qid not in question_ids:
            return err(400, f"Unknown questionId: {qid}")

    # Normalise submitted answers to match engine input format
    submitted_answers = [
        {"questionId": str(ans["questionId"]), "selectedLabel": str(ans.get("selectedLabel", "")).strip()}
        for ans in raw_answers
    ]

    submitted_at = datetime.now(timezone.utc).isoformat()
    attempt_number = _count_previous_attempts(user_id) + 1

    # Run the Readiness Engine — this is the core scoring algorithm.
    # Returns domain scores, tiers, gaps, module priority, and personalised narrative.
    scorecard = calculate_scorecard(submitted_answers, all_questions, attempt_number)

    # Persist the full response including embedded scorecard.
    # Schema: PK=userId SK=submittedAt
    try:
        RESPONSES_T.put_item(
            Item={
                "userId": user_id,
                "submittedAt": submitted_at,
                "tenantId": tenant_id,
                "overallScore": scorecard["overallScore"],
                "attemptNumber": attempt_number,
                "scorecard": scorecard,
                # Store raw answers for audit / re-scoring if engine changes
                "answers": scorecard["answeredScores"],
            }
        )
    except ClientError as exc:
        logger.error(
            "Failed to store assessment response for user %s: %s", user_id, exc
        )
        return err(500, "Failed to store your submission")

    # Unlock ALL modules (1-6) simultaneously — no pass/fail gate.
    # Every user who completes the assessment gets full course access.
    _unlock_all_modules(user_id, tenant_id)

    logger.info(
        "Assessment submitted — user=%s overallScore=%d%% attempt=%d",
        user_id,
        scorecard["overallScore"],
        attempt_number,
    )

    return ok(
        {
            "submittedAt": submitted_at,
            "attemptNumber": attempt_number,
            "modulesUnlocked": True,
            "message": "All modules unlocked. Your personalised plan is ready.",
            "scorecard": scorecard,
        }
    )


def _get_status(user_id: str) -> dict:
    """GET /api/lms/assessment/status — latest attempt including full scorecard."""
    try:
        latest = _get_latest_response(user_id)
        if not latest:
            return ok({"attempted": False, "latestResult": None})
        return ok(
            {
                "attempted": True,
                "latestResult": {
                    "overallScore": latest.get("overallScore", 0),
                    "submittedAt": latest.get("submittedAt"),
                    "attemptNumber": latest.get("attemptNumber", 1),
                    "scorecard": latest.get("scorecard"),
                },
            }
        )
    except ClientError:
        return err(500, "Failed to retrieve assessment status")


def _get_history(user_id: str) -> dict:
    """GET /api/lms/assessment/history — all attempts with overallScore for progress chart."""
    try:
        all_responses = _get_all_responses(user_id)
        # Return lightweight summary per attempt — frontend uses this for the progress chart
        history = [
            {
                "attemptNumber": r.get("attemptNumber", 1),
                "submittedAt": r.get("submittedAt"),
                "overallScore": r.get("overallScore", 0),
                # Include domain-level scores so the chart can show per-domain progress
                "domainScores": {
                    domain: data.get("percentage", 0)
                    for domain, data in (r.get("scorecard") or {}).get("domainScores", {}).items()
                },
            }
            for r in all_responses
        ]
        return ok({"history": history, "totalAttempts": len(history)})
    except ClientError:
        return err(500, "Failed to retrieve assessment history")


# ── Dispatcher ────────────────────────────────────────────────────────────────

def handle(
    event: dict,
    method: str,
    path: str,
    tenant_id: Optional[str],
    email: Optional[str],
    user_id: Optional[str],
    role: Optional[str],
) -> dict:
    auth_err = require_auth(tenant_id, user_id)
    if auth_err:
        return auth_err

    if method == "GET" and path.endswith("/assessment/questions"):
        return _list_questions(tenant_id, user_id)

    if method == "POST" and path.endswith("/assessment/submit"):
        return _submit_assessment(event, tenant_id, user_id)

    if method == "GET" and path.endswith("/assessment/status"):
        return _get_status(user_id)

    if method == "GET" and path.endswith("/assessment/history"):
        return _get_history(user_id)

    return err(404, "Assessment route not found")
