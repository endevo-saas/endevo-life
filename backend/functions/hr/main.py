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
"""
import json, os, uuid, base64, re
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

POOL_ID   = os.environ.get("COGNITO_POOL_ID", "us-east-1_DVyEJqgFt")
REGION    = os.environ.get("AWS_REGION", "us-east-1")
dynamo    = boto3.resource("dynamodb", region_name=REGION)
cognito   = boto3.client("cognito-idp", region_name=REGION)
ses       = boto3.client("ses", region_name=REGION)
USERS_T   = dynamo.Table("endevo-uat-users")
AUDIT_T   = dynamo.Table("endevo-uat-audit")

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
    return resp(status, {"detail": msg})

def get_body(event):
    try:
        return json.loads(event.get("body") or "{}")
    except:
        return {}

def get_caller(event):
    token = (event.get("headers") or {}).get("authorization", "").replace("Bearer ", "")
    if not token:
        return None, None, None
    try:
        u = cognito.get_user(AccessToken=token)
        attrs = {a["Name"]: a["Value"] for a in u["UserAttributes"]}
        return attrs.get("custom:tenantId"), attrs.get("custom:role"), attrs.get("email")
    except:
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

def handler(event, context):
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
        return resp(200, {
            "total_users":     count_items(USERS_T, base_filter),
            "active_users":    count_items(USERS_T, base_filter & Attr("status").eq("active")),
            "pending_invites": count_items(USERS_T, base_filter & Attr("status").eq("pending")),
            "total_employees": count_items(USERS_T, base_filter & Attr("role").eq("EMPLOYEE")),
        })

    # ── GET /api/hr/employees ─────────────────────────────────────────────
    if path.endswith("/employees") and method == "GET":
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

        if not email:
            return err(400, "Email required")
        if not validate_email(email):
            return err(400, "Invalid email format")

        # Check for duplicate invite within this tenant
        existing = scan_all(USERS_T, Attr("email").eq(email) & Attr("tenantId").eq(tenant_id))
        if existing:
            return err(409, f"{email} is already a member of this organisation")

        invite_token  = str(uuid.uuid4())
        temp_password = f"Invite@{str(uuid.uuid4())[:8]}!"
        user_id       = str(uuid.uuid4())
        now           = datetime.now(timezone.utc).isoformat()

        # Look up tenant name for Cognito attribute
        tenant_name = ""
        try:
            t = dynamo.Table("endevo-uat-tenants").get_item(Key={"tenantId": tenant_id}).get("Item")
            tenant_name = t.get("name", "") if t else ""
        except Exception:
            pass

        # Check global email uniqueness — one email one role
        from boto3.dynamodb.conditions import Attr as _Attr
        global_existing = scan_all(USERS_T, _Attr("email").eq(email))
        if global_existing:
            existing_role = global_existing[0].get("role", "unknown")
            return err(409, f"{email} is already registered as {existing_role} in the system. One email can only hold one role.")

        # Create Cognito user
        try:
            cognito.admin_create_user(
                UserPoolId=POOL_ID, Username=email,
                TemporaryPassword=temp_password,
                UserAttributes=[
                    {"Name": "email",             "Value": email},
                    {"Name": "email_verified",    "Value": "true"},
                    {"Name": "given_name",        "Value": first_name},
                    {"Name": "family_name",       "Value": last_name},
                    {"Name": "custom:role",       "Value": "EMPLOYEE"},
                    {"Name": "custom:tenantId",   "Value": tenant_id},
                    {"Name": "custom:tenantName", "Value": tenant_name},
                ],
                MessageAction="SUPPRESS"
            )
            cognito.admin_set_user_password(UserPoolId=POOL_ID, Username=email,
                Password=temp_password, Permanent=True)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "UsernameExistsException":
                return err(409, f"User {email} already exists in the system")
            return err(400, str(e.response["Error"]["Message"]))

        USERS_T.put_item(Item={
            "userId": user_id, "tenantId": tenant_id, "email": email,
            "firstName": first_name, "lastName": last_name,
            "role": "EMPLOYEE", "status": "pending",
            "department": department, "jobTitle": job_title,
            "inviteToken": invite_token, "invitedBy": caller_email, "createdAt": now
        })

        invite_url = f"https://main.d1vgn9nzfx4cxk.amplifyapp.com/register?token={invite_token}&email={email}"

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
                          <p style="color:#94a3b8;font-size:14px">Click the button below to accept your invitation and create your own password:</p>
                          <div style="text-align:center;margin:28px 0">
                            <a href="{invite_url}" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px;letter-spacing:-0.01em">
                              Accept Invitation &rarr;
                            </a>
                          </div>
                          <p style="color:#475569;font-size:12px;text-align:center">This link expires in 7 days. Click it once — you'll create your own password.</p>
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
            "temp_password": temp_password
        })

    # ── PUT /api/hr/employees/{id} ────────────────────────────────────────
    if "/employees/" in path and method == "PUT":
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item or item.get("tenantId") != tenant_id:
            return err(404, "Employee not found in your organisation")

        allowed = ["firstName", "lastName", "department", "jobTitle", "status"]
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

    # ── DELETE /api/hr/employees/{id} — deactivate (no hard delete) ─────────
    if "/employees/" in path and method == "DELETE":
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item or item.get("tenantId") != tenant_id:
            return err(404, "Employee not found in your organisation")
        emp_email = item.get("email", "")
        # Disable in Cognito so they can't login
        try:
            cognito.admin_disable_user(UserPoolId=POOL_ID, Username=emp_email)
        except ClientError as e:
            if e.response["Error"]["Code"] != "UserNotFoundException":
                return err(400, f"Deactivation failed: {e.response['Error']['Message']}")
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v, deactivatedAt = :at, deactivatedBy = :by",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "inactive", ":at": now, ":by": caller_email})
        audit(tenant_id, caller_email, "EMPLOYEE_DEACTIVATED",
              f"Deactivated: {emp_email}", ip=ip, device=device, severity="WARNING")
        return resp(200, {"message": f"Employee {emp_email} deactivated"})

    # ── POST /api/hr/employees/{id}/reactivate ────────────────────────────
    if "/employees/" in path and path.endswith("/reactivate") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item or item.get("tenantId") != tenant_id:
            return err(404, "Employee not found in your organisation")
        emp_email = item.get("email", "")
        try:
            cognito.admin_enable_user(UserPoolId=POOL_ID, Username=emp_email)
        except ClientError as e:
            if e.response["Error"]["Code"] != "UserNotFoundException":
                return err(400, f"Reactivation failed: {e.response['Error']['Message']}")
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v, reactivatedAt = :at",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "active", ":at": now})
        audit(tenant_id, caller_email, "EMPLOYEE_REACTIVATED",
              f"Reactivated: {emp_email}", ip=ip, device=device)
        return resp(200, {"message": f"Employee {emp_email} reactivated"})

    # ── GET /api/hr/tenant ────────────────────────────────────────────────
    if path.endswith("/tenant") and method == "GET":
        TENANTS_T = dynamo.Table("endevo-uat-tenants")
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
        TRAIN_T  = dynamo.Table("endevo-uat-training")
        PROG_T   = dynamo.Table("endevo-uat-video-progress")
        from boto3.dynamodb.conditions import Key as _Key
        courses_resp = TRAIN_T.query(KeyConditionExpression=_Key("tenantId").eq(tenant_id))
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
                prog = PROG_T.get_item(Key={"userId": emp["userId"], "videoId": vid}).get("Item")
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
        CERT_T = dynamo.Table("endevo-uat-certificates")
        certs = scan_all(CERT_T, Attr("tenantId").eq(tenant_id))
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

    return err(404, f"Route not found: {method} {path}")
