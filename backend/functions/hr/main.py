"""
Endevo Life — HR Admin Lambda (pure boto3, no pip needed)
Foundation v2: pagination, server-side search, input validation

Routes:
  GET  /api/hr/dashboard
  GET  /api/hr/employees             ?search=&status=&limit=50&next_token=
  POST /api/hr/invite
  PUT  /api/hr/employees/{id}
  DELETE /api/hr/employees/{id}
  GET  /api/hr/audit                 ?limit=50&next_token=
  GET  /api/hr/metrics               — activation rate, completion %, overall progress
  GET  /api/hr/subscription          — tenant subscription & seat info
  GET  /api/hr/sessions              — 1:1 session overview for tenant
  POST /api/hr/sessions/book         — book a 1:1 session for an employee
  POST /api/hr/upload-url            — get S3 presigned upload URL (scoped to tenant)
  POST /api/hr/branding              — update own tenant branding

  Archive / Recycle Bin:
  GET  /api/hr/archive/employees                       List archived employees in own tenant
  POST /api/hr/archive/employees/{userId}/restore      Restore archived employee
"""
import json, os, uuid, base64, re
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr

REGION    = os.environ.get("AWS_REGION", "us-east-1")
dynamo    = boto3.resource("dynamodb", region_name=REGION)
ses       = boto3.client("ses", region_name=REGION)
s3_client = boto3.client("s3", region_name=REGION)
_secrets  = boto3.client("secretsmanager", region_name=REGION)
UPLOAD_BUCKET = os.environ.get("S3_UPLOAD_BUCKET", "endevo-uat-uploads")
CF_DOMAIN = os.environ.get("CF_DOMAIN", "")
USERS_T        = dynamo.Table("endevo-uat-users")
AUDIT_T        = dynamo.Table("endevo-uat-audit")
SUBSCRIPTIONS_T = dynamo.Table("endevo-uat-subscriptions")
SESSIONS_T     = dynamo.Table("endevo-uat-sessions")
MODULES_T      = dynamo.Table("endevo-uat-lms-modules")
USER_MODULES_T = dynamo.Table("endevo-uat-lms-user-modules")
RESPONSES_T    = dynamo.Table("endevo-uat-responses")
TENANTS_T      = dynamo.Table("endevo-uat-tenants")

# ── Secrets & WorkOS ─────────────────────────────────────────────────────────

_secret_cache = {}

def _get_secret(name):
    if name in _secret_cache:
        return _secret_cache[name]
    val = _secrets.get_secret_value(SecretId=name)["SecretString"]
    _secret_cache[name] = val
    return val

def _workos_api(method, path, body=None):
    import urllib.request
    api_key = _get_secret("endevo/workos/api-key")
    url = f"https://api.workos.com{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=10) as r:
        if r.status == 204:
            return {}
        return json.loads(r.read())

# ── CORS ─────────────────────────────────────────────────────────────────────

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

# ── Helpers ───────────────────────────────────────────────────────────────────

def resp(status, body):
    if "success" not in body:
        body = {**body, "success": True}
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": _get_cors_origin(),
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body, default=str)
    }

def err(status, msg):
    return resp(status, {"success": False, "detail": msg})

def get_body(event):
    try:
        return json.loads(event.get("body") or "{}")
    except:
        return {}

def get_caller(event):
    """Extract (tenantId, role, email) from Bearer token via session or WorkOS JWT."""
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
                if u.get("status") in ("inactive", "archived"):
                    return None, None, None
                # Check session expiry (24h TTL)
                expires = u.get("sessionExpiresAt", "")
                if expires:
                    from datetime import datetime, timezone
                    exp_dt = datetime.fromisoformat(expires)
                    if datetime.now(timezone.utc) > exp_dt:
                        return None, None, None
                return u.get("tenantId"), u.get("role"), u.get("email")
        except Exception as e:
            print(f"SESSION_LOOKUP_ERROR: {e}")
        return None, None, None

    # SECURITY: JWT path removed — unverified JWT tokens are not accepted.
    # All authentication MUST go through the DynamoDB session token path (endevo_*).
    # WorkOS JWTs lack RSA signature verification and can be forged.
    print(f"AUTH_REJECTED: Non-session token presented to HR endpoint")
    return None, None, None

