"""
Progress routes — video watch progress and module completion tracking.

Business rules:
  - Video progress stored in endevo-uat-video-progress (PK: userId, SK: videoId).
    Fields: tenantId, moduleNum, percent, percentComplete, completed, lastWatched,
            lastPosition (seconds), updatedAt.
  - A video is 'complete' when watched >= 95%.
  - A module auto-completes when ALL videos >= 95% watched AND all inline quizzes
    answered (checked in _check_module_auto_complete).
  - Schema: endevo-uat-lms-user-modules field is lockStatus (locked|unlocked|complete).
  - Schema: endevo-uat-lms-user-modules inlineQuizAnswers = {questionId: {...}}.
  - Completing Module 6 creates a certificate record in endevo-uat-certificates.
  - Completing a module just marks it complete — all modules were already unlocked
    at assessment time. There is no sequential unlock chain.

Routes handled:
  POST /api/lms/progress/video              — upsert video watch progress (with lastPosition)
  GET  /api/lms/progress/video/{videoId}    — get current progress for a specific video
  GET  /api/lms/progress/module/{moduleNum} — get all progress for a module
  POST /api/lms/progress/module/complete    — manually mark module as complete
"""
import json
import logging
import os
import re
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional

from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from utils.auth import require_auth
from utils.db import (
    VIDEO_PROG_T,
    TRAINING_T,
    QUESTIONS_T,
    USER_MODULES_T,
    CERTS_T,
)
from utils.response import ok, err

logger = logging.getLogger(__name__)

TOTAL_MODULES: int = 6
VIDEO_COMPLETE_THRESHOLD: int = 95   # percent


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_body(event: dict) -> dict:
    try:
        return json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_user_module(user_id: str, module_num: str) -> Optional[dict]:
    try:
        resp = USER_MODULES_T.get_item(Key={"userId": user_id, "moduleNum": module_num})
        return resp.get("Item")
    except ClientError as exc:
        logger.error("Failed to get user module: %s", exc)
        raise


def _get_videos_for_module(tenant_id: str, module_num: str) -> list[dict]:
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
        return videos
    except ClientError as exc:
        logger.error("Failed to get videos for module: %s", exc)
        raise


def _get_inline_questions_for_module(
    tenant_id: str, module_num: str, videos: list[dict]
) -> list[dict]:
    """Return all inline quiz questions across all videos in a module."""
    all_qs: list[dict] = []
    for video in videos:
        video_id = str(video.get("videoId", ""))
        try:
            resp = QUESTIONS_T.query(
                KeyConditionExpression=Key("tenantId").eq(tenant_id),
                FilterExpression=(
                    Attr("type").eq("inline") & Attr("videoId").eq(video_id)
                ),
            )
            all_qs.extend(resp.get("Items", []))
        except ClientError as exc:
            logger.error(
                "Failed to query inline questions for video %s: %s", video_id, exc
            )
    return all_qs


def _mark_module_complete(
    user_id: str, module_num: str, tenant_id: str, email: Optional[str] = None
) -> None:
    """
    Mark module as complete and issue a certificate if this is Module 6.

    Note: completing a module does NOT unlock the next module — all modules
    were already unlocked when the user completed the assessment.
    """
    now = _now_iso()
    try:
        USER_MODULES_T.update_item(
            Key={"userId": user_id, "moduleNum": module_num},
            UpdateExpression="SET lockStatus = :complete, completedAt = :now",
            ExpressionAttributeValues={":complete": "complete", ":now": now},
        )
    except ClientError as exc:
        logger.error(
            "Failed to mark module %s complete for user %s: %s", module_num, user_id, exc
        )
        raise
    logger.info("Module %s marked complete for user %s", module_num, user_id)

    # Issue certificate on completion of the final module (Module 6: Communicate)
    if int(module_num) == TOTAL_MODULES:
        cert_id = _issue_certificate(user_id, tenant_id, now)
        if email and cert_id:
            try:
                _issue_certificate_email(user_id, tenant_id, email, cert_id, now)
            except Exception as exc:  # noqa: BLE001
                logger.error("Certificate email failed (non-fatal): %s", exc)


