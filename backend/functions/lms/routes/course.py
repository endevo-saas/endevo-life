"""
Course routes — module listings, module detail, video/asset signed URLs.

Business rules:
  - 6 modules total; each module has lockStatus: locked | unlocked | complete.
  - Module config lives in endevo-uat-lms-modules (PK: tenantId, SK: moduleNum).
  - Per-user module status in endevo-uat-lms-user-modules (PK: userId, SK: moduleNum).
    Field: lockStatus (locked|unlocked|complete).
  - All modules are unlocked simultaneously after the user completes the assessment.
  - Videos metadata in endevo-uat-training (PK: tenantId, SK: videoId).
  - Video watch progress in endevo-uat-video-progress (PK: userId, SK: videoId).
  - Inline quiz answers stored in endevo-uat-lms-user-modules under the map
    attribute 'inlineQuizAnswers', keyed by questionId.

Routes handled:
  GET /api/lms/course/modules                    — list 6 modules with user lock/complete status
  GET /api/lms/course/modules/{moduleNum}        — module detail: videos, quizzes, progress
  GET /api/lms/course/video/{videoId}/url        — presigned URL for video (4 h)
  GET /api/lms/course/asset/{key}/url            — presigned URL for PDF asset (1 h)
"""
import json
import logging
import re
from typing import Optional

from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from utils.auth import require_auth
from utils.db import TRAINING_T, QUESTIONS_T, MODULES_T, USER_MODULES_T, VIDEO_PROG_T
from utils.response import ok, err
from utils.s3 import get_video_presigned_url, get_asset_presigned_url

logger = logging.getLogger(__name__)

TOTAL_MODULES: int = 6


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_body(event: dict) -> dict:
    try:
        return json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}


def _get_user_module_status(user_id: str, module_num: str) -> Optional[dict]:
    """Return the user-module record from endevo-uat-lms-user-modules, or None."""
    try:
        resp = USER_MODULES_T.get_item(
            Key={"userId": user_id, "moduleNum": module_num}
        )
        return resp.get("Item")
    except ClientError as exc:
        logger.error("Failed to get user module status: %s", exc)
        raise


def _get_module_config(tenant_id: str, module_num: str) -> Optional[dict]:
    """Return the module config record from endevo-uat-lms-modules, or None."""
    try:
        resp = MODULES_T.get_item(
            Key={"tenantId": tenant_id, "moduleNum": module_num}
        )
        return resp.get("Item")
    except ClientError as exc:
        logger.error("Failed to get module config: %s", exc)
        raise


