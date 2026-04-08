"""
Admin routes — super admin / admin CRUD for questions, modules, and user progress.

All routes require role in ("GLOBAL_ADMIN", "HR_ADMIN").

Schema notes:
  - endevo-uat-lms-user-modules: field lockStatus (locked|unlocked|complete).
  - endevo-uat-questions: PK=tenantId SK=questionId.
    answers=[{label,text,score}], correctLabel, type (assessment|inline).
  - endevo-uat-lms-modules: PK=tenantId SK=moduleNum.
    Fields: title, description, videoIds[], pdfKey, objectives[], isActive, status,
            videoCount, thumbnailKey.

Routes handled:
  GET    /api/lms/admin/questions                    — list questions (type filter)
  POST   /api/lms/admin/questions                    — create question
  PUT    /api/lms/admin/questions/{id}               — update question
  DELETE /api/lms/admin/questions/{id}               — delete question
  GET    /api/lms/admin/modules                      — list all module configs (sorted by moduleNum int)
  POST   /api/lms/admin/modules                      — create or update module config
  POST   /api/lms/admin/modules/{moduleNum}/reorder  — change a module's position/number
  GET    /api/lms/admin/users/progress               — list all users with module progress summary
  GET    /api/lms/admin/users/{userId}/progress      — full progress for a specific user
  POST   /api/lms/admin/users/{userId}/unlock        — manually unlock a module for a user
"""
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from utils.auth import require_auth, require_admin
from utils.db import (
    QUESTIONS_T,
    MODULES_T,
    USER_MODULES_T,
    USERS_T,
    VIDEO_PROG_T,
    RESPONSES_T,
    CERTS_T,
    TRAINING_T,
)
from utils.s3 import get_upload_presigned_url, VIDEOS_BUCKET, ASSETS_BUCKET
from utils.response import ok, err

logger = logging.getLogger(__name__)

VALID_QUESTION_TYPES: frozenset[str] = frozenset({"assessment", "inline"})
# Not hardcoded — module count is dynamic, read from endevo-uat-lms-modules


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_body(event: dict) -> dict:
    try:
        return json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _paginate_query(table, **kwargs) -> list[dict]:
    """Run a query and transparently follow pagination."""
    resp = table.query(**kwargs)
    items = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = table.query(
            **{**kwargs, "ExclusiveStartKey": resp["LastEvaluatedKey"]}
        )
        items.extend(resp.get("Items", []))
    return items


def _paginate_scan(table, **kwargs) -> list[dict]:
    """Run a scan and transparently follow pagination."""
    resp = table.scan(**kwargs)
    items = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = table.scan(
            **{**kwargs, "ExclusiveStartKey": resp["LastEvaluatedKey"]}
        )
        items.extend(resp.get("Items", []))
    return items


# ── Question CRUD ─────────────────────────────────────────────────────────────

def _list_questions(event: dict, tenant_id: str) -> dict:
    """GET /api/lms/admin/questions"""
    qs_params = event.get("queryStringParameters") or {}
    type_filter: Optional[str] = qs_params.get("type")

    try:
        filter_expr = None
        if type_filter:
            if type_filter not in VALID_QUESTION_TYPES:
                return err(400, f"type must be one of {sorted(VALID_QUESTION_TYPES)}")
            filter_expr = Attr("type").eq(type_filter)

        kwargs: dict = {
            "KeyConditionExpression": Key("tenantId").eq(tenant_id),
        }
        if filter_expr is not None:
            kwargs["FilterExpression"] = filter_expr

        questions = _paginate_query(QUESTIONS_T, **kwargs)
        return ok({"questions": questions, "total": len(questions)})
    except ClientError:
        return err(500, "Failed to list questions")


