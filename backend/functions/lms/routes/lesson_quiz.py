"""
Lesson quiz routes — supports four quiz modes:

1. **likert_scale** (self-assessment): 1-5 rating per question, no right/wrong,
   completion = all questions answered. Score = average rating.
2. **multiple_choice** (knowledge test): pick correct answer, pass/fail threshold.
3. **open_text** (free-form text): user types responses into text fields,
   completion = all required fields answered. No scoring / no pass-fail.
4. **checklist** (action verification): Check / Not Yet per item,
   completion = all items answered. No pass/fail — tracks what's done vs not yet.

Business rules:
  - Quiz questions stored in endevo-uat-questions with type="lesson_quiz".
  - Questions grouped by quizId field.
  - quizMode on the lesson record: "likert_scale" | "multiple_choice" | "open_text" | "checklist".
  - Likert/checklist quizzes always pass on completion (no threshold).
  - Multiple choice: scoring = (correct / total) * 100, pass if >= passThreshold.
  - Open text: always completes on submission (all required fields answered).

Routes handled:
  GET  /api/lms/lessons/{lessonId}/quiz          — get quiz questions
  POST /api/lms/lessons/{lessonId}/quiz/submit   — submit quiz attempt
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
    """Return quiz questions for a lesson."""
    lesson = _get_lesson_by_id(lesson_id)
    if not lesson:
        return err(404, "Lesson not found")

    if lesson.get("lessonType") != "quiz":
        return err(400, "This lesson is not a quiz")

    quiz_id = lesson.get("quizId", "")
    if not quiz_id:
        return err(404, "Quiz not configured for this lesson")

    quiz_mode = lesson.get("quizMode", "multiple_choice")
    pass_threshold = lesson.get("passThreshold", 70)
    max_attempts = lesson.get("maxAttempts", 0)

    try:
        questions = _paginate_query(
            QUESTIONS_T,
            KeyConditionExpression=Key("tenantId").eq(tenant_id),
            FilterExpression=Attr("quizId").eq(quiz_id) & Attr("type").eq("lesson_quiz"),
        )
        # Fallback to SYSTEM quiz questions if tenant has none
        if not questions and tenant_id != "SYSTEM":
            questions = _paginate_query(
                QUESTIONS_T,
                KeyConditionExpression=Key("tenantId").eq("SYSTEM"),
                FilterExpression=Attr("quizId").eq(quiz_id) & Attr("type").eq("lesson_quiz"),
            )
        questions.sort(key=lambda q: int(q.get("order", q.get("number", 0))))

        sanitized = []
        for q in questions:
            q_type = q.get("questionType", "multiple_choice")
            item = {
                "questionId": q.get("questionId", ""),
                "title": q.get("title", ""),
                "text": q.get("text", ""),
                "questionType": q_type,
                "order": q.get("order", q.get("number", 0)),
            }

            if q_type == "likert_scale":
                item["scaleMin"] = q.get("scaleMin", 1)
                item["scaleMax"] = q.get("scaleMax", 5)
                item["scaleMinLabel"] = q.get("scaleMinLabel", "Not at all accurate")
                item["scaleMidLabel"] = q.get("scaleMidLabel", "Somewhat accurate")
                item["scaleMaxLabel"] = q.get("scaleMaxLabel", "Very accurate")
            elif q_type == "open_text":
                # Free-form text fields (e.g. trusted people, emergency contacts)
                item["fields"] = [
                    {
                        "fieldId": f.get("fieldId", ""),
                        "label": f.get("label", ""),
                        "placeholder": f.get("placeholder", ""),
                        "required": bool(f.get("required", True)),
                    }
                    for f in q.get("fields", [])
                ]
            elif q_type == "checklist":
                # Action verification: Check / Not Yet per item
                item["answers"] = [
                    {"label": a.get("label", ""), "text": a.get("text", "")}
                    for a in q.get("answers", [])
                ]
            else:
                # Multiple choice — strip isCorrect
                answers = q.get("answers", [])
                item["answers"] = [
                    {"label": a.get("label", ""), "text": a.get("text", "")}
                    for a in answers
                ]
                item["points"] = q.get("points", 1)

            sanitized.append(item)

        # Get current progress
        try:
            prog = LESSON_PROG_T.get_item(
                Key={"userId": user_id, "lessonId": lesson_id}
            ).get("Item", {})
        except ClientError:
            prog = {}

        attempts_used = int(prog.get("quizAttempts", 0))
        already_completed = prog.get("status") == "completed"

        return ok(_decimal_to_num({
            "quizId": quiz_id,
            "lessonId": lesson_id,
            "title": lesson.get("title", ""),
            "quizMode": quiz_mode,
            "passThreshold": pass_threshold,
            "maxAttempts": max_attempts,
            "attemptsUsed": attempts_used,
            "alreadyCompleted": already_completed,
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
    """Score a quiz attempt. Handles both likert_scale and multiple_choice."""
    body = get_body(event)
    answers = body.get("answers", [])

    if not answers:
        return err(400, "answers array is required")

    lesson = _get_lesson_by_id(lesson_id)
    if not lesson:
        return err(404, "Lesson not found")

    if lesson.get("lessonType") != "quiz":
        return err(400, "This lesson is not a quiz")

    quiz_id = lesson.get("quizId", "")
    quiz_mode = lesson.get("quizMode", "multiple_choice")
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
    already_completed = prog.get("status") == "completed"

    if already_completed and quiz_mode in ("likert_scale", "open_text", "checklist"):
        return err(400, "You have already completed this assessment")

    if quiz_mode == "multiple_choice":
        if prog.get("passed", False):
            return err(400, "You have already passed this quiz")
        if max_attempts > 0 and attempts_used >= max_attempts:
            return err(400, f"Maximum attempts ({max_attempts}) reached")

    # Fetch questions (with SYSTEM fallback)
    try:
        questions = _paginate_query(
            QUESTIONS_T,
            KeyConditionExpression=Key("tenantId").eq(tenant_id),
            FilterExpression=Attr("quizId").eq(quiz_id) & Attr("type").eq("lesson_quiz"),
        )
        if not questions and tenant_id != "SYSTEM":
            questions = _paginate_query(
                QUESTIONS_T,
                KeyConditionExpression=Key("tenantId").eq("SYSTEM"),
                FilterExpression=Attr("quizId").eq(quiz_id) & Attr("type").eq("lesson_quiz"),
            )
    except ClientError as exc:
        logger.error("Failed to fetch quiz questions: %s", exc)
        return err(500, "Failed to score quiz")

    now = _now_iso()
    new_attempt_count = attempts_used + 1

    # ── LIKERT SCALE SCORING ──
    if quiz_mode == "likert_scale":
        # answers = [{questionId: "...", rating: 3}, ...]
        answer_map = {a.get("questionId", ""): int(a.get("rating", 0)) for a in answers}
        total_questions = len(questions)
        total_rating = sum(answer_map.values())
        avg_rating = round(total_rating / max(total_questions, 1), 1)
        max_possible = total_questions * 5

        # Build per-question results
        results = []
        for q in sorted(questions, key=lambda x: int(x.get("order", 0))):
            qid = q.get("questionId", "")
            results.append({
                "questionId": qid,
                "title": q.get("title", ""),
                "text": q.get("text", ""),
                "rating": answer_map.get(qid, 0),
            })

        # Likert always completes (self-assessment, no pass/fail)
        try:
            LESSON_PROG_T.update_item(
                Key={"userId": user_id, "lessonId": lesson_id},
                UpdateExpression=(
                    "SET quizAttempts = :ac, lastScore = :ls, bestScore = :bs, "
                    "passed = :p, #s = :st, updatedAt = :now, "
                    "completedAt = if_not_exists(completedAt, :now), "
                    "tenantId = :tid, moduleNum = :mn, lessonType = :lt, "
                    "quizMode = :qm, likertResponses = :lr"
                ),
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":ac": new_attempt_count,
                    ":ls": Decimal(str(avg_rating)),
                    ":bs": Decimal(str(avg_rating)),
                    ":p": True,
                    ":st": "completed",
                    ":now": now,
                    ":tid": tenant_id,
                    ":mn": lesson.get("moduleNum", ""),
                    ":lt": "quiz",
                    ":qm": "likert_scale",
                    ":lr": answer_map,
                },
            )
            from routes.lessons import _check_module_auto_complete
            _check_module_auto_complete(user_id, tenant_id, lesson_id)
        except ClientError as exc:
            logger.error("Failed to update likert progress: %s", exc)

        return ok({
            "quizMode": "likert_scale",
            "totalQuestions": total_questions,
            "totalRating": total_rating,
            "maxPossible": max_possible,
            "averageRating": avg_rating,
            "completed": True,
            "results": results,
        })

    # ── OPEN TEXT SCORING ──
    if quiz_mode == "open_text":
        # answers = [{questionId: "...", responses: [{fieldId: "f1", value: "John"}, ...]}, ...]
        # Validate: all required fields must have a non-empty value
        q_map = {q.get("questionId", ""): q for q in questions}

        for ans in answers:
            qid = ans.get("questionId", "")
            q_def = q_map.get(qid, {})
            responses_map = {
                r.get("fieldId", ""): r.get("value", "").strip()
                for r in ans.get("responses", [])
            }
            for field in q_def.get("fields", []):
                if field.get("required", True) and not responses_map.get(field.get("fieldId", "")):
                    return err(
                        400,
                        f"Required field '{field.get('label', field.get('fieldId', ''))}' is empty",
                    )

        # Store responses securely — no scoring, always completes
        open_text_responses = [
            {
                "questionId": ans.get("questionId", ""),
                "responses": ans.get("responses", []),
            }
            for ans in answers
        ]

        try:
            LESSON_PROG_T.update_item(
                Key={"userId": user_id, "lessonId": lesson_id},
                UpdateExpression=(
                    "SET quizAttempts = :ac, lastScore = :ls, bestScore = :bs, "
                    "passed = :p, #s = :st, updatedAt = :now, "
                    "completedAt = if_not_exists(completedAt, :now), "
                    "tenantId = :tid, moduleNum = :mn, lessonType = :lt, "
                    "quizMode = :qm, openTextResponses = :otr"
                ),
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":ac": new_attempt_count,
                    ":ls": Decimal("0"),
                    ":bs": Decimal("0"),
                    ":p": True,
                    ":st": "completed",
                    ":now": now,
                    ":tid": tenant_id,
                    ":mn": lesson.get("moduleNum", ""),
                    ":lt": "quiz",
                    ":qm": "open_text",
                    ":otr": open_text_responses,
                },
            )
            from routes.lessons import _check_module_auto_complete
            _check_module_auto_complete(user_id, tenant_id, lesson_id)
        except ClientError as exc:
            logger.error("Failed to update open_text progress: %s", exc)

        return ok({
            "quizMode": "open_text",
            "totalQuestions": len(questions),
            "completed": True,
            "responses": open_text_responses,
        })

    # ── CHECKLIST SCORING ──
    if quiz_mode == "checklist":
        # answers = [{questionId: "...", selectedLabel: "A"}, ...] where A=Check, B=Not Yet
        checklist_responses = []
        for ans in answers:
            qid = ans.get("questionId", "")
            selected = ans.get("selectedLabel", "")
            checklist_responses.append({
                "questionId": qid,
                "selectedLabel": selected,
                "done": selected == "A",
            })

        done_count = sum(1 for r in checklist_responses if r["done"])
        total_items = len(checklist_responses)

        try:
            LESSON_PROG_T.update_item(
                Key={"userId": user_id, "lessonId": lesson_id},
                UpdateExpression=(
                    "SET quizAttempts = :ac, lastScore = :ls, bestScore = :bs, "
                    "passed = :p, #s = :st, updatedAt = :now, "
                    "completedAt = if_not_exists(completedAt, :now), "
                    "tenantId = :tid, moduleNum = :mn, lessonType = :lt, "
                    "quizMode = :qm, checklistResponses = :cr"
                ),
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":ac": new_attempt_count,
                    ":ls": done_count,
                    ":bs": done_count,
                    ":p": True,
                    ":st": "completed",
                    ":now": now,
                    ":tid": tenant_id,
                    ":mn": lesson.get("moduleNum", ""),
                    ":lt": "quiz",
                    ":qm": "checklist",
                    ":cr": checklist_responses,
                },
            )
            from routes.lessons import _check_module_auto_complete
            _check_module_auto_complete(user_id, tenant_id, lesson_id)
        except ClientError as exc:
            logger.error("Failed to update checklist progress: %s", exc)

        return ok({
            "quizMode": "checklist",
            "totalItems": total_items,
            "doneCount": done_count,
            "completed": True,
            "results": checklist_responses,
        })

    # ── MULTIPLE CHOICE SCORING ──
    answer_key: dict = {}
    explanations: dict = {}
    for q in questions:
        qid = q.get("questionId", "")
        for a in q.get("answers", []):
            if a.get("isCorrect", False):
                answer_key[qid] = a.get("label", "")
                break
        explanations[qid] = q.get("explanation", "")

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
    best_score = max(score, int(prog.get("bestScore", 0)))

    try:
        update_expr = (
            "SET quizAttempts = :ac, lastScore = :ls, bestScore = :bs, "
            "passed = :p, #s = :st, updatedAt = :now, "
            "tenantId = :tid, moduleNum = :mn, lessonType = :lt, quizMode = :qm"
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
            ":qm": "multiple_choice",
        }
        if passed:
            update_expr += ", completedAt = if_not_exists(completedAt, :now)"

        LESSON_PROG_T.update_item(
            Key={"userId": user_id, "lessonId": lesson_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues=expr_values,
        )
        if passed:
            from routes.lessons import _check_module_auto_complete
            _check_module_auto_complete(user_id, tenant_id, lesson_id)
    except ClientError as exc:
        logger.error("Failed to update quiz progress: %s", exc)

    return ok({
        "quizMode": "multiple_choice",
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
    try:
        prog = LESSON_PROG_T.get_item(
            Key={"userId": user_id, "lessonId": lesson_id}
        ).get("Item", {})

        if not prog:
            return ok({"attempts": 0, "completed": False})

        return ok(_decimal_to_num({
            "lessonId": lesson_id,
            "quizMode": prog.get("quizMode", "multiple_choice"),
            "attempts": prog.get("quizAttempts", 0),
            "lastScore": prog.get("lastScore", 0),
            "bestScore": prog.get("bestScore", 0),
            "passed": prog.get("passed", False),
            "completed": prog.get("status") == "completed",
            "completedAt": prog.get("completedAt", ""),
            "likertResponses": prog.get("likertResponses", {}),
            "openTextResponses": prog.get("openTextResponses", []),
            "checklistResponses": prog.get("checklistResponses", []),
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

    submit_match = re.search(r"/lessons/([^/]+)/quiz/submit$", path)
    if method == "POST" and submit_match:
        return _submit_quiz(event, tenant_id, user_id, submit_match.group(1))

    results_match = re.search(r"/lessons/([^/]+)/quiz/results$", path)
    if method == "GET" and results_match:
        return _get_quiz_results(user_id, results_match.group(1))

    quiz_match = re.search(r"/lessons/([^/]+)/quiz$", path)
    if method == "GET" and quiz_match:
        return _get_quiz_questions(tenant_id, user_id, quiz_match.group(1))

    return err(404, "Quiz route not found")