def _get_videos_for_module(tenant_id: str, module_num: str) -> list[dict]:
    """Query endevo-uat-training for all videos belonging to a given module."""
    try:
        resp = TRAINING_T.query(
            KeyConditionExpression=Key("tenantId").eq(tenant_id),
            FilterExpression=Attr("moduleNum").eq(module_num),
        )
        videos = resp.get("Items", [])
        while "LastEvaluatedKey" in resp:
            resp = TRAINING_T.query(
                KeyConditionExpression=Key("tenantId").eq(tenant_id),
                FilterExpression=Attr("moduleNum").eq(module_num),
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            videos.extend(resp.get("Items", []))
        return sorted(videos, key=lambda v: v.get("order", 0))
    except ClientError as exc:
        logger.error("Failed to query videos for module %s: %s", module_num, exc)
        raise


def _get_inline_questions_for_video(
    tenant_id: str, video_id: str
) -> list[dict]:
    """Return inline quiz questions for a specific video."""
    try:
        resp = QUESTIONS_T.query(
            KeyConditionExpression=Key("tenantId").eq(tenant_id),
            FilterExpression=Attr("type").eq("inline") & Attr("videoId").eq(video_id),
        )
        return resp.get("Items", [])
    except ClientError as exc:
        logger.error(
            "Failed to query inline questions for video %s: %s", video_id, exc
        )
        raise


def _get_video_progress(user_id: str, video_id: str) -> Optional[dict]:
    """Return user's progress record for a single video, or None."""
    try:
        resp = VIDEO_PROG_T.get_item(
            Key={"userId": user_id, "videoId": video_id}
        )
        return resp.get("Item")
    except ClientError as exc:
        logger.error("Failed to get video progress: %s", exc)
        raise


# ── Route handlers ────────────────────────────────────────────────────────────

def _list_modules(tenant_id: str, user_id: str) -> dict:
    """GET /api/lms/course/modules"""
    try:
        modules_resp = MODULES_T.query(
            KeyConditionExpression=Key("tenantId").eq(tenant_id)
        )
        module_configs: dict[str, dict] = {
            str(m["moduleNum"]): m for m in modules_resp.get("Items", [])
        }

        result: list[dict] = []
        for module_num in [str(n) for n in range(1, TOTAL_MODULES + 1)]:
            user_module = _get_user_module_status(user_id, module_num)
            config = module_configs.get(module_num, {})
            # Schema field is lockStatus, default to "locked" when no record exists
            lock_status = "locked"
            if user_module:
                lock_status = user_module.get("lockStatus", "locked")

            result.append(
                {
                    "moduleNum": module_num,
                    "title": config.get("title", f"Module {module_num}"),
                    "description": config.get("description", ""),
                    "lockStatus": lock_status,
                    "completedAt": (user_module or {}).get("completedAt"),
                    "unlockedAt": (user_module or {}).get("unlockedAt"),
                }
            )

        return ok({"modules": result})
    except ClientError:
        return err(500, "Failed to load course modules")


def _get_module_detail(tenant_id: str, user_id: str, module_num: str) -> dict:
    """GET /api/lms/course/modules/{moduleNum}"""
    try:
        # Verify user has access to this module
        user_module = _get_user_module_status(user_id, module_num)
        # Schema field: lockStatus
        if not user_module or user_module.get("lockStatus", "locked") == "locked":
            return err(403, f"Module {module_num} is locked")

        module_config = _get_module_config(tenant_id, module_num)
        if not module_config:
            # Admin hasn't seeded this module yet — return a safe placeholder
            module_config = {
                "title": f"Module {module_num}",
                "description": "Content coming soon.",
                "moduleNum": module_num,
                "tenantId": tenant_id,
            }

        videos = _get_videos_for_module(tenant_id, module_num)
        # Schema: inlineQuizAnswers = {questionId: {selectedLabel, correct, answeredAt}}
        inline_answers: dict = (user_module or {}).get("inlineQuizAnswers") or {}

        # Attach progress and inline quiz data to each video
        enriched_videos = []
        for video in videos:
            video_id = str(video.get("videoId", ""))
            progress = _get_video_progress(user_id, video_id)
            inline_qs = _get_inline_questions_for_video(tenant_id, video_id)

            # Strip correctLabel / scores before sending to client.
            safe_quizzes = [
                {
                    "questionId": q.get("questionId"),
                    "text": q.get("text", ""),
                    "answers": [
                        {"label": a.get("label", ""), "text": a.get("text", "")}
                        for a in (q.get("answers") or [])
                    ],
                    "timestamp": q.get("timestamp"),  # seconds into video
                    # Answered check: inlineQuizAnswers keyed by questionId
                    "answered": str(q.get("questionId")) in inline_answers,
                }
                for q in inline_qs
            ]

            enriched_videos.append(
                {
                    "videoId": video_id,
                    "title": video.get("title", ""),
                    "duration": video.get("duration"),
                    "order": video.get("order", 0),
                    "videoType": video.get("videoType", "main"),
                    "thumbnailKey": video.get("thumbnailKey", ""),
                    "progress": {
                        "percent": int((progress or {}).get("percent", 0)),
                        "completed": bool((progress or {}).get("completed", False)),
                        "lastWatched": (progress or {}).get("lastWatched"),
                    },
                    "inlineQuizzes": safe_quizzes,
                }
            )

        return ok(
            {
                "moduleNum": module_num,
                "title": module_config.get("title", f"Module {module_num}"),
                "description": module_config.get("description", ""),
                "objectives": module_config.get("objectives", []),
                "pdfKey": module_config.get("pdfKey", ""),
                "lockStatus": user_module.get("lockStatus", "unlocked"),
                "videos": enriched_videos,
                "quizScore": user_module.get("quizScore"),
                "completedAt": user_module.get("completedAt"),
            }
        )
    except ClientError:
        return err(500, "Failed to load module detail")


def _get_video_url(tenant_id: str, user_id: str, video_id: str) -> dict:
    """GET /api/lms/course/video/{videoId}/url"""
    try:
        # Fetch video metadata to confirm it exists and belongs to tenant
        resp = TRAINING_T.get_item(
            Key={"tenantId": tenant_id, "videoId": video_id}
        )
        video = resp.get("Item")
        if not video:
            return err(404, "Video not found")

        module_num = str(video.get("moduleNum", ""))
        if module_num:
            user_module = _get_user_module_status(user_id, module_num)
            if not user_module or user_module.get("lockStatus", "locked") == "locked":
                return err(403, "Module is locked — complete the assessment first")

        s3_key: str = video.get("s3Key", "")
        if not s3_key:
            return err(500, "Video storage key is not configured")

        url = get_video_presigned_url(s3_key)
        return ok({"videoId": video_id, "url": url, "expiresIn": 14400})
    except ClientError as exc:
        logger.error("Failed to generate video URL for %s: %s", video_id, exc)
        return err(500, "Failed to generate video URL")


def _get_asset_url(asset_key: str) -> dict:
    """GET /api/lms/course/asset/{key}/url"""
    if not asset_key:
        return err(400, "Asset key is required")
    try:
        url = get_asset_presigned_url(asset_key)
        return ok({"key": asset_key, "url": url, "expiresIn": 3600})
    except ClientError as exc:
        logger.error("Failed to generate asset URL for %s: %s", asset_key, exc)
        return err(500, "Failed to generate asset URL")


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

    # GET /api/lms/course/modules  (must be checked before modules/{moduleNum})
    if method == "GET" and re.search(r"/course/modules$", path):
        return _list_modules(tenant_id, user_id)

    # GET /api/lms/course/modules/{moduleNum}
    module_match = re.search(r"/course/modules/(\w+)$", path)
    if method == "GET" and module_match:
        return _get_module_detail(tenant_id, user_id, module_match.group(1))

    # GET /api/lms/course/video/{videoId}/url
    video_match = re.search(r"/course/video/([^/]+)/url$", path)
    if method == "GET" and video_match:
        return _get_video_url(tenant_id, user_id, video_match.group(1))

    # GET /api/lms/course/asset/{key}/url
    # key may contain slashes — capture everything after /asset/ up to /url
    asset_match = re.search(r"/course/asset/(.+)/url$", path)
    if method == "GET" and asset_match:
        return _get_asset_url(asset_match.group(1))

    return err(404, "Course route not found")