def _create_question(event: dict, tenant_id: str) -> dict:
    """POST /api/lms/admin/questions

    Schema: answers=[{label, text, score}], correctLabel.
    """
    body = get_body(event)

    q_type: str = str(body.get("type", "")).strip()
    text: str = str(body.get("text", "")).strip()
    answers: list = body.get("answers", [])

    if not q_type or q_type not in VALID_QUESTION_TYPES:
        return err(400, f"type must be one of {sorted(VALID_QUESTION_TYPES)}")
    if not text:
        return err(400, "text is required")
    if not isinstance(answers, list) or len(answers) < 2:
        return err(400, "answers must be a list with at least 2 items")

    # Validate answer objects
    for a in answers:
        if not isinstance(a, dict) or "label" not in a or "text" not in a:
            return err(400, "Each answer must have 'label' and 'text' fields")

    question_id = str(uuid.uuid4())
    now = _now_iso()

    item: dict = {
        "tenantId": tenant_id,
        "questionId": question_id,
        "type": q_type,
        "text": text,
        "answers": answers,
        "createdAt": now,
        "updatedAt": now,
    }

    # Optional fields
    if q_type == "inline":
        video_id = str(body.get("videoId", "")).strip()
        if not video_id:
            return err(400, "videoId is required for inline questions")
        item["videoId"] = video_id
        timestamp = body.get("timestamp")
        if timestamp is not None:
            item["timestamp"] = int(timestamp)

    domain = str(body.get("domain", "")).strip()
    if domain:
        item["domain"] = domain

    number = body.get("number")
    if number is not None:
        item["number"] = int(number)

    weight = body.get("weight")
    if weight is not None:
        item["weight"] = int(weight)

    correct_label = str(body.get("correctLabel", "")).strip()
    if correct_label:
        item["correctLabel"] = correct_label

    explanation = str(body.get("explanation", "")).strip()
    if explanation:
        item["explanation"] = explanation

    order = body.get("order")
    if order is not None:
        item["order"] = int(order)

    try:
        QUESTIONS_T.put_item(Item=item)
        logger.info(
            "Question created: %s type=%s tenant=%s", question_id, q_type, tenant_id
        )
        return ok(item, status=201)
    except ClientError:
        return err(500, "Failed to create question")


def _update_question(event: dict, tenant_id: str, question_id: str) -> dict:
    """PUT /api/lms/admin/questions/{id}"""
    body = get_body(event)

    update_exprs: list[str] = ["updatedAt = :now"]
    expr_vals: dict = {":now": _now_iso()}
    expr_names: dict = {}

    # Map body field names to DynamoDB expression fields.
    # Fields that are DynamoDB reserved words need expression attribute name aliases.
    allowed_fields: dict[str, str] = {
        "text": "text",
        "answers": "answers",
        "domain": "domain",
        "number": "#num",
        "weight": "weight",
        "correctLabel": "correctLabel",
        "explanation": "explanation",
        "videoId": "videoId",
        "timestamp": "#ts",
        "order": "#ord",
    }
    # Expression attribute name mappings for reserved words
    reserved_aliases: dict[str, str] = {
        "#num": "number",
        "#ts": "timestamp",
        "#ord": "order",
    }

    for field, expr_field in allowed_fields.items():
        if field in body:
            if expr_field.startswith("#"):
                expr_names[expr_field] = reserved_aliases[expr_field]
            update_exprs.append(f"{expr_field} = :{field}")
            expr_vals[f":{field}"] = body[field]

    if len(update_exprs) == 1:
        return err(400, "No updatable fields provided")

    update_expression = "SET " + ", ".join(update_exprs)

    try:
        kwargs: dict = {
            "Key": {"tenantId": tenant_id, "questionId": question_id},
            "UpdateExpression": update_expression,
            "ExpressionAttributeValues": expr_vals,
            "ConditionExpression": "attribute_exists(questionId)",
            "ReturnValues": "ALL_NEW",
        }
        if expr_names:
            kwargs["ExpressionAttributeNames"] = expr_names

        resp = QUESTIONS_T.update_item(**kwargs)
        return ok(resp.get("Attributes", {}))
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return err(404, "Question not found")
        logger.error("Failed to update question %s: %s", question_id, exc)
        return err(500, "Failed to update question")


def _delete_question(tenant_id: str, question_id: str) -> dict:
    """DELETE /api/lms/admin/questions/{id}"""
    try:
        QUESTIONS_T.delete_item(
            Key={"tenantId": tenant_id, "questionId": question_id},
            ConditionExpression="attribute_exists(questionId)",
        )
        logger.info("Question deleted: %s", question_id)
        return ok({"message": "Question deleted", "questionId": question_id})
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return err(404, "Question not found")
        logger.error("Failed to delete question %s: %s", question_id, exc)
        return err(500, "Failed to delete question")