def sanitize(value, max_len=200):
    if not isinstance(value, str):
        return value
    v = value.strip()[:max_len]
    v = re.sub(r'<[^>]*>', '', v)
    for bad in ["javascript:", "onload=", "onerror=", "onclick=", "eval(", "document.", "window."]:
        v = re.sub(re.escape(bad), "", v, flags=re.IGNORECASE)
    return v.strip()

def validate_email(email):
    if not email or len(email) > 254:
        return False
    return bool(re.match(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", email))

def encode_cursor(last_key):
    if not last_key:
        return None
    return base64.urlsafe_b64encode(json.dumps(last_key, default=str).encode()).decode()

def decode_cursor(token):
    if not token:
        return None
    try:
        return json.loads(base64.urlsafe_b64decode(token.encode()))
    except:
        return None

def scan_page(table, limit, next_token, filter_expr=None):
    limit = min(max(int(limit or 50), 1), 200)
    params = {"Limit": limit}
    if filter_expr is not None:
        params["FilterExpression"] = filter_expr
    start_key = decode_cursor(next_token)
    if start_key:
        params["ExclusiveStartKey"] = start_key
    result = table.scan(**params)
    return result.get("Items", []), encode_cursor(result.get("LastEvaluatedKey"))

def scan_all(table, filter_expr=None):
    params = {}
    if filter_expr is not None:
        params["FilterExpression"] = filter_expr
    items = []
    while True:
        result = table.scan(**params)
        items.extend(result.get("Items", []))
        last = result.get("LastEvaluatedKey")
        if not last:
            break
        params["ExclusiveStartKey"] = last
    return items

def count_items(table, filter_expr=None):
    params = {"Select": "COUNT"}
    if filter_expr is not None:
        params["FilterExpression"] = filter_expr
    total = 0
    while True:
        result = table.scan(**params)
        total += result.get("Count", 0)
        last = result.get("LastEvaluatedKey")
        if not last:
            break
        params["ExclusiveStartKey"] = last
    return total

def get_ip(event):
    return event.get("requestContext", {}).get("http", {}).get("sourceIp", "unknown")

def get_device(event):
    headers = event.get("headers") or {}
    return (headers.get("user-agent") or headers.get("User-Agent") or "unknown")[:200]

def audit(tenant_id, actor, action, details="", ip="", device="", severity="INFO"):
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
            "createdAt": now
        }
        if ip:     item["ip_address"] = ip
        if device: item["user_agent"] = device
        AUDIT_T.put_item(Item=item)
    except Exception as e:
        print(f"AUDIT_WRITE_ERROR: {e}")

# ── Handler ───────────────────────────────────────────────────────────────────

def _handler_impl(event, context):
    global _current_event
    _current_event = event

    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    qs     = event.get("queryStringParameters") or {}
    ip     = get_ip(event)
    device = get_device(event)

    if method == "OPTIONS":
        return resp(200, {})

    body = get_body(event)
    tenant_id, role, caller_email = get_caller(event)

    if not tenant_id:
        return err(401, "Not authenticated")
    if role not in ("HR_ADMIN", "GLOBAL_ADMIN"):
        return err(403, "HR Admin access required")

    # ── GET /api/hr/dashboard ─────────────────────────────────────────────
    if path.endswith("/dashboard") and method == "GET":
        base_filter = Attr("tenantId").eq(tenant_id)
        # Fetch tenant name for display
        t_name = ""
        try:
            t_item = dynamo.Table("endevo-uat-tenants").get_item(Key={"tenantId": tenant_id}).get("Item")
            t_name = t_item.get("name", "") if t_item else ""
        except Exception:
            pass
        return resp(200, {
            "total_users":     count_items(USERS_T, base_filter),
            "active_users":    count_items(USERS_T, base_filter & Attr("status").eq("active")),
            "pending_invites": count_items(USERS_T, base_filter & Attr("status").eq("pending")),
            "total_employees": count_items(USERS_T, base_filter & Attr("role").eq("EMPLOYEE")),
            "tenant_name":     t_name,
        })

    # ── GET /api/hr/employees ─────────────────────────────────────────────
    if path.endswith("/employees") and method == "GET" and "/archive/" not in path:
        limit         = qs.get("limit", 50)
        next_token    = qs.get("next_token")
        search        = sanitize(qs.get("search", ""), 100)
        filter_status = qs.get("status", "")
        filter_dept   = qs.get("department", "")

        # Always scope to tenant + EMPLOYEE role
        fexpr = Attr("tenantId").eq(tenant_id) & Attr("role").eq("EMPLOYEE")

        if filter_status:
            fexpr = fexpr & Attr("status").eq(filter_status)
        if filter_dept:
            fexpr = fexpr & Attr("department").eq(filter_dept)
        if search:
            sf = (Attr("email").contains(search) |
                  Attr("firstName").contains(search) |
                  Attr("lastName").contains(search))
            fexpr = fexpr & sf

        items, next_cursor = scan_page(USERS_T, limit, next_token, fexpr)
        employees = [{k: v for k, v in e.items() if k != "inviteToken"} for e in items]

        return resp(200, {
            "employees":  employees,
            "count":      len(employees),
            "next_token": next_cursor,
            "has_more":   bool(next_cursor)
        })

    # ── POST /api/hr/invite ───────────────────────────────────────────────
    if path.endswith("/invite") and method == "POST":
        email      = sanitize((body.get("email") or "").lower().strip(), 254)
        first_name = sanitize(body.get("first_name") or body.get("firstName") or "", 50)
        last_name  = sanitize(body.get("last_name") or body.get("lastName") or "", 50)
        department = sanitize(body.get("department") or "General", 100)
        job_title  = sanitize(body.get("job_title") or body.get("jobTitle") or "", 100)
        phone      = (body.get("phone") or "").strip()[:20]

        if not phone:
            return err(400, "Phone number is required for OTP login")
        if not email:
            return err(400, "Email required")
        if not validate_email(email):
            return err(400, "Invalid email format")

        # Check for duplicate invite within this tenant (GSI query + tenant filter)
        from boto3.dynamodb.conditions import Key as _Key
        _email_result = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=_Key("email").eq(email),
        )
        existing = [i for i in _email_result.get("Items", []) if i.get("tenantId") == tenant_id]
        if existing:
            return err(409, f"{email} is already a member of this organisation")

        invite_token  = str(uuid.uuid4())
        temp_password = f"Invite@{str(uuid.uuid4())[:8]}!"
        user_id       = str(uuid.uuid4())
        now           = datetime.now(timezone.utc).isoformat()

        # Look up tenant name
        tenant_name = ""
        try:
            t = dynamo.Table("endevo-uat-tenants").get_item(Key={"tenantId": tenant_id}).get("Item")
            tenant_name = t.get("name", "") if t else ""
        except Exception:
            pass

        # Check global email uniqueness — one email one role
        _global_result = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=_Key("email").eq(email),
        )
        global_existing = _global_result.get("Items", [])
        if global_existing:
            existing_role = global_existing[0].get("role", "unknown")
            return err(409, f"{email} is already registered as {existing_role} in the system. One email can only hold one role.")

        # Create WorkOS user
        try:
            workos_user = _workos_api("POST", "/user_management/users", {
                "email": email,
                "password": temp_password,
                "first_name": first_name,
                "last_name": last_name,
                "email_verified": True,
            })
        except Exception as e:
            error_msg = str(e)
            if "409" in error_msg or "already exists" in error_msg.lower():
                return err(409, f"User {email} already exists in the system")
            print(f"WORKOS_CREATE_USER_ERROR: {e}")
            return err(400, f"Failed to create user account: {error_msg}")

        USERS_T.put_item(Item={
            "userId": user_id, "tenantId": tenant_id, "email": email,
            "firstName": first_name, "lastName": last_name,
            "role": "EMPLOYEE", "status": "pending",
            "department": department, "jobTitle": job_title, "phone": phone,
            "inviteToken": invite_token, "invitedBy": caller_email, "createdAt": now
        })

        invite_url = f"https://uat.endevo.life/register?token={invite_token}&email={email}"

        try:
            ses.send_email(
                Source="noreply@endevo.life",
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": "You've been invited to Endevo Life"},
                    "Body": {"Html": {"Data": f"""
                        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
                          <div style="text-align:center;margin-bottom:24px">
                            <h1 style="color:#818cf8;font-size:26px;margin:0">Endevo Life</h1>
                            <p style="color:#64748b;font-size:13px;margin:4px 0 0">Digital Legacy & Estate Planning</p>
                          </div>
                          <h2 style="color:#e2e8f0;font-size:20px">You're invited to join!</h2>
                          <p style="color:#94a3b8">Hi {first_name or 'there'},</p>
                          <p style="color:#94a3b8">You've been invited to complete your digital legacy training on <strong style="color:#fff">Endevo Life</strong>.</p>
                          <div style="background:#1e293b;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #6366f1">
                            <p style="margin:0;color:#64748b;font-size:12px">Invited as:</p>
                            <p style="margin:4px 0 0;color:#e2e8f0;font-weight:600">Employee</p>
                          </div>
                          <p style="color:#94a3b8;font-size:14px">Click below to complete your account setup — no password needed, you'll login with a secure OTP code:</p>
                          <div style="text-align:center;margin:28px 0">
                            <a href="{invite_url}" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px;letter-spacing:-0.01em">
                              Complete Account Setup &rarr;
                            </a>
                          </div>
                          <p style="color:#475569;font-size:12px;text-align:center">This link expires in 7 days. Click it once to complete your account setup.</p>
                          <p style="color:#334155;font-size:11px;margin-top:24px;border-top:1px solid #1e293b;padding-top:16px;text-align:center">
                            Need help? <a href="mailto:support@endevo.life" style="color:#818cf8">support@endevo.life</a>
                          </p>
                        </div>"""}}
                }
            )
            email_sent = True
        except Exception as e:
            print(f"SES_ERROR: {e}")
            email_sent = False

        audit(tenant_id, caller_email, "INVITE_SENT",
              f"Invited {email} (dept: {department})", ip=ip, device=device)
        return resp(200, {
            "message": "Invitation sent", "user_id": user_id,
            "invite_url": invite_url, "email_sent": email_sent,
            "password_set": True
        })

    # ── PUT /api/hr/employees/{id} ────────────────────────────────────────
    if "/employees/" in path and method == "PUT":
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item or item.get("tenantId") != tenant_id:
            return err(404, "Employee not found in your organisation")

        allowed = ["firstName", "lastName", "department", "jobTitle", "status", "phone"]
        updates = {}
        for k in allowed:
            if k in body:
                updates[k] = sanitize(str(body[k]), 100) if isinstance(body[k], str) else body[k]
        if not updates:
            return err(400, "Nothing to update")
        if "status" in updates and updates["status"] not in ("active", "inactive", "pending"):
            return err(400, "Invalid status — must be active, inactive, or pending")

        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression=expr,
            ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        audit(tenant_id, caller_email, "EMPLOYEE_UPDATED",
              f"Updated {item.get('email','')} fields: {list(updates.keys())}", ip=ip, device=device)
        return resp(200, {"message": "Employee updated"})

    # ── DELETE /api/hr/employees/{id} — archive (no hard delete) ────────────
    if "/employees/" in path and method == "DELETE" and "/archive/" not in path:
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item or item.get("tenantId") != tenant_id:
            return err(404, "Employee not found in your organisation")
        if item.get("status") == "archived":
            return err(400, "Employee is already archived")
        emp_email = item.get("email", "")
        now = datetime.now(timezone.utc).isoformat()
        reason = sanitize(body.get("reason", "HR action"), 500)
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v, archivedAt = :at, archivedBy = :by, archiveReason = :reason, deactivatedAt = :at, deactivatedBy = :by",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "archived", ":at": now, ":by": caller_email, ":reason": reason})
        audit(tenant_id, caller_email, "EMPLOYEE_ARCHIVED",
              json.dumps({"userId": user_id, "email": emp_email, "reason": reason}),
              ip=ip, device=device, severity="WARN")
        return resp(200, {"message": f"Employee {emp_email} archived", "archivedAt": now})

    # ── POST /api/hr/employees/{id}/reactivate ────────────────────────────
    if "/employees/" in path and path.endswith("/reactivate") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item or item.get("tenantId") != tenant_id:
            return err(404, "Employee not found in your organisation")
        if item.get("status") == "active":
            return err(400, "Employee is already active")
        emp_email = item.get("email", "")
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v, reactivatedAt = :at, reactivatedBy = :by, restoredAt = :at, restoredBy = :by",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "active", ":at": now, ":by": caller_email})
        audit(tenant_id, caller_email, "EMPLOYEE_RESTORED",
              json.dumps({"userId": user_id, "email": emp_email, "previousStatus": item.get("status", ""), "restoredBy": caller_email}),
              ip=ip, device=device, severity="WARN")
        return resp(200, {"message": f"Employee {emp_email} restored"})

    # ── GET /api/hr/tenant ────────────────────────────────────────────────
    if path.endswith("/tenant") and method == "GET":
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t:
            return err(404, "Tenant not found")
        # Attach live user counts
        t["user_count"]     = count_items(USERS_T, Attr("tenantId").eq(tenant_id))
        t["active_count"]   = count_items(USERS_T, Attr("tenantId").eq(tenant_id) & Attr("status").eq("active"))
        t["employee_count"] = count_items(USERS_T, Attr("tenantId").eq(tenant_id) & Attr("role").eq("EMPLOYEE"))
        t["hr_count"]       = count_items(USERS_T, Attr("tenantId").eq(tenant_id) & Attr("role").eq("HR_ADMIN"))
        return resp(200, t)

    # ── GET /api/hr/training ──────────────────────────────────────────────
    if path.endswith("/training") and method == "GET":
        _train_t = dynamo.Table("endevo-uat-training")
        _prog_t  = dynamo.Table("endevo-uat-video-progress")
        from boto3.dynamodb.conditions import Key as _Key
        courses_resp = _train_t.query(KeyConditionExpression=_Key("tenantId").eq(tenant_id))
        courses = courses_resp.get("Items", [])
        # For each course count employees enrolled / completed
        employees = scan_all(USERS_T, Attr("tenantId").eq(tenant_id) & Attr("role").eq("EMPLOYEE"))
        emp_count = len(employees)
        result = []
        for c in courses:
            vid = c.get("videoId", c.get("courseId", ""))
            enrolled = 0
            completed_count = 0
            for emp in employees:
                prog = _prog_t.get_item(Key={"userId": emp["userId"], "videoId": vid}).get("Item")
                if prog:
                    enrolled += 1
                    if prog.get("completed"):
                        completed_count += 1
            result.append({
                **c,
                "courseId":       vid,
                "enrolled":       enrolled,
                "completed":      completed_count,
                "not_started":    emp_count - enrolled,
                "total_employees": emp_count,
                "completion_rate": round(completed_count / emp_count * 100) if emp_count > 0 else 0,
                "enrollment_rate": round(enrolled / emp_count * 100) if emp_count > 0 else 0,
            })
        return resp(200, {"courses": result, "count": len(result)})

    # ── GET /api/hr/certificates ──────────────────────────────────────────
    if path.endswith("/certificates") and method == "GET":
        _cert_t = dynamo.Table("endevo-uat-certificates")
        certs = scan_all(_cert_t, Attr("tenantId").eq(tenant_id))
        # Enrich with employee name
        for c in certs:
            uid = c.get("userId", "")
            if uid:
                user_result = scan_all(USERS_T, Attr("tenantId").eq(tenant_id) & Attr("role").eq("EMPLOYEE"))
                emp = next((u for u in user_result if u.get("userId") == uid or uid in str(u.get("userId",""))), None)
                if emp:
                    c["firstName"] = emp.get("firstName", "")
                    c["lastName"]  = emp.get("lastName", "")
                    c["email"]     = emp.get("email", "")
        certs.sort(key=lambda x: x.get("issuedAt", ""), reverse=True)
        return resp(200, {"certificates": certs, "count": len(certs)})

    # ── GET /api/hr/audit ─────────────────────────────────────────────────
    if path.endswith("/audit") and method == "GET":
        limit      = min(int(qs.get("limit", 50)), 200)
        next_token = qs.get("next_token")
        fexpr      = Attr("tenantId").eq(tenant_id)
        items, next_cursor = scan_page(AUDIT_T, limit, next_token, fexpr)
        logs = sorted(items, key=lambda x: x.get("createdAt", ""), reverse=True)
        return resp(200, {
            "logs":       logs,
            "count":      len(logs),
            "next_token": next_cursor,
            "has_more":   bool(next_cursor)
        })

    # ── GET /api/hr/metrics ─────────────────────────────────────────────
    if path.endswith("/metrics") and method == "GET":
        base_filter = Attr("tenantId").eq(tenant_id)
        all_users = scan_all(USERS_T, base_filter)
        total_users = len(all_users)
        active_users = [u for u in all_users if u.get("status") == "active"]
        pending_users = [u for u in all_users if u.get("status") == "pending"]
        active_count = len(active_users)
        pending_count = len(pending_users)

        # Activation rate: users who activated / total invited
        activation_rate = round((active_count / total_users * 100), 1) if total_users > 0 else 0.0

        # Module completion & overall progress
        # Fetch all user-module records for this tenant's active users
        active_user_ids = {u["userId"] for u in active_users}
        user_module_records = scan_all(
            USER_MODULES_T,
            Attr("tenantId").eq(tenant_id)
        ) if active_user_ids else []

        users_with_completion = set()
        # Group by userId to compute per-user progress
        user_progress_map = {}  # userId -> list of progress %
        for rec in user_module_records:
            uid = rec.get("userId", "")
            if uid not in active_user_ids:
                continue
            progress = float(rec.get("progress", 0))
            user_progress_map.setdefault(uid, []).append(progress)
            if rec.get("status") == "completed" or progress >= 100:
                users_with_completion.add(uid)

        # Completion rate: active users with at least 1 completed module / active users
        completion_rate = round((len(users_with_completion) / active_count * 100), 1) if active_count > 0 else 0.0

        # Overall progress: average of each user's average module progress
        if user_progress_map:
            per_user_averages = [
                sum(progs) / len(progs) for progs in user_progress_map.values()
            ]
            overall_progress = round(sum(per_user_averages) / len(per_user_averages), 1)
        else:
            overall_progress = 0.0

        return resp(200, {
            "activationRate":  activation_rate,
            "completionRate":  completion_rate,
            "overallProgress": overall_progress,
            "totalUsers":      total_users,
            "activeUsers":     active_count,
            "pendingUsers":    pending_count,
        })

    # ── GET /api/hr/subscription ──────────────────────────────────────────
    if path.endswith("/subscription") and method == "GET":
        # Fetch tenant record for subscription info
        tenant_item = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not tenant_item:
            return err(404, "Tenant not found")

        plan = tenant_item.get("plan", "basic").lower()
        seats = int(tenant_item.get("seats", 0))

        # Plan pricing constants
        plan_config = {
            "basic":   {"pricePerEmployee": 299, "sessionsPerEmployee": 2},
            "premium": {"pricePerEmployee": 499, "sessionsPerEmployee": 6},
        }
        cfg = plan_config.get(plan, plan_config["basic"])
        price_per_employee = cfg["pricePerEmployee"]
        sessions_per_employee = cfg["sessionsPerEmployee"]
        total_sessions = seats * sessions_per_employee

        # Count used seats (active + pending users in tenant)
        used_seats = count_items(USERS_T, Attr("tenantId").eq(tenant_id) & Attr("status").is_in(["active", "pending"]))

        # Count used sessions
        tenant_sessions = scan_all(SESSIONS_T, Attr("tenantId").eq(tenant_id))
        used_sessions = len([s for s in tenant_sessions if s.get("status") in ("completed", "scheduled", "in_progress")])

        # Fetch subscription record for billing history
        sub_item = None
        try:
            sub_results = scan_all(SUBSCRIPTIONS_T, Attr("tenantId").eq(tenant_id))
            sub_item = sub_results[0] if sub_results else None
        except Exception:
            pass
        billing_history = sub_item.get("billingHistory", []) if sub_item else []

        return resp(200, {
            "tenantId":            tenant_id,
            "plan":                plan,
            "seats":               seats,
            "usedSeats":           used_seats,
            "pricePerEmployee":    price_per_employee,
            "sessionsPerEmployee": sessions_per_employee,
            "totalSessions":       total_sessions,
            "usedSessions":        used_sessions,
            "billingHistory":      billing_history,
        })

    # ── GET /api/hr/sessions ──────────────────────────────────────────────
    if path.endswith("/sessions") and method == "GET" and "/sessions/book" not in path:
        # Tenant session overview
        tenant_item = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        plan = (tenant_item.get("plan", "basic").lower()) if tenant_item else "basic"
        seats = int(tenant_item.get("seats", 0)) if tenant_item else 0
        sessions_per_employee = 2 if plan == "basic" else 6
        total_allocated = seats * sessions_per_employee

        # Fetch all session records for tenant
        tenant_sessions = scan_all(SESSIONS_T, Attr("tenantId").eq(tenant_id))
        used = len([s for s in tenant_sessions if s.get("status") in ("completed", "scheduled", "in_progress")])
        remaining = max(total_allocated - used, 0)

        # Recent sessions (last 20, sorted by date desc)
        recent = sorted(tenant_sessions, key=lambda s: s.get("scheduledAt", s.get("createdAt", "")), reverse=True)[:20]
        recent_list = [{
            "sessionId":   s.get("sessionId", ""),
            "userId":      s.get("userId", ""),
            "coachId":     s.get("coachId", ""),
            "scheduledAt": s.get("scheduledAt", ""),
            "status":      s.get("status", ""),
            "createdAt":   s.get("createdAt", ""),
        } for s in recent]

        return resp(200, {
            "plan":              plan,
            "sessionsPerEmployee": sessions_per_employee,
            "totalAllocated":    total_allocated,
            "used":              used,
            "remaining":         remaining,
            "recentSessions":    recent_list,
        })

    # ── POST /api/hr/sessions/book ────────────────────────────────────────
    if path.endswith("/sessions/book") and method == "POST":
        user_id = sanitize((body.get("userId") or "").strip(), 100)
        scheduled_at = sanitize((body.get("scheduledAt") or "").strip(), 50)
        coach_id = sanitize((body.get("coachId") or "").strip(), 100)

        if not user_id:
            return err(400, "userId is required")
        if not scheduled_at:
            return err(400, "scheduledAt is required")

        # Validate employee belongs to tenant
        emp = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not emp or emp.get("tenantId") != tenant_id:
            return err(404, "User not found in your organisation")
        if emp.get("status") == "inactive":
            return err(400, "Cannot book session for inactive user")

        # Check session quota
        tenant_item = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        plan = (tenant_item.get("plan", "basic").lower()) if tenant_item else "basic"
        seats = int(tenant_item.get("seats", 0)) if tenant_item else 0
        sessions_per_employee = 2 if plan == "basic" else 6
        total_allocated = seats * sessions_per_employee

        tenant_sessions = scan_all(SESSIONS_T, Attr("tenantId").eq(tenant_id))
        used = len([s for s in tenant_sessions if s.get("status") in ("completed", "scheduled", "in_progress")])
        if used >= total_allocated:
            return err(400, f"Session quota exceeded ({used}/{total_allocated}). Upgrade plan or add seats.")

        # Create session record
        now = datetime.now(timezone.utc).isoformat()
        session_id = str(uuid.uuid4())
        session_item = {
            "tenantId":    tenant_id,
            "sessionId":   session_id,
            "userId":      user_id,
            "scheduledAt": scheduled_at,
            "status":      "scheduled",
            "createdAt":   now,
            "bookedBy":    caller_email,
        }
        if coach_id:
            session_item["coachId"] = coach_id

        SESSIONS_T.put_item(Item=session_item)

        audit(tenant_id, caller_email, "SESSION_BOOKED",
              f"Booked session {session_id} for user {user_id} at {scheduled_at}",
              ip=ip, device=device)

        return resp(200, {
            "message":     "Session booked successfully",
            "sessionId":   session_id,
            "userId":      user_id,
            "scheduledAt": scheduled_at,
            "status":      "scheduled",
        })

    # ── POST /api/hr/upload-url ────────────────────────────────────────────
    if path.endswith("/upload-url") and method == "POST":
        ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "pdf"}
        ALLOWED_TYPES = {"logo", "photo", "document"}
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

        upload_type = sanitize(body.get("type", ""), 20).lower()
        filename = sanitize(body.get("filename", ""), 255)

        if not upload_type or upload_type not in ALLOWED_TYPES:
            return err(400, f"Invalid type. Allowed: {', '.join(sorted(ALLOWED_TYPES))}")
        if not filename:
            return err(400, "filename is required")

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            return err(400, f"File extension '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

        safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
        s3_key = f"uploads/{upload_type}/{tenant_id}/{uuid.uuid4()}_{safe_filename}"

        content_type_map = {
            "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "webp": "image/webp",
            "pdf": "application/pdf",
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

    # ── POST /api/hr/branding ────────────────────────────────────────────
    if path.endswith("/branding") and method == "POST":
        logo_url = sanitize(body.get("logoUrl", ""), 500)
        primary_color = sanitize(body.get("primaryColor", ""), 20)
        company_name = sanitize(body.get("companyName", ""), 200)

        if not any([logo_url, primary_color, company_name]):
            return err(400, "At least one branding field required (logoUrl, primaryColor, companyName)")

        # Validate logoUrl is HTTPS
        if logo_url and not logo_url.startswith("https://"):
            return err(400, "logoUrl must be an HTTPS URL")

        if primary_color and not re.match(r'^#[0-9A-Fa-f]{3,8}$', primary_color):
            return err(400, "Invalid color format. Use hex (e.g. #2BBFC5)")

        updates = {}
        if logo_url:
            updates["logoUrl"] = logo_url
        if primary_color:
            updates["primaryColor"] = primary_color
        if company_name:
            updates["companyName"] = company_name
        updates["brandingUpdatedAt"] = datetime.now(timezone.utc).isoformat()

        expr = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals = {f":{k}": v for k, v in updates.items()}

        try:
            TENANTS_T.update_item(
                Key={"tenantId": tenant_id},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=vals,
            )
        except Exception as e:
            print(f"BRANDING_UPDATE_ERROR: {e}")
            return err(500, "Failed to update branding")

        audit(tenant_id, caller_email, "TENANT_BRANDING_UPDATED",
              f"HR updated branding for tenant {tenant_id}: {json.dumps(updates, default=str)}",
              ip=ip, device=device)

        return resp(200, {
            "message": "Branding updated successfully",
            "tenantId": tenant_id,
            "branding": updates,
        })

    # ══════════════════════════════════════════════════════════════════════
    # ── Archive / Recycle Bin Routes ─────────────────────────────────────
    # ══════════════════════════════════════════════════════════════════════

    # ── GET /api/hr/archive/employees — List archived employees in tenant ─
    if path.endswith("/archive/employees") and method == "GET":
        all_archived = scan_all(USERS_T,
            Attr("tenantId").eq(tenant_id) & Attr("status").eq("archived"))
        result_items = [{
            "userId":        u.get("userId"),
            "email":         u.get("email"),
            "name":          u.get("name", ""),
            "role":          u.get("role", ""),
            "department":    u.get("department", ""),
            "archivedAt":    u.get("archivedAt", u.get("deactivatedAt", "")),
            "archivedBy":    u.get("archivedBy", u.get("deactivatedBy", "")),
            "archiveReason": u.get("archiveReason", ""),
        } for u in all_archived]
        return resp(200, {"employees": result_items, "count": len(result_items)})

    # ── POST /api/hr/archive/employees/{userId}/restore — Restore employee
    if "/archive/employees/" in path and path.endswith("/restore") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item or item.get("tenantId") != tenant_id:
            return err(404, "Archived employee not found in your organisation")
        if item.get("status") != "archived":
            return err(400, f"Employee is not archived (status: {item.get('status')})")
        emp_email = item.get("email", "")
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v, restoredAt = :at, restoredBy = :by, reactivatedAt = :at, reactivatedBy = :by",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "active", ":at": now, ":by": caller_email})
        audit(tenant_id, caller_email, "EMPLOYEE_RESTORED",
              json.dumps({"userId": user_id, "email": emp_email, "restoredBy": caller_email}),
              ip=ip, device=device, severity="WARN")
        return resp(200, {"message": f"Employee {emp_email} restored from archive", "restoredAt": now})

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