def _issue_certificate(user_id: str, tenant_id: str, issued_at: str) -> Optional[str]:
    """Create a certificate record in endevo-uat-certificates.

    Schema: PK=userId SK=issuedAt, fields: tenantId, moduleNum, certificateId, type.
    Returns the certificateId on success, None on failure.
    """
    certificate_id = str(uuid.uuid4())
    try:
        CERTS_T.put_item(
            Item={
                "userId": user_id,
                "issuedAt": issued_at,
                "certificateId": certificate_id,
                "tenantId": tenant_id,
                "moduleNum": str(TOTAL_MODULES),
                "type": "lms_completion",
            }
        )
        logger.info(
            "Certificate issued for user %s certificateId=%s", user_id, certificate_id
        )
        return certificate_id
    except ClientError as exc:
        logger.error("Failed to issue certificate for user %s: %s", user_id, exc)
        return None


def _issue_certificate_email(
    user_id: str, tenant_id: str, email: str, cert_id: str, issued_at: str
) -> None:
    """Send certificate completion email via SES."""
    import boto3 as _boto3
    ses = _boto3.client("ses", region_name=os.environ.get("REGION", "us-east-1"))

    verify_url = f"https://main.d1vgn9nzfx4cxk.amplifyapp.com/certificates/verify/{cert_id}"
    download_url = "https://main.d1vgn9nzfx4cxk.amplifyapp.com/employee/certificates"

    html_body = f"""
    <html>
    <body style="font-family: Georgia, serif; background: #0D1825; color: #ffffff; padding: 40px; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #2BBFC5; font-size: 28px; margin: 0;">Endevo Life</h1>
        <p style="color: #94a3b8; margin: 4px 0 0;">Digital Legacy Platform</p>
      </div>

      <div style="background: #1e293b; border: 1px solid #2BBFC5; border-radius: 16px; padding: 32px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">&#127942;</div>
        <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 8px;">Certificate of Completion</h2>
        <p style="color: #94a3b8; margin: 0 0 24px;">You have completed the Endevo Life 6-Module Digital Legacy Program</p>

        <div style="background: #0f172a; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="color: #64748b; font-size: 12px; margin: 0 0 4px;">Certificate ID</p>
          <p style="color: #2BBFC5; font-family: monospace; font-size: 14px; margin: 0;">{cert_id}</p>
        </div>

        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px;">
          Issued: {issued_at[:10]}<br>
          Your digital legacy is now protected.
        </p>

        <a href="{download_url}" style="display: inline-block; background: #E8612A; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-right: 12px;">View Certificate</a>
        <a href="{verify_url}" style="display: inline-block; background: transparent; color: #2BBFC5; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; border: 1px solid #2BBFC5;">Verify Certificate</a>
      </div>

      <p style="color: #475569; font-size: 12px; text-align: center; margin-top: 24px;">
        Endevo Life — Protecting families through digital legacy planning.
      </p>
    </body>
    </html>
    """

    ses.send_email(
        Source="noreply@endevo.life",
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": "Your Endevo Life Certificate of Completion", "Charset": "UTF-8"},
            "Body": {
                "Html": {"Data": html_body, "Charset": "UTF-8"},
                "Text": {
                    "Data": (
                        f"Congratulations! You completed the Endevo Life program. "
                        f"Certificate ID: {cert_id}. Verify at: {verify_url}"
                    ),
                    "Charset": "UTF-8",
                },
            },
        },
    )
    logger.info("Certificate email sent to %s cert_id=%s", email, cert_id)


def _check_module_auto_complete(
    user_id: str, module_num: str, tenant_id: str, email: Optional[str] = None
) -> bool:
    """
    Returns True and triggers module completion if all auto-complete conditions
    are met:
      - All videos watched >= 95%
      - All inline quizzes answered

    Note: module quiz score check is handled separately via the quiz route.
    """
    try:
        user_module = _get_user_module(user_id, module_num)
        if not user_module:
            return False

        # Already complete — nothing to do
        if user_module.get("lockStatus", "locked") == "complete":
            return True

        # Module must be unlocked before it can auto-complete
        if user_module.get("lockStatus", "locked") == "locked":
            return False

        videos = _get_videos_for_module(tenant_id, module_num)
        if not videos:
            return False

        # Check all videos completed (percent >= threshold)
        for video in videos:
            video_id = str(video.get("videoId", ""))
            try:
                resp = VIDEO_PROG_T.get_item(
                    Key={"userId": user_id, "videoId": video_id}
                )
                prog = resp.get("Item")
            except ClientError as exc:
                logger.error(
                    "Failed to get video progress for %s: %s", video_id, exc
                )
                return False
            if not prog or int(prog.get("percent", 0)) < VIDEO_COMPLETE_THRESHOLD:
                return False

        # Check all inline quizzes answered.
        # Schema: inlineQuizAnswers = {questionId: {selectedLabel, correct, answeredAt}}
        inline_qs = _get_inline_questions_for_module(tenant_id, module_num, videos)
        answered: dict = user_module.get("inlineQuizAnswers") or {}
        for q in inline_qs:
            question_id = str(q.get("questionId", ""))
            if question_id not in answered:
                return False

        # All conditions met — mark complete
        _mark_module_complete(user_id, module_num, tenant_id, email=email)
        return True
    except ClientError as exc:
        logger.error(
            "Error checking auto-complete for module %s user %s: %s",
            module_num,
            user_id,
            exc,
        )
        return False