# ── Module config CRUD ────────────────────────────────────────────────────────

def _list_modules(tenant_id: str) -> dict:
    """GET /api/lms/admin/modules"""
    try:
        modules = _paginate_query(
            MODULES_T,
            KeyConditionExpression=Key("tenantId").eq(tenant_id),
        )
        # Sort by moduleNum as integer so Module 10 sorts after Module 9
        modules.sort(key=lambda m: int(m.get("moduleNum", 0)))
        return ok({"modules": modules, "total": len(modules)})
    except ClientError:
        return err(500, "Failed to list modules")


def _upsert_module(event: dict, tenant_id: str) -> dict:
    """POST /api/lms/admin/modules — create or update a module config.

    Schema: PK=tenantId SK=moduleNum.
    Fields: title, description, videoIds[], pdfKey, objectives[], isActive, status.
    """
    body = get_body(event)
    module_num: str = str(body.get("moduleNum", "")).strip()

    if not module_num or not module_num.isdigit():
        return err(400, "moduleNum must be a positive integer string")

    if int(module_num) < 1:
        return err(400, "moduleNum must be a positive integer")

    title: str = str(body.get("title", f"Module {module_num}")).strip()
    now = _now_iso()

    item: dict = {
        "tenantId": tenant_id,
        "moduleNum": module_num,
        "title": title,
        "description": str(body.get("description", "")).strip(),
        "videoIds": body.get("videoIds", []),
        "objectives": body.get("objectives", []),
        "isActive": bool(body.get("isActive", True)),
        "status": str(body.get("status", "draft")).strip(),
        "updatedAt": now,
    }

    pdf_key = str(body.get("pdfKey", "")).strip()
    if pdf_key:
        item["pdfKey"] = pdf_key

    if "quizPassThreshold" in body:
        item["quizPassThreshold"] = int(body["quizPassThreshold"])

    try:
        MODULES_T.put_item(Item=item)
        logger.info("Module config upserted: module=%s tenant=%s", module_num, tenant_id)
        return ok(item)
    except ClientError:
        return err(500, "Failed to save module configuration")


def _reorder_module(event: dict, tenant_id: str, current_module_num: str) -> dict:
    """POST /api/lms/admin/modules/{moduleNum}/reorder

    Change a module's position by updating its moduleNum.
    This creates a new record with the new moduleNum and deletes the old one.
    The old moduleNum must exist; the new moduleNum must not already exist
    unless it is the same record.

    Body: {newModuleNum: "7"}
    """
    body = get_body(event)
    new_module_num: str = str(body.get("newModuleNum", "")).strip()

    if not new_module_num or not new_module_num.isdigit():
        return err(400, "newModuleNum must be a positive integer string")
    if new_module_num == current_module_num:
        return err(400, "newModuleNum must differ from current moduleNum")

    now = _now_iso()
    try:
        # Fetch the existing module config
        resp = MODULES_T.get_item(Key={"tenantId": tenant_id, "moduleNum": current_module_num})
        existing = resp.get("Item")
        if not existing:
            return err(404, f"Module {current_module_num} not found")

        # Write under the new moduleNum
        new_item = {**existing, "moduleNum": new_module_num, "updatedAt": now}
        MODULES_T.put_item(Item=new_item)

        # Remove the old record
        MODULES_T.delete_item(Key={"tenantId": tenant_id, "moduleNum": current_module_num})

        logger.info(
            "Module reordered: %s -> %s tenant=%s",
            current_module_num,
            new_module_num,
            tenant_id,
        )
        return ok(
            {
                "message": f"Module renumbered from {current_module_num} to {new_module_num}",
                "oldModuleNum": current_module_num,
                "newModuleNum": new_module_num,
            }
        )
    except ClientError as exc:
        logger.error(
            "Failed to reorder module %s to %s: %s",
            current_module_num,
            new_module_num,
            exc,
        )
        return err(500, "Failed to reorder module")


# ── User progress views ───────────────────────────────────────────────────────

