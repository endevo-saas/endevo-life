"""
Lesson routes — ordered lesson sequences within modules.

Business rules:
  - Each module has an ordered list of lessons in endevo-uat-lms-lessons.
  - Lessons have types: video, quiz, pdf, podcast, resource.
  - PK = tenantId, SK = moduleOrder (e.g. "1#001" for module 1, lesson 1).
  - Progress tracked in endevo-uat-lms-lesson-progress (PK=userId, SK=lessonId).
  - Video/podcast complete at 95% watched.
  - Quiz complete when score >= passThreshold.
  - PDF/resource complete on explicit user action.
  - Module completes when ALL required lessons are completed.

Routes handled:
  GET  /api/lms/lessons/module/{moduleNum}      — list lessons for module (with progress)
  GET  /api/lms/lessons/{lessonId}              — single lesson detail + presigned URLs
  POST /api/lms/lessons/{lessonId}/start        — mark lesson as in_progress
  POST /api/lms/lessons/{lessonId}/progress     — update progress (video position etc.)
  POST /api/lms/lessons/{lessonId}/complete     — mark lesson as completed
"""
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from utils.auth import require_auth
from utils.db import LESSONS_T, LESSON_PROG_T, USER_MODULES_T, CERTS_T, MODULES_T
from utils.response import ok, err
from utils.s3 import get_video_presigned_url, get_asset_presigned_url

logger = logging.getLogger(__name__)

