"""
Endevo Life — Auth Lambda  v2.0 (2026-03-28)
Zero Trust foundation: IP tracking, device fingerprint, brute-force protection, security audit.

Routes:
  POST /api/auth/login
  POST /api/auth/mfa
  POST /api/auth/register
  POST /api/auth/forgot-password
  POST /api/auth/reset-password
  POST /api/auth/change-password
  GET  /api/auth/me
"""
import json, os, re, random, string
import boto3
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError

POOL_ID   = os.environ.get("COGNITO_POOL_ID",   "us-east-1_DVyEJqgFt")
CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "4sbv2j6cv7jpp1oi0d16njsej1")
REGION    = os.environ.get("AWS_REGION",         "us-east-1")

cognito = boto3.client("cognito-idp", region_name=REGION)
ses     = boto3.client("ses",         region_name=REGION)
dynamo  = boto3.resource("dynamodb",  region_name=REGION)

USERS_T  = dynamo.Table("endevo-uat-users")
AUDIT_T  = dynamo.Table("endevo-uat-audit")   # also stores OTP records + brute-force tracking

MAX_FAILED  = 5    # lock out after 5 consecutive failures
LOCKOUT_MIN = 15   # lockout window in minutes
OTP_TTL_MIN = 10   # OTP expires after 10 minutes

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
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
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
        return 0  # fail open — don't block on DB errors

def generate_otp():
    """Generate a 6-digit numeric OTP."""
    return ''.join(random.choices(string.digits, k=6))

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