# ── Route handlers ────────────────────────────────────────────────────────────

def _update_video_progress(event: dict, tenant_id: str, user_id: str) -> dict:
    """POST /api/lms/progress/video

    Expected body: {videoId, moduleNum, percent, completed, lastPosition}
    lastPosition: seconds (integer) — position to resume from on next watch.
    """
    body = get_body(event)
    video_id: str = str(body.get("videoId", "")).strip()
    module_num: str = str(body.get("moduleNum", "")).strip()
    percent = body.get("percent")
    completed = bool(body.get("completed", False))
    last_position_raw = body.get("lastPosition", 0)

    if not video_id:
        return err(400, "videoId is required")
    if percent is None or not isinstance(percent, (int, float)):
        return err(400, "percent must be a number")
    percent = max(0, min(100, int(percent)))

    # Coerce lastPosition to non-negative Decimal for DynamoDB
    try:
        last_position = Decimal(str(max(0, int(last_position_raw))))
    except (ValueError, TypeError):
        last_position = Decimal("0")

    # Auto-detect completed from threshold
    if percent >= VIDEO_COMPLETE_THRESHOLD:
        completed = True

    now = _now_iso()
    try:
        VIDEO_PROG_T.put_item(
            Item={
                "userId": user_id,
                "videoId": video_id,
                "tenantId": tenant_id,
                "moduleNum": module_num,
                "percent": percent,
                "percentComplete": percent,
                "completed": completed,
                "lastPosition": last_position,
                "lastWatched": now,
                "updatedAt": now,
            }
        )
    except ClientError as exc:
        logger.error("Failed to update video progress: %s", exc)
        return err(500, "Failed to save video progress")

    # Determine which module this video belongs to for auto-complete check.
    # Prefer body-supplied moduleNum; fall back to looking up from TRAINING_T.
    effective_module_num = module_num
    if not effective_module_num:
        try:
            resp = TRAINING_T.get_item(
                Key={"tenantId": tenant_id, "videoId": video_id}
            )
            video_meta = resp.get("Item")
            if video_meta:
                effective_module_num = str(video_meta.get("moduleNum", ""))
        except ClientError:
            logger.warning(
                "Could not look up moduleNum for video %s — skipping auto-complete",
                video_id,
            )

    if completed and effective_module_num:
        try:
            _check_module_auto_complete(user_id, effective_module_num, tenant_id)
        except ClientError:
            # Non-critical: auto-complete can be retried; don't fail the progress save
            logger.warning(
                "Could not check module auto-complete after video progress update"
            )

    logger.info(
        "Video progress saved — user=%s video=%s percent=%d completed=%s lastPosition=%s",
        user_id,
        video_id,
        percent,
        completed,
        last_position,
    )
    return ok(
        {
            "videoId": video_id,
            "percent": percent,
            "percentComplete": percent,
            "completed": completed,
            "lastPosition": int(last_position),
            "savedAt": now,
        }
    )