def _list_users_progress(tenant_id: str) -> dict:
    """GET /api/lms/admin/users/progress — enriched with name, email, score, per-module status."""
    try:
        # All user-module records for this tenant
        user_module_records = _paginate_scan(
            USER_MODULES_T,
            FilterExpression=Attr("tenantId").eq(tenant_id),
        )

        # Enrich with user profile (name + email)
        user_records = _paginate_scan(
            USERS_T,
            FilterExpression=Attr("tenantId").eq(tenant_id),
        )
        user_map: dict[str, dict] = {u.get("userId", ""): u for u in user_records}

        # Latest assessment per user
        all_responses = _paginate_scan(
            RESPONSES_T,
            FilterExpression=Attr("tenantId").eq(tenant_id),
        )
        latest_response: dict[str, dict] = {}
        for resp in all_responses:
            uid = resp.get("userId", "")
            existing = latest_response.get(uid)
            if not existing or resp.get("submittedAt", "") > existing.get("submittedAt", ""):
                latest_response[uid] = resp

        # Group module records by userId
        by_user: dict[str, list] = {}
        for record in user_module_records:
            uid = record.get("userId", "")
            by_user.setdefault(uid, []).append(record)

        summary = []
        for uid, modules in by_user.items():
            user_info = user_map.get(uid, {})
            response = latest_response.get(uid, {})
            scorecard = response.get("scorecard", {})

            completed = [m for m in modules if m.get("lockStatus") == "complete"]
            unlocked = [m for m in modules if m.get("lockStatus") in ("unlocked", "complete")]

            # Per-module status map {"1": "unlocked", "2": "complete", ...}
            module_status: dict[str, str] = {
                m.get("moduleNum", ""): m.get("lockStatus", "locked")
                for m in modules
            }

            last_dates = [
                m.get("completedAt") or m.get("updatedAt", "")
                for m in modules if m.get("completedAt") or m.get("updatedAt")
            ]

            summary.append({
                "userId": uid,
                "email": user_info.get("email", ""),
                "firstName": user_info.get("firstName", ""),
                "lastName": user_info.get("lastName", ""),
                "assessmentScore": scorecard.get("overallScore"),
                "assessmentAttempts": response.get("attemptNumber", 0) if response else 0,
                "assessmentTaken": bool(response),
                "moduleStatus": module_status,
                "modulesUnlocked": len(unlocked),
                "modulesCompleted": len(completed),
                "latestModuleCompleted": (
                    max((int(m["moduleNum"]) for m in completed), default=None)
                ),
                "lastActivity": max(last_dates) if last_dates else None,
                "overallTier": scorecard.get("overallTier", {}),
            })

        summary.sort(key=lambda u: (-u["modulesCompleted"], u.get("lastName", ""), u.get("firstName", "")))
        return ok({"users": summary, "total": len(summary)})
    except ClientError as exc:
        logger.error("Failed to retrieve user progress: %s", exc)
        return err(500, "Failed to retrieve user progress summary")


def _get_user_progress(user_id: str, tenant_id: str) -> dict:
    """GET /api/lms/admin/users/{userId}/progress"""
    try:
        # Module-level records
        module_records = _paginate_query(
            USER_MODULES_T,
            KeyConditionExpression=Key("userId").eq(user_id),
        )

        # Video progress records
        video_records = _paginate_query(
            VIDEO_PROG_T,
            KeyConditionExpression=Key("userId").eq(user_id),
        )

        # Latest assessment (most recent attempt with scorecard)
        resp = RESPONSES_T.query(
            KeyConditionExpression=Key("userId").eq(user_id),
            ScanIndexForward=False,
            Limit=1,
        )
        latest_assessment = (resp.get("Items") or [None])[0]

        # Certificate
        cert_resp = CERTS_T.query(
            KeyConditionExpression=Key("userId").eq(user_id),
            ScanIndexForward=False,
            Limit=1,
        )
        certificate = (cert_resp.get("Items") or [None])[0]

        return ok(
            {
                "userId": user_id,
                "moduleProgress": module_records,
                "videoProgress": video_records,
                "latestAssessment": latest_assessment,
                "certificate": certificate,
            }
        )
    except ClientError:
        return err(500, "Failed to retrieve user progress")