def handler(event, context):
    global _current_event
    _current_event = event

    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    ip     = get_ip(event)
    device = get_device(event)

    if method == "OPTIONS":
        return resp(200, {})

    body = get_body(event)

    # ── POST /api/auth/login ──────────────────────────────────────
    if path.endswith("/login") and method == "POST":
        import uuid as _uuid
        email    = (body.get("email") or "").lower().strip()
        password = body.get("password") or ""

        if not email or not password:
            return err(400, "Email and password required")

        # Zero Trust: brute-force check before attempting Cognito
        failed = get_failed_count(ip)
        if failed >= MAX_FAILED:
            security_audit("LOGIN_BLOCKED", email, "AUTH", ip, device,
                           f"IP blocked after {failed} failed attempts", "WARN")
            return err(429, f"Too many failed login attempts from your location. Try again in {LOCKOUT_MIN} minutes.")

        try:
            r = cognito.initiate_auth(
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={"USERNAME": email, "PASSWORD": password},
                ClientId=CLIENT_ID
            )
            if r.get("ChallengeName") == "SOFTWARE_TOKEN_MFA":
                security_audit("MFA_CHALLENGE", email, "AUTH", ip, device, "MFA required")
                return resp(200, {
                    "mfa_required": True,
                    "session":   r["Session"],
                    "challenge": r["ChallengeName"]
                })
            tokens = r["AuthenticationResult"]
            user = cognito.get_user(AccessToken=tokens["AccessToken"])
            attrs = {a["Name"]: a["Value"] for a in user["UserAttributes"]}
            tenant_id  = attrs.get("custom:tenantId", "")
            first_name = attrs.get("given_name", "")

            role       = attrs.get("custom:role", "EMPLOYEE")
            token_payload = {
                "access_token":  tokens["AccessToken"],
                "id_token":      tokens["IdToken"],
                "refresh_token": tokens["RefreshToken"],
                "role":          role,
                "tenant_id":     tenant_id,
                "tenant_name":   attrs.get("custom:tenantName", ""),
                "email":         attrs.get("email", email),
                "first_name":    first_name,
                "last_name":     attrs.get("family_name", "")
            }

            # ── Email OTP only for GLOBAL_ADMIN ────────────────────
            if role == "GLOBAL_ADMIN":
                otp_code = generate_otp()
                otp_ref  = str(_uuid.uuid4())
                store_otp(otp_ref, email, otp_code, token_payload)
                email_ok = send_otp_email(email, otp_code, first_name)
                security_audit("OTP_SENT", email, tenant_id or "AUTH", ip, device,
                               f"OTP sent for GLOBAL_ADMIN login from {ip} | email_sent={email_ok}")
                return resp(200, {
                    "otp_required": True,
                    "otp_ref":      otp_ref,
                    "email":        email,
                    "message":      f"Verification code sent to {email}. Please check your inbox."
                })

            # HR_ADMIN and EMPLOYEE — direct login, no OTP
            security_audit("LOGIN_SUCCESS", email, tenant_id or "AUTH", ip, device,
                           f"Login from {ip} | {device[:80]}")
            return resp(200, token_payload)

        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code in ("NotAuthorizedException", "UserNotFoundException"):
                security_audit("LOGIN_FAILED", email, "AUTH", ip, device,
                               f"Invalid credentials from {ip}", "WARN")
                return err(401, "Invalid email or password")
            return err(400, str(e.response["Error"]["Message"]))

    # ── POST /api/auth/verify-otp ─────────────────────────────────
    if path.endswith("/verify-otp") and method == "POST":
        email    = (body.get("email") or "").lower().strip()
        otp_ref  = body.get("otp_ref") or ""
        otp_code = body.get("code") or ""

        if not all([email, otp_ref, otp_code]):
            return err(400, "email, otp_ref, and code are required")

        record = get_otp_record(otp_ref, email)
        if not record:
            security_audit("OTP_EXPIRED", email, "AUTH", ip, device,
                           "OTP not found or expired", "WARN")
            return err(401, "Verification code has expired or is invalid. Please log in again.")

        if record.get("otp_code") != otp_code:
            security_audit("OTP_FAILED", email, "AUTH", ip, device,
                           f"Wrong OTP attempt from {ip}", "WARN")
            return err(401, "Incorrect verification code. Please check your email and try again.")

        # OTP valid — consume it and return stored tokens
        delete_otp_record(otp_ref, email)
        token_payload = json.loads(record.get("tokens", "{}"))
        tenant_id = token_payload.get("tenant_id", "")

        security_audit("LOGIN_SUCCESS", email, tenant_id or "AUTH", ip, device,
                       f"OTP verified. Login complete from {ip} | {device[:80]}")
        return resp(200, token_payload)

    # ── POST /api/auth/mfa ────────────────────────────────────────
    if path.endswith("/mfa") and method == "POST":
        session  = body.get("session") or ""
        otp_code = body.get("code") or ""
        email    = (body.get("email") or "").lower().strip()
        try:
            r = cognito.respond_to_auth_challenge(
                ClientId=CLIENT_ID,
                ChallengeName="SOFTWARE_TOKEN_MFA",
                Session=session,
                ChallengeResponses={
                    "USERNAME": email,
                    "SOFTWARE_TOKEN_MFA_CODE": otp_code
                }
            )
            tokens = r["AuthenticationResult"]
            user = cognito.get_user(AccessToken=tokens["AccessToken"])
            attrs = {a["Name"]: a["Value"] for a in user["UserAttributes"]}
            security_audit("MFA_SUCCESS", email, attrs.get("custom:tenantId", "AUTH"), ip, device)
            return resp(200, {
                "access_token":  tokens["AccessToken"],
                "id_token":      tokens["IdToken"],
                "refresh_token": tokens["RefreshToken"],
                "role":          attrs.get("custom:role", "EMPLOYEE")
            })
        except ClientError:
            security_audit("MFA_FAILED", email, "AUTH", ip, device, "Invalid MFA code", "WARN")
            return err(401, "Invalid MFA code")

    # ── POST /api/auth/register ───────────────────────────────────
    if path.endswith("/register") and method == "POST":
        token    = body.get("invite_token") or ""
        password = body.get("password") or ""
        first    = body.get("first_name") or ""
        last     = body.get("last_name") or ""
        if not all([token, password, first, last]):
            return err(400, "All fields required")

        result = USERS_T.scan(
            FilterExpression="inviteToken = :t AND #s = :pending",
            ExpressionAttributeValues={":t": token, ":pending": "pending"},
            ExpressionAttributeNames={"#s": "status"}
        )
        items = result.get("Items", [])
        if not items:
            security_audit("REGISTER_INVALID_TOKEN", "unknown", "AUTH", ip, device,
                           f"Invalid invite token attempt from {ip}", "WARN")
            return err(400, "Invalid or expired invite link")

        user_record = items[0]
        email       = user_record["email"]
        tenant_id   = user_record.get("tenantId", "")
        tenant_name = user_record.get("tenantName", "")
        role        = user_record.get("role", "EMPLOYEE")

        try:
            cognito.admin_create_user(
                UserPoolId=POOL_ID, Username=email,
                TemporaryPassword=password,
                UserAttributes=[
                    {"Name": "email",             "Value": email},
                    {"Name": "email_verified",    "Value": "true"},
                    {"Name": "given_name",        "Value": first},
                    {"Name": "family_name",       "Value": last},
                    {"Name": "custom:role",       "Value": role},
                    {"Name": "custom:tenantId",   "Value": tenant_id},
                    {"Name": "custom:tenantName", "Value": tenant_name},
                ],
                MessageAction="SUPPRESS"
            )
            cognito.admin_set_user_password(
                UserPoolId=POOL_ID, Username=email, Password=password, Permanent=True
            )
            USERS_T.update_item(
                Key={"userId": user_record["userId"]},
                UpdateExpression="SET #s = :active, firstName = :f, lastName = :l",
                ExpressionAttributeValues={":active": "active", ":f": first, ":l": last},
                ExpressionAttributeNames={"#s": "status"}
            )
            security_audit("REGISTER_SUCCESS", email, tenant_id, ip, device,
                           f"Account created via invite. Role={role}")
            return resp(200, {"message": "Account created successfully"})
        except ClientError as e:
            return err(400, str(e.response["Error"]["Message"]))

    # ── POST /api/auth/forgot-password ───────────────────────────
    if path.endswith("/forgot-password") and method == "POST":
        email = (body.get("email") or "").lower().strip()
        try:
            cognito.forgot_password(ClientId=CLIENT_ID, Username=email)
            security_audit("FORGOT_PASSWORD_REQUEST", email, "AUTH", ip, device)
        except:
            pass  # Silent fail — don't reveal if email exists
        return resp(200, {"message": "If this email exists, a reset code was sent"})

    # ── POST /api/auth/reset-password ────────────────────────────
    if path.endswith("/reset-password") and method == "POST":
        email    = (body.get("email") or "").lower().strip()
        code     = body.get("code") or ""
        new_pass = body.get("new_password") or ""
        if not all([email, code, new_pass]):
            return err(400, "Email, code, and new password required")
        try:
            cognito.confirm_forgot_password(
                ClientId=CLIENT_ID, Username=email,
                ConfirmationCode=code, Password=new_pass
            )
            security_audit("PASSWORD_RESET", email, "AUTH", ip, device)
            return resp(200, {"message": "Password reset successfully"})
        except ClientError as e:
            return err(400, str(e.response["Error"]["Message"]))

    # ── POST /api/auth/signup ────────────────────────────────────
    # Individual self-signup — no invite required, assigns to tenant-ind
    if path.endswith("/signup") and method == "POST":
        import uuid as _uuid
        email    = (body.get("email") or "").lower().strip()
        password = body.get("password") or ""
        first    = (body.get("first_name") or "").strip()
        last     = (body.get("last_name") or "").strip()
        company  = (body.get("company") or "Individual").strip()[:100]
        if not all([email, password, first, last]):
            return err(400, "All fields are required")
        # Basic email validation
        if not re.match(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", email):
            return err(400, "Invalid email address")
        # Check if email already exists in Cognito
        try:
            cognito.admin_get_user(UserPoolId=POOL_ID, Username=email)
            return err(409, "An account with this email already exists")
        except ClientError as e:
            if e.response["Error"]["Code"] != "UserNotFoundException":
                return err(500, "Signup error — please try again")
        # Create user in Cognito
        try:
            cognito.admin_create_user(
                UserPoolId=POOL_ID, Username=email,
                TemporaryPassword=password,
                UserAttributes=[
                    {"Name": "email",             "Value": email},
                    {"Name": "email_verified",    "Value": "true"},
                    {"Name": "given_name",        "Value": first},
                    {"Name": "family_name",       "Value": last},
                    {"Name": "custom:role",       "Value": "EMPLOYEE"},
                    {"Name": "custom:tenantId",   "Value": "tenant-ind"},
                    {"Name": "custom:tenantName", "Value": "Individual"},
                ],
                MessageAction="SUPPRESS"
            )
            cognito.admin_set_user_password(
                UserPoolId=POOL_ID, Username=email, Password=password, Permanent=True
            )
        except ClientError as e:
            return err(400, str(e.response["Error"]["Message"]))
        # Create DynamoDB record
        user_id = str(_uuid.uuid4())
        USERS_T.put_item(Item={
            "userId":    user_id,
            "email":     email,
            "firstName": first,
            "lastName":  last,
            "role":      "EMPLOYEE",
            "tenantId":  "tenant-ind",
            "company":   company,
            "status":    "active",
            "plan":      "individual",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
        security_audit("SIGNUP_SUCCESS", email, "tenant-ind", ip, device,
                       f"Self-signup: {first} {last} <{email}> company={company}")
        return resp(200, {"message": "Account created successfully"})

    # ── POST /api/auth/change-password ───────────────────────────
    if path.endswith("/change-password") and method == "POST":
        access_token = (event.get("headers") or {}).get("authorization", "").replace("Bearer ", "")
        old_pass = body.get("old_password") or ""
        new_pass = body.get("new_password") or ""
        try:
            cognito.change_password(
                AccessToken=access_token,
                PreviousPassword=old_pass, ProposedPassword=new_pass
            )
            # Get email for audit
            try:
                u = cognito.get_user(AccessToken=access_token)
                attrs = {a["Name"]: a["Value"] for a in u["UserAttributes"]}
                email = attrs.get("email", "unknown")
                tid   = attrs.get("custom:tenantId", "AUTH")
            except:
                email, tid = "unknown", "AUTH"
            security_audit("PASSWORD_CHANGED", email, tid, ip, device, "Password changed via settings")
            return resp(200, {"message": "Password changed successfully"})
        except ClientError as e:
            return err(400, str(e.response["Error"]["Message"]))

    # ── GET /api/auth/me ─────────────────────────────────────────
    if path.endswith("/me") and method == "GET":
        access_token = (event.get("headers") or {}).get("authorization", "").replace("Bearer ", "")
        if not access_token:
            return err(401, "Not authenticated")
        try:
            user = cognito.get_user(AccessToken=access_token)
            attrs = {a["Name"]: a["Value"] for a in user["UserAttributes"]}
            return resp(200, {
                "email":       attrs.get("email"),
                "first_name":  attrs.get("given_name"),
                "last_name":   attrs.get("family_name"),
                "role":        attrs.get("custom:role"),
                "tenant_id":   attrs.get("custom:tenantId"),
                "tenant_name": attrs.get("custom:tenantName")
            })
        except ClientError:
            return err(401, "Invalid or expired token")

    return err(404, f"Route not found: {method} {path}")

# CI/CD test from endevo-life org — 2026-04-01T02:24:24Z