VIDEO_COMPLETE_THRESHOLD: int = 95


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decimal_to_num(obj):
    """Convert Decimal to int/float for JSON serialization."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: _decimal_to_num(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decimal_to_num(i) for i in obj]
    return obj


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


# ── GET /api/lms/lessons/module/{moduleNum} ──────────────────────────────────

def _list_module_lessons(
    tenant_id: str, user_id: str, module_num: str
) -> dict:
    """Return ordered lessons for a module, enriched with per-user progress.
    Falls back to SYSTEM lessons if tenant has no custom lessons (shared template).
    """
    try:
        lessons = _paginate_query(
            LESSONS_T,
            KeyConditionExpression=(
                Key("tenantId").eq(tenant_id)
                & Key("moduleOrder").begins_with(f"{module_num}#")
            ),
        )
        # Fallback: if tenant has no custom lessons, use SYSTEM template
        if not lessons and tenant_id != "SYSTEM":
            lessons = _paginate_query(
                LESSONS_T,
                KeyConditionExpression=(
                    Key("tenantId").eq("SYSTEM")
                    & Key("moduleOrder").begins_with(f"{module_num}#")
                ),
            )
        lessons.sort(key=lambda l: l.get("moduleOrder", ""))

        # Filter to active lessons only
        lessons = [l for l in lessons if l.get("isActive", True)]

        # Fetch user progress for all lessons in this module
        progress_map: dict = {}
        try:
            prog_items = _paginate_query(
                LESSON_PROG_T,
                KeyConditionExpression=Key("userId").eq(user_id),
                FilterExpression=Attr("moduleNum").eq(module_num),
            )
            progress_map = {p["lessonId"]: p for p in prog_items}
        except ClientError:
            pass

        result = []
        for lesson in lessons:
            lid = lesson.get("lessonId", "")
            prog = progress_map.get(lid, {})
            result.append({
                "lessonId": lid,
                "moduleNum": module_num,
                "order": lesson.get("order", 0),
                "title": lesson.get("title", ""),
                "description": lesson.get("description", ""),
                "lessonType": lesson.get("lessonType", "video"),
                "durationMinutes": lesson.get("durationMinutes", 0),
                "isRequired": lesson.get("isRequired", True),
                "thumbnailKey": lesson.get("thumbnailKey", ""),
                "status": prog.get("status", "not_started"),
                "percentWatched": prog.get("percentWatched", 0),
                "lastPosition": prog.get("lastPosition", 0),
                "quizPassed": prog.get("passed", False),
                "quizBestScore": prog.get("bestScore", 0),
            })

        completed = sum(1 for r in result if r["status"] == "completed")
        total_required = sum(1 for r in result if r["isRequired"])
        completed_required = sum(
            1 for r in result if r["isRequired"] and r["status"] == "completed"
        )

        return ok({
            "lessons": _decimal_to_num(result),
            "total": len(result),
            "completed": completed,
            "totalRequired": total_required,
            "completedRequired": completed_required,
            "moduleComplete": completed_required >= total_required and total_required > 0,
        })
    except ClientError as exc:
        logger.error("Failed to list lessons: %s", exc)
        return err(500, "Failed to list lessons")


# ── GET /api/lms/lessons/{lessonId} ──────────────────────────────────────────

def _get_lesson_detail(
    tenant_id: str, user_id: str, lesson_id: str
) -> dict:
    """Return full lesson detail with presigned URLs and progress."""
    try:
        # Lookup by GSI
        resp = LESSONS_T.query(
            IndexName="lessonId-index",
            KeyConditionExpression=Key("lessonId").eq(lesson_id),
        )
        items = resp.get("Items", [])
        if not items:
            return err(404, "Lesson not found")

        lesson = items[0]
        lesson_type = lesson.get("lessonType", "video")

        detail: dict = {
            "lessonId": lesson_id,
            "moduleNum": lesson.get("moduleNum", ""),
            "order": lesson.get("order", 0),
            "title": lesson.get("title", ""),
            "description": lesson.get("description", ""),
            "lessonType": lesson_type,
            "durationMinutes": lesson.get("durationMinutes", 0),
            "isRequired": lesson.get("isRequired", True),
            "thumbnailKey": lesson.get("thumbnailKey", ""),
        }

        # Type-specific enrichments
        if lesson_type in ("video", "podcast"):
            s3_key = lesson.get("s3Key", "")
            if s3_key:
                detail["streamUrl"] = get_video_presigned_url(s3_key)
                detail["s3Key"] = s3_key

        elif lesson_type == "pdf":
            asset_key = lesson.get("assetKey", "")
            if asset_key:
                detail["downloadUrl"] = get_asset_presigned_url(asset_key)
                detail["assetKey"] = asset_key
                detail["assetName"] = lesson.get("assetName", "")

        elif lesson_type == "quiz":
            detail["quizId"] = lesson.get("quizId", "")
            detail["passThreshold"] = lesson.get("passThreshold", 70)
            detail["maxAttempts"] = lesson.get("maxAttempts", 0)

        # Fetch user progress
        try:
            prog_resp = LESSON_PROG_T.get_item(
                Key={"userId": user_id, "lessonId": lesson_id}
            )
            prog = prog_resp.get("Item", {})
            detail["progress"] = {
                "status": prog.get("status", "not_started"),
                "lastPosition": prog.get("lastPosition", 0),
                "percentWatched": prog.get("percentWatched", 0),
                "quizAttempts": prog.get("quizAttempts", 0),
                "bestScore": prog.get("bestScore", 0),
                "passed": prog.get("passed", False),
                "startedAt": prog.get("startedAt", ""),
                "completedAt": prog.get("completedAt", ""),
            }
        except ClientError:
            detail["progress"] = {"status": "not_started"}

        # Navigation: find prev/next lessons
        try:
            module_num = lesson.get("moduleNum", "")
            all_lessons = _paginate_query(
                LESSONS_T,
                KeyConditionExpression=(
                    Key("tenantId").eq(tenant_id)
                    & Key("moduleOrder").begins_with(f"{module_num}#")
                ),
            )
            active = sorted(
                [l for l in all_lessons if l.get("isActive", True)],
                key=lambda l: l.get("moduleOrder", ""),
            )
            ids = [l.get("lessonId", "") for l in active]
            idx = ids.index(lesson_id) if lesson_id in ids else -1
            detail["prevLessonId"] = ids[idx - 1] if idx > 0 else None
            detail["nextLessonId"] = ids[idx + 1] if 0 <= idx < len(ids) - 1 else None
        except (ClientError, ValueError):
            detail["prevLessonId"] = None
            detail["nextLessonId"] = None

        return ok(_decimal_to_num(detail))
    except ClientError as exc:
        logger.error("Failed to get lesson: %s", exc)
        return err(500, "Failed to get lesson")


# ── POST /api/lms/lessons/{lessonId}/start ───────────────────────────────────

def _start_lesson(user_id: str, lesson_id: str, tenant_id: str) -> dict:
    """Mark a lesson as in_progress if not already started."""
    try:
        # Get lesson metadata for moduleNum
        resp = LESSONS_T.query(
            IndexName="lessonId-index",
            KeyConditionExpression=Key("lessonId").eq(lesson_id),
        )
        items = resp.get("Items", [])
        if not items:
            return err(404, "Lesson not found")

        lesson = items[0]
        now = _now_iso()

        LESSON_PROG_T.update_item(
            Key={"userId": user_id, "lessonId": lesson_id},
            UpdateExpression=(
                "SET #s = if_not_exists(#s, :ip), "
                "tenantId = :tid, "
                "moduleNum = :mn, "
                "lessonType = :lt, "
                "startedAt = if_not_exists(startedAt, :now), "
                "updatedAt = :now"
            ),
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":ip": "in_progress",
                ":tid": tenant_id,
                ":mn": lesson.get("moduleNum", ""),
                ":lt": lesson.get("lessonType", "video"),
                ":now": now,
            },
        )
        return ok({"message": "Lesson started", "lessonId": lesson_id})
    except ClientError as exc:
        logger.error("Failed to start lesson: %s", exc)
        return err(500, "Failed to start lesson")


# ── POST /api/lms/lessons/{lessonId}/progress ────────────────────────────────

def _update_lesson_progress(
    event: dict, user_id: str, lesson_id: str, tenant_id: str
) -> dict:
    """Update progress for a video/podcast lesson (position, percent)."""
    body = get_body(event)
    last_position = body.get("lastPosition", 0)
    percent_watched = body.get("percentWatched", 0)
    now = _now_iso()

    # Lookup lesson to get moduleNum for the progress record GSI
    lesson_meta = None
    try:
        resp = LESSONS_T.query(
            IndexName="lessonId-index",
            KeyConditionExpression=Key("lessonId").eq(lesson_id),
        )
        items = resp.get("Items", [])
        if items:
            lesson_meta = items[0]
    except ClientError:
        pass
    module_num = lesson_meta.get("moduleNum", "") if lesson_meta else ""

    try:
        # Auto-complete if watched >= threshold
        if int(percent_watched) >= VIDEO_COMPLETE_THRESHOLD:
            status = "completed"
            update_expr = (
                "SET lastPosition = :lp, percentWatched = :pw, "
                "#s = :comp, updatedAt = :now, "
                "completedAt = if_not_exists(completedAt, :now), "
                "tenantId = :tid, moduleNum = :mn, lessonType = :lt"
            )
            expr_values: dict = {
                ":lp": Decimal(str(last_position)),
                ":pw": Decimal(str(percent_watched)),
                ":now": now,
                ":comp": "completed",
                ":tid": tenant_id,
                ":mn": module_num,
                ":lt": lesson_meta.get("lessonType", "video") if lesson_meta else "video",
            }
        else:
            status = "in_progress"
            update_expr = (
                "SET lastPosition = :lp, percentWatched = :pw, "
                "#s = if_not_exists(#s, :ip), updatedAt = :now, "
                "tenantId = :tid, moduleNum = :mn, lessonType = :lt"
            )
            expr_values = {
                ":lp": Decimal(str(last_position)),
                ":pw": Decimal(str(percent_watched)),
                ":now": now,
                ":ip": "in_progress",
                ":tid": tenant_id,
                ":mn": module_num,
                ":lt": lesson_meta.get("lessonType", "video") if lesson_meta else "video",
            }

        LESSON_PROG_T.update_item(
            Key={"userId": user_id, "lessonId": lesson_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues=expr_values,
        )

        # Check module auto-complete if this lesson just completed
        if status == "completed":
            _check_module_auto_complete(user_id, tenant_id, lesson_id)

        return ok({
            "message": "Progress updated",
            "lessonId": lesson_id,
            "percentWatched": percent_watched,
            "status": status,
        })
    except ClientError as exc:
        logger.error("Failed to update progress: %s", exc)
        return err(500, "Failed to update progress")


# ── POST /api/lms/lessons/{lessonId}/complete ────────────────────────────────

def _complete_lesson(user_id: str, lesson_id: str, tenant_id: str) -> dict:
    """Explicitly mark a lesson as completed (for PDF/resource types)."""
    now = _now_iso()
    try:
        # Get lesson metadata
        resp = LESSONS_T.query(
            IndexName="lessonId-index",
            KeyConditionExpression=Key("lessonId").eq(lesson_id),
        )
        items = resp.get("Items", [])
        if not items:
            return err(404, "Lesson not found")

        lesson = items[0]

        LESSON_PROG_T.update_item(
            Key={"userId": user_id, "lessonId": lesson_id},
            UpdateExpression=(
                "SET #s = :comp, completedAt = if_not_exists(completedAt, :now), "
                "updatedAt = :now, tenantId = :tid, moduleNum = :mn, "
                "lessonType = :lt, viewedAt = if_not_exists(viewedAt, :now)"
            ),
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":comp": "completed",
                ":now": now,
                ":tid": tenant_id,
                ":mn": lesson.get("moduleNum", ""),
                ":lt": lesson.get("lessonType", ""),
            },
        )

        _check_module_auto_complete(user_id, tenant_id, lesson_id)

        return ok({"message": "Lesson completed", "lessonId": lesson_id})
    except ClientError as exc:
        logger.error("Failed to complete lesson: %s", exc)
        return err(500, "Failed to complete lesson")


# ── Module auto-complete check ───────────────────────────────────────────────

def _check_module_auto_complete(
    user_id: str, tenant_id: str, lesson_id: str
) -> None:
    """Check if all required lessons in the module are complete.
    If so, mark the user-module record as complete and issue cert for module 6.
    """
    try:
        # Get the lesson to find its moduleNum
        resp = LESSONS_T.query(
            IndexName="lessonId-index",
            KeyConditionExpression=Key("lessonId").eq(lesson_id),
        )
        items = resp.get("Items", [])
        if not items:
            return

        module_num = items[0].get("moduleNum", "")
        if not module_num:
            return

        # Get all required lessons for this module (with SYSTEM fallback)
        all_lessons = _paginate_query(
            LESSONS_T,
            KeyConditionExpression=(
                Key("tenantId").eq(tenant_id)
                & Key("moduleOrder").begins_with(f"{module_num}#")
            ),
        )
        if not all_lessons and tenant_id != "SYSTEM":
            all_lessons = _paginate_query(
                LESSONS_T,
                KeyConditionExpression=(
                    Key("tenantId").eq("SYSTEM")
                    & Key("moduleOrder").begins_with(f"{module_num}#")
                ),
            )
        required = [
            l for l in all_lessons
            if l.get("isRequired", True) and l.get("isActive", True)
        ]

        if not required:
            return

        # Get user progress for these lessons
        required_ids = {l["lessonId"] for l in required}
        prog_items = _paginate_query(
            LESSON_PROG_T,
            KeyConditionExpression=Key("userId").eq(user_id),
            FilterExpression=Attr("moduleNum").eq(module_num),
        )
        completed_ids = {
            p["lessonId"] for p in prog_items if p.get("status") == "completed"
        }

        if not required_ids.issubset(completed_ids):
            return

        # All required lessons complete — mark module complete
        now = _now_iso()
        USER_MODULES_T.update_item(
            Key={"userId": user_id, "moduleNum": module_num},
            UpdateExpression=(
                "SET lockStatus = :c, completedAt = if_not_exists(completedAt, :now), "
                "updatedAt = :now"
            ),
            ExpressionAttributeValues={":c": "complete", ":now": now},
        )
        logger.info("Module %s auto-completed for user %s", module_num, user_id)

        # Certificate for module 6
        if module_num == "6":
            _issue_certificate(user_id, tenant_id, now)

    except ClientError as exc:
        logger.error("Module auto-complete check failed: %s", exc)


def _issue_certificate(user_id: str, tenant_id: str, now: str) -> None:
    """Issue a completion certificate when all 6 modules are done."""
    try:
        cert_id = str(uuid.uuid4())
        CERTS_T.put_item(Item={
            "tenantId": tenant_id,
            "certId": cert_id,
            "userId": user_id,
            "type": "lms_completion",
            "issuedAt": now,
            "status": "active",
        })
        logger.info("Certificate %s issued for user %s", cert_id, user_id)
    except ClientError as exc:
        logger.error("Failed to issue certificate: %s", exc)


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

    # GLOBAL_ADMIN queries SYSTEM tenant
    if role == "GLOBAL_ADMIN":
        tenant_id = "SYSTEM"

    # GET /api/lms/lessons/module/{moduleNum}
    module_match = re.search(r"/lessons/module/(\w+)$", path)
    if method == "GET" and module_match:
        return _list_module_lessons(tenant_id, user_id, module_match.group(1))

    # POST /api/lms/lessons/{lessonId}/start
    start_match = re.search(r"/lessons/([^/]+)/start$", path)
    if method == "POST" and start_match:
        return _start_lesson(user_id, start_match.group(1), tenant_id)

    # POST /api/lms/lessons/{lessonId}/progress
    prog_match = re.search(r"/lessons/([^/]+)/progress$", path)
    if method == "POST" and prog_match:
        return _update_lesson_progress(event, user_id, prog_match.group(1), tenant_id)

    # POST /api/lms/lessons/{lessonId}/complete
    comp_match = re.search(r"/lessons/([^/]+)/complete$", path)
    if method == "POST" and comp_match:
        return _complete_lesson(user_id, comp_match.group(1), tenant_id)

    # GET /api/lms/lessons/{lessonId}
    detail_match = re.search(r"/lessons/([^/]+)$", path)
    if method == "GET" and detail_match:
        return _get_lesson_detail(tenant_id, user_id, detail_match.group(1))

    return err(404, "Lesson route not found")
