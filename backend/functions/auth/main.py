"""
Endevo Life — Auth Lambda  v3.0 (2026-04-05)
Zero Trust foundation: IP tracking, device fingerprint, brute-force protection, security audit.
Auth provider: WorkOS (Cognito fully removed).

Routes:
  GET  /api/auth/health             (Route 53 health check)
  POST /api/auth/register           (invite-based account creation via WorkOS)
  GET  /api/auth/me                 (current user profile — WorkOS tokens only)
  GET  /api/auth/workos/login       (AuthKit authorization URL)
  POST /api/auth/workos/callback    (exchange code for session)
  POST /api/auth/workos/send-otp   (WorkOS Magic Auth — send OTP)
  POST /api/auth/workos/verify-otp (WorkOS Magic Auth — verify OTP)
"""
import json, os, random, string, urllib.error
import boto3
from datetime import datetime, timezone, timedelta

REGION    = os.environ.get("AWS_REGION",         "us-east-1")

ses     = boto3.client("ses",              region_name=REGION)
sns     = boto3.client("sns",              region_name=REGION)
dynamo  = boto3.resource("dynamodb",       region_name=REGION)

# ── Secrets Manager (for WorkOS credentials) ─────────────────────────────────
_secrets_client = boto3.client("secretsmanager", region_name=REGION)
_secret_cache: dict[str, str] = {}


def _get_secret(name: str) -> str:
    """Retrieve a secret from AWS Secrets Manager (cached per Lambda container)."""
    if name in _secret_cache:
        return _secret_cache[name]
    try:
        secret_resp = _secrets_client.get_secret_value(SecretId=name)
        _secret_cache[name] = secret_resp["SecretString"]
        return _secret_cache[name]
    except Exception as e:
        print(f"SECRET_FETCH_ERROR: Failed to get secret {name}: {e}")
        return ""

USERS_T   = dynamo.Table("endevo-uat-users")
AUDIT_T   = dynamo.Table("endevo-uat-audit")   # also stores OTP records + brute-force tracking
TENANTS_T = dynamo.Table("endevo-uat-tenants")

MAX_FAILED  = 5    # lock out after 5 consecutive failures
LOCKOUT_MIN = 15   # lockout window in minutes
OTP_TTL_MIN = 5    # OTP expires after 5 minutes

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
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
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

def get_ip(event):
    """Extract real client IP from API Gateway v2 event."""
    req_ctx = event.get("requestContext", {})
    return req_ctx.get("http", {}).get("sourceIp", "unknown")

def get_device(event):
    """Extract user-agent / device info from request headers."""
    headers = event.get("headers") or {}
    ua = headers.get("user-agent") or headers.get("User-Agent") or "unknown"
    return ua[:200]  # cap length

def security_audit(action, email, tenant_id, ip, device, details="", severity="INFO"):
    """Write security event to audit table with IP + device fingerprint."""
    try:
        import uuid
        now = datetime.now(timezone.utc).isoformat()
        audit_id = str(uuid.uuid4())
        AUDIT_T.put_item(Item={
            "tenantId":  tenant_id or "AUTH",
            "sk":        f"{now}#{audit_id}",
            "auditId":   audit_id,
            "actor":     email or "anonymous",
            "action":    action,
            "details":   details[:500],
            "ip_address": ip,
            "user_agent": device,
            "severity":  severity,
            "createdAt": now
        })
    except Exception as e:
        print(f"AUDIT_WRITE_ERROR: {e}")

def get_failed_count(ip):
    """Count consecutive failed logins from this IP in the last LOCKOUT_MIN minutes."""
    try:
        since = (datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_MIN)).isoformat()
        result = AUDIT_T.scan(
            FilterExpression="ip_address = :ip AND #a = :action AND createdAt > :since",
            ExpressionAttributeValues={
                ":ip":     ip,
                ":action": "LOGIN_FAILED",
                ":since":  since
            },
            ExpressionAttributeNames={"#a": "action"},
            Select="COUNT"
        )
        return result.get("Count", 0)
    except:
        return 99  # fail CLOSED — block on error to prevent bypass under load

def generate_otp():
    """Generate a cryptographically secure 6-digit numeric OTP."""
    import secrets
    return ''.join(str(secrets.randbelow(10)) for _ in range(6))

