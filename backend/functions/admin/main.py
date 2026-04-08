"""
Endevo Life — Global Admin Lambda (pure boto3, no pip needed)
Foundation v2: pagination, server-side search, input validation, sanitization

Routes:
  GET  /api/admin/dashboard
  GET  /api/admin/tenants            ?search=&limit=50&next_token=
  POST /api/admin/tenants
  GET  /api/admin/tenants/{id}
  PUT  /api/admin/tenants/{id}
  DELETE /api/admin/tenants/{id}
  GET  /api/admin/users              ?search=&tenantId=&role=&status=&limit=50&next_token=
  POST /api/admin/users
  GET  /api/admin/users/{id}
  PUT  /api/admin/users/{id}
  DELETE /api/admin/users/{id}
  POST /api/admin/users/{id}/lock
  POST /api/admin/users/{id}/unlock
  POST /api/admin/users/{id}/reset-password
  POST /api/admin/invite
  GET  /api/admin/audit              ?limit=100&next_token=
  GET  /api/admin/health

  Subscription & Billing:
  GET  /api/admin/subscriptions                     Billing overview (all tenants)
  GET  /api/admin/subscriptions/{tenantId}           Tenant subscription detail
  POST /api/admin/subscriptions/{tenantId}/invoice   Create manual invoice
  PUT  /api/admin/subscriptions/{tenantId}/plan      Change tenant plan

  Metrics:
  GET  /api/admin/metrics/overview                   Platform-wide metrics
"""
import json, os, uuid, base64, re
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr, Key

REGION    = os.environ.get("AWS_REGION", "us-east-1")
dynamo    = boto3.resource("dynamodb", region_name=REGION)
ses       = boto3.client("ses", region_name=REGION)
_secrets  = boto3.client("secretsmanager", region_name=REGION)
USERS_T          = dynamo.Table("endevo-uat-users")
TENANTS_T        = dynamo.Table("endevo-uat-tenants")
AUDIT_T          = dynamo.Table("endevo-uat-audit")
CERT_T           = dynamo.Table("endevo-uat-certificates")
TRAINING_T       = dynamo.Table("endevo-uat-training")
VIDEO_PROGRESS_T = dynamo.Table("endevo-uat-video-progress")
CONFIG_T         = dynamo.Table("endevo-uat-config")
SUBSCRIPTIONS_T  = dynamo.Table("endevo-uat-subscriptions")
SESSIONS_T       = dynamo.Table("endevo-uat-sessions")

# ── Platform Config Defaults ──────────────────────────────────────────────────
CONFIG_DEFAULTS = {
    "platform": {
        "company_name": "Endevo Life",
        "support_email": "support@endevo.life",
        "max_tenants": 99999,
        "platform_name": "Endevo Life",
        "tagline": "Digital Legacy & Estate Planning"
    },
    "pricing": {
        "basic":   {"price_monthly": 29, "price_yearly": 299, "max_seats": 100,  "label": "Endevo Basic",   "custom": False},
        "premium": {"price_monthly": 49, "price_yearly": 499, "max_seats": 9999, "label": "Endevo Premium", "custom": False}
    },
    "security": {
        "otp_enabled": False,
        "captcha_enabled": False,
        "session_timeout_hours": 8,
        "max_login_attempts": 5,
        "lockout_duration_minutes": 30,
        "mfa_required": False,
        "password_expiry_days": 90
    },
    "notifications": {
        "from_email": "noreply@endevo.life",
        "from_name": "Endevo Life",
        "invite_email_enabled": True,
        "welcome_email_enabled": True
    }
}

# ── Secrets & WorkOS ─────────────────────────────────────────────────────────

_secret_cache = {}

def _get_secret(name):
    if name in _secret_cache:
        return _secret_cache[name]
    val = _secrets.get_secret_value(SecretId=name)["SecretString"]
    _secret_cache[name] = val
    return val

def _workos_api(method, path, body=None):
    """Call WorkOS User Management API."""
    import urllib.request
    api_key = _get_secret("endevo/workos/api-key")
    url = f"https://api.workos.com{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status == 204:
            return {}
        return json.loads(resp.read())

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
    """Extract (role, email) from Bearer token via session token or WorkOS JWT."""
    auth_header = (event.get("headers") or {}).get("authorization", "")
    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else auth_header.strip()
    if not token:
        return None, None

    # Session token (from OTP login) — look up in DynamoDB
    if token.startswith("endevo_"):
        try:
            result = USERS_T.scan(FilterExpression=Attr("sessionToken").eq(token))
            items = result.get("Items", [])
            if items:
                u = items[0]
                # Check session expiry (24h TTL)
                expires = u.get("sessionExpiresAt", "")
                if expires:
                    exp_dt = datetime.fromisoformat(expires)
                    if datetime.now(timezone.utc) > exp_dt:
                        return None, None
                return u.get("role"), u.get("email")
        except Exception as e:
            print(f"SESSION_LOOKUP_ERROR: {e}")
        return None, None

    # WorkOS JWT — validate and look up in DynamoDB
    try:
        from utils.workos_auth import is_workos_token, validate_workos_token
        if is_workos_token(token):
            workos_user = validate_workos_token(token)
            if workos_user:
                email = workos_user["email"]
                try:
                    result = USERS_T.query(
                        IndexName="email-index",
                        KeyConditionExpression=Key("email").eq(email),
                    )
                    items = result.get("Items", [])
                    if items:
                        return items[0].get("role"), email
                except Exception as e:
                    print(f"WORKOS_ADMIN_DB_ERROR: {e}")
                return None, email
        return None, None
    except ImportError:
        print("CRITICAL: workos_auth module not available")
        return None, None

def sanitize(value, max_len=200):
    """Strip whitespace, remove ALL HTML tags, limit length, block XSS patterns."""
    if not isinstance(value, str):
        return value
    v = value.strip()[:max_len]
    # Strip all HTML/XML tags completely
    v = re.sub(r'<[^>]*>', '', v)
    # Block dangerous patterns
    for bad in ["javascript:", "onload=", "onerror=", "onclick=", "eval(", "document.", "window."]:
        v = re.sub(re.escape(bad), "", v, flags=re.IGNORECASE)
    return v.strip()

def validate_email(email):
    """RFC-5322 lightweight check."""
    if not email or len(email) > 254:
        return False
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))

def encode_cursor(last_key):
    """Encode DynamoDB LastEvaluatedKey as URL-safe base64 string."""
    if not last_key:
        return None
    return base64.urlsafe_b64encode(json.dumps(last_key, default=str).encode()).decode()

def decode_cursor(token):
    """Decode cursor token back to DynamoDB ExclusiveStartKey."""
    if not token:
        return None
    try:
        return json.loads(base64.urlsafe_b64decode(token.encode()))
    except:
        return None

def scan_page(table, limit, next_token, filter_expr=None, proj=None):
    """Single paginated scan. Returns (items, next_cursor)."""
    limit = min(max(int(limit or 50), 1), 200)
    params = {"Limit": limit}
    if filter_expr is not None:
        params["FilterExpression"] = filter_expr
    if proj:
        params["ProjectionExpression"] = proj
    start_key = decode_cursor(next_token)
    if start_key:
        params["ExclusiveStartKey"] = start_key
    result = table.scan(**params)
    items = result.get("Items", [])
    return items, encode_cursor(result.get("LastEvaluatedKey"))