def _manual_unlock(event: dict, target_user_id: str, tenant_id: str) -> dict:
    """POST /api/lms/admin/users/{userId}/unlock — emergency module bypass.

    Schema: endevo-uat-lms-user-modules lockStatus field.
    """
    body = get_body(event)
    module_num: str = str(body.get("moduleNum", "")).strip()
    reason: str = str(body.get("reason", "manual admin override")).strip()

    if not module_num or not module_num.isdigit():
        return err(400, "moduleNum must be a positive integer string")

    now = _now_iso()
    try:
        USER_MODULES_T.put_item(
            Item={
                "userId": target_user_id,
                "moduleNum": module_num,
                "lockStatus": "unlocked",
                "tenantId": tenant_id,
                "unlockedAt": now,
                "unlockedBy": "admin",
                "unlockReason": reason,
            }
        )
        logger.info(
            "Manual unlock — module=%s user=%s reason=%s",
            module_num,
            target_user_id,
            reason,
        )
        return ok(
            {
                "message": (
                    f"Module {module_num} manually unlocked for user {target_user_id}"
                ),
                "moduleNum": module_num,
                "userId": target_user_id,
                "unlockedAt": now,
            }
        )
    except ClientError:
        return err(500, "Failed to unlock module")


# ── Video / PDF upload pipeline ───────────────────────────────────────────────

ALLOWED_LMS_EXTENSIONS: frozenset[str] = frozenset(
    {"mp4", "mov", "webm", "pdf", "jpg", "jpeg", "png", "gif", "webp"}
)

_LMS_CONTENT_TYPE_MAP: dict[str, str] = {
    "mp4": "video/mp4", "mov": "video/quicktime", "webm": "video/webm",
    "pdf": "application/pdf",
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}

def _get_upload_url(event: dict, module_num: str) -> dict:
    """POST /api/lms/admin/modules/{moduleNum}/upload-url

    Body: {fileName, fileType}
    fileType = "video" | "pdf"
    Returns: {uploadUrl, key, bucket, expiresIn}
    """
    body = get_body(event)
    file_name: str = str(body.get("fileName", "")).strip()
    file_type: str = str(body.get("fileType", "")).strip()

    if not file_name:
        return err(400, "fileName is required")
    if file_type not in ("video", "pdf"):
        return err(400, "fileType must be 'video' or 'pdf'")

    # Validate file extension
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext not in ALLOWED_LMS_EXTENSIONS:
        return err(400, f"File extension '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_LMS_EXTENSIONS))}")

    # Derive content type server-side from extension
    content_type = _LMS_CONTENT_TYPE_MAP.get(ext, "application/octet-stream")

    if file_type == "video":
        bucket = VIDEOS_BUCKET
        key = f"modules/module{module_num}/{file_name}"
    else:
        bucket = ASSETS_BUCKET
        key = f"modules/module{module_num}/{file_name}"

    try:
        upload_url = get_upload_presigned_url(bucket, key, content_type)
        return ok({"uploadUrl": upload_url, "key": key, "bucket": bucket, "expiresIn": 900})
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to generate upload URL: %s", exc)
        return err(500, "Failed to generate upload URL")