def store_otp(otp_ref, email, otp_code, tokens):
    """Store OTP + tokens in audit table. TTL auto-deletes after OTP_TTL_MIN minutes."""
    import uuid as _uuid
    now = datetime.now(timezone.utc)
    ttl = int((now + timedelta(minutes=OTP_TTL_MIN)).timestamp())
    AUDIT_T.put_item(Item={
        "tenantId":      "OTP_STORE",
        "sk":            f"{otp_ref}#{email}",
        "auditId":       str(_uuid.uuid4()),
        "actor":         email,
        "action":        "OTP_PENDING",
        "otp_code":      otp_code,
        "otp_ref":       otp_ref,
        "tokens":        json.dumps(tokens),
        "details":       f"OTP login pending for {email}",
        "severity":      "INFO",
        "createdAt":     now.isoformat(),
        "ttl":           ttl
    })

def get_otp_record(otp_ref, email):
    """Look up OTP record by ref + email. Returns None if expired or not found."""
    result = AUDIT_T.get_item(Key={
        "tenantId": "OTP_STORE",
        "sk":       f"{otp_ref}#{email}"
    })
    item = result.get("Item")
    if not item:
        return None
    # Manual expiry check (TTL may not be instant)
    created = datetime.fromisoformat(item.get("createdAt", "2000-01-01T00:00:00+00:00"))
    if (datetime.now(timezone.utc) - created).total_seconds() > OTP_TTL_MIN * 60:
        return None
    if item.get("action") != "OTP_PENDING":
        return None
    return item

def delete_otp_record(otp_ref, email):
    """Consume OTP record after successful verification."""
    AUDIT_T.delete_item(Key={"tenantId": "OTP_STORE", "sk": f"{otp_ref}#{email}"})

def send_otp_email(email, otp_code, first_name=""):
    """Send OTP code to user's email via SES."""
    greeting = f"Hi {first_name}," if first_name else "Hello,"
    try:
        ses.send_email(
            Source="no-reply@endevo.life",
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": "Endevo Life — Your Login Verification Code"},
                "Body": {"Html": {"Data": f"""
                    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
                      <div style="text-align:center;margin-bottom:24px">
                        <h1 style="color:#818cf8;font-size:24px;margin:0">Endevo Life</h1>
                        <p style="color:#64748b;font-size:13px;margin:4px 0 0">Security Verification</p>
                      </div>
                      <p style="color:#94a3b8">{greeting}</p>
                      <p style="color:#94a3b8">Your one-time login code is:</p>
                      <div style="text-align:center;margin:24px 0;padding:24px;background:#1e293b;border-radius:12px;border:1px solid #334155">
                        <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#818cf8;font-family:monospace">{otp_code}</div>
                        <p style="color:#64748b;font-size:12px;margin:8px 0 0">Expires in {OTP_TTL_MIN} minutes</p>
                      </div>
                      <p style="color:#64748b;font-size:12px">If you did not attempt to log in, please change your password immediately and contact <a href="mailto:support@endevo.life" style="color:#818cf8">support@endevo.life</a></p>
                      <p style="color:#475569;font-size:11px;margin-top:16px;border-top:1px solid #1e293b;padding-top:12px">
                        This code is valid for {OTP_TTL_MIN} minutes and can only be used once. Never share this code with anyone.
                      </p>
                    </div>"""
                }}
            }
        )
        return True
    except Exception as e:
        print(f"OTP_EMAIL_ERROR: {e}")
        return False

def send_otp_sms(phone, otp_code):
    """Send OTP code to user's phone via SNS SMS."""
    if not phone:
        return False
    try:
        sns.publish(
            PhoneNumber=phone,
            Message=f"Endevo Life verification code: {otp_code} — expires in {OTP_TTL_MIN} minutes. Never share this code.",
            MessageAttributes={
                "AWS.SNS.SMS.SenderID": {"DataType": "String", "StringValue": "EndevoLife"},
                "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
            }
        )
        return True
    except Exception as e:
        print(f"OTP_SMS_ERROR: {e}")
        return False