def _get_module_progress(tenant_id: str, user_id: str, module_num: str) -> dict:
    """GET /api/lms/progress/module/{moduleNum}"""
    try:
        user_module = _get_user_module(user_id, module_num)
        videos = _get_videos_for_module(tenant_id, module_num)

        video_progress = []
        for video in videos:
            video_id = str(video.get("videoId", ""))
            try:
                resp = VIDEO_PROG_T.get_item(
                    Key={"userId": user_id, "videoId": video_id}
                )
                prog = resp.get("Item") or {}
            except ClientError as exc:
                logger.error(
                    "Failed to get video progress for %s: %s", video_id, exc
                )
                prog = {}
            raw_pos = prog.get("lastPosition", 0)
            try:
                last_pos = int(raw_pos)
            except (ValueError, TypeError):
                last_pos = 0
            video_progress.append(
                {
                    "videoId": video_id,
                    "title": video.get("title", ""),
                    "percent": int(prog.get("percent", 0)),
                    "percentComplete": int(prog.get("percentComplete", prog.get("percent", 0))),
                    "completed": bool(prog.get("completed", False)),
                    "lastWatched": prog.get("lastWatched"),
                    "lastPosition": last_pos,
                    "updatedAt": prog.get("updatedAt", prog.get("lastWatched")),
                }
            )

        return ok(
            {
                "moduleNum": module_num,
                "moduleStatus": (user_module or {}).get("lockStatus", "locked"),
                "quizScore": (user_module or {}).get("quizScore"),
                "completedAt": (user_module or {}).get("completedAt"),
                # Return camelCase to match schema field name
                "inlineQuizAnswers": (user_module or {}).get("inlineQuizAnswers") or {},
                "videoProgress": video_progress,
            }
        )
    except ClientError:
        return err(500, "Failed to retrieve module progress")


def _get_video_progress(user_id: str, video_id: str) -> dict:
    """GET /api/lms/progress/video/{videoId}

    Returns the current video progress record for the authenticated user.
    Used by the video player page to resume from lastPosition.
    """
    if not video_id:
        return err(400, "videoId is required")
    try:
        resp = VIDEO_PROG_T.get_item(Key={"userId": user_id, "videoId": video_id})
        prog = resp.get("Item")
        if not prog:
            return ok({"videoId": video_id, "percent": 0, "percentComplete": 0, "completed": False, "lastPosition": 0})

        raw_pos = prog.get("lastPosition", 0)
        try:
            last_pos = int(raw_pos)
        except (ValueError, TypeError):
            last_pos = 0

        return ok(
            {
                "videoId": video_id,
                "percent": int(prog.get("percent", 0)),
                "percentComplete": int(prog.get("percentComplete", prog.get("percent", 0))),
                "completed": bool(prog.get("completed", False)),
                "lastPosition": last_pos,
                "lastWatched": prog.get("lastWatched"),
                "updatedAt": prog.get("updatedAt", prog.get("lastWatched")),
            }
        )
    except ClientError as exc:
        logger.error("Failed to get video progress for %s: %s", video_id, exc)
        return err(500, "Failed to retrieve video progress")


def _complete_module(event: dict, tenant_id: str, user_id: str, email: Optional[str] = None) -> dict:
    """POST /api/lms/progress/module/complete"""
    body = get_body(event)
    module_num: str = str(body.get("moduleNum", "")).strip()

    if not module_num or not module_num.isdigit():
        return err(400, "moduleNum must be a positive integer string")

    try:
        user_module = _get_user_module(user_id, module_num)
        # Schema field: lockStatus
        if not user_module or user_module.get("lockStatus", "locked") == "locked":
            return err(403, f"Module {module_num} is locked and cannot be completed")

        if user_module.get("lockStatus", "locked") == "complete":
            return ok(
                {"message": f"Module {module_num} is already complete", "moduleNum": module_num}
            )

        _mark_module_complete(user_id, module_num, tenant_id, email=email)

        return ok(
            {
                "message": f"Module {module_num} marked complete",
                "moduleNum": module_num,
                "certificateIssued": int(module_num) == TOTAL_MODULES,
            }
        )
    except ClientError:
        return err(500, "Failed to mark module complete")


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

    # POST /api/lms/progress/video
    if method == "POST" and re.search(r"/progress/video$", path):
        return _update_video_progress(event, tenant_id, user_id)

    # GET /api/lms/progress/video/{videoId}  — check before module routes
    video_prog_match = re.search(r"/progress/video/([^/]+)$", path)
    if method == "GET" and video_prog_match:
        return _get_video_progress(user_id, video_prog_match.group(1))

    # POST /api/lms/progress/module/complete  — check before module/{moduleNum} to avoid clash
    if method == "POST" and re.search(r"/progress/module/complete$", path):
        return _complete_module(event, tenant_id, user_id, email=email)

    # GET /api/lms/progress/module/{moduleNum}
    module_match = re.search(r"/progress/module/(\w+)$", path)
    if method == "GET" and module_match:
        return _get_module_progress(tenant_id, user_id, module_match.group(1))

    return err(404, "Progress route not found")