def scan_all(table, filter_expr=None):
    """Full scan with automatic pagination (for counts/dashboard only)."""
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
    """Count items without loading data. Uses Select=COUNT for efficiency."""
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
            "tenantId":  tenant_id or "SYSTEM",
            "sk":        f"{now}#{audit_id}",
            "auditId":   audit_id,
            "actor":     actor,
            "action":    action,
            "details":   details[:500],
            "severity":  severity,
            "createdAt": now
        }
        if ip:   item["ip_address"] = ip
        if device: item["user_agent"] = device
        AUDIT_T.put_item(Item=item)
    except Exception as e:
        print(f"AUDIT_WRITE_ERROR: {e}")

def get_config(key):
    """Get config from DynamoDB, fall back to compiled defaults."""
    try:
        item = CONFIG_T.get_item(Key={"configKey": key}).get("Item")
        if item:
            return item.get("configValue", CONFIG_DEFAULTS.get(key, {}))
    except Exception:
        pass
    return CONFIG_DEFAULTS.get(key, {})

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
    role, caller_email = get_caller(event)
    if not role:
        return err(401, "Not authenticated")
    if role != "GLOBAL_ADMIN":
        return err(403, "Global Admin access required")

    # ── GET /api/admin/dashboard ──────────────────────────────────────────
    if path.endswith("/dashboard") and method == "GET":
        total_tenants  = count_items(TENANTS_T)
        active_tenants = count_items(TENANTS_T, Attr("status").eq("active"))
        total_users    = count_items(USERS_T)
        active_users   = count_items(USERS_T, Attr("status").eq("active"))
        total_certs    = count_items(CERT_T)
        return resp(200, {
            "total_tenants":      total_tenants,
            "active_tenants":     active_tenants,
            "total_users":        total_users,
            "active_users":       active_users,
            "locked_users":       count_items(USERS_T, Attr("status").eq("locked")),
            "pending_users":      count_items(USERS_T, Attr("status").eq("pending")),
            "total_certificates": total_certs,
            "system_status":      "healthy"
        })

    # ── GET /api/admin/tenants ────────────────────────────────────────────
    if path.endswith("/tenants") and method == "GET":
        limit       = qs.get("limit", 50)
        next_token  = qs.get("next_token")
        search      = sanitize(qs.get("search", ""), 100)
        plan_filter = qs.get("plan", "")
        status_filter = qs.get("status", "")

        # Build filter expression (plan/status only; name search done in Python for case-insensitivity)
        fexpr = None
        if plan_filter:
            pf = Attr("plan").eq(plan_filter)
            fexpr = (fexpr & pf) if fexpr else pf
        if status_filter:
            sf = Attr("status").eq(status_filter)
            fexpr = (fexpr & sf) if fexpr else sf

        items, next_cursor = scan_page(TENANTS_T, limit, next_token, fexpr)

        # Case-insensitive name search in Python (DynamoDB contains() is case-sensitive)
        if search:
            sl = search.lower()
            items = [t for t in items if sl in t.get("name", "").lower() or sl in t.get("tenantId", "").lower()]

        # Get user counts per tenant using COUNT (no data transfer)
        for t in items:
            tid = t["tenantId"]
            t["user_count"]     = count_items(USERS_T, Attr("tenantId").eq(tid))
            t["active_count"]   = count_items(USERS_T, Attr("tenantId").eq(tid) & Attr("status").eq("active"))
            t["hr_count"]       = count_items(USERS_T, Attr("tenantId").eq(tid) & Attr("role").eq("HR_ADMIN"))
            t["employee_count"] = count_items(USERS_T, Attr("tenantId").eq(tid) & Attr("role").eq("EMPLOYEE"))

        return resp(200, {
            "tenants":    items,
            "count":      len(items),
            "next_token": next_cursor,
            "has_more":   bool(next_cursor)
        })

    # ── POST /api/admin/tenants ───────────────────────────────────────────
    if path.endswith("/tenants") and method == "POST":
        name       = sanitize(body.get("name") or "", 100)
        plan       = sanitize(body.get("plan") or "basic", 50)
        max_seats  = body.get("maxSeats")
        website    = sanitize(body.get("website") or "", 200)
        hr_contact = sanitize(body.get("hrContact") or "", 100)
        hr_email   = sanitize((body.get("hrEmail") or "").lower().strip(), 254)
        hr_first   = sanitize(body.get("hrFirstName") or hr_contact.split()[0] if hr_contact else "", 50)
        hr_last    = sanitize(body.get("hrLastName")  or (hr_contact.split()[1] if len(hr_contact.split()) > 1 else "Admin"), 50)
        hr_phone   = (body.get("hrPhone") or "").strip()[:20]

        # Reject raw input containing HTML/script injection before sanitization
        raw_name = body.get("name") or ""
        if re.search(r'[<>]|javascript:|on\w+=', raw_name, re.IGNORECASE):
            return err(400, "Tenant name contains invalid characters")
        if not name:
            return err(400, "Tenant name required")
        if len(name) < 2:
            return err(400, "Tenant name must be at least 2 characters")
        # HR admin email is MANDATORY — without it there's no one to notify the org
        if not hr_email:
            return err(400, "HR Admin email is required. Every tenant must have an HR admin to manage their organization.")
        if not validate_email(hr_email):
            return err(400, "Invalid HR admin email format")
        if plan not in ("basic", "premium"):
            return err(400, "Invalid plan")
        try:
            max_seats = int(max_seats or 50)
        except (TypeError, ValueError):
            return err(400, "maxSeats must be a number")

        # Check HR email uniqueness globally — one email, one role
        _email_res = USERS_T.query(IndexName="email-index", KeyConditionExpression=Key("email").eq(hr_email))
        existing_user = _email_res.get("Items", [])
        if existing_user:
            existing_role = existing_user[0].get("role", "unknown")
            return err(409, f"Email {hr_email} is already registered as {existing_role}. One email can only hold one role.")

        # Sequential tenant ID — format: tenant-00001 (supports up to 99,999+)
        seq = count_items(TENANTS_T) + 1
        tenant_id = f"tenant-{seq:05d}"
        while TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item"):
            seq += 1
            tenant_id = f"tenant-{seq:05d}"

        now = datetime.now(timezone.utc).isoformat()
        TENANTS_T.put_item(Item={
            "tenantId": tenant_id, "name": name, "plan": plan, "status": "active",
            "website": website, "hrContact": hr_contact, "hrEmail": hr_email,
            "createdAt": now, "createdBy": caller_email,
            "maxSeats": max_seats, "employeeCount": 0,
            "tenantCode": tenant_id
        })

        # Auto-create HR Admin account and send invite email
        invite_token  = str(uuid.uuid4())
        temp_password = f"Endevo@{str(uuid.uuid4())[:8]}!"
        hr_user_id    = str(uuid.uuid4())
        hr_created    = False
        email_sent    = False

        try:
            _workos_api("POST", "/user_management/users", {
                "email": hr_email,
                "password": temp_password,
                "first_name": hr_first or "HR",
                "last_name": hr_last or "Admin",
                "email_verified": True,
            })
            USERS_T.put_item(Item={
                "userId": hr_user_id, "tenantId": tenant_id, "email": hr_email,
                "firstName": hr_first or "HR", "lastName": hr_last or "Admin",
                "phone": hr_phone,
                "role": "HR_ADMIN", "status": "active", "inviteToken": invite_token,
                "createdBy": caller_email, "createdAt": now
            })
            hr_created = True
        except Exception as ce:
            # HR admin creation failed — don't fail the tenant, but note it
            print(f"HR_ADMIN_CREATE_ERROR: {ce}")

        if hr_created:
            invite_url = f"https://uat.endevo.life/login"
            try:
                ses.send_email(
                    Source="no-reply@endevo.life",
                    Destination={"ToAddresses": [hr_email]},
                    Message={
                        "Subject": {"Data": f"Welcome to Endevo Life — You are the HR Admin for {name}"},
                        "Body": {"Html": {"Data": f"""
                            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
                              <div style="text-align:center;margin-bottom:24px">
                                <h1 style="color:#818cf8;font-size:28px;margin:0">Endevo Life</h1>
                                <p style="color:#64748b;font-size:14px;margin:4px 0 0">Digital Legacy & Estate Planning Platform</p>
                              </div>
                              <h2 style="color:#e2e8f0;font-size:20px">Your HR Admin Account is Ready</h2>
                              <p style="color:#94a3b8">You have been set up as the <strong style="color:#818cf8">HR Administrator</strong> for <strong style="color:#fff">{name}</strong>.</p>
                              <div style="background:#1e293b;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #818cf8">
                                <p style="margin:0 0 8px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px">Your Login Credentials</p>
                                <p style="margin:4px 0;color:#e2e8f0"><strong>Email:</strong> {hr_email}</p>
                                <p style="margin:4px 0;color:#e2e8f0"><strong>Temporary Password:</strong> <code style="background:#0f172a;padding:2px 8px;border-radius:4px;color:#818cf8">{temp_password}</code></p>
                                <p style="margin:4px 0;color:#e2e8f0"><strong>Organization:</strong> {name}</p>
                                <p style="margin:4px 0;color:#e2e8f0"><strong>Tenant ID:</strong> <code style="color:#64748b">{tenant_id}</code></p>
                              </div>
                              <p style="color:#94a3b8;font-size:14px">Please log in and change your password immediately.</p>
                              <a href="{invite_url}" style="display:inline-block;padding:14px 28px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0">Login to Endevo Life →</a>
                              <p style="color:#475569;font-size:12px;margin-top:24px;border-top:1px solid #1e293b;padding-top:16px">
                                As HR Admin you can: invite employees, manage training, view reports, and download certificates.<br>
                                Need help? Contact <a href="mailto:support@endevo.life" style="color:#818cf8">support@endevo.life</a>
                              </p>
                            </div>"""
                        }}
                    }
                )
                email_sent = True
            except Exception as se:
                print(f"SES_ERROR: {se}")

        audit("SYSTEM", caller_email, "TENANT_CREATED",
              f"Created tenant: {name} ({tenant_id}) | HR Admin: {hr_email} | Email sent: {email_sent}",
              ip=ip, device=device)
        return resp(200, {
            "message": f"Tenant '{name}' created successfully",
            "tenant_id":      tenant_id,
            "tenant_code":    tenant_id,
            "hr_admin_email": hr_email,
            "hr_admin_created": hr_created,
            "invite_email_sent": email_sent,
            "password_set": True if hr_created else False
        })

    # ── GET /api/admin/tenants/{id} ───────────────────────────────────────
    if "/tenants/" in path and method == "GET":
        tenant_id = path.split("/")[-1]
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t:
            return err(404, "Tenant not found")
        all_users = scan_all(USERS_T, Attr("tenantId").eq(tenant_id))
        safe_users = [{k: v for k, v in u.items() if k != "inviteToken"} for u in all_users]
        hr_admins = [u for u in safe_users if u.get("role") == "HR_ADMIN"]
        employees = [u for u in safe_users if u.get("role") == "EMPLOYEE"]
        active    = [u for u in safe_users if u.get("status") == "active"]
        t["users"]     = safe_users
        t["hr_admins"] = hr_admins
        t["employees"] = employees
        t["user_count"] = len(safe_users)
        t["stats"] = {
            "total_users": len(safe_users), "active_users": len(active),
            "hr_admins": len(hr_admins), "employees": len(employees)
        }
        return resp(200, t)

    # ── PUT /api/admin/tenants/{id} ───────────────────────────────────────
    if "/tenants/" in path and method == "PUT":
        tenant_id = path.split("/")[-1]
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t:
            return err(404, "Tenant not found")
        allowed = ["name", "plan", "status", "maxSeats", "website", "hrContact", "hrEmail"]
        updates = {}
        for k in allowed:
            if k in body:
                v = body[k]
                updates[k] = sanitize(str(v), 200) if isinstance(v, str) else v
        if not updates:
            return err(400, "Nothing to update")
        if "plan" in updates and updates["plan"] not in ("basic", "premium"):
            return err(400, "Invalid plan")
        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        TENANTS_T.update_item(Key={"tenantId": tenant_id}, UpdateExpression=expr,
            ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        audit(tenant_id, caller_email, "TENANT_UPDATED", f"Updated {tenant_id}: {list(updates.keys())}", ip=ip, device=device)
        return resp(200, {"message": "Tenant updated"})

    # ── POST /api/admin/tenants/{id}/disable ─────────────────────────────
    if "/tenants/" in path and path.endswith("/disable") and method == "POST":
        tenant_id = path.split("/")[-2]
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t:
            return err(404, "Tenant not found")
        if tenant_id in ("SYSTEM", "tenant-ind"):
            return err(400, "System tenants cannot be disabled")
        if t.get("status") == "disabled":
            return err(400, "Tenant is already disabled")
        now = datetime.now(timezone.utc).isoformat()
        TENANTS_T.update_item(Key={"tenantId": tenant_id},
            UpdateExpression="SET #s = :v, disabledAt = :at, disabledBy = :by",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "disabled", ":at": now, ":by": caller_email})
        # Deactivate all users in this tenant (DynamoDB status controls login)
        all_users = scan_all(USERS_T, Attr("tenantId").eq(tenant_id) & Attr("status").eq("active"))
        for u in all_users:
            try:
                USERS_T.update_item(Key={"userId": u["userId"]},
                    UpdateExpression="SET #s = :v",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={":v": "inactive"})
            except Exception:
                pass
        audit("SYSTEM", caller_email, "TENANT_DISABLED",
              f"Disabled tenant: {t.get('name')} ({tenant_id}) — {len(all_users)} users deactivated",
              ip=ip, device=device, severity="WARNING")
        return resp(200, {"message": f"Tenant '{t.get('name')}' disabled. {len(all_users)} users deactivated."})

    # ── POST /api/admin/tenants/{id}/enable ──────────────────────────────
    if "/tenants/" in path and path.endswith("/enable") and method == "POST":
        tenant_id = path.split("/")[-2]
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t:
            return err(404, "Tenant not found")
        if t.get("status") not in ("disabled", "suspended", "inactive"):
            return err(400, f"Tenant is already active (status: {t.get('status')})")
        now = datetime.now(timezone.utc).isoformat()
        TENANTS_T.update_item(Key={"tenantId": tenant_id},
            UpdateExpression="SET #s = :v, reactivatedAt = :at, reactivatedBy = :by",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "active", ":at": now, ":by": caller_email})
        # Re-activate all users in DynamoDB (status controls login)
        all_users = scan_all(USERS_T, Attr("tenantId").eq(tenant_id))
        reactivated = 0
        for u in all_users:
            try:
                USERS_T.update_item(Key={"userId": u["userId"]},
                    UpdateExpression="SET #s = :v",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={":v": "active"})
                reactivated += 1
            except Exception:
                pass
        audit("SYSTEM", caller_email, "TENANT_ENABLED",
              f"Re-enabled tenant: {t.get('name')} ({tenant_id}) — {reactivated} users reactivated",
              ip=ip, device=device, severity="WARNING")
        return resp(200, {"message": f"Tenant '{t.get('name')}' re-enabled. {reactivated} users reactivated."})

    # ── DELETE /api/admin/tenants/{id} — BLOCKED, no hard delete ─────────
    if "/tenants/" in path and method == "DELETE":
        return err(405, "Tenants cannot be deleted. Use POST /disable to disable or /enable to re-activate.")

    # ── GET /api/admin/users ──────────────────────────────────────────────
    if path.endswith("/users") and method == "GET":
        limit         = qs.get("limit", 50)
        next_token    = qs.get("next_token")
        search        = sanitize(qs.get("search", ""), 100)
        filter_tenant = qs.get("tenantId", "")
        filter_role   = qs.get("role", "")
        filter_status = qs.get("status", "")

        # Build compound filter
        fexpr = None
        if filter_tenant:
            fexpr = Attr("tenantId").eq(filter_tenant)
        if filter_role:
            rf = Attr("role").eq(filter_role)
            fexpr = (fexpr & rf) if fexpr else rf
        if filter_status:
            sf = Attr("status").eq(filter_status)
            fexpr = (fexpr & sf) if fexpr else sf
        if search:
            # Search across email, firstName, lastName
            sf = (Attr("email").contains(search) |
                  Attr("firstName").contains(search) |
                  Attr("lastName").contains(search))
            fexpr = (fexpr & sf) if fexpr else sf

        items, next_cursor = scan_page(USERS_T, limit, next_token, fexpr)
        safe = [{k: v for k, v in u.items() if k != "inviteToken"} for u in items]
        return resp(200, {
            "users":      safe,
            "count":      len(safe),
            "next_token": next_cursor,
            "has_more":   bool(next_cursor)
        })

    # ── POST /api/admin/users ─────────────────────────────────────────────
    if path.endswith("/users") and method == "POST":
        email      = sanitize((body.get("email") or "").lower().strip(), 254)
        first      = sanitize(body.get("firstName") or body.get("first_name") or "", 50)
        last       = sanitize(body.get("lastName") or body.get("last_name") or "", 50)
        user_role  = body.get("role") or "EMPLOYEE"
        tenant_id  = body.get("tenantId") or body.get("tenant_id") or ""
        department = sanitize(body.get("department") or "", 100)
        job_title  = sanitize(body.get("jobTitle") or body.get("job_title") or "", 100)
        phone      = (body.get("phone") or "").strip()[:20]

        if not email:
            return err(400, "Email required")
        if not phone:
            return err(400, "Phone number is required")
        if not validate_email(email):
            return err(400, "Invalid email format")
        if user_role not in ("GLOBAL_ADMIN", "HR_ADMIN", "EMPLOYEE"):
            return err(400, "Role must be GLOBAL_ADMIN, HR_ADMIN, or EMPLOYEE")
        if user_role in ("HR_ADMIN", "EMPLOYEE") and not tenant_id:
            return err(400, "tenantId required for HR_ADMIN and EMPLOYEE")

        # Global admins belong to SYSTEM tenant
        if user_role == "GLOBAL_ADMIN":
            tenant_id = "SYSTEM"

        # Enforce email uniqueness across all roles
        _email_res2 = USERS_T.query(IndexName="email-index", KeyConditionExpression=Key("email").eq(email))
        existing = _email_res2.get("Items", [])
        if existing:
            existing_role = existing[0].get("role", "unknown")
            return err(409, f"Email {email} already registered as {existing_role}. One email, one role.")

        tenant_name = ""
        if tenant_id and tenant_id != "SYSTEM":
            t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
            if not t:
                return err(404, f"Tenant {tenant_id} not found")
            tenant_name = t.get("name", "")

        invite_token = str(uuid.uuid4())

        # Create user in WorkOS (or find existing)
        workos_user_id = ""
        try:
            workos_user = _workos_api("POST", "/user_management/users", {
                "email": email,
                "first_name": first,
                "last_name": last,
                "email_verified": True,
            })
            workos_user_id = workos_user.get("id", "")
        except Exception as e:
            print(f"WORKOS_CREATE_USER: {e}")
            # User may already exist in WorkOS — look them up
            try:
                workos_lookup = _workos_api("GET", f"/user_management/users?email={email}")
                if workos_lookup.get("data"):
                    workos_user_id = workos_lookup["data"][0].get("id", "")
            except Exception:
                pass  # Continue without WorkOS ID — DynamoDB is source of truth
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        try:
            USERS_T.put_item(Item={
                "userId": user_id, "tenantId": tenant_id, "email": email,
                "firstName": first, "lastName": last, "role": user_role,
                "phone": phone,
                "status": "pending", "inviteToken": invite_token,
                "department": department, "jobTitle": job_title,
                "workosUserId": workos_user_id,
                "createdBy": caller_email, "createdAt": now
            })
        except Exception as e:
            # DynamoDB write failed — clean up WorkOS user to avoid orphan
            try:
                _workos_api("DELETE", f"/user_management/users/{workos_user_id}")
            except Exception:
                pass
            return err(500, f"Failed to save user record: {str(e)}")

        invite_url = f"https://uat.endevo.life/register?token={invite_token}&email={email}"
        try:
            ses.send_email(
                Source="no-reply@endevo.life",
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": f"You're invited to Endevo Life — {tenant_name or 'Platform'}"},
                    "Body": {"Html": {"Data": f"""
                        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
                          <div style="text-align:center;margin-bottom:24px">
                            <h1 style="color:#818cf8;font-size:26px;margin:0">Endevo Life</h1>
                            <p style="color:#64748b;font-size:13px;margin:4px 0 0">Digital Legacy & Estate Planning</p>
                          </div>
                          <h2 style="color:#e2e8f0;font-size:20px">You've been invited!</h2>
                          <p style="color:#94a3b8">You've been added as <strong style="color:#fff">{user_role.replace('_',' ')}</strong>{(' at <strong style="color:#fff">' + tenant_name + '</strong>') if tenant_name else ' to the Endevo Life platform'}.</p>
                          <div style="background:#1e293b;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #6366f1">
                            <p style="margin:0;color:#64748b;font-size:12px">Your role:</p>
                            <p style="margin:4px 0 0;color:#e2e8f0;font-weight:600">{user_role.replace('_',' ')}</p>
                            {('<p style="margin:4px 0 0;color:#64748b;font-size:12px">Organisation: <span style="color:#e2e8f0">' + tenant_name + '</span></p>') if tenant_name else ''}
                          </div>
                          <p style="color:#94a3b8;font-size:14px">Complete your account setup — no password needed, you'll login with a secure OTP code:</p>
                          <div style="text-align:center;margin:28px 0">
                            <a href="{invite_url}" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px">
                              Complete Account Setup &rarr;
                            </a>
                          </div>
                          <p style="color:#475569;font-size:12px;text-align:center">This link is personal to you. Click it once to complete your account setup.</p>
                          <p style="color:#334155;font-size:11px;margin-top:24px;border-top:1px solid #1e293b;padding-top:16px;text-align:center">
                            Questions? <a href="mailto:support@endevo.life" style="color:#818cf8">support@endevo.life</a>
                          </p>
                        </div>"""}}
                }
            )
            email_sent = True
        except Exception as e:
            print(f"SES_ERROR: {e}")
            email_sent = False

        audit(tenant_id or "SYSTEM", caller_email, "USER_CREATED",
              f"Created & invited {user_role}: {email} (tenant: {tenant_name or 'SYSTEM'})", ip=ip, device=device)
        return resp(200, {
            "message": f"User created and invitation sent to {email}",
            "user_id": user_id, "email": email, "role": user_role,
            "email_sent": email_sent, "invite_url": invite_url
        })

    # ── GET /api/admin/users/{id} ─────────────────────────────────────────
    if "/users/" in path and method == "GET" and not any(x in path for x in ["/lock", "/unlock", "/reset-password"]):
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        return resp(200, {k: v for k, v in item.items() if k != "inviteToken"})

    # ── PUT /api/admin/users/{id} ─────────────────────────────────────────
    if "/users/" in path and method == "PUT" and not any(x in path for x in ["/lock", "/unlock", "/reset-password"]):
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        allowed = ["firstName", "lastName", "department", "jobTitle", "status", "role"]
        updates = {}
        for k in allowed:
            if k in body:
                updates[k] = sanitize(str(body[k]), 100) if isinstance(body[k], str) else body[k]
        if not updates:
            return err(400, "Nothing to update")
        if "role" in updates and updates["role"] not in ("GLOBAL_ADMIN", "HR_ADMIN", "EMPLOYEE"):
            return err(400, "Invalid role")
        if "status" in updates and updates["status"] not in ("active", "inactive", "locked", "pending"):
            return err(400, "Invalid status")
        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression=expr,
            ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        audit(item.get("tenantId", "SYSTEM"), caller_email, "USER_UPDATED",
              f"Updated user: {item['email']} fields: {list(updates.keys())}", ip=ip, device=device)
        return resp(200, {"message": "User updated"})

    # ── DELETE /api/admin/users/{id} — BLOCKED, no hard delete ───────────
    if "/users/" in path and method == "DELETE" and not any(x in path for x in ["/lock", "/unlock", "/reset-password"]):
        return err(405, "Users cannot be deleted. Use POST /lock to deactivate or /unlock to re-activate.")

    # ── POST /api/admin/users/{id}/deactivate ─────────────────────────────
    if "/users/" in path and path.endswith("/deactivate") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        if item.get("status") == "inactive":
            return err(400, "User is already inactive")
        email = item.get("email", "")
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v, deactivatedAt = :at, deactivatedBy = :by",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "inactive", ":at": now, ":by": caller_email})
        audit(item.get("tenantId", "SYSTEM"), caller_email, "USER_DEACTIVATED",
              f"Deactivated: {email}", ip=ip, device=device, severity="WARNING")
        return resp(200, {"message": f"User {email} deactivated"})

    # ── POST /api/admin/users/{id}/reactivate ─────────────────────────────
    if "/users/" in path and path.endswith("/reactivate") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        if item.get("status") == "active":
            return err(400, "User is already active")
        email = item.get("email", "")
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v, reactivatedAt = :at, reactivatedBy = :by",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "active", ":at": now, ":by": caller_email})
        audit(item.get("tenantId", "SYSTEM"), caller_email, "USER_REACTIVATED",
              f"Reactivated: {email}", ip=ip, device=device, severity="WARNING")
        return resp(200, {"message": f"User {email} reactivated"})

    # ── POST /api/admin/users/{id}/lock ───────────────────────────────────
    if "/users/" in path and path.endswith("/lock") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        email = item.get("email", "")
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "locked"})
        audit(item.get("tenantId", "SYSTEM"), caller_email, "USER_LOCKED", f"Locked: {email}", ip=ip, device=device)
        return resp(200, {"message": f"User {email} locked"})

    # ── POST /api/admin/users/{id}/unlock ─────────────────────────────────
    if "/users/" in path and path.endswith("/unlock") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        email = item.get("email", "")
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "active"})
        audit(item.get("tenantId", "SYSTEM"), caller_email, "USER_UNLOCKED", f"Unlocked: {email}", ip=ip, device=device)
        return resp(200, {"message": f"User {email} unlocked"})

    # ── POST /api/admin/users/{id}/reset-password ─────────────────────────
    if "/users/" in path and path.endswith("/reset-password") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        email = item.get("email", "")
        new_password = body.get("password") or f"Reset@{str(uuid.uuid4())[:8]}!"
        # Find the WorkOS user by email to get workos user id
        workos_uid = item.get("workosUserId", "")
        if not workos_uid:
            try:
                search_resp = _workos_api("GET", f"/user_management/users?email={email}")
                wk_users = search_resp.get("data", [])
                if wk_users:
                    workos_uid = wk_users[0].get("id", "")
            except Exception:
                pass
        if not workos_uid:
            return err(400, f"Cannot reset password: WorkOS user not found for {email}")
        try:
            _workos_api("PUT", f"/user_management/users/{workos_uid}", {
                "password": new_password,
            })
        except Exception as e:
            return err(400, f"Password reset failed: {str(e)}")
        audit(item.get("tenantId", "SYSTEM"), caller_email, "PASSWORD_RESET",
              f"Reset password for: {email}", ip=ip, device=device)
        return resp(200, {"message": f"Password reset for {email}", "password_set": True})

    # ── POST /api/admin/invite ────────────────────────────────────────────
    if path.endswith("/invite") and method == "POST":
        email     = sanitize((body.get("email") or "").lower().strip(), 254)
        user_role = body.get("role") or "EMPLOYEE"
        tenant_id = body.get("tenantId") or ""
        first     = sanitize(body.get("firstName") or "", 50)
        last      = sanitize(body.get("lastName") or "", 50)
        phone     = (body.get("phone") or "").strip()[:20]

        if not email:
            return err(400, "Email required")
        if not phone:
            return err(400, "Phone number is required")
        if not validate_email(email):
            return err(400, "Invalid email format")
        if user_role not in ("GLOBAL_ADMIN", "HR_ADMIN", "EMPLOYEE"):
            return err(400, "Invalid role")
        if user_role in ("HR_ADMIN", "EMPLOYEE") and not tenant_id:
            return err(400, "tenantId required for HR_ADMIN/EMPLOYEE")

        # Global admins belong to SYSTEM tenant (not a real tenant)
        if user_role == "GLOBAL_ADMIN":
            tenant_id = "SYSTEM"

        # Check email uniqueness across ALL roles globally
        _email_res3 = USERS_T.query(IndexName="email-index", KeyConditionExpression=Key("email").eq(email))
        existing = _email_res3.get("Items", [])
        if existing:
            existing_role = existing[0].get("role", "unknown")
            return err(409, f"Email {email} is already registered as {existing_role}. One email can only hold one role.")

        tenant_name = ""
        if tenant_id and tenant_id != "SYSTEM":
            t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
            if not t:
                return err(404, f"Tenant {tenant_id} not found")
            tenant_name = t.get("name", "")

        invite_token  = str(uuid.uuid4())

        try:
            workos_user = _workos_api("POST", "/user_management/users", {
                "email": email,
                "first_name": first,
                "last_name": last,
                "email_verified": True,
            })
        except Exception as e:
            msg = str(e)
            if "already exists" in msg.lower() or "duplicate" in msg.lower():
                return err(409, f"User {email} already exists")
            return err(400, f"WorkOS user creation failed: {msg}")

        workos_user_id = workos_user.get("id", "")
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        try:
            USERS_T.put_item(Item={
                "userId": user_id, "tenantId": tenant_id, "email": email,
                "firstName": first, "lastName": last, "role": user_role,
                "phone": phone,
                "status": "pending", "inviteToken": invite_token,
                "workosUserId": workos_user_id,
                "createdBy": caller_email, "createdAt": now
            })
        except Exception as e:
            # DynamoDB write failed — clean up WorkOS user to avoid orphan
            try:
                _workos_api("DELETE", f"/user_management/users/{workos_user_id}")
            except Exception:
                pass
            return err(500, f"Failed to save user record: {str(e)}")

        invite_url = f"https://uat.endevo.life/register?token={invite_token}&email={email}"
        try:
            ses.send_email(
                Source="no-reply@endevo.life",
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": f"You're invited to Endevo Life — {tenant_name or 'Platform'}"},
                    "Body": {"Html": {"Data": f"""
                        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
                          <div style="text-align:center;margin-bottom:24px">
                            <h1 style="color:#818cf8;font-size:26px;margin:0">Endevo Life</h1>
                            <p style="color:#64748b;font-size:13px;margin:4px 0 0">Digital Legacy & Estate Planning</p>
                          </div>
                          <h2 style="color:#e2e8f0;font-size:20px">You've been invited!</h2>
                          <p style="color:#94a3b8">You've been added as <strong style="color:#fff">{user_role.replace('_',' ')}</strong>{(' at <strong style="color:#fff">' + tenant_name + '</strong>') if tenant_name else ' to the Endevo Life platform'}.</p>
                          <div style="background:#1e293b;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #6366f1">
                            <p style="margin:0;color:#64748b;font-size:12px">Your role:</p>
                            <p style="margin:4px 0 0;color:#e2e8f0;font-weight:600">{user_role.replace('_',' ')}</p>
                            {('<p style="margin:4px 0 0;color:#64748b;font-size:12px">Organisation: <span style="color:#e2e8f0">' + tenant_name + '</span></p>') if tenant_name else ''}
                          </div>
                          <p style="color:#94a3b8;font-size:14px">Complete your account setup — no password needed, you'll login with a secure OTP code:</p>
                          <div style="text-align:center;margin:28px 0">
                            <a href="{invite_url}" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px">
                              Complete Account Setup &rarr;
                            </a>
                          </div>
                          <p style="color:#475569;font-size:12px;text-align:center">This link is personal to you. Click it once to complete your account setup.</p>
                          <p style="color:#334155;font-size:11px;margin-top:24px;border-top:1px solid #1e293b;padding-top:16px;text-align:center">
                            Questions? <a href="mailto:support@endevo.life" style="color:#818cf8">support@endevo.life</a>
                          </p>
                        </div>"""}}
                }
            )
            email_sent = True
        except Exception as e:
            print(f"SES_ERROR: {e}")
            email_sent = False

        audit(tenant_id or "SYSTEM", caller_email, "USER_INVITED",
              f"Invited {email} as {user_role}" + (f" to {tenant_name}" if tenant_name else ""), ip=ip, device=device)
        return resp(200, {
            "message": f"Invitation sent to {email}",
            "user_id": user_id, "email_sent": email_sent,
            "invite_url": invite_url
        })

    # ── GET /api/admin/audit ──────────────────────────────────────────────
    if path.endswith("/audit") and method == "GET":
        limit      = min(int(qs.get("limit", 100)), 500)
        next_token = qs.get("next_token")
        params = {"Limit": limit, "ScanIndexForward": False}
        if next_token:
            sk = decode_cursor(next_token)
            if sk:
                params["ExclusiveStartKey"] = sk
        result = AUDIT_T.scan(Limit=limit, **({} if not next_token else {"ExclusiveStartKey": decode_cursor(next_token) or {}}))
        logs = sorted(result.get("Items", []), key=lambda x: x.get("createdAt", ""), reverse=True)
        return resp(200, {
            "logs":       logs,
            "count":      len(logs),
            "next_token": encode_cursor(result.get("LastEvaluatedKey")),
            "has_more":   bool(result.get("LastEvaluatedKey"))
        })

    # ── GET /api/admin/health ─────────────────────────────────────────────
    if path.endswith("/health") and method == "GET":
        dynamo_ok  = "ok"
        workos_ok  = "ok"
        ses_ok     = "ok"
        try:
            USERS_T.scan(Limit=1, Select="COUNT")
        except:
            dynamo_ok = "error"
        try:
            _workos_api("GET", "/user_management/users?limit=1")
        except:
            workos_ok = "error"
        try:
            ses.get_send_quota()
        except:
            ses_ok = "error"
        overall = "healthy" if dynamo_ok == "ok" and workos_ok == "ok" else "degraded"
        return resp(200, {
            "status": overall,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": {
                "dynamodb": dynamo_ok,
                "workos":   workos_ok,
                "ses":      ses_ok,
                "lambda":   "ok",
                "api_gateway": "ok"
            }
        })

    # ── GET /api/admin/config ─────────────────────────────────────────────
    if path.endswith("/config") and method == "GET":
        config = {
            "platform":      get_config("platform"),
            "pricing":       get_config("pricing"),
            "security":      get_config("security"),
            "notifications": get_config("notifications")
        }
        return resp(200, config)

    # ── PUT /api/admin/config ─────────────────────────────────────────────
    if path.endswith("/config") and method == "PUT":
        section = body.get("section")
        values  = body.get("values")
        allowed_sections = ["platform", "pricing", "security", "notifications"]
        if section not in allowed_sections:
            return err(400, f"Section must be one of: {', '.join(allowed_sections)}")
        if not values or not isinstance(values, dict):
            return err(400, "Values must be an object")
        # Merge with existing config (preserve keys not provided)
        existing = get_config(section)
        merged = {**existing, **values}
        now = datetime.now(timezone.utc).isoformat()
        CONFIG_T.put_item(Item={
            "configKey":   section,
            "configValue": merged,
            "updatedAt":   now,
            "updatedBy":   caller_email
        })
        audit("SYSTEM", caller_email, "CONFIG_UPDATED",
              f"Updated {section} config: {list(values.keys())}", ip=ip, device=device, severity="WARNING")
        return resp(200, {"message": f"Config section '{section}' updated", "config": merged})

    # ── GET /api/admin/certificates ───────────────────────────────────────
    if path.endswith("/certificates") and method == "GET":
        tenant_filter = qs.get("tenantId", "")
        fexpr = Attr("tenantId").eq(tenant_filter) if tenant_filter else None
        certs = scan_all(CERT_T, fexpr)
        # Enrich with user info (email, name) via batch lookup
        for c in certs:
            uid = c.get("userId", "")
            if uid:
                u = USERS_T.get_item(Key={"userId": uid}).get("Item")
                if u:
                    c["email"]     = u.get("email", "")
                    c["firstName"] = u.get("firstName", "")
                    c["lastName"]  = u.get("lastName", "")
                    c["tenantId"]  = u.get("tenantId", "")
                    # Enrich tenantName
                    tid = u.get("tenantId", "")
                    if tid and tid != "SYSTEM":
                        t = TENANTS_T.get_item(Key={"tenantId": tid}).get("Item")
                        c["tenantName"] = t.get("name", tid) if t else tid
        certs.sort(key=lambda x: x.get("issuedAt", ""), reverse=True)
        return resp(200, {"certificates": certs, "count": len(certs)})

    # ── GET /api/admin/training-enrollment ───────────────────────────────
    if path.endswith("/training-enrollment") and method == "GET":
        tenant_filter = qs.get("tenantId", "")
        if tenant_filter:
            t = TENANTS_T.get_item(Key={"tenantId": tenant_filter}).get("Item")
            tenants_list = [t] if t else []
        else:
            tenants_list = scan_all(TENANTS_T, Attr("status").ne("deleted"))

        result = []
        for tenant in tenants_list:
            tid = tenant.get("tenantId")
            if not tid:
                continue
            # Courses for this tenant
            courses_resp = TRAINING_T.query(
                KeyConditionExpression=Key("tenantId").eq(tid),
                Limit=50
            )
            courses = courses_resp.get("Items", [])
            # Employees for this tenant
            employees = scan_all(USERS_T, Attr("tenantId").eq(tid) & Attr("role").eq("EMPLOYEE"))
            emp_count = len(employees)
            course_stats = []
            for course in courses:
                video_id = course.get("videoId", "")
                enrolled = 0
                completed_count = 0
                for emp in employees:
                    prog = VIDEO_PROGRESS_T.get_item(
                        Key={"userId": emp["userId"], "videoId": video_id}
                    ).get("Item")
                    if prog:
                        enrolled += 1
                        if prog.get("completed"):
                            completed_count += 1
                course_stats.append({
                    "courseId":       video_id,
                    "title":          course.get("title", ""),
                    "enrolled":       enrolled,
                    "completed":      completed_count,
                    "not_started":    emp_count - enrolled,
                    "total_employees": emp_count,
                    "completion_rate": round(completed_count / emp_count * 100) if emp_count > 0 else 0,
                    "enrollment_rate": round(enrolled / emp_count * 100) if emp_count > 0 else 0
                })
            result.append({
                "tenantId":      tid,
                "tenantName":    tenant.get("name", ""),
                "employee_count": emp_count,
                "course_count":  len(courses),
                "courses":       course_stats
            })
        return resp(200, {"enrollment": result, "count": len(result)})

    # ── GET /api/admin/subscriptions ─────────────────────────────────────
    if path.endswith("/subscriptions") and method == "GET":
        try:
            pricing = get_config("pricing")
            basic_price  = pricing.get("basic", {}).get("price_yearly", 299)
            premium_price = pricing.get("premium", {}).get("price_yearly", 499)

            all_tenants = scan_all(TENANTS_T, Attr("status").ne("deleted"))
            total_tenants = len(all_tenants)

            # Gather subscription data from subscriptions table
            all_subs = scan_all(SUBSCRIPTIONS_T)
            active_subs = [s for s in all_subs if s.get("status") == "active" and s.get("sk", "").startswith("SUB#")]

            # Plan distribution from tenants table (source of truth for current plan)
            basic_count   = sum(1 for t in all_tenants if t.get("plan") == "basic")
            premium_count = sum(1 for t in all_tenants if t.get("plan") == "premium")

            # Revenue calculation based on tenant plans and seat counts
            mrr = 0
            for t in all_tenants:
                plan = t.get("plan", "basic")
                seats = int(t.get("employeeCount", 0) or 0) or 1
                if plan == "premium":
                    mrr += (premium_price / 12) * seats
                else:
                    mrr += (basic_price / 12) * seats
            arr = mrr * 12

            # Recent subscription changes (plan changes, invoices) — last 20
            changes = [s for s in all_subs if s.get("sk", "").startswith("CHANGE#")]
            changes.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
            recent_changes = changes[:20]

            return resp(200, {
                "total_tenants":      total_tenants,
                "active_subscriptions": len(active_subs),
                "revenue": {
                    "mrr": round(mrr, 2),
                    "arr": round(arr, 2),
                    "currency": "USD"
                },
                "plan_distribution": {
                    "basic":   basic_count,
                    "premium": premium_count
                },
                "recent_changes": recent_changes
            })
        except Exception as e:
            print(f"SUBSCRIPTIONS_OVERVIEW_ERROR: {e}")
            return err(500, f"Failed to load subscriptions overview: {str(e)}")

    # ── GET /api/admin/subscriptions/{tenantId} ──────────────────────────
    if "/subscriptions/" in path and method == "GET" and not path.endswith("/invoice") and not path.endswith("/plan"):
        tenant_id = path.split("/")[-1]
        try:
            t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
            if not t:
                return err(404, "Tenant not found")

            pricing = get_config("pricing")
            plan = t.get("plan", "basic")
            plan_info = pricing.get(plan, pricing.get("basic", {}))
            seats = int(t.get("employeeCount", 0) or 0) or int(t.get("maxSeats", 50) or 50)

            # Query subscriptions table for this tenant
            try:
                sub_result = SUBSCRIPTIONS_T.query(
                    KeyConditionExpression=Key("tenantId").eq(tenant_id)
                )
                sub_items = sub_result.get("Items", [])
            except Exception:
                sub_items = []

            # Separate invoices and plan changes
            invoices = [s for s in sub_items if s.get("sk", "").startswith("INV#")]
            invoices.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
            plan_changes = [s for s in sub_items if s.get("sk", "").startswith("CHANGE#")]
            plan_changes.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

            return resp(200, {
                "tenantId":    tenant_id,
                "tenantName":  t.get("name", ""),
                "current_plan": {
                    "plan":       plan,
                    "label":      plan_info.get("label", plan.title()),
                    "price_yearly": plan_info.get("price_yearly", 0),
                    "price_monthly": plan_info.get("price_monthly", 0),
                    "seats":      seats,
                    "max_seats":  int(t.get("maxSeats", 50) or 50),
                    "amount_yearly": plan_info.get("price_yearly", 0) * seats
                },
                "invoices":      invoices,
                "plan_changes":  plan_changes,
                "status":        t.get("status", "unknown")
            })
        except Exception as e:
            print(f"SUBSCRIPTION_DETAIL_ERROR: {e}")
            return err(500, f"Failed to load subscription detail: {str(e)}")

    # ── POST /api/admin/subscriptions/{tenantId}/invoice ─────────────────
    if "/subscriptions/" in path and path.endswith("/invoice") and method == "POST":
        tenant_id = path.split("/")[-2]
        try:
            t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
            if not t:
                return err(404, "Tenant not found")

            amount      = body.get("amount")
            description = sanitize(body.get("description") or "", 500)
            due_date    = sanitize(body.get("dueDate") or body.get("due_date") or "", 30)

            if amount is None:
                return err(400, "amount is required")
            try:
                amount = round(float(amount), 2)
            except (TypeError, ValueError):
                return err(400, "amount must be a number")
            if amount <= 0:
                return err(400, "amount must be greater than zero")
            if not description:
                return err(400, "description is required")
            if not due_date:
                return err(400, "dueDate is required (ISO format, e.g. 2026-05-01)")

            now = datetime.now(timezone.utc).isoformat()
            invoice_id = f"INV-{str(uuid.uuid4())[:8].upper()}"

            SUBSCRIPTIONS_T.put_item(Item={
                "tenantId":    tenant_id,
                "sk":          f"INV#{invoice_id}",
                "invoiceId":   invoice_id,
                "amount":      str(amount),
                "currency":    "USD",
                "description": description,
                "dueDate":     due_date,
                "status":      "pending",
                "createdAt":   now,
                "createdBy":   caller_email
            })

            audit(tenant_id, caller_email, "INVOICE_CREATED",
                  f"Created invoice {invoice_id}: ${amount} for {t.get('name', tenant_id)} — {description}",
                  ip=ip, device=device)

            return resp(200, {
                "message":    f"Invoice {invoice_id} created for {t.get('name', tenant_id)}",
                "invoice_id": invoice_id,
                "amount":     amount,
                "due_date":   due_date,
                "status":     "pending"
            })
        except Exception as e:
            if "amount" in str(e) or "required" in str(e):
                raise
            print(f"INVOICE_CREATE_ERROR: {e}")
            return err(500, f"Failed to create invoice: {str(e)}")

    # ── PUT /api/admin/subscriptions/{tenantId}/plan ─────────────────────
    if "/subscriptions/" in path and path.endswith("/plan") and method == "PUT":
        tenant_id = path.split("/")[-2]
        try:
            t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
            if not t:
                return err(404, "Tenant not found")

            new_plan       = sanitize(body.get("plan") or "", 20)
            new_seats      = body.get("seats")
            effective_date = sanitize(body.get("effectiveDate") or body.get("effective_date") or "", 30)

            if new_plan not in ("basic", "premium"):
                return err(400, "plan must be 'basic' or 'premium'")

            old_plan  = t.get("plan", "basic")
            old_seats = int(t.get("maxSeats", 50) or 50)

            if new_seats is not None:
                try:
                    new_seats = int(new_seats)
                except (TypeError, ValueError):
                    return err(400, "seats must be a number")
                if new_seats < 1:
                    return err(400, "seats must be at least 1")
            else:
                new_seats = old_seats

            now = datetime.now(timezone.utc).isoformat()
            change_id = f"CHG-{str(uuid.uuid4())[:8].upper()}"

            # Record the plan change in subscriptions table
            SUBSCRIPTIONS_T.put_item(Item={
                "tenantId":      tenant_id,
                "sk":            f"CHANGE#{change_id}",
                "changeId":      change_id,
                "oldPlan":       old_plan,
                "newPlan":       new_plan,
                "oldSeats":      old_seats,
                "newSeats":      new_seats,
                "effectiveDate": effective_date or now,
                "createdAt":     now,
                "createdBy":     caller_email
            })

            # Update tenant record with new plan and seats
            update_expr = "SET #p = :plan, maxSeats = :seats, planChangedAt = :at, planChangedBy = :by"
            TENANTS_T.update_item(
                Key={"tenantId": tenant_id},
                UpdateExpression=update_expr,
                ExpressionAttributeNames={"#p": "plan"},
                ExpressionAttributeValues={
                    ":plan":  new_plan,
                    ":seats": new_seats,
                    ":at":    now,
                    ":by":    caller_email
                }
            )

            audit(tenant_id, caller_email, "PLAN_CHANGED",
                  f"Changed plan for {t.get('name', tenant_id)}: {old_plan} -> {new_plan}, seats: {old_seats} -> {new_seats}",
                  ip=ip, device=device, severity="WARNING")

            return resp(200, {
                "message":   f"Plan updated for {t.get('name', tenant_id)}",
                "change_id": change_id,
                "old_plan":  old_plan,
                "new_plan":  new_plan,
                "old_seats": old_seats,
                "new_seats": new_seats,
                "effective_date": effective_date or now
            })
        except Exception as e:
            if "plan must be" in str(e) or "seats must be" in str(e):
                raise
            print(f"PLAN_CHANGE_ERROR: {e}")
            return err(500, f"Failed to change plan: {str(e)}")

    # ── GET /api/admin/metrics/overview ───────────────────────────────────
    if "/metrics/" in path and path.endswith("/overview") and method == "GET":
        try:
            # Users by status
            all_users = scan_all(USERS_T)
            active_users  = [u for u in all_users if u.get("status") == "active"]
            pending_users = [u for u in all_users if u.get("status") == "pending"]
            inactive_users = [u for u in all_users if u.get("status") in ("inactive", "locked")]

            # Users by plan (join with tenant plan)
            all_tenants = scan_all(TENANTS_T, Attr("status").ne("deleted"))
            tenant_plans = {t["tenantId"]: t.get("plan", "basic") for t in all_tenants}
            basic_users   = sum(1 for u in all_users if tenant_plans.get(u.get("tenantId")) == "basic")
            premium_users = sum(1 for u in all_users if tenant_plans.get(u.get("tenantId")) == "premium")

            # Activation rate: active / (active + pending) — invited users who activated
            invited_total = len(active_users) + len(pending_users)
            activation_rate = round(len(active_users) / invited_total * 100, 1) if invited_total > 0 else 0

            # Module completion rates from training/video-progress
            all_training = scan_all(TRAINING_T)
            all_progress = scan_all(VIDEO_PROGRESS_T)
            total_enrollments = len(all_progress)
            completed_enrollments = sum(1 for p in all_progress if p.get("completed"))
            module_completion_rate = round(completed_enrollments / total_enrollments * 100, 1) if total_enrollments > 0 else 0

            # Session utilization from sessions table
            try:
                all_sessions = scan_all(SESSIONS_T)
                total_sessions_used = len(all_sessions)
                # Calculate total sessions available based on tenant plans
                pricing = get_config("pricing")
                basic_sessions  = 2
                premium_sessions = 6
                total_sessions_available = 0
                for t in all_tenants:
                    plan = t.get("plan", "basic")
                    emp_count = int(t.get("employeeCount", 0) or 0)
                    if plan == "premium":
                        total_sessions_available += emp_count * premium_sessions
                    else:
                        total_sessions_available += emp_count * basic_sessions
                session_utilization = round(total_sessions_used / total_sessions_available * 100, 1) if total_sessions_available > 0 else 0
            except Exception:
                total_sessions_used = 0
                total_sessions_available = 0
                session_utilization = 0

            return resp(200, {
                "users": {
                    "total":    len(all_users),
                    "active":   len(active_users),
                    "pending":  len(pending_users),
                    "inactive": len(inactive_users)
                },
                "users_by_plan": {
                    "basic":   basic_users,
                    "premium": premium_users
                },
                "activation_rate": activation_rate,
                "module_completion": {
                    "total_enrollments":     total_enrollments,
                    "completed_enrollments": completed_enrollments,
                    "completion_rate":       module_completion_rate
                },
                "session_utilization": {
                    "used":         total_sessions_used,
                    "available":    total_sessions_available,
                    "utilization":  session_utilization
                },
                "tenants": {
                    "total":  len(all_tenants),
                    "basic":  sum(1 for t in all_tenants if t.get("plan") == "basic"),
                    "premium": sum(1 for t in all_tenants if t.get("plan") == "premium")
                }
            })
        except Exception as e:
            print(f"METRICS_OVERVIEW_ERROR: {e}")
            return err(500, f"Failed to load metrics overview: {str(e)}")

    return err(404, f"Route not found: {method} {path}")
