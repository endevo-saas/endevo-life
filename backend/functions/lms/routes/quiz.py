"""
Quiz routes — inline quiz popups during video playback.

Business rules:
  - Inline questions stored in endevo-uat-questions with type="inline" and a
    videoId field linking them to a specific video.
  - Answers stored inside the user-module record (endevo-uat-lms-user-modules) under
    the map attribute 'inlineQuizAnswers'.  Key: questionId.
    Value: {selectedLabel, correct, answeredAt}.
  - A user can only submit an answer once per question (idempotent pattern).
  - Schema: endevo-uat-lms-user-modules lockStatus field (not "status").

Routes handled:
  GET  /api/lms/quiz/video/{videoId}   — list inline quiz questions for a video
  POST /api/lms/quiz/answer            — submit a single inline quiz answer
"""
import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from utils.auth import require_auth
from utils.db import QUESTIONS_T, USER_MODULES_T, TRAINING_T
from utils.response import ok, err

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_body(event: dict) -> dict:
    try:
        return json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_module_for_video(tenant_id: str, video_id: str) -> Optional[str]:
    """Return the moduleNum for a given video, or None if not found."""
    try:
        resp = TRAINING_T.get_item(
            Key={"tenantId": tenant_id, "videoId": video_id}
        )
        item = resp.get("Item")
        return str(item["moduleNum"]) if item and "moduleNum" in item else None
    except ClientError as exc:
        logger.error("Failed to look up module for video %s: %s", video_id, exc)
        return None


def _get_user_module(user_id: str, module_num: str) -> Optional[dict]:
    try:
        resp = USER_MODULES_T.get_item(Key={"userId": user_id, "moduleNum": module_num})
        return resp.get("Item")
    except ClientError as exc:
        logger.error("Failed to get user module: %s", exc)
        raise


def _get_correct_label(tenant_id: str, question_id: str) -> Optional[str]:
    """Look up the correctLabel for a question from DynamoDB."""
    try:
        resp = QUESTIONS_T.get_item(
            Key={"tenantId": tenant_id, "questionId": question_id}
        )
        item = resp.get("Item")
        return item.get("correctLabel") if item else None
    except ClientError as exc:
        logger.error(
            "Failed to look up correctLabel for question %s: %s", question_id, exc
        )
        return None


# ── Route handlers ────────────────────────────────────────────────────────────

def _list_quiz_questions(tenant_id: str, user_id: str, video_id: str) -> dict:
    """GET /api/lms/quiz/video/{videoId}"""
    try:
        resp = QUESTIONS_T.query(
            KeyConditionExpression=Key("tenantId").eq(tenant_id),
            FilterExpression=(
                Attr("type").eq("inline") & Attr("videoId").eq(video_id)
            ),
        )
        questions = resp.get("Items", [])

        # Paginate if needed
        while "LastEvaluatedKey" in resp:
            resp = QUESTIONS_T.query(
                KeyConditionExpression=Key("tenantId").eq(tenant_id),
                FilterExpression=(
                    Attr("type").eq("inline") & Attr("videoId").eq(video_id)
                ),
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            questions.extend(resp.get("Items", []))

        # Determine which answers this user has already submitted.
        # Schema: inlineQuizAnswers keyed by questionId.
        module_num = _get_module_for_video(tenant_id, video_id)
        answered_ids: set[str] = set()
        if module_num:
            user_module = _get_user_module(user_id, module_num)
            if user_module:
                answered_ids = set(
                    (user_module.get("inlineQuizAnswers") or {}).keys()
                )

        # Strip correctLabel / scores; annotate answered state
        safe_questions = [
            {
                "questionId": q.get("questionId"),
                "text": q.get("text", ""),
                "answers": [
                    {"label": a.get("label", ""), "text": a.get("text", "")}
                    for a in (q.get("answers") or [])
                ],
                "timestamp": q.get("timestamp"),  # seconds into video
                "answered": str(q.get("questionId", "")) in answered_ids,
            }
            for q in questions
        ]
        return ok({"videoId": video_id, "questions": safe_questions})
    except ClientError:
        return err(500, "Failed to load quiz questions")


def _submit_answer(event: dict, tenant_id: str, user_id: str) -> dict:
    """POST /api/lms/quiz/answer

    Expected body: {videoId, questionId, selectedLabel}

    Persists answer to endevo-uat-lms-user-modules.inlineQuizAnswers[questionId].
    correctLabel is looked up server-side — never trusted from client.
    """
    body = get_body(event)
    video_id: str = str(body.get("videoId", "")).strip()
    question_id: str = str(body.get("questionId", "")).strip()
    selected_label: str = str(body.get("selectedLabel", "")).strip()

    if not video_id:
        return err(400, "videoId is required")
    if not question_id:
        return err(400, "questionId is required")
    if not selected_label:
        return err(400, "selectedLabel is required")

    module_num = _get_module_for_video(tenant_id, video_id)
    if not module_num:
        return err(404, "Video not found or not associated with a module")

    # Confirm user has access to this module
    try:
        user_module = _get_user_module(user_id, module_num)
        if not user_module or user_module.get("lockStatus", "locked") == "locked":
            return err(403, "Module is locked")

        # Idempotent: do not overwrite an existing answer
        existing_answers: dict = user_module.get("inlineQuizAnswers") or {}
        if question_id in existing_answers:
            return ok(
                {
                    "message": "Already answered",
                    "videoId": video_id,
                    "questionId": question_id,
                    "selectedLabel": existing_answers[question_id].get(
                        "selectedLabel"
                    ),
                    "correct": existing_answers[question_id].get("correct"),
                }
            )
    except ClientError:
        return err(500, "Failed to load module data")

    # Look up correct answer server-side
    correct_label = _get_correct_label(tenant_id, question_id)
    is_correct: Optional[bool] = (
        (selected_label == correct_label) if correct_label is not None else None
    )

    answer_record = {
        "selectedLabel": selected_label,
        "correct": is_correct,
        "answeredAt": _now_iso(),
    }

    # Persist the answer into the user-module map.
    # Use if_not_exists to initialise the map if it doesn't exist yet,
    # then SET the specific key — single atomic expression avoids race condition.
    try:
        USER_MODULES_T.update_item(
            Key={"userId": user_id, "moduleNum": module_num},
            UpdateExpression=(
                "SET inlineQuizAnswers = if_not_exists(inlineQuizAnswers, :empty), "
                "inlineQuizAnswers.#qid = :answer"
            ),
            ExpressionAttributeNames={"#qid": question_id},
            ExpressionAttributeValues={
                ":empty": {},
                ":answer": answer_record,
            },
        )
    except ClientError as exc:
        logger.error("Failed to save inline quiz answer: %s", exc)
        return err(500, "Failed to save quiz answer")

    logger.info(
        "Inline quiz answered — user=%s video=%s question=%s correct=%s",
        user_id,
        video_id,
        question_id,
        is_correct,
    )
    return ok(
        {
            "message": "Answer recorded",
            "videoId": video_id,
            "questionId": question_id,
            "selectedLabel": selected_label,
            "correct": is_correct,
        }
    )


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

    # GET /api/lms/quiz/video/{videoId}
    video_match = re.search(r"/quiz/video/([^/]+)$", path)
    if method == "GET" and video_match:
        return _list_quiz_questions(tenant_id, user_id, video_match.group(1))

    # POST /api/lms/quiz/answer
    if method == "POST" and re.search(r"/quiz/answer$", path):
        return _submit_answer(event, tenant_id, user_id)

    return err(404, "Quiz route not found")
