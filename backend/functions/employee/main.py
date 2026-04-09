"""
Endevo Life — Employee Lambda (pure boto3, no pip needed)
Routes: dashboard, profile, training list, video progress, assessment, certificates,
        certificate/check, subscription, sessions, progress-summary, upload-url, avatar
"""
import json, os, uuid, boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

REGION   = os.environ.get("AWS_REGION", "us-east-1")
dynamo   = boto3.resource("dynamodb", region_name=REGION)
s3_client = boto3.client("s3", region_name=REGION)
UPLOAD_BUCKET = os.environ.get("S3_UPLOAD_BUCKET", "endevo-uat-uploads")
CF_DOMAIN = os.environ.get("CF_DOMAIN", "")
USERS_T  = dynamo.Table("endevo-uat-users")
TRAIN_T  = dynamo.Table("endevo-uat-training")
PROG_T   = dynamo.Table("endevo-uat-video-progress")
QUEST_T  = dynamo.Table("endevo-uat-questions")
RESP_T   = dynamo.Table("endevo-uat-responses")
CERT_T   = dynamo.Table("endevo-uat-certificates")
SUBSCRIPTIONS_T = dynamo.Table("endevo-uat-subscriptions")
SESSIONS_T = dynamo.Table("endevo-uat-sessions")
TENANTS_T  = dynamo.Table("endevo-uat-tenants")
MODULES_T  = dynamo.Table("endevo-uat-lms-user-modules")
CONFIG_T   = dynamo.Table("endevo-uat-config")

ALLOWED_ORIGINS = [
    "https://uat.endevo.life",
    "https://main.d1vvfv8oltolcf.amplifyapp.com",
    "http://localhost:3000",
]

_current_event = {}

def _get_cors_origin():
    origin = (_current_event.get("headers") or {}).get("origin", "")
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0]