def _lookup_user_by_email(email):
    """Find a user in DynamoDB by email using GSI."""
    try:
        from boto3.dynamodb.conditions import Key
        result = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=Key("email").eq(email),
        )
        items = result.get("Items", [])
        return items[0] if items else None
    except Exception as e:
        print(f"USER_LOOKUP_ERROR: {e}")
        return None


def handler(event, context):
    global _current_event
    _current_event = event

    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    ip     = get_ip(event)
    device = get_device(event)

    if method == "OPTIONS":
        return resp(200, {})

    # ── GET /api/auth/health — Route 53 health check endpoint ────────
    if path.endswith("/health") and method == "GET":
        return resp(200, {"status": "healthy", "region": REGION})

    body = get_body(event)

    # ── POST /api/auth/activate — Activate account from invite link ──────
    # Also matches /register for backwards compatibility
    if (path.endswith("/activate") or path.endswith("/register")) and method == "POST":
        token = body.get("invite_token") or body.get("token") or ""
        if not token:
            return err(400, "Invite token required")

        from boto3.dynamodb.conditions import Attr
        result = USERS_T.scan(
            FilterExpression=Attr("inviteToken").eq(token) & Attr("status").eq("pending")
        )
        items = result.get("Items", [])
        if not items:
            security_audit("ACTIVATE_INVALID_TOKEN", "unknown", "AUTH", ip, device,
                           f"Invalid invite token attempt from {ip}", "WARN")
            return err(400, "Invalid or expired invite link")

        user_record = items[0]
        email = user_record["email"]
        tenant_id = user_record.get("tenantId", "")
        role = user_record.get("role", "EMPLOYEE")
        first = user_record.get("firstName", "")
        last = user_record.get("lastName", "")

        # Activate: set status to active, clear invite token
        USERS_T.update_item(
            Key={"userId": user_record["userId"]},
            UpdateExpression="SET #s = :active, authProvider = :ap, activatedAt = :ts REMOVE inviteToken",
            ExpressionAttributeValues={
                ":active": "active",
                ":ap": "workos",
                ":ts": datetime.now(timezone.utc).isoformat(),
            },
            ExpressionAttributeNames={"#s": "status"}
        )
        security_audit("ACCOUNT_ACTIVATED", email, tenant_id, ip, device,
                       f"Account activated via invite link. Role={role}")
        return resp(200, {
            "message": "Account activated successfully",
            "email": email,
            "first_name": first,
            "redirect": "/login",
        })

    # ── GET /api/auth/me ─────────────────────────────────────────
    if path.endswith("/me") and method == "GET":
        _auth_hdr = (event.get("headers") or {}).get("authorization", "")
        access_token = _auth_hdr[7:].strip() if _auth_hdr.lower().startswith("bearer ") else _auth_hdr.strip()
        if not access_token:
            return err(401, "Not authenticated")

        # Look up user by session token in DynamoDB (GSI query, not scan)
        from boto3.dynamodb.conditions import Key as _SessKey
        try:
            result = USERS_T.query(
                IndexName="sessionToken-index",
                KeyConditionExpression=_SessKey("sessionToken").eq(access_token),
                Limit=1,
            )
            items = result.get("Items", [])
            if items:
                u = items[0]
                # Check session expiry
                expires = u.get("sessionExpiresAt", "")
                if expires:
                    exp_dt = datetime.fromisoformat(expires)
                    if datetime.now(timezone.utc) > exp_dt:
                        return err(401, "Session expired. Please log in again.")
                return resp(200, {
                    "email":       u.get("email", ""),
                    "first_name":  u.get("firstName", ""),
                    "last_name":   u.get("lastName", ""),
                    "role":        u.get("role", "EMPLOYEE"),
                    "tenant_id":   u.get("tenantId", ""),
                    "tenant_name": u.get("tenantName", ""),
                    "provider":    "workos",
                })
        except Exception as e:
            print(f"ME_LOOKUP_ERROR: {e}")

        return err(401, "Invalid or expired token")

    # ── GET /api/auth/workos/login — Return AuthKit authorization URL ──
    if path.endswith("/workos/login") and method == "GET":
        import urllib.parse

        redirect_uri = (event.get("queryStringParameters") or {}).get(
            "redirect_uri",
            "https://main.d1vvfv8oltolcf.amplifyapp.com/api/auth/callback",
        )
        client_id = _get_secret("endevo/workos/client-id")
        if not client_id:
            return err(500, "WorkOS configuration error")

        auth_url = (
            "https://api.workos.com/user_management/authorize?"
            + urllib.parse.urlencode({
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "provider": "authkit",
            })
        )
        return resp(200, {"url": auth_url})

    # ── POST /api/auth/workos/callback — Exchange code for user + session ──
    if path.endswith("/workos/callback") and method == "POST":
        import urllib.request

        code = (body.get("code") or "").strip()
        if not code:
            return err(400, "Authorization code required")

        api_key = _get_secret("endevo/workos/api-key")
        client_id = _get_secret("endevo/workos/client-id")
        if not api_key or not client_id:
            return err(500, "WorkOS configuration error")

        try:
            data = json.dumps({
                "code": code,
                "client_id": client_id,
            }).encode()
            req = urllib.request.Request(
                "https://api.workos.com/user_management/authenticate",
                data=data,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=10) as workos_resp:
                workos_data = json.loads(workos_resp.read())
        except Exception as e:
            print(f"WORKOS_AUTH_ERROR: {e}")
            security_audit("WORKOS_AUTH_FAILED", "", "AUTH", ip, device,
                           f"WorkOS code exchange failed: {e}", "WARN")
            return err(502, "Failed to authenticate with WorkOS")

        user_email = (workos_data.get("user") or {}).get("email", "")
        workos_user_id = (workos_data.get("user") or {}).get("id", "")
        access_token = workos_data.get("access_token", "")

        if not user_email:
            return err(502, "WorkOS did not return a user email")

        # Look up user in DynamoDB
        role = "EMPLOYEE"
        tenant_id = ""
        tenant_name = ""
        first_name = ""
        last_name = ""
        try:
            from boto3.dynamodb.conditions import Key as _Key
            result = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key("email").eq(user_email),
            )
            items = result.get("Items", [])
            if items:
                u = items[0]
                role = u.get("role", "EMPLOYEE")
                tenant_id = u.get("tenantId", "")
                tenant_name = u.get("tenantName", "")
                first_name = u.get("firstName", "")
                last_name = u.get("lastName", "")
        except Exception as e:
            print(f"WORKOS_DB_LOOKUP_ERROR: {e}")

        security_audit("LOGIN_SUCCESS", user_email, tenant_id or "AUTH", ip, device,
                       f"WorkOS SSO login from {ip} | workos_uid={workos_user_id}")

        return resp(200, {
            "access_token": access_token,
            "role": role,
            "tenant_id": tenant_id,
            "tenant_name": tenant_name,
            "email": user_email,
            "first_name": first_name,
            "last_name": last_name,
            "provider": "workos",
        })

    # ── POST /api/auth/send-otp — Send OTP via Email (SES) + SMS (SNS) ──────
    if (path.endswith("/send-otp") or path.endswith("/workos/send-otp")) and method == "POST":
        import uuid as _uuid
        email = (body.get("email") or "").lower().strip()
        if not email or "@" not in email:
            return err(400, "Valid email address required")

        # Zero Trust: brute-force check
        failed = get_failed_count(ip)
        if failed >= MAX_FAILED:
            security_audit("LOGIN_BLOCKED", email, "AUTH", ip, device,
                           f"IP blocked after {failed} failed attempts", "WARN")
            return err(429, f"Too many failed attempts. Try again in {LOCKOUT_MIN} minutes.")

        # Look up user in DynamoDB
        user_record = _lookup_user_by_email(email)
        if not user_record:
            security_audit("LOGIN_UNKNOWN_EMAIL", email, "AUTH", ip, device,
                           f"OTP requested for unknown email from {ip}", "WARN")
            return err(404, "No account found with this email. Contact your HR administrator.")

        # Check user is active
        if user_record.get("status") == "inactive":
            return err(403, "Your account has been deactivated. Contact your HR administrator.")

        first_name = user_record.get("firstName", "")
        phone = user_record.get("phone", "")

        # Generate OTP and store
        otp_code = generate_otp()
        otp_ref = str(_uuid.uuid4())
        store_otp(otp_ref, email, otp_code, {})  # tokens populated on verify

        # Send via BOTH channels
        email_ok = send_otp_email(email, otp_code, first_name)
        sms_ok = send_otp_sms(phone, otp_code) if phone else False

        channels = []
        if email_ok:
            channels.append("email")
        if sms_ok:
            channels.append("sms")

        security_audit("OTP_SENT", email, user_record.get("tenantId", "AUTH"), ip, device,
                       f"OTP sent via {','.join(channels)} from {ip}")

        # Mask email/phone for response
        masked_email = email[:3] + "***" + email[email.index("@"):]
        masked_phone = f"***{phone[-4:]}" if phone and len(phone) >= 4 else ""

        return resp(200, {
            "message": "Verification code sent",
            "otp_ref": otp_ref,
            "email": masked_email,
            "phone": masked_phone,
            "channels": channels,
            "expires_in": OTP_TTL_MIN * 60,
        })

    # ── POST /api/auth/verify-otp — Verify OTP and login ─────────────────
    if (path.endswith("/verify-otp") or path.endswith("/workos/verify-otp")) and method == "POST":
        email = (body.get("email") or "").lower().strip()
        otp_ref = body.get("otp_ref") or ""
        otp_code = body.get("code") or ""

        if not all([email, otp_ref, otp_code]):
            return err(400, "email, otp_ref, and code are required")

        # Brute-force protection on OTP verification
        if get_failed_count(ip) >= MAX_FAILED:
            security_audit("OTP_VERIFY_BLOCKED", email or "UNKNOWN", "AUTH", ip, device,
                           f"IP {ip} blocked — too many failed attempts", "WARN")
            return err(429, "Too many attempts. Please wait 15 minutes.")

        record = get_otp_record(otp_ref, email)
        if not record:
            security_audit("OTP_EXPIRED", email, "AUTH", ip, device,
                           "OTP not found or expired", "WARN")
            return err(401, "Verification code has expired. Please request a new one.")

        if record.get("otp_code") != otp_code:
            security_audit("OTP_FAILED", email, "AUTH", ip, device,
                           f"Wrong OTP attempt from {ip}", "WARN")
            return err(401, "Incorrect verification code. Please check and try again.")

        # OTP valid — consume it
        delete_otp_record(otp_ref, email)

        # Look up full user profile
        user_record = _lookup_user_by_email(email)
        role = user_record.get("role", "EMPLOYEE") if user_record else "EMPLOYEE"
        tenant_id = user_record.get("tenantId", "") if user_record else ""
        tenant_name = ""
        first_name = user_record.get("firstName", "") if user_record else ""
        last_name = user_record.get("lastName", "") if user_record else ""

        if tenant_id and tenant_id != "SYSTEM":
            try:
                t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item", {})
                tenant_name = t.get("name", "")
            except Exception:
                pass

        # Generate session token and store in DynamoDB for validation by other Lambdas
        import uuid as _uuid2, hashlib, base64
        session_id = str(_uuid2.uuid4())
        session_hash = base64.urlsafe_b64encode(
            hashlib.sha256(f"{session_id}:{email}:{datetime.now(timezone.utc).isoformat()}".encode()).digest()
        ).decode().rstrip("=")
        access_token = f"endevo_{session_hash}"
        user_id = user_record.get("userId", "") if user_record else ""

        # Store session in users table for lookup
        try:
            USERS_T.update_item(
                Key={"userId": user_id},
                UpdateExpression="SET sessionToken = :t, lastLoginAt = :ts, lastLoginIp = :ip, sessionExpiresAt = :exp",
                ExpressionAttributeValues={
                    ":t": access_token,
                    ":ts": datetime.now(timezone.utc).isoformat(),
                    ":ip": ip,
                    ":exp": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
                }
            )
        except Exception as e:
            print(f"SESSION_STORE_ERROR: {e}")

        security_audit("LOGIN_SUCCESS", email, tenant_id or "AUTH", ip, device,
                       f"OTP verified. Login from {ip} | {device[:80]}")

        return resp(200, {
            "access_token": access_token,
            "role": role,
            "tenant_id": tenant_id,
            "tenant_name": tenant_name,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "provider": "workos",
        })

    return err(404, f"Route not found: {method} {path}")

# CI/CD test from endevo-life org — 2026-04-01T02:24:24Z
