"""
Lesson quiz routes — in-app quiz engine for lesson-type quizzes.

Business rules:
  - Quiz questions stored in endevo-uat-questions with type="lesson_quiz".
  - Questions grouped by quizId field.
  - Scoring: (correct / total) * 100, pass if >= passThreshold.
  - maxAttempts=0 means unlimited retries.
  - Best score is always preserved; retaking cannot lower it.
  - Quiz completion triggers lesson completion which triggers module auto-complete.

Routes handled:
  GET  /api/lms/lessons/{lessonId}/quiz          — get quiz questions (answers stripped)
  POST /api/lms/lessons/{lessonId}/quiz/submit   — submit quiz attempt, returns score
  GET  /api/lms/lessons/{lessonId}/quiz/results  — get past attempt results
"""
import json
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from utils.auth import require_auth
from utils.db import LESSONS_T, LESSON_PROG_T, QUESTIONS_T
from utils.response import ok, err

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_body(event: dict) -> dict:
    try:
        return json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}


def _paginate_query(table, **kwargs) -> list:
    items = []
    resp = table.query(**kwargs)
    items.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table.query(ExclusiveStartKey=resp["LastEvaluatedKey"], **kwargs)
        items.extend(resp.get("Items", []))
    return items


def _get_lesson_by_id(lesson_id: str) -> Optional[dict]:
    """Fetch a lesson by lessonId via GSI."""
    try:
        resp = LESSONS_T.query(
            IndexName="lessonId-index",
            KeyConditionExpression=Key("lessonId").eq(lesson_id),
        )
        items = resp.get("Items", [])
        return items[0] if items else None
    except ClientError:
        return None