def resp(status, body):
    return {"statusCode": status, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": _get_cors_origin(), "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"}, "body": json.dumps(body, default=str)}

def err(status, msg): return resp(status, {"detail": msg})
def get_body(event):
    try: return json.loads(event.get("body") or "{}")
    except: return {}

# ── Plan Config (DynamoDB-driven with fallback) ──────────────────────────────

_DEFAULT_PLAN_CONFIG = {
    "basic": {
        "planLabel": "Endevo Basic",
        "priceYearly": 299,
        "priceMonthly": 24.92,
        "sessionsTotal": 2,
        "features": [
            "Readiness Assessment",
            "6 Learning Modules",
            "2x 30-min 1:1 Sessions per year",
            "AI Guide (Jesse)",
        ],
    },
    "premium": {
        "planLabel": "Endevo Premium",
        "priceYearly": 499,
        "priceMonthly": 41.58,
        "sessionsTotal": 6,
        "features": [
            "Readiness Assessment",
            "6 Learning Modules",
            "6x 30-min 1:1 Sessions per year",
            "AI Guide (Jesse)",
            "Priority scheduling",
            "Extended session recordings",
        ],
    },
    "premiumFeatures": [
        "Everything in Basic",
        "6x 30-min 1:1 Sessions per year",
        "AI Guide (Jesse)",
        "Priority scheduling",
        "Extended session recordings",
    ],
}

_plan_config_cache: dict = {"data": None, "ts": 0.0}

def _get_plan_config() -> dict:
    """Load plan config from DynamoDB with 5-minute cache, fallback to defaults."""
    import time
    now = time.time()
    if _plan_config_cache["data"] is not None and (now - _plan_config_cache["ts"]) < 300:
        return _plan_config_cache["data"]
    try:
        item = CONFIG_T.get_item(Key={"configKey": "PLAN_CONFIG"}).get("Item")
        if item and "configValue" in item:
            cfg = item["configValue"]
            # Convert Decimal to int/float for JSON safety
            cfg = json.loads(json.dumps(cfg, default=str))
            _plan_config_cache["data"] = cfg
            _plan_config_cache["ts"] = now
            return cfg
    except Exception as e:
        print(f"PLAN_CONFIG_LOAD_ERROR: {e}")
    _plan_config_cache["data"] = _DEFAULT_PLAN_CONFIG
    _plan_config_cache["ts"] = now
    return _DEFAULT_PLAN_CONFIG

def get_caller(event):
    """Extract (tenantId, email, userId) from Bearer token via session or WorkOS JWT."""
    auth_header = (event.get("headers") or {}).get("authorization", "")
    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else auth_header.strip()
    if not token:
        return None, None, None

    # Session token (from OTP login)
    if token.startswith("endevo_"):
        try:
            from boto3.dynamodb.conditions import Key as _SessKey
            result = USERS_T.query(
                IndexName="sessionToken-index",
                KeyConditionExpression=_SessKey("sessionToken").eq(token),
                Limit=1,
            )
            items = result.get("Items", [])
            if items:
                u = items[0]
                # Check session expiry (24h TTL)
                expires = u.get("sessionExpiresAt", "")
                if expires:
                    from datetime import datetime as _dt, timezone as _tz
                    exp_dt = _dt.fromisoformat(expires)
                    if _dt.now(_tz.utc) > exp_dt:
                        return None, None, None
                return u.get("tenantId"), u.get("email"), u.get("userId", "")
        except Exception as e:
            print(f"SESSION_LOOKUP_ERROR: {e}")
        return None, None, None

    # SECURITY: JWT path removed — unverified JWT tokens are not accepted.
    # All authentication MUST go through the DynamoDB session token path (endevo_*).
    # WorkOS JWTs lack RSA signature verification and can be forged.
    print(f"AUTH_REJECTED: Non-session token presented to employee endpoint")
    return None, None, None

def handler(event, context):
    global _current_event
    _current_event = event

    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    if method == "OPTIONS": return resp(200, {})
    body = get_body(event)
    tenant_id, email, user_sub = get_caller(event)
    if not tenant_id: return err(401, "Not authenticated")

    # GET /api/employee/dashboard
    if path.endswith("/dashboard") and method == "GET":
        from boto3.dynamodb.conditions import Key as _Key, Attr as _Attr
        courses_resp = TRAIN_T.query(KeyConditionExpression=_Key("tenantId").eq(tenant_id))
        total_courses = len(courses_resp.get("Items", []))
        progress = PROG_T.scan(FilterExpression=_Attr("userId").eq(user_sub))
        completed = len([p for p in progress.get("Items", []) if p.get("completed")])
        certs = CERT_T.scan(FilterExpression=_Attr("userId").eq(user_sub) & _Attr("tenantId").eq(tenant_id))
        return resp(200, {
            "total_courses":     total_courses,
            "completed_courses": completed,
            "certificates":      len(certs.get("Items", [])),
            "progress_pct":      round((completed / total_courses * 100) if total_courses > 0 else 0, 1)
        })

    # GET /api/employee/profile
    if path.endswith("/profile") and method == "GET":
        from boto3.dynamodb.conditions import Key as _Key
        result = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=_Key("email").eq(email),
        )
        items = [i for i in result.get("Items", []) if i.get("tenantId") == tenant_id]
        if not items: return err(404, "Profile not found")
        profile = {k: v for k, v in items[0].items() if k not in ["inviteToken"]}
        return resp(200, profile)

    # PUT /api/employee/profile
    if path.endswith("/profile") and method == "PUT":
        from boto3.dynamodb.conditions import Key as _Key2
        allowed = ["firstName","lastName","jobTitle","department"]
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates: return err(400, "Nothing to update")
        result = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=_Key2("email").eq(email),
        )
        items = [i for i in result.get("Items", []) if i.get("tenantId") == tenant_id]
        if not items: return err(404, "Profile not found")
        user_id = items[0]["userId"]
        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        return resp(200, {"message": "Profile updated"})

    # GET /api/employee/training
    if path.endswith("/training") and method == "GET":
        from boto3.dynamodb.conditions import Key as _Key, Attr as _Attr
        courses_resp = TRAIN_T.query(KeyConditionExpression=_Key("tenantId").eq(tenant_id))
        courses = courses_resp.get("Items", [])
        progress = PROG_T.scan(FilterExpression=_Attr("userId").eq(user_sub))
        # Build progress map keyed by both videoId and courseId for safety
        prog_map = {}
        for p in progress.get("Items", []):
            prog_map[p.get("videoId", "")] = p
            prog_map[p.get("courseId", "")] = p
        result = []
        for c in courses:
            # videoId is the sort key in training table — use as courseId
            vid = c.get("videoId", c.get("courseId", ""))
            p = prog_map.get(vid, {})
            result.append({
                **c,
                "courseId":    vid,
                "progress_pct": p.get("progressPct", 0),
                "completed":   p.get("completed", False)
            })
        return resp(200, {"courses": result, "count": len(result)})

    # POST /api/employee/progress
    if path.endswith("/progress") and method == "POST":
        course_id   = body.get("course_id") or ""
        progress_pct = body.get("progress_pct") or 0
        completed   = body.get("completed", False)
        if not course_id: return err(400, "course_id required")
        PROG_T.put_item(Item={"userId": user_sub, "videoId": course_id, "progressId": str(uuid.uuid4()), "tenantId": tenant_id, "courseId": course_id, "progressPct": progress_pct, "completed": completed, "updatedAt": datetime.now(timezone.utc).isoformat()})
        return resp(200, {"message": "Progress saved"})

    # GET /api/employee/assessment/{courseId}
    if "/assessment/" in path and method == "GET":
        from boto3.dynamodb.conditions import Attr as _Attr
        course_id = path.split("/")[-1]
        questions = QUEST_T.scan(FilterExpression=_Attr("tenantId").eq(tenant_id) & _Attr("courseId").eq(course_id))
        qs = [{k: v for k, v in q.items() if k != "correctAnswer"} for q in questions.get("Items", [])]
        return resp(200, {"questions": qs, "count": len(qs)})

    # POST /api/employee/assessment/{courseId}/submit
    if "/assessment/" in path and path.endswith("/submit") and method == "POST":
        from boto3.dynamodb.conditions import Attr as _Attr
        parts = path.split("/")
        course_id = parts[-2]
        answers = body.get("answers", {})
        questions = QUEST_T.scan(FilterExpression=_Attr("tenantId").eq(tenant_id) & _Attr("courseId").eq(course_id))
        qs = questions.get("Items", [])
        if not qs: return err(404, "Assessment not found")
        correct = sum(1 for q in qs if answers.get(q["questionId"]) == q.get("correctAnswer"))
        score = round(correct / len(qs) * 100)
        passed = score >= 70
        resp_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        RESP_T.put_item(Item={"responseId": resp_id, "userId": user_sub, "tenantId": tenant_id, "courseId": course_id, "score": score, "passed": passed, "answers": answers, "submittedAt": now})
        if passed:
            cert_id = f"{user_sub}#{course_id}"
            try:
                CERT_T.put_item(
                    Item={"certId": cert_id, "userId": user_sub, "tenantId": tenant_id, "courseId": course_id, "email": email, "score": score, "issuedAt": now},
                    ConditionExpression="attribute_not_exists(certId)"
                )
            except ClientError as e:
                if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                    raise
            # Auto-mark progress as completed
            PROG_T.put_item(Item={"userId": user_sub, "videoId": course_id, "progressId": str(uuid.uuid4()), "tenantId": tenant_id, "courseId": course_id, "progressPct": 100, "completed": True, "updatedAt": now})
        return resp(200, {"score": score, "passed": passed, "correct": correct, "total": len(qs), "certificate_issued": passed})

    # POST /api/employee/certificate/check — Check eligibility and generate certificate
    if path.endswith("/certificate/check") and method == "POST":
        from boto3.dynamodb.conditions import Attr as _Attr
        now = datetime.now(timezone.utc).isoformat()

        # 1. Query all user modules
        mod_result = MODULES_T.scan(
            FilterExpression=_Attr("userId").eq(user_sub) & _Attr("tenantId").eq(tenant_id)
        )
        mod_items = mod_result.get("Items", [])

        # 2. Check if module 6 is completed (lockStatus == "complete" or status == "completed")
        module_6_complete = any(
            (str(m.get("moduleNum", "")) == "6") and
            (m.get("lockStatus") == "complete" or m.get("status") == "completed" or m.get("completed"))
            for m in mod_items
        )
        if not module_6_complete:
            completed_count = len([
                m for m in mod_items
                if m.get("lockStatus") == "complete" or m.get("status") == "completed" or m.get("completed")
            ])
            return resp(200, {
                "eligible": False,
                "message": f"Complete all 6 modules to earn your certificate. {completed_count}/6 completed.",
                "modulesCompleted": completed_count,
                "modulesTotal": 6,
            })

        # 3. Check if certificate already exists (idempotent)
        existing_certs = CERT_T.scan(
            FilterExpression=_Attr("userId").eq(user_sub) & _Attr("tenantId").eq(tenant_id) & _Attr("type").eq("legacy-readiness")
        )
        if existing_certs.get("Items"):
            cert = existing_certs["Items"][0]
            return resp(200, {"eligible": True, "certificate": cert, "message": "Certificate already issued"})

        # 4. Calculate average score from responses
        score = None
        try:
            resp_result = RESP_T.scan(FilterExpression=_Attr("userId").eq(user_sub))
            responses = resp_result.get("Items", [])
            if responses:
                scores = [int(r.get("score", 0)) for r in responses if r.get("score") is not None]
                if scores:
                    score = round(sum(scores) / len(scores))
        except Exception as e:
            print(f"CERT_CHECK_SCORE_ERROR: {e}")

        # 5. Create certificate
        cert_id = f"CERT-{str(uuid.uuid4())[:8]}"
        cert_item = {
            "userId": user_sub,
            "certificateId": cert_id,
            "tenantId": tenant_id,
            "email": email,
            "type": "legacy-readiness",
            "title": "Legacy Readiness Certification",
            "issuedAt": now,
            "status": "issued",
            "completedModules": 6,
        }
        if score is not None:
            cert_item["score"] = score

        try:
            CERT_T.put_item(Item=cert_item)
        except ClientError as e:
            print(f"CERT_CREATE_ERROR: {e}")
            return err(500, "Failed to create certificate")

        return resp(200, {"eligible": True, "certificate": cert_item, "message": "Certificate issued"})

    # GET /api/employee/certificates
    if path.endswith("/certificates") and method == "GET":
        from boto3.dynamodb.conditions import Attr as _Attr
        certs = CERT_T.scan(FilterExpression=_Attr("userId").eq(user_sub) & _Attr("tenantId").eq(tenant_id))
        return resp(200, {"certificates": certs.get("Items", []), "count": len(certs.get("Items", []))})

    # GET /api/employee/subscription
    if path.endswith("/subscription") and method == "GET":
        from boto3.dynamodb.conditions import Key as _Key, Attr as _Attr
        from decimal import Decimal

        plan_cfg = _get_plan_config()
        PLAN_CONFIG = {k: v for k, v in plan_cfg.items() if k in ("basic", "premium")}
        PREMIUM_FEATURES = plan_cfg.get("premiumFeatures", _DEFAULT_PLAN_CONFIG["premiumFeatures"])

        # Determine user plan
        plan = "basic"
        try:
            user_result = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key("email").eq(email),
            )
            user_items = [i for i in user_result.get("Items", []) if i.get("tenantId") == tenant_id]
            if user_items:
                raw_plan = user_items[0].get("plan", "basic") or "basic"
                plan = raw_plan.lower() if isinstance(raw_plan, str) else "basic"
        except Exception as e:
            print(f"SUBSCRIPTION_USER_LOOKUP_ERROR: {e}")

        # Fallback to tenant plan if user has no plan
        if plan == "basic":
            try:
                tenant_result = TENANTS_T.get_item(Key={"tenantId": tenant_id})
                tenant_item = tenant_result.get("Item", {})
                tenant_plan = tenant_item.get("plan", "basic") or "basic"
                if tenant_plan in PLAN_CONFIG:
                    plan = tenant_plan
            except Exception as e:
                print(f"SUBSCRIPTION_TENANT_LOOKUP_ERROR: {e}")

        config = PLAN_CONFIG.get(plan, PLAN_CONFIG["basic"])

        # Count used sessions
        sessions_used = 0
        try:
            session_result = SESSIONS_T.scan(
                FilterExpression=_Attr("userId").eq(user_sub) & _Attr("status").eq("completed")
            )
            sessions_used = len(session_result.get("Items", []))
        except Exception as e:
            print(f"SUBSCRIPTION_SESSIONS_COUNT_ERROR: {e}")

        sessions_total = config["sessionsTotal"]
        return resp(200, {
            "plan": plan,
            "planLabel": config["planLabel"],
            "priceMonthly": config["priceMonthly"],
            "priceYearly": config["priceYearly"],
            "sessionsTotal": sessions_total,
            "sessionsUsed": sessions_used,
            "sessionsRemaining": max(0, sessions_total - sessions_used),
            "features": config["features"],
            "premiumFeatures": PREMIUM_FEATURES,
            "managedBy": "Your Employer",
        })

    # GET /api/employee/sessions
    if path.endswith("/sessions") and method == "GET":
        from boto3.dynamodb.conditions import Key as _Key, Attr as _Attr

        # Determine session quota from user/tenant plan
        plan = "basic"
        try:
            user_result = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key("email").eq(email),
            )
            user_items = [i for i in user_result.get("Items", []) if i.get("tenantId") == tenant_id]
            if user_items:
                plan = user_items[0].get("plan", "basic") or "basic"
        except Exception:
            pass

        if plan == "basic":
            try:
                tenant_result = TENANTS_T.get_item(Key={"tenantId": tenant_id})
                tenant_plan = tenant_result.get("Item", {}).get("plan", "basic") or "basic"
                if tenant_plan in ("basic", "premium"):
                    plan = tenant_plan
            except Exception:
                pass

        total_allowed = 6 if plan == "premium" else 2

        # Fetch session history for this user
        sessions_list = []
        used_count = 0
        try:
            result = SESSIONS_T.scan(
                FilterExpression=_Attr("userId").eq(user_sub)
            )
            raw = sorted(result.get("Items", []), key=lambda s: s.get("scheduledAt", ""), reverse=True)
            for s in raw:
                sessions_list.append({
                    "sessionId": s.get("sessionId", ""),
                    "scheduledAt": s.get("scheduledAt", ""),
                    "status": s.get("status", ""),
                    "coachName": s.get("coachName", ""),
                    "duration": int(s.get("duration", 30)),
                })
            used_count = len([s for s in raw if s.get("status") == "completed"])
        except Exception as e:
            print(f"SESSIONS_LIST_ERROR: {e}")

        return resp(200, {
            "sessions": sessions_list,
            "total": total_allowed,
            "used": used_count,
            "remaining": max(0, total_allowed - used_count),
        })

    # GET /api/employee/progress-summary
    if path.endswith("/progress-summary") and method == "GET":
        from boto3.dynamodb.conditions import Key as _Key, Attr as _Attr

        TIER_MAP = [
            (0, "Not Started"),
            (40, "Getting Started"),
            (60, "On Your Way"),
            (80, "Well Prepared"),
            (100, "Fully Ready"),
        ]

        def _score_to_tier(score: int) -> str:
            tier = "Not Started"
            for threshold, label in TIER_MAP:
                if score >= threshold:
                    tier = label
            return tier

        # Latest readiness assessment
        readiness_score = 0
        last_activity = None
        try:
            resp_result = RESP_T.scan(
                FilterExpression=_Attr("userId").eq(user_sub)
            )
            responses = resp_result.get("Items", [])
            if responses:
                latest = max(responses, key=lambda r: r.get("submittedAt", ""))
                readiness_score = int(latest.get("score", 0))
                last_activity = latest.get("submittedAt")
        except Exception as e:
            print(f"PROGRESS_READINESS_ERROR: {e}")

        # Module completion
        modules_completed = 0
        modules_total = 6
        try:
            mod_result = MODULES_T.scan(
                FilterExpression=_Attr("userId").eq(user_sub) & _Attr("tenantId").eq(tenant_id)
            )
            mod_items = mod_result.get("Items", [])
            modules_completed = len([m for m in mod_items if m.get("completed") or m.get("status") == "completed"])
            # Check last activity from modules too
            for m in mod_items:
                updated = m.get("updatedAt") or m.get("completedAt", "")
                if updated and (last_activity is None or updated > last_activity):
                    last_activity = updated
        except Exception as e:
            print(f"PROGRESS_MODULES_ERROR: {e}")

        overall_progress = round((modules_completed / modules_total * 100) if modules_total > 0 else 0, 1)

        return resp(200, {
            "readinessScore": readiness_score,
            "readinessTier": _score_to_tier(readiness_score),
            "modulesCompleted": modules_completed,
            "modulesTotal": modules_total,
            "overallProgress": overall_progress,
            "lastActivity": last_activity,
        })

    # ── POST /api/employee/upload-url ──────────────────────────────────────
    if path.endswith("/upload-url") and method == "POST":
        import re as _re
        ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

        upload_type = (body.get("type", "") or "").strip().lower()
        filename = (body.get("filename", "") or "").strip()[:255]

        if upload_type != "photo":
            return err(400, "Only type 'photo' is allowed for employees")
        if not filename:
            return err(400, "filename is required")

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            return err(400, f"File extension '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

        safe_filename = _re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
        s3_key = f"uploads/photo/{tenant_id}/{user_sub}_{safe_filename}"

        content_type_map = {
            "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "webp": "image/webp",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")

        try:
            upload_url = s3_client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": UPLOAD_BUCKET,
                    "Key": s3_key,
                    "ContentType": content_type,
                },
                ExpiresIn=300,
            )
        except Exception as e:
            print(f"PRESIGNED_URL_ERROR: {e}")
            return err(500, "Failed to generate upload URL")

        return resp(200, {
            "uploadUrl": upload_url,
            "key": s3_key,
            "expiresIn": 300,
        })

    # ── PUT /api/employee/avatar ─────────────────────────────────────────
    if path.endswith("/avatar") and method == "PUT":
        import re as _re
        avatar_key = (body.get("avatarKey", "") or "").strip()

        if not avatar_key:
            return err(400, "avatarKey is required")

        # Validate the key looks like a valid upload path
        if not avatar_key.startswith("uploads/photo/"):
            return err(400, "Invalid avatar key format")

        # Validate extension
        ext = avatar_key.rsplit(".", 1)[-1].lower() if "." in avatar_key else ""
        if ext not in {"jpg", "jpeg", "png", "gif", "webp"}:
            return err(400, "Invalid avatar file type")

        # Look up user record
        from boto3.dynamodb.conditions import Key as _Key
        result = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=_Key("email").eq(email),
        )
        items = [i for i in result.get("Items", []) if i.get("tenantId") == tenant_id]
        if not items:
            return err(404, "User not found")

        user_id = items[0]["userId"]

        try:
            USERS_T.update_item(
                Key={"userId": user_id},
                UpdateExpression="SET #ak = :ak, #uat = :uat",
                ExpressionAttributeNames={"#ak": "avatarKey", "#uat": "avatarUpdatedAt"},
                ExpressionAttributeValues={
                    ":ak": avatar_key,
                    ":uat": datetime.now(timezone.utc).isoformat(),
                },
            )
        except Exception as e:
            print(f"AVATAR_UPDATE_ERROR: {e}")
            return err(500, "Failed to update avatar")

        # Build display URL
        avatar_url = ""
        if CF_DOMAIN:
            avatar_url = f"https://{CF_DOMAIN}/{avatar_key}"

        return resp(200, {
            "message": "Avatar updated",
            "avatarKey": avatar_key,
            "avatarUrl": avatar_url,
        })

    return err(404, f"Route not found: {method} {path}")
