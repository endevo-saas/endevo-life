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
import json, os, re
import boto3
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError

POOL_ID   = os.environ.get("COGNITO_POOL_ID",   "us-east-1_DVyEJqgFt")
CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "4sbv2j6cv7jpp1oi0d16njsej1")
REGION    = os.environ.get("AWS_REGION",         "us-east-1")

cognito = boto3.client("cognito-idp", region_name=REGION)
dynamo  = boto3.resource("dynamodb",  region_name=REGION)

USERS_T  = dynamo.Table("endevo-uat-users")
AUDIT_T  = dynamo.Table("endevo-uat-audit")
TOKENS_T = dynamo.Table("endevo-uat-audit")   # reuse audit for brute-force tracking

MAX_FAILED = 5    # lock out after 5 consecutive failures
LOCKOUT_MIN = 15  # lockout window in minutes

# ── Helpers ───────────────────────────────────────────────────────────────────

def resp(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
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

def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    ip     = get_ip(event)
    device = get_device(event)

    if method == "OPTIONS":
        return resp(200, {})

    body = get_body(event)

    # ── POST /api/auth/login ──────────────────────────────────────
    if path.endswith("/login") and method == "POST":
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
            tenant_id = attrs.get("custom:tenantId", "")

            security_audit("LOGIN_SUCCESS", email, tenant_id or "AUTH", ip, device,
                           f"Login from {ip} | {device[:80]}")
            return resp(200, {
                "access_token":  tokens["AccessToken"],
                "id_token":      tokens["IdToken"],
                "refresh_token": tokens["RefreshToken"],
                "role":          attrs.get("custom:role", "EMPLOYEE"),
                "tenant_id":     tenant_id,
                "tenant_name":   attrs.get("custom:tenantName", ""),
                "email":         attrs.get("email", email),
                "first_name":    attrs.get("given_name", ""),
                "last_name":     attrs.get("family_name", "")
            })
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code in ("NotAuthorizedException", "UserNotFoundException"):
                security_audit("LOGIN_FAILED", email, "AUTH", ip, device,
                               f"Invalid credentials from {ip}", "WARN")
                return err(401, "Invalid email or password")
            return err(400, str(e.response["Error"]["Message"]))

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