def _decimal_to_num(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: _decimal_to_num(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decimal_to_num(i) for i in obj]
    return obj


# ── GET /api/lms/lessons/{lessonId}/quiz ─────────────────────────────────────

def _get_quiz_questions(
    tenant_id: str, user_id: str, lesson_id: str
) -> dict:
    """Return quiz questions for a lesson. Strip isCorrect from answers."""
    lesson = _get_lesson_by_id(lesson_id)
    if not lesson:
        return err(404, "Lesson not found")

    if lesson.get("lessonType") != "quiz":
        return err(400, "This lesson is not a quiz")

    quiz_id = lesson.get("quizId", "")
    if not quiz_id:
        return err(404, "Quiz not configured for this lesson")

    pass_threshold = lesson.get("passThreshold", 70)
    max_attempts = lesson.get("maxAttempts", 0)

    try:
        # Query questions by tenantId, filter by quizId
        questions = _paginate_query(
            QUESTIONS_T,
            KeyConditionExpression=Key("tenantId").eq(tenant_id),
            FilterExpression=Attr("quizId").eq(quiz_id) & Attr("type").eq("lesson_quiz"),
        )
        questions.sort(key=lambda q: int(q.get("order", q.get("number", 0))))

        # Strip isCorrect from answers for the student view
        sanitized = []
        for q in questions:
            answers = q.get("answers", [])
            safe_answers = []
            for a in answers:
                safe_answers.append({
                    "label": a.get("label", ""),
                    "text": a.get("text", ""),
                })
            sanitized.append({
                "questionId": q.get("questionId", ""),
                "text": q.get("text", ""),
                "questionType": q.get("questionType", "multiple_choice"),
                "order": q.get("order", q.get("number", 0)),
                "answers": safe_answers,
                "points": q.get("points", 1),
            })

        # Get current progress (attempt count, passed status)
        try:
            prog = LESSON_PROG_T.get_item(
                Key={"userId": user_id, "lessonId": lesson_id}
            ).get("Item", {})
        except ClientError:
            prog = {}

        attempts_used = int(prog.get("quizAttempts", 0))
        already_passed = prog.get("passed", False)
        can_retry = max_attempts == 0 or attempts_used < max_attempts

        return ok(_decimal_to_num({
            "quizId": quiz_id,
            "lessonId": lesson_id,
            "title": lesson.get("title", ""),
            "passThreshold": pass_threshold,
            "maxAttempts": max_attempts,
            "attemptsUsed": attempts_used,
            "alreadyPassed": already_passed,
            "canRetry": can_retry and not already_passed,
            "questions": sanitized,
            "totalQuestions": len(sanitized),
        }))
    except ClientError as exc:
        logger.error("Failed to get quiz: %s", exc)
        return err(500, "Failed to load quiz")


# ── POST /api/lms/lessons/{lessonId}/quiz/submit ─────────────────────────────

def _submit_quiz(
    event: dict, tenant_id: str, user_id: str, lesson_id: str
) -> dict:
    """Score a quiz attempt and update progress."""
    body = get_body(event)
    answers = body.get("answers", [])
    # answers = [{questionId: "...", selectedLabel: "A"}, ...]

    if not answers:
        return err(400, "answers array is required")

    lesson = _get_lesson_by_id(lesson_id)
    if not lesson:
        return err(404, "Lesson not found")

    if lesson.get("lessonType") != "quiz":
        return err(400, "This lesson is not a quiz")

    quiz_id = lesson.get("quizId", "")
    pass_threshold = int(lesson.get("passThreshold", 70))
    max_attempts = int(lesson.get("maxAttempts", 0))

    # Check attempt limit
    try:
        prog = LESSON_PROG_T.get_item(
            Key={"userId": user_id, "lessonId": lesson_id}
        ).get("Item", {})
    except ClientError:
        prog = {}

    attempts_used = int(prog.get("quizAttempts", 0))
    already_passed = prog.get("passed", False)

    if already_passed:
        return err(400, "You have already passed this quiz")

    if max_attempts > 0 and attempts_used >= max_attempts:
        return err(400, f"Maximum attempts ({max_attempts}) reached")

    # Fetch correct answers
    try:
        questions = _paginate_query(
            QUESTIONS_T,
            KeyConditionExpression=Key("tenantId").eq(tenant_id),
            FilterExpression=Attr("quizId").eq(quiz_id) & Attr("type").eq("lesson_quiz"),
        )
    except ClientError as exc:
        logger.error("Failed to fetch quiz questions: %s", exc)
        return err(500, "Failed to score quiz")

    # Build answer key
    answer_key: dict = {}
    explanations: dict = {}
    for q in questions:
        qid = q.get("questionId", "")
        # Find correct answer(s)
        for a in q.get("answers", []):
            if a.get("isCorrect", False):
                answer_key[qid] = a.get("label", "")
                break
        explanations[qid] = q.get("explanation", "")

    # Score
    total_points = len(answer_key)
    correct = 0
    results = []
    for ans in answers:
        qid = ans.get("questionId", "")
        selected = ans.get("selectedLabel", "")
        is_correct = selected == answer_key.get(qid, "")
        if is_correct:
            correct += 1
        results.append({
            "questionId": qid,
            "selectedLabel": selected,
            "correctLabel": answer_key.get(qid, ""),
            "isCorrect": is_correct,
            "explanation": explanations.get(qid, ""),
        })

    score = round((correct / max(total_points, 1)) * 100)
    passed = score >= pass_threshold
    now = _now_iso()
    new_attempt_count = attempts_used + 1
    best_score = max(score, int(prog.get("bestScore", 0)))

    # Update progress
    try:
        update_expr = (
            "SET quizAttempts = :ac, lastScore = :ls, bestScore = :bs, "
            "passed = :p, #s = :st, updatedAt = :now, "
            "tenantId = :tid, moduleNum = :mn, lessonType = :lt"
        )
        expr_values: dict = {
            ":ac": new_attempt_count,
            ":ls": score,
            ":bs": best_score,
            ":p": passed,
            ":st": "completed" if passed else "in_progress",
            ":now": now,
            ":tid": tenant_id,
            ":mn": lesson.get("moduleNum", ""),
            ":lt": "quiz",
        }

        if passed:
            update_expr += ", completedAt = if_not_exists(completedAt, :now)"

        LESSON_PROG_T.update_item(
            Key={"userId": user_id, "lessonId": lesson_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues=expr_values,
        )

        # Trigger module auto-complete check if passed
        if passed:
            from routes.lessons import _check_module_auto_complete
            _check_module_auto_complete(user_id, tenant_id, lesson_id)

    except ClientError as exc:
        logger.error("Failed to update quiz progress: %s", exc)

    return ok({
        "score": score,
        "passed": passed,
        "passThreshold": pass_threshold,
        "correct": correct,
        "total": total_points,
        "attemptNumber": new_attempt_count,
        "bestScore": best_score,
        "results": results,
    })


# ── GET /api/lms/lessons/{lessonId}/quiz/results ─────────────────────────────

def _get_quiz_results(user_id: str, lesson_id: str) -> dict:
    """Return current quiz progress for review."""
    try:
        prog = LESSON_PROG_T.get_item(
            Key={"userId": user_id, "lessonId": lesson_id}
        ).get("Item", {})

        if not prog:
            return ok({"attempts": 0, "bestScore": 0, "passed": False})

        return ok(_decimal_to_num({
            "lessonId": lesson_id,
            "attempts": prog.get("quizAttempts", 0),
            "lastScore": prog.get("lastScore", 0),
            "bestScore": prog.get("bestScore", 0),
            "passed": prog.get("passed", False),
            "completedAt": prog.get("completedAt", ""),
        }))
    except ClientError as exc:
        logger.error("Failed to get quiz results: %s", exc)
        return err(500, "Failed to get quiz results")


# ── Dispatcher ───────────────────────────────────────────────────────────────

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

    if role == "GLOBAL_ADMIN":
        tenant_id = "SYSTEM"

    # POST /api/lms/lessons/{lessonId}/quiz/submit
    submit_match = re.search(r"/lessons/([^/]+)/quiz/submit$", path)
    if method == "POST" and submit_match:
        return _submit_quiz(event, tenant_id, user_id, submit_match.group(1))

    # GET /api/lms/lessons/{lessonId}/quiz/results
    results_match = re.search(r"/lessons/([^/]+)/quiz/results$", path)
    if method == "GET" and results_match:
        return _get_quiz_results(user_id, results_match.group(1))

    # GET /api/lms/lessons/{lessonId}/quiz
    quiz_match = re.search(r"/lessons/([^/]+)/quiz$", path)
    if method == "GET" and quiz_match:
        return _get_quiz_questions(tenant_id, user_id, quiz_match.group(1))

    return err(404, "Quiz route not found")
