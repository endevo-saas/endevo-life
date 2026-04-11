"""
Endevo Life — Employee Lambda (pure boto3, no pip needed)
Routes: dashboard, profile, training list, video progress, assessment, certificates,
        certificate/check, subscription, sessions, progress-summary, upload-url, avatar,
        playbook/generate (AI-powered My Playbook with Bedrock),
        email/send-playbook (Personalized assessment email via SES),
        support/question (Q&A via Bedrock), support/faq (FAQ search),
        profile/personal-contact (add personal email/phone),
        verify/personal-email (OTP via SES), verify/personal-phone (OTP via SNS)
"""
import json, os, uuid, boto3
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError

REGION   = os.environ.get("AWS_REGION", "us-east-1")
dynamo   = boto3.resource("dynamodb", region_name=REGION)
s3_client = boto3.client("s3", region_name=REGION)
ses_client = boto3.client("ses", region_name=REGION)
sns_client = boto3.client("sns", region_name=REGION)
UPLOAD_BUCKET = os.environ.get("S3_UPLOAD_BUCKET", "endevo-uat-uploads")
CF_DOMAIN = os.environ.get("CF_DOMAIN", "")
SES_FROM_ADDRESS = os.environ.get("SES_FROM_ADDRESS", "noreply@endevo.com")
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
AUDIT_T    = dynamo.Table("endevo-uat-audit")
OTP_T      = dynamo.Table("endevo-uat-otp")

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
    if "success" not in body:
        body = {**body, "success": True}
    return {"statusCode": status, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": _get_cors_origin(), "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"}, "body": json.dumps(body, default=str)}

def err(status, msg): return resp(status, {"success": False, "detail": msg})
def get_body(event):
    try: return json.loads(event.get("body") or "{}")
    except: return {}

def get_ip(event):
    return event.get("requestContext", {}).get("http", {}).get("sourceIp", "unknown")

def get_device(event):
    headers = event.get("headers") or {}
    return (headers.get("user-agent") or headers.get("User-Agent") or "unknown")[:200]

def audit(tenant_id, actor, action, details="", ip="", device="", severity="INFO"):
    """Write an audit log entry to the audit table."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        audit_id = str(uuid.uuid4())
        item = {
            "tenantId":  tenant_id,
            "sk":        f"{now}#{audit_id}",
            "auditId":   audit_id,
            "actor":     actor,
            "action":    action,
            "details":   details[:500],
            "severity":  severity,
            "createdAt": now,
        }
        if ip:     item["ip_address"] = ip
        if device: item["user_agent"] = device
        AUDIT_T.put_item(Item=item)
    except Exception as e:
        print(f"AUDIT_WRITE_ERROR: {e}")

def _get_modules_total(tenant_id):
    """Return the total number of LMS modules for this tenant (dynamic, not hardcoded)."""
    try:
        from boto3.dynamodb.conditions import Key as _Key
        courses_resp = TRAIN_T.query(KeyConditionExpression=_Key("tenantId").eq(tenant_id))
        count = len(courses_resp.get("Items", []))
        return count if count > 0 else 6  # fallback to 6 if no courses seeded yet
    except Exception:
        return 6  # safe fallback

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
    """Extract (tenantId, email, userId, role) from Bearer token via session or WorkOS JWT."""
    auth_header = (event.get("headers") or {}).get("authorization", "")
    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else auth_header.strip()
    if not token:
        return None, None, None, None

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
                        return None, None, None, None
                return u.get("tenantId"), u.get("email"), u.get("userId", ""), u.get("role", "EMPLOYEE")
        except Exception as e:
            print(f"SESSION_LOOKUP_ERROR: {e}")
        return None, None, None, None

    # SECURITY: JWT path removed — unverified JWT tokens are not accepted.
    # All authentication MUST go through the DynamoDB session token path (endevo_*).
    # WorkOS JWTs lack RSA signature verification and can be forged.
    print(f"AUTH_REJECTED: Non-session token presented to employee endpoint")
    return None, None, None, None

def _handler_impl(event, context):
    global _current_event
    _current_event = event

    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    if method == "OPTIONS": return resp(200, {})
    body = get_body(event)
    tenant_id, email, user_sub, user_role = get_caller(event)
    if not tenant_id: return err(401, "Not authenticated")

    # Role validation: only EMPLOYEE, HR_ADMIN, GLOBAL_ADMIN may access employee endpoints
    if user_role not in ("EMPLOYEE", "ADMIN", "GLOBAL_ADMIN"):
        return err(403, "Employee access required")

    ip = get_ip(event)
    device = get_device(event)

    # GET /api/employee/dashboard
    if path.endswith("/dashboard") and method == "GET":
        from boto3.dynamodb.conditions import Key as _Key, Attr as _Attr
        modules_total = _get_modules_total(tenant_id)
        # Count USER-SPECIFIC module completion from the modules table
        mod_result = MODULES_T.scan(
            FilterExpression=_Attr("userId").eq(user_sub) & _Attr("tenantId").eq(tenant_id)
        )
        mod_items = mod_result.get("Items", [])
        completed = len([
            m for m in mod_items
            if m.get("lockStatus") == "complete" or m.get("status") == "completed" or m.get("completed")
        ])
        certs = CERT_T.scan(FilterExpression=_Attr("userId").eq(user_sub) & _Attr("tenantId").eq(tenant_id))
        return resp(200, {
            "total_courses":     modules_total,
            "completed_courses": completed,
            "certificates":      len(certs.get("Items", [])),
            "progress_pct":      round((completed / modules_total * 100) if modules_total > 0 else 0, 1)
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
        audit(tenant_id, email, "PROFILE_UPDATED",
              f"Fields updated: {', '.join(updates.keys())}", ip=ip, device=device)
        return resp(200, {"message": "Profile updated"})

    # POST /api/employee/profile/personal-contact
    if path.endswith("/profile/personal-contact") and method == "POST":
        from employee.personal_contact import update_personal_contact
        from boto3.dynamodb.conditions import Key as _Key3
        result3 = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=_Key3("email").eq(email),
        )
        items3 = [i for i in result3.get("Items", []) if i.get("tenantId") == tenant_id]
        if not items3: return err(404, "Profile not found")
        user_id3 = items3[0]["userId"]
        personal_email = body.get("personal_email")
        personal_phone_number = body.get("personal_phone_number")
        try:
            update_personal_contact(
                users_table=USERS_T,
                user_id=user_id3,
                tenant_id=tenant_id,
                personal_email=personal_email,
                personal_phone_number=personal_phone_number,
            )
        except ValueError as ve:
            return err(400, str(ve))
        audit(tenant_id, email, "PERSONAL_CONTACT_UPDATED",
              f"personal_email={'set' if personal_email else 'unchanged'} "
              f"personal_phone={'set' if personal_phone_number else 'unchanged'}",
              ip=ip, device=device)
        return resp(200, {"message": "Personal contact updated"})

    # POST /api/employee/verify/personal-email
    if path.endswith("/verify/personal-email") and method == "POST":
        from employee.personal_contact import generate_otp, send_email_otp
        action = body.get("action", "send")
        if action == "send":
            personal_email_target = body.get("personal_email", "")
            if not personal_email_target:
                return err(400, "personal_email is required")
            from employee.personal_contact import validate_personal_email
            validation_result = validate_personal_email(personal_email_target)
            if not validation_result.get("valid"):
                return err(400, validation_result.get("reason", "Invalid email address"))
            otp_code = generate_otp()
            otp_id = str(uuid.uuid4())
            expires_at_dt = datetime.now(timezone.utc) + timedelta(minutes=10)
            expires_at_iso = expires_at_dt.isoformat()
            expires_at_unix = int(expires_at_dt.timestamp())
            OTP_T.put_item(Item={
                "otpId": otp_id,
                "userId": user_sub,
                "tenantId": tenant_id,
                "channel": "email",
                "code": otp_code,
                "expiresAt": expires_at_iso,
                "ttl": expires_at_unix,
                "used": False,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            })
            send_result = send_email_otp(
                ses_client=ses_client,
                recipient_email=personal_email_target,
                otp_code=otp_code,
                from_address=SES_FROM_ADDRESS,
            )
            if not send_result.get("success"):
                return err(500, f"Failed to send OTP: {send_result.get('error', 'Unknown')}")
            audit(tenant_id, email, "PERSONAL_EMAIL_OTP_SENT",
                  f"OTP sent to {personal_email_target}", ip=ip, device=device)
            return resp(200, {"success": True, "otp_id": otp_id, "message": "OTP sent"})
        # action == "verify"
        from employee.personal_contact import verify_otp
        otp_id = body.get("otp_id", "")
        code = body.get("code", "")
        if not otp_id or not code:
            return err(400, "otp_id and code are required")
        verify_result = verify_otp(
            otp_store=OTP_T,
            user_id=user_sub,
            channel="email",
            otp_id=otp_id,
            code=code,
        )
        if not verify_result.get("verified"):
            return err(400, verify_result.get("reason", "Verification failed"))
        # Mark personal_email_verified = True in users table
        from boto3.dynamodb.conditions import Key as _Key4
        result4 = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=_Key4("email").eq(email),
        )
        items4 = [i for i in result4.get("Items", []) if i.get("tenantId") == tenant_id]
        if items4:
            USERS_T.update_item(
                Key={"userId": items4[0]["userId"]},
                UpdateExpression="SET #pev = :pev",
                ExpressionAttributeNames={"#pev": "personal_email_verified"},
                ExpressionAttributeValues={":pev": True},
            )
        audit(tenant_id, email, "PERSONAL_EMAIL_VERIFIED", ip=ip, device=device)
        return resp(200, {"success": True, "verified": True})

    # POST /api/employee/verify/personal-phone
    if path.endswith("/verify/personal-phone") and method == "POST":
        from employee.personal_contact import generate_otp, send_phone_otp
        action = body.get("action", "send")
        if action == "send":
            personal_phone_target = body.get("personal_phone_number", "")
            if not personal_phone_target:
                return err(400, "personal_phone_number is required")
            from employee.personal_contact import validate_personal_phone
            validation_result = validate_personal_phone(personal_phone_target)
            if not validation_result.get("valid"):
                return err(400, validation_result.get("reason", "Invalid phone number"))
            otp_code = generate_otp()
            otp_id = str(uuid.uuid4())
            expires_at_dt = datetime.now(timezone.utc) + timedelta(minutes=10)
            expires_at_iso = expires_at_dt.isoformat()
            expires_at_unix = int(expires_at_dt.timestamp())
            OTP_T.put_item(Item={
                "otpId": otp_id,
                "userId": user_sub,
                "tenantId": tenant_id,
                "channel": "phone",
                "code": otp_code,
                "expiresAt": expires_at_iso,
                "ttl": expires_at_unix,
                "used": False,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            })
            send_result = send_phone_otp(
                sns_client=sns_client,
                phone_number=personal_phone_target,
                otp_code=otp_code,
            )
            if not send_result.get("success"):
                return err(500, f"Failed to send SMS: {send_result.get('error', 'Unknown')}")
            audit(tenant_id, email, "PERSONAL_PHONE_OTP_SENT",
                  f"SMS sent to {personal_phone_target}", ip=ip, device=device)
            return resp(200, {"success": True, "otp_id": otp_id, "message": "SMS sent"})
        # action == "verify"
        from employee.personal_contact import verify_otp
        otp_id = body.get("otp_id", "")
        code = body.get("code", "")
        if not otp_id or not code:
            return err(400, "otp_id and code are required")
        verify_result = verify_otp(
            otp_store=OTP_T,
            user_id=user_sub,
            channel="phone",
            otp_id=otp_id,
            code=code,
        )
        if not verify_result.get("verified"):
            return err(400, verify_result.get("reason", "Verification failed"))
        # Mark personal_phone_verified = True
        from boto3.dynamodb.conditions import Key as _Key5
        result5 = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=_Key5("email").eq(email),
        )
        items5 = [i for i in result5.get("Items", []) if i.get("tenantId") == tenant_id]
        if items5:
            USERS_T.update_item(
                Key={"userId": items5[0]["userId"]},
                UpdateExpression="SET #ppv = :ppv",
                ExpressionAttributeNames={"#ppv": "personal_phone_verified"},
                ExpressionAttributeValues={":ppv": True},
            )
        audit(tenant_id, email, "PERSONAL_PHONE_VERIFIED", ip=ip, device=device)
        return resp(200, {"success": True, "verified": True})

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
        audit(tenant_id, email, "ASSESSMENT_SUBMITTED",
              f"Course {course_id}: score={score}, passed={passed}", ip=ip, device=device)
        return resp(200, {"score": score, "passed": passed, "correct": correct, "total": len(qs), "certificate_issued": passed})

    # POST /api/employee/certificate/check — Check eligibility and generate certificate
    if path.endswith("/certificate/check") and method == "POST":
        from boto3.dynamodb.conditions import Attr as _Attr
        now = datetime.now(timezone.utc).isoformat()
        modules_total = _get_modules_total(tenant_id)

        # 1. Query all user modules
        mod_result = MODULES_T.scan(
            FilterExpression=_Attr("userId").eq(user_sub) & _Attr("tenantId").eq(tenant_id)
        )
        mod_items = mod_result.get("Items", [])

        # 2. Check if the last module is completed (lockStatus == "complete" or status == "completed")
        last_module_complete = any(
            (str(m.get("moduleNum", "")) == str(modules_total)) and
            (m.get("lockStatus") == "complete" or m.get("status") == "completed" or m.get("completed"))
            for m in mod_items
        )
        if not last_module_complete:
            completed_count = len([
                m for m in mod_items
                if m.get("lockStatus") == "complete" or m.get("status") == "completed" or m.get("completed")
            ])
            return resp(200, {
                "eligible": False,
                "message": f"Complete all {modules_total} modules to earn your certificate. {completed_count}/{modules_total} completed.",
                "modulesCompleted": completed_count,
                "modulesTotal": modules_total,
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
            "completedModules": modules_total,
        }
        if score is not None:
            cert_item["score"] = score

        try:
            CERT_T.put_item(Item=cert_item)
        except ClientError as e:
            print(f"CERT_CREATE_ERROR: {e}")
            return err(500, "Failed to create certificate")

        audit(tenant_id, email, "CERTIFICATE_GENERATED",
              f"Certificate {cert_id} issued (score={score})", ip=ip, device=device)
        return resp(200, {"eligible": True, "certificate": cert_item, "message": "Certificate issued"})

    # POST /api/employee/playbook/generate — Generate AI-powered My Playbook
    if path.endswith("/playbook/generate") and method == "POST":
        from boto3.dynamodb.conditions import Attr as _Attr, Key as _Key2
        from employee.utils.bedrock_analyzer import analyze_assessment, generate_playbook

        # 1. Get latest assessment responses
        resp_result = RESP_T.scan(FilterExpression=_Attr("userId").eq(user_sub))
        responses = resp_result.get("Items", [])
        if not responses:
            return err(404, "No assessment found. Complete the assessment first.")

        # Get latest response
        latest_resp = max(responses, key=lambda r: r.get("submittedAt", ""))
        answers = latest_resp.get("answers", {})

        # 2. Get all questions to analyze
        questions = QUEST_T.scan(FilterExpression=_Attr("tenantId").eq(tenant_id))
        qs = questions.get("Items", [])
        if not qs:
            return err(404, "Questions not found")

        # 3. Analyze assessment with Bedrock
        analysis = analyze_assessment(answers, qs)

        # 4. Generate personalized playbook
        user_name = body.get("userName", "User")
        try:
            user_result = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key2("email").eq(email),
            )
            user_items = [i for i in user_result.get("Items", []) if i.get("tenantId") == tenant_id]
            if user_items:
                user_name = f"{user_items[0].get('firstName', '')} {user_items[0].get('lastName', '')}".strip() or user_name
        except Exception:
            pass

        playbook = generate_playbook(user_name, analysis["domainScores"], analysis["weakDomains"])

        # 5. Store playbook in DynamoDB for persistence
        playbook_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        playbook_item = {
            "playbookId": playbook_id,
            "userId": user_sub,
            "tenantId": tenant_id,
            "overallScore": analysis["overallScore"],
            "domainScores": analysis["domainScores"],
            "playbook": playbook,
            "analysis": analysis["analysis"],
            "weakDomains": analysis["weakDomains"],
            "createdAt": now,
            "updatedAt": now,
        }

        # Create playbookId table reference if doesn't exist — use RESP_T as fallback storage
        try:
            # Store in a custom table or use responses table with special courseId
            RESP_T.put_item(Item={
                **playbook_item,
                "responseId": playbook_id,
                "courseId": "MY_PLAYBOOK",
            })
        except Exception as e:
            print(f"PLAYBOOK_STORAGE_WARNING: {e}")

        audit(tenant_id, email, "PLAYBOOK_GENERATED",
              f"Overall score: {analysis['overallScore']}%, Weak domains: {', '.join(analysis['weakDomains'])}",
              ip=ip, device=device)

        return resp(200, {
            "playbookId": playbook_id,
            "overallScore": analysis["overallScore"],
            "domainScores": analysis["domainScores"],
            "weakDomains": analysis["weakDomains"],
            "strongDomains": analysis["strongDomains"],
            "analysis": analysis["analysis"],
            "playbook": playbook,
            "generatedAt": now,
        })

    # POST /api/employee/email/send-playbook — Send personalized assessment email
    if path.endswith("/email/send-playbook") and method == "POST":
        from boto3.dynamodb.conditions import Attr as _Attr, Key as _Key2
        from employee.utils.email_generator import send_assessment_email

        # 1. Get latest playbook data
        playbook_result = RESP_T.scan(
            FilterExpression=_Attr("userId").eq(user_sub) & _Attr("courseId").eq("MY_PLAYBOOK")
        )
        playbooks = playbook_result.get("Items", [])
        if not playbooks:
            return err(404, "No playbook found. Generate playbook first.")

        playbook_data = max(playbooks, key=lambda p: p.get("createdAt", ""))

        # 2. Get user details
        user_name = "User"
        try:
            user_result = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key2("email").eq(email),
            )
            user_items = [i for i in user_result.get("Items", []) if i.get("tenantId") == tenant_id]
            if user_items:
                user_name = f"{user_items[0].get('firstName', '')} {user_items[0].get('lastName', '')}".strip() or user_name
        except Exception:
            pass

        # 3. Get assessment tasks from latest response
        resp_result = RESP_T.scan(FilterExpression=_Attr("userId").eq(user_sub))
        responses = resp_result.get("Items", [])
        latest_resp = max(responses, key=lambda r: r.get("submittedAt", "")) if responses else {}

        # Get task list from playbook
        tasks = playbook_data.get("playbook", {}).get("tasks", [])

        # 4. Send email via SES
        email_result = send_assessment_email(
            recipient_email=email,
            recipient_name=user_name,
            overall_score=playbook_data.get("overallScore", 0),
            domain_scores=playbook_data.get("domainScores", {}),
            weak_domains=playbook_data.get("weakDomains", []),
            tasks=tasks
        )

        if not email_result.get("success"):
            audit(tenant_id, email, "PLAYBOOK_EMAIL_FAILED",
                  f"Error: {email_result.get('error', 'Unknown')}",
                  ip=ip, device=device, severity="WARNING")
            return err(500, f"Email send failed: {email_result.get('error', 'Unknown')}")

        # 5. Audit successful send
        audit(tenant_id, email, "PLAYBOOK_EMAIL_SENT",
              f"Email sent to {email}, MessageId: {email_result.get('messageId', '')}",
              ip=ip, device=device)

        return resp(200, {
            "success": True,
            "messageId": email_result.get("messageId", ""),
            "email": email_result.get("email", ""),
            "subject": email_result.get("subject", ""),
            "sentAt": email_result.get("sentAt", ""),
        })

    # POST /api/employee/support/question — Post a question to support Q&A
    if path.endswith("/support/question") and method == "POST":
        from employee.utils.support_qa import answer_question, SAMPLE_FAQ

        body_data = get_body(event)
        user_question = body_data.get("question", "").strip()

        if not user_question:
            return err(400, "Question cannot be empty")

        if len(user_question) > 1000:
            return err(400, "Question too long (max 1000 characters)")

        # Generate AI answer using Nova Micro
        user_name = "User"
        try:
            from boto3.dynamodb.conditions import Key as _Key2
            user_result = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key2("email").eq(email),
            )
            user_items = [i for i in user_result.get("Items", []) if i.get("tenantId") == tenant_id]
            if user_items:
                user_name = f"{user_items[0].get('firstName', '')} {user_items[0].get('lastName', '')}".strip() or user_name
        except Exception:
            pass

        qa_result = answer_question(user_question, user_name)

        # Store question in DynamoDB
        question_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        question_item = {
            "questionId": question_id,
            "userId": user_sub,
            "tenantId": tenant_id,
            "question": user_question,
            "answer": qa_result["answer"],
            "confidence": qa_result["confidence"],
            "shouldEscalate": qa_result["shouldEscalate"],
            "source": "ai",
            "createdAt": now,
            "rating": None,
            "ratingFeedback": None,
        }

        # Create support questions table if using RESP_T as fallback
        try:
            from boto3.dynamodb.conditions import Attr as _Attr
            AUDIT_T.put_item(Item={
                "tenantId": tenant_id,
                "sk": f"SUPPORT#{now}#{question_id}",
                "questionId": question_id,
                "userId": user_sub,
                "question": user_question,
                "confidence": qa_result["confidence"],
                "shouldEscalate": qa_result["shouldEscalate"],
            })
        except Exception as e:
            print(f"SUPPORT_QUESTION_STORAGE_WARNING: {e}")

        # Audit question
        audit(tenant_id, email, "SUPPORT_QUESTION_POSTED",
              f"Question: {user_question[:100]}, Confidence: {qa_result['confidence']}, Escalate: {qa_result['shouldEscalate']}",
              ip=ip, device=device)

        return resp(200, {
            "questionId": question_id,
            "question": user_question,
            "answer": qa_result["answer"],
            "confidence": qa_result["confidence"],
            "shouldEscalate": qa_result["shouldEscalate"],
            "source": "ai",
            "createdAt": now,
        })

    # POST /api/employee/support/question/{questionId}/rate — Rate answer helpfulness
    if path.endswith("/rate") and "/support/question/" in path and method == "POST":
        from employee.utils.support_qa import rate_answer

        body_data = get_body(event)
        rating = int(body_data.get("rating", 0))
        feedback = body_data.get("feedback", "")

        # Extract questionId from path
        path_parts = path.split("/")
        question_id = path_parts[path_parts.index("question") + 1] if "question" in path_parts else None

        if not question_id or rating < 1 or rating > 5:
            return err(400, "Invalid rating (must be 1-5)")

        rate_result = rate_answer(question_id, rating, feedback)

        now = datetime.now(timezone.utc).isoformat()

        # Audit rating
        audit(tenant_id, email, "SUPPORT_ANSWER_RATED",
              f"QuestionId: {question_id}, Rating: {rating}, Escalated: {rate_result.get('escalatedToHR')}",
              ip=ip, device=device)

        return resp(200, {
            "success": True,
            "rating": rating,
            "escalatedToHR": rate_result.get("escalatedToHR", False),
            "ratedAt": now,
        })

    # GET /api/employee/support/faq — Get FAQ entries
    if path.endswith("/support/faq") and method == "GET":
        from employee.utils.support_qa import SAMPLE_FAQ

        query_param = (event.get("queryStringParameters") or {}).get("search", "")

        if query_param:
            from employee.utils.support_qa import get_faq_by_search
            faq_list = get_faq_by_search(query_param)
        else:
            faq_list = SAMPLE_FAQ

        return resp(200, {
            "faq": faq_list,
            "count": len(faq_list),
        })

    # GET /api/employee/checklist — Get personalized task checklist
    if path.endswith("/checklist") and method == "GET":
        from boto3.dynamodb.conditions import Attr as _Attr
        from employee.utils.checklist_manager import calculate_domain_progress

        # Get latest playbook for tasks
        playbook_result = RESP_T.scan(
            FilterExpression=_Attr("userId").eq(user_sub) & _Attr("courseId").eq("MY_PLAYBOOK")
        )
        playbooks = playbook_result.get("Items", [])
        if not playbooks:
            return err(404, "No playbook found. Generate playbook first.")

        latest_playbook = max(playbooks, key=lambda p: p.get("createdAt", ""))
        tasks = latest_playbook.get("playbook", {}).get("tasks", [])

        # Calculate progress per domain
        domain_progress = calculate_domain_progress(tasks)
        overall_progress = round(sum(domain_progress.values()) / len(domain_progress)) if domain_progress else 0

        return resp(200, {
            "tasks": tasks,
            "domainProgress": domain_progress,
            "overallProgress": overall_progress,
            "totalTasks": len(tasks),
            "completedTasks": len([t for t in tasks if t.get("status") == "completed"]),
        })

    # POST /api/employee/checklist/{taskId}/complete — Mark task as complete
    if path.endswith("/complete") and "/checklist/" in path and method == "POST":
        from boto3.dynamodb.conditions import Attr as _Attr
        from employee.utils.checklist_manager import generate_milestone_message

        # Extract taskId from path
        path_parts = path.split("/")
        task_id = path_parts[path_parts.index("checklist") + 1] if "checklist" in path_parts else None

        if not task_id:
            return err(400, "Invalid task ID")

        # Get latest playbook and update task status
        playbook_result = RESP_T.scan(
            FilterExpression=_Attr("userId").eq(user_sub) & _Attr("courseId").eq("MY_PLAYBOOK")
        )
        playbooks = playbook_result.get("Items", [])
        if not playbooks:
            return err(404, "No playbook found")

        latest_playbook = max(playbooks, key=lambda p: p.get("createdAt", ""))
        playbook_data = latest_playbook.get("playbook", {})
        tasks = playbook_data.get("tasks", [])

        # Find and update task
        task_found = False
        for task in tasks:
            if task.get("rank") == int(task_id):
                task["status"] = "completed"
                task_found = True
                task_name = task.get("title", "Task")
                domain = task.get("domain", "general")
                break

        if not task_found:
            return err(404, "Task not found")

        # Calculate new progress
        from employee.utils.checklist_manager import calculate_domain_progress
        domain_progress = calculate_domain_progress(tasks)
        overall_progress = round(sum(domain_progress.values()) / len(domain_progress)) if domain_progress else 0

        # Generate milestone message
        user_name = "User"
        try:
            from boto3.dynamodb.conditions import Key as _Key2
            user_result = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key2("email").eq(email),
            )
            user_items = [i for i in user_result.get("Items", []) if i.get("tenantId") == tenant_id]
            if user_items:
                user_name = f"{user_items[0].get('firstName', '')} {user_items[0].get('lastName', '')}".strip() or user_name
        except Exception:
            pass

        milestone_msg = generate_milestone_message(domain, overall_progress, user_name)

        now = datetime.now(timezone.utc).isoformat()

        # Persist updated playbook to DynamoDB
        from boto3.dynamodb.conditions import Attr as _Attr2
        RESP_T.update_item(
            Key={"userId": user_sub, "submittedAt": latest_playbook.get("submittedAt")},
            UpdateExpression="SET playbook = :playbook",
            ExpressionAttributeValues={":playbook": {"tasks": tasks}}
        )

        # Audit completion
        audit(tenant_id, email, "TASK_COMPLETED",
              f"TaskId: {task_id}, TaskName: {task_name}, DomainProgress: {domain_progress}",
              ip=ip, device=device)

        return resp(200, {
            "success": True,
            "taskId": task_id,
            "taskName": task_name,
            "domain": domain,
            "domainProgress": domain_progress,
            "overallProgress": overall_progress,
            "milestoneMessage": milestone_msg,
            "completedAt": now,
        })

    # GET /api/employee/checklist/progress — Get overall progress summary
    if path.endswith("/progress") and "/checklist/" in path and method == "GET":
        from boto3.dynamodb.conditions import Attr as _Attr
        from employee.utils.checklist_manager import calculate_domain_progress

        playbook_result = RESP_T.scan(
            FilterExpression=_Attr("userId").eq(user_sub) & _Attr("courseId").eq("MY_PLAYBOOK")
        )
        playbooks = playbook_result.get("Items", [])
        if not playbooks:
            return err(404, "No playbook found")

        latest_playbook = max(playbooks, key=lambda p: p.get("createdAt", ""))
        tasks = latest_playbook.get("playbook", {}).get("tasks", [])

        domain_progress = calculate_domain_progress(tasks)
        overall_progress = round(sum(domain_progress.values()) / len(domain_progress)) if domain_progress else 0

        return resp(200, {
            "overallProgress": overall_progress,
            "domainProgress": domain_progress,
            "totalTasks": len(tasks),
            "completedTasks": len([t for t in tasks if t.get("status") == "completed"]),
        })

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

        plan_cfg = _get_plan_config()
        plan_detail = plan_cfg.get(plan, plan_cfg.get("basic", {}))
        total_allowed = int(plan_detail.get("sessionsTotal", 2))

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

    # POST /api/employee/sessions/book — Book a new 1:1 session
    if path.endswith("/sessions/book") and method == "POST":
        from employee.utils.sessions import book_session, validate_session_booking

        body_data = get_body(event)
        scheduled_at = body_data.get("scheduledAt", "")
        notes = body_data.get("notes", "")

        if not scheduled_at:
            return err(400, "scheduledAt is required")

        # Get user name
        user_name = "User"
        try:
            from boto3.dynamodb.conditions import Key as _Key
            user_result = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key("email").eq(email),
            )
            user_items = [i for i in user_result.get("Items", []) if i.get("tenantId") == tenant_id]
            if user_items:
                user_name = f"{user_items[0].get('firstName', '')} {user_items[0].get('lastName', '')}".strip() or user_name
        except Exception:
            pass

        # Fetch existing sessions for validation
        existing_sessions = []
        try:
            from boto3.dynamodb.conditions import Attr as _Attr
            result = SESSIONS_T.scan(
                FilterExpression=_Attr("userId").eq(user_sub)
            )
            existing_sessions = result.get("Items", [])
        except Exception:
            pass

        # Validate booking
        is_valid, error_msg = validate_session_booking(scheduled_at, existing_sessions)
        if not is_valid:
            return err(400, error_msg or "Cannot book session at this time")

        # Create session
        session_data = book_session(user_sub, user_name, scheduled_at, notes=notes)

        # Store session in SESSIONS_T
        try:
            SESSIONS_T.put_item(Item={
                "userId": user_sub,
                "sk": f"{scheduled_at}#{session_data['sessionId']}",
                "sessionId": session_data["sessionId"],
                "userName": user_name,
                "scheduledAt": scheduled_at,
                "status": "scheduled",
                "notes": notes,
                "tenantId": tenant_id,
                "createdAt": session_data["createdAt"],
            })
        except Exception as e:
            print(f"SESSION_STORAGE_ERROR: {e}")
            return err(500, "Failed to store session")

        # Audit booking
        audit(tenant_id, email, "SESSION_BOOKED",
              f"SessionId: {session_data['sessionId']}, ScheduledAt: {scheduled_at}",
              ip=ip, device=device)

        return resp(200, {
            "sessionId": session_data["sessionId"],
            "userId": user_sub,
            "userName": user_name,
            "scheduledAt": scheduled_at,
            "status": "scheduled",
            "notes": notes,
            "createdAt": session_data["createdAt"],
        })

    # POST /api/employee/sessions/{sessionId}/complete — Complete session with transcript
    if path.endswith("/complete") and "/sessions/" in path and method == "POST":
        from employee.utils.sessions import complete_session

        body_data = get_body(event)
        transcript = body_data.get("transcript", "")
        session_title = body_data.get("title", "Session")

        # Extract sessionId from path
        path_parts = path.split("/")
        session_id = path_parts[path_parts.index("sessions") + 1] if "sessions" in path_parts else None

        if not session_id:
            return err(400, "Invalid session ID")

        if not transcript:
            return err(400, "Transcript is required")

        # Get session from SESSIONS_T
        session_item = None
        try:
            from boto3.dynamodb.conditions import Attr as _Attr
            result = SESSIONS_T.scan(
                FilterExpression=_Attr("sessionId").eq(session_id) & _Attr("userId").eq(user_sub)
            )
            items = result.get("Items", [])
            if items:
                session_item = items[0]
        except Exception as e:
            print(f"SESSION_LOOKUP_ERROR: {e}")

        if not session_item:
            return err(404, "Session not found")

        # Generate summary
        completion_data = complete_session(session_id, transcript, session_title)

        now = datetime.now(timezone.utc).isoformat()

        # Update session in SESSIONS_T
        try:
            SESSIONS_T.put_item(Item={
                **session_item,
                "status": "completed",
                "transcript": transcript[:1000],  # Store excerpt
                "summary": completion_data["summary"],
                "duration": len(transcript.split()) // 130,  # Estimate ~130 wpm
                "completedAt": completion_data["completedAt"],
            })
        except Exception as e:
            print(f"SESSION_UPDATE_ERROR: {e}")

        # Audit completion
        audit(tenant_id, email, "SESSION_COMPLETED",
              f"SessionId: {session_id}, Summary: {completion_data['summary'][:100]}",
              ip=ip, device=device)

        return resp(200, {
            "sessionId": session_id,
            "status": "completed",
            "summary": completion_data["summary"],
            "transcriptLength": completion_data["transcriptLength"],
            "duration": len(transcript.split()) // 130,
            "completedAt": completion_data["completedAt"],
        })

    # GET /api/employee/master-classes — Get all master classes
    if path.endswith("/master-classes") and method == "GET":
        from employee.utils.master_classes import DEFAULT_MASTER_CLASSES

        return resp(200, {
            "classes": DEFAULT_MASTER_CLASSES,
            "count": len(DEFAULT_MASTER_CLASSES),
        })

    # GET /api/employee/master-classes/recommended — Get recommended classes
    if path.endswith("/master-classes/recommended") and method == "GET":
        from employee.utils.master_classes import DEFAULT_MASTER_CLASSES, get_recommended_classes
        from boto3.dynamodb.conditions import Attr as _Attr

        # Get user's weak domains from latest playbook
        weak_domains = []
        try:
            playbook_result = RESP_T.scan(
                FilterExpression=_Attr("userId").eq(user_sub) & _Attr("courseId").eq("MY_PLAYBOOK")
            )
            playbooks = playbook_result.get("Items", [])
            if playbooks:
                latest = max(playbooks, key=lambda p: p.get("createdAt", ""))
                weak_domains = latest.get("playbook", {}).get("weakDomains", [])
        except Exception:
            pass

        recommended = get_recommended_classes(weak_domains, DEFAULT_MASTER_CLASSES)

        return resp(200, {
            "classes": recommended,
            "count": len(recommended),
            "basedOnDomains": weak_domains,
        })

    # POST /api/employee/master-classes/{classId}/register — Register for a class
    if path.endswith("/register") and "/master-classes/" in path and method == "POST":
        from employee.utils.master_classes import register_for_class

        # Extract classId from path
        path_parts = path.split("/")
        class_id = path_parts[path_parts.index("master-classes") + 1] if "master-classes" in path_parts else None

        if not class_id:
            return err(400, "Invalid class ID")

        # Get user name
        user_name = "User"
        try:
            from boto3.dynamodb.conditions import Key as _Key
            user_result = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key("email").eq(email),
            )
            user_items = [i for i in user_result.get("Items", []) if i.get("tenantId") == tenant_id]
            if user_items:
                user_name = f"{user_items[0].get('firstName', '')} {user_items[0].get('lastName', '')}".strip() or user_name
        except Exception:
            pass

        # Create registration
        registration = register_for_class(user_sub, class_id, user_name)

        # Store in AUDIT_T as registration record
        try:
            AUDIT_T.put_item(Item={
                "tenantId": tenant_id,
                "sk": f"REGISTRATION#{registration['registeredAt']}#{registration['registrationId']}",
                "registrationId": registration["registrationId"],
                "userId": user_sub,
                "classId": class_id,
                "userName": user_name,
                "registeredAt": registration["registeredAt"],
                "eventType": "class_registration",
            })
        except Exception as e:
            print(f"REGISTRATION_STORAGE_ERROR: {e}")

        # Audit registration
        audit(tenant_id, email, "CLASS_REGISTERED",
              f"ClassId: {class_id}, ClassName: {registration['registrationId']}",
              ip=ip, device=device)

        return resp(200, {
            "registrationId": registration["registrationId"],
            "classId": class_id,
            "userId": user_sub,
            "registeredAt": registration["registeredAt"],
            "status": "registered",
        })

    # GET /api/employee/master-classes/registrations — Get user's class registrations
    if "/master-classes/registrations" in path and method == "GET":
        from boto3.dynamodb.conditions import Attr as _Attr

        registrations = []
        try:
            result = AUDIT_T.scan(
                FilterExpression=_Attr("userId").eq(user_sub) & _Attr("eventType").eq("class_registration")
            )
            registrations = result.get("Items", [])
        except Exception as e:
            print(f"REGISTRATIONS_LOOKUP_ERROR: {e}")

        return resp(200, {
            "registrations": registrations,
            "count": len(registrations),
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
        modules_total = _get_modules_total(tenant_id)
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


def handler(event, context):
    try:
        return _handler_impl(event, context)
    except Exception as e:
        import traceback
        print(f"UNHANDLED_ERROR: {traceback.format_exc()}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "success": False,
                "error_code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again.",
                "detail": str(e)[:200] if os.environ.get("STAGE") == "dev" else None
            })
        }