def _list_module_videos(tenant_id: str, module_num: str) -> dict:
    """GET /api/lms/admin/modules/{moduleNum}/videos"""
    try:
        from boto3.dynamodb.conditions import Key as _Key, Attr as _Attr
        resp = TRAINING_T.query(
            KeyConditionExpression=_Key("tenantId").eq(tenant_id),
            FilterExpression=_Attr("moduleNum").eq(module_num),
        )
        videos = resp.get("Items", [])
        while "LastEvaluatedKey" in resp:
            resp = TRAINING_T.query(
                KeyConditionExpression=_Key("tenantId").eq(tenant_id),
                FilterExpression=_Attr("moduleNum").eq(module_num),
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            videos.extend(resp.get("Items", []))
        videos.sort(key=lambda v: int(v.get("order", 0)))
        return ok({"videos": videos, "total": len(videos)})
    except ClientError:
        return err(500, "Failed to list module videos")


def _add_module_video(event: dict, tenant_id: str, module_num: str) -> dict:
    """POST /api/lms/admin/modules/{moduleNum}/videos

    Body: {videoId, title, description, s3Key, duration, videoType, order, thumbnailKey?}
    videoType = "main" | "action_step"
    """
    body = get_body(event)
    video_id: str = str(body.get("videoId", str(uuid.uuid4()))).strip()
    title: str = str(body.get("title", "")).strip()
    s3_key: str = str(body.get("s3Key", "")).strip()
    video_type: str = str(body.get("videoType", "main")).strip()

    if not title:
        return err(400, "title is required")
    if not s3_key:
        return err(400, "s3Key is required")
    if video_type not in ("main", "action_step"):
        return err(400, "videoType must be 'main' or 'action_step'")

    now = _now_iso()
    item: dict = {
        "tenantId": tenant_id,
        "videoId": video_id,
        "moduleNum": module_num,
        "title": title,
        "description": str(body.get("description", "")).strip(),
        "s3Key": s3_key,
        "duration": str(body.get("duration", "")).strip(),
        "videoType": video_type,
        "order": int(body.get("order", 0)),
        "createdAt": now,
    }
    thumbnail_key = str(body.get("thumbnailKey", "")).strip()
    if thumbnail_key:
        item["thumbnailKey"] = thumbnail_key

    try:
        TRAINING_T.put_item(Item=item)
        # Append videoId to the module's videoIds list
        MODULES_T.update_item(
            Key={"tenantId": tenant_id, "moduleNum": module_num},
            UpdateExpression=(
                "SET videoIds = list_append(if_not_exists(videoIds, :empty), :vid), "
                "videoCount = if_not_exists(videoCount, :zero) + :one, "
                "updatedAt = :now"
            ),
            ExpressionAttributeValues={
                ":vid": [video_id],
                ":empty": [],
                ":zero": 0,
                ":one": 1,
                ":now": now,
            },
        )
        logger.info("Video %s added to module %s tenant=%s", video_id, module_num, tenant_id)
        return ok(item, status=201)
    except ClientError as exc:
        logger.error("Failed to add video: %s", exc)
        return err(500, "Failed to add video")


def _delete_module_video(tenant_id: str, module_num: str, video_id: str) -> dict:
    """DELETE /api/lms/admin/modules/{moduleNum}/videos/{videoId}"""
    try:
        TRAINING_T.delete_item(
            Key={"tenantId": tenant_id, "videoId": video_id},
            ConditionExpression="attribute_exists(videoId)",
        )
        # Remove from module's videoIds list by fetching and rewriting
        resp = MODULES_T.get_item(Key={"tenantId": tenant_id, "moduleNum": module_num})
        mod = resp.get("Item")
        if mod:
            updated_ids = [v for v in (mod.get("videoIds") or []) if v != video_id]
            MODULES_T.update_item(
                Key={"tenantId": tenant_id, "moduleNum": module_num},
                UpdateExpression="SET videoIds = :ids, videoCount = :cnt, updatedAt = :now",
                ExpressionAttributeValues={
                    ":ids": updated_ids,
                    ":cnt": len(updated_ids),
                    ":now": _now_iso(),
                },
            )
        logger.info("Video %s deleted from module %s", video_id, module_num)
        return ok({"deleted": True, "videoId": video_id})
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return err(404, "Video not found")
        logger.error("Failed to delete video %s: %s", video_id, exc)
        return err(500, "Failed to delete video")


def _update_module_pdf(event: dict, tenant_id: str, module_num: str) -> dict:
    """POST /api/lms/admin/modules/{moduleNum}/pdf

    Body: {pdfKey, pdfName}
    """
    body = get_body(event)
    pdf_key: str = str(body.get("pdfKey", "")).strip()
    pdf_name: str = str(body.get("pdfName", "")).strip()

    if not pdf_key:
        return err(400, "pdfKey is required")

    now = _now_iso()
    try:
        MODULES_T.update_item(
            Key={"tenantId": tenant_id, "moduleNum": module_num},
            UpdateExpression="SET pdfKey = :pdfKey, pdfName = :pdfName, updatedAt = :now",
            ExpressionAttributeValues={
                ":pdfKey": pdf_key,
                ":pdfName": pdf_name or pdf_key,
                ":now": now,
            },
        )
        return ok({"moduleNum": module_num, "pdfKey": pdf_key, "pdfName": pdf_name or pdf_key, "updatedAt": now})
    except ClientError as exc:
        logger.error("Failed to update module PDF: %s", exc)
        return err(500, "Failed to update module PDF")


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

    admin_err = require_admin(role)
    if admin_err:
        return admin_err

    # GLOBAL_ADMIN users have tenantId="endevo-global" in DynamoDB but
    # shared/template data lives under tenantId="SYSTEM" in DynamoDB.
    if role == "GLOBAL_ADMIN":
        tenant_id = "SYSTEM"

    # ── Question routes ────────────────────────────────────────────────────────
    # GET/POST /api/lms/admin/questions
    if re.search(r"/admin/questions$", path):
        if method == "GET":
            return _list_questions(event, tenant_id)
        if method == "POST":
            return _create_question(event, tenant_id)

    # PUT/DELETE /api/lms/admin/questions/{id}
    q_id_match = re.search(r"/admin/questions/([^/]+)$", path)
    if q_id_match:
        q_id = q_id_match.group(1)
        if method == "PUT":
            return _update_question(event, tenant_id, q_id)
        if method == "DELETE":
            return _delete_question(tenant_id, q_id)

    # ── Module routes ──────────────────────────────────────────────────────────
    # POST /api/lms/admin/modules/{moduleNum}/reorder  — check before generic modules$ match
    module_reorder_match = re.search(r"/admin/modules/(\w+)/reorder$", path)
    if method == "POST" and module_reorder_match:
        return _reorder_module(event, tenant_id, module_reorder_match.group(1))

    if re.search(r"/admin/modules$", path):
        if method == "GET":
            return _list_modules(tenant_id)
        if method == "POST":
            return _upsert_module(event, tenant_id)

    # ── User progress routes ───────────────────────────────────────────────────
    # GET /api/lms/admin/users/progress  (must be checked before {userId}/progress)
    if method == "GET" and re.search(r"/admin/users/progress$", path):
        return _list_users_progress(tenant_id)

    # GET /api/lms/admin/users/{userId}/progress
    user_prog_match = re.search(r"/admin/users/([^/]+)/progress$", path)
    if method == "GET" and user_prog_match:
        return _get_user_progress(user_prog_match.group(1), tenant_id)

    # POST /api/lms/admin/users/{userId}/unlock
    user_unlock_match = re.search(r"/admin/users/([^/]+)/unlock$", path)
    if method == "POST" and user_unlock_match:
        return _manual_unlock(event, user_unlock_match.group(1), tenant_id)

    # ── Video/PDF upload pipeline ──────────────────────────────────────────────
    # POST /api/lms/admin/modules/{moduleNum}/upload-url
    upload_url_match = re.search(r"/admin/modules/(\w+)/upload-url$", path)
    if method == "POST" and upload_url_match:
        return _get_upload_url(event, upload_url_match.group(1))

    # GET /api/lms/admin/modules/{moduleNum}/videos
    # POST /api/lms/admin/modules/{moduleNum}/videos
    module_videos_match = re.search(r"/admin/modules/(\w+)/videos$", path)
    if module_videos_match:
        mod_num = module_videos_match.group(1)
        if method == "GET":
            return _list_module_videos(tenant_id, mod_num)
        if method == "POST":
            return _add_module_video(event, tenant_id, mod_num)

    # DELETE /api/lms/admin/modules/{moduleNum}/videos/{videoId}
    module_video_del_match = re.search(r"/admin/modules/(\w+)/videos/([^/]+)$", path)
    if method == "DELETE" and module_video_del_match:
        return _delete_module_video(tenant_id, module_video_del_match.group(1), module_video_del_match.group(2))

    # POST /api/lms/admin/modules/{moduleNum}/pdf
    module_pdf_match = re.search(r"/admin/modules/(\w+)/pdf$", path)
    if method == "POST" and module_pdf_match:
        return _update_module_pdf(event, tenant_id, module_pdf_match.group(1))

    return err(404, "Admin route not found")
