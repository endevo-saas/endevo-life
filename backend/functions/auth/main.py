"""
Endevo Life — Auth Lambda  v4.0 (Cognito passwordless)
Zero Trust: IP tracking, device fingerprint, brute-force protection, security audit.
Auth provider: Amazon Cognito (custom auth flow — passwordless email OTP).

Routes:
  GET  /api/auth/health             (Route 53 health check)
  POST /api/auth/activate           (invite-based account activation)
  POST /api/auth/register           (alias for /activate — backwards compat)
  GET  /api/auth/me                 (current user profile from Cognito JWT)
  POST /api/auth/send-otp           (initiate Cognito CUSTOM_AUTH — triggers OTP email)
  POST /api/auth/verify-otp         (respond to Cognito challenge — returns JWT tokens)
  POST /api/auth/refresh            (exchange refresh token for new access/id tokens)
  POST /api/auth/logout             (revoke refresh token)

Removed (WorkOS SSO):
  GET  /api/auth/workos/login       — REMOVED
  POST /api/auth/workos/callback    — REMOVED
  POST /api/auth/workos/send-otp    — REMOVED (alias path removed; /send-otp still works)
  POST /api/auth/workos/verify-otp  — REMOVED (alias path removed; /verify-otp still works)
"""
import json
import os
from datetime import datetime, timedelta, timezone

import boto3
from boto3.dynamodb.conditions import Attr, Key

REGION = os.environ.get("AWS_REGION", "us-east-1")
COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")

ses    = boto3.client("ses",              region_name=REGION)
sns    = boto3.client("sns",              region_name=REGION)
dynamo = boto3.resource("dynamodb",       region_name=REGION)
cognito_idp = boto3.client("cognito-idp", region_name=REGION)

USERS_T   = dynamo.Table("endevo-uat-users")
AUDIT_T   = dynamo.Table("endevo-uat-audit")
TENANTS_T = dynamo.Table("endevo-uat-tenants")

MAX_FAILED  = 5
LOCKOUT_MIN = 15

ALLOWED_ORIGINS = [
    "https://uat.endevo.life",
    "https://main.d1vvfv8oltolcf.amplifyapp.com",
    "http://localhost:3000",
]

_current_event: dict = {}


def _get_cors_origin() -> str:
    origin = (_current_event.get("headers") or {}).get("origin", "")
    return origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]


# ── Response helpers ──────────────────────────────────────────────────────────

def resp(status: int, body: dict) -> dict:
    if "success" not in body:
        body = {**body, "success": True}
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": _get_cors_origin(),
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }


def err(status: int, msg: str) -> dict:
    return resp(status, {"success": False, "error": msg, "detail": msg})


def get_body(event: dict) -> dict:
    try:
        return json.loads(event.get("body") or "{}")
    except Exception:
        return {}


def get_ip(event: dict) -> str:
    return event.get("requestContext", {}).get("http", {}).get("sourceIp", "unknown")


def get_device(event: dict) -> str:
    ua = (event.get("headers") or {}).get("user-agent") or "unknown"
    return ua[:200]


# ── Security audit ────────────────────────────────────────────────────────────

def security_audit(action: str, email: str, tenant_id: str, ip: str, device: str,
                   details: str = "", severity: str = "INFO") -> None:
    try:
        import uuid
        now = datetime.now(timezone.utc).isoformat()
        AUDIT_T.put_item(Item={
            "tenantId":   tenant_id or "AUTH",
            "sk":         f"{now}#{uuid.uuid4()}",
            "actor":      email or "anonymous",
            "action":     action,
            "details":    details[:500],
            "ip_address": ip,
            "user_agent": device,
            "severity":   severity,
            "createdAt":  now,
        })
    except Exception as exc:
        print(f"AUDIT_WRITE_ERROR: {exc}")


def get_failed_count(ip: str) -> int:
    try:
        since = (datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_MIN)).isoformat()
        result = AUDIT_T.scan(
            FilterExpression="ip_address = :ip AND #a = :action AND createdAt > :since",
            ExpressionAttributeValues={":ip": ip, ":action": "LOGIN_FAILED", ":since": since},
            ExpressionAttributeNames={"#a": "action"},
            Select="COUNT",
        )
        return result.get("Count", 0)
    except Exception:
        return 99  # fail CLOSED


def _lookup_user_by_email(email: str) -> dict | None:
    try:
        result = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=Key("email").eq(email),
        )
        items = result.get("Items", [])
        return items[0] if items else None
    except Exception as exc:
        print(f"USER_LOOKUP_ERROR: {exc}")
        return None


# ── Route handlers ────────────────────────────────────────────────────────────

def _handler_impl(event: dict, context: object) -> dict:
    global _current_event
    _current_event = event

    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    ip     = get_ip(event)
    device = get_device(event)

    if method == "OPTIONS":
        return resp(200, {})

    # ── GET /api/auth/health ─────────────────────────────────────────────────
    if path.endswith("/health") and method == "GET":
        return resp(200, {"status": "healthy", "region": REGION, "auth": "cognito"})

    body = get_body(event)

    # ── POST /api/auth/activate (or /register) ───────────────────────────────
    if (path.endswith("/activate") or path.endswith("/register")) and method == "POST":
        token = body.get("invite_token") or body.get("token") or ""
        if not token:
            return err(400, "Invite token required")

        result = USERS_T.scan(
            FilterExpression=Attr("inviteToken").eq(token) & Attr("status").eq("pending")
        )
        items = result.get("Items", [])
        if not items:
            security_audit("ACTIVATE_INVALID_TOKEN", "unknown", "AUTH", ip, device,
                           f"Invalid invite token from {ip}", "WARN")
            return err(400, "Invalid or expired invite link")

        user = items[0]
        email     = user["email"]
        tenant_id = user.get("tenantId", "")
        role      = user.get("role", "EMPLOYEE")
        first     = user.get("firstName", "")

        USERS_T.update_item(
            Key={"userId": user["userId"]},
            UpdateExpression="SET #s = :active, authProvider = :ap, activatedAt = :ts REMOVE inviteToken",
            ExpressionAttributeValues={
                ":active": "active",
                ":ap":     "cognito",
                ":ts":     datetime.now(timezone.utc).isoformat(),
            },
            ExpressionAttributeNames={"#s": "status"},
        )
        security_audit("ACCOUNT_ACTIVATED", email, tenant_id, ip, device,
                       f"Account activated via invite. Role={role}")
        return resp(200, {
            "message": "Account activated successfully",
            "email": email,
            "first_name": first,
            "redirect": "/login",
        })

    # ── GET /api/auth/me ──────────────────────────────────────────────────────
    if path.endswith("/me") and method == "GET":
        auth_hdr = (event.get("headers") or {}).get("authorization", "")
        token = auth_hdr[7:].strip() if auth_hdr.lower().startswith("bearer ") else auth_hdr.strip()
        if not token:
            return err(401, "Not authenticated")

        # Decode JWT claims (verification happens inside cognito_auth).
        # We import lazily so the module is only loaded when /me is called.
        try:
            import sys, os as _os
            _shared = _os.path.join(_os.path.dirname(__file__), "..", "..", "shared")
            if _shared not in sys.path:
                sys.path.insert(0, _shared)
            from cognito_auth import verify_jwt, InvalidTokenError
            claims = verify_jwt(token)
        except Exception as exc:
            return err(401, f"Invalid or expired token: {exc}")

        email     = claims.get("email", "")
        role      = claims.get("custom:role") or (claims.get("cognito:groups") or ["EMPLOYEE"])[0]
        tenant_id = claims.get("custom:tenantId", "")

        # Enrich from DynamoDB for non-JWT fields (first/last name, tenant name).
        first_name = last_name = tenant_name = ""
        user_rec = _lookup_user_by_email(email)
        if user_rec:
            first_name  = user_rec.get("firstName", "")
            last_name   = user_rec.get("lastName", "")

        if tenant_id and tenant_id != "SYSTEM":
            try:
                t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item", {})
                tenant_name = t.get("name", "")
            except Exception:
                pass

        return resp(200, {
            "email":       email,
            "first_name":  first_name,
            "last_name":   last_name,
            "role":        role,
            "tenant_id":   tenant_id,
            "tenant_name": tenant_name,
            "provider":    "cognito",
            "sub":         claims.get("sub", ""),
        })

    # ── POST /api/auth/send-otp ───────────────────────────────────────────────
    # Initiates Cognito CUSTOM_AUTH flow — triggers the CreateAuthChallenge Lambda,
    # which sends the OTP email.  The client must then call /verify-otp.
    if path.endswith("/send-otp") and method == "POST":
        email = (body.get("email") or "").lower().strip()
        if not email or "@" not in email:
            return err(400, "Valid email address required")

        # Brute-force protection
        if get_failed_count(ip) >= MAX_FAILED:
            security_audit("LOGIN_BLOCKED", email, "AUTH", ip, device,
                           f"IP blocked after {MAX_FAILED} failed attempts", "WARN")
            return err(429, f"Too many failed attempts. Try again in {LOCKOUT_MIN} minutes.")

        # Verify user exists and is active in DynamoDB.
        user_record = _lookup_user_by_email(email)
        if not user_record:
            security_audit("LOGIN_UNKNOWN_EMAIL", email, "AUTH", ip, device,
                           f"OTP requested for unknown email from {ip}", "WARN")
            return err(404, "No account found with this email. Contact your HR administrator.")

        if user_record.get("status") in ("inactive", "archived"):
            return err(403, "Your account has been deactivated. Contact your HR administrator.")

        if not COGNITO_CLIENT_ID:
            return err(500, "Cognito client not configured")

        # Initiate Cognito custom auth — triggers DefineAuthChallenge → CreateAuthChallenge.
        try:
            cog_resp = cognito_idp.initiate_auth(
                AuthFlow="CUSTOM_AUTH",
                AuthParameters={"USERNAME": email},
                ClientId=COGNITO_CLIENT_ID,
            )
        except cognito_idp.exceptions.UserNotFoundException:
            # User not in Cognito pool yet — not yet migrated or first login.
            return err(404, "No account found. Please contact your HR administrator.")
        except Exception as exc:
            print(f"COGNITO_INITIATE_AUTH_ERROR: {exc}")
            return err(502, "Authentication service error. Please try again.")

        session = cog_resp.get("Session", "")
        security_audit("OTP_SENT", email, user_record.get("tenantId", "AUTH"), ip, device,
                       f"Cognito OTP initiated from {ip}")

        masked_email = email[:3] + "***" + email[email.index("@"):]
        return resp(200, {
            "message":     "Verification code sent",
            "session":     session,   # Cognito session token — client passes this to /verify-otp
            "email":       masked_email,
            "expires_in":  300,       # 5 minutes (Cognito session TTL)
            "channels":    ["email"],
        })

    # ── POST /api/auth/verify-otp ─────────────────────────────────────────────
    # Responds to Cognito CUSTOM_AUTH challenge with the OTP the user entered.
    if path.endswith("/verify-otp") and method == "POST":
        email    = (body.get("email") or "").lower().strip()
        session  = body.get("session") or body.get("otp_ref") or ""
        otp_code = (body.get("code") or "").strip()

        if not all([email, session, otp_code]):
            return err(400, "email, session, and code are required")

        if get_failed_count(ip) >= MAX_FAILED:
            security_audit("OTP_VERIFY_BLOCKED", email, "AUTH", ip, device,
                           f"IP {ip} blocked — too many failed attempts", "WARN")
            return err(429, "Too many attempts. Please wait 15 minutes.")

        if not COGNITO_CLIENT_ID:
            return err(500, "Cognito client not configured")

        try:
            cog_resp = cognito_idp.respond_to_auth_challenge(
                ClientId=COGNITO_CLIENT_ID,
                ChallengeName="CUSTOM_CHALLENGE",
                Session=session,
                ChallengeResponses={"USERNAME": email, "ANSWER": otp_code},
            )
        except cognito_idp.exceptions.NotAuthorizedException:
            security_audit("OTP_FAILED", email, "AUTH", ip, device,
                           f"Wrong OTP from {ip}", "WARN")
            return err(401, "Incorrect verification code. Please check and try again.")
        except cognito_idp.exceptions.ExpiredCodeException:
            return err(401, "Code has expired. Please request a new one.")
        except Exception as exc:
            print(f"COGNITO_RESPOND_CHALLENGE_ERROR: {exc}")
            return err(502, "Authentication service error. Please try again.")

        auth_result = cog_resp.get("AuthenticationResult")
        if not auth_result:
            # Challenge was not satisfied (wrong answer within retry limit).
            security_audit("OTP_FAILED", email, "AUTH", ip, device,
                           f"OTP challenge not satisfied from {ip}", "WARN")
            return err(401, "Incorrect verification code. Please check and try again.")

        access_token  = auth_result.get("AccessToken", "")
        id_token      = auth_result.get("IdToken", "")
        refresh_token = auth_result.get("RefreshToken", "")

        # Enrich response from DynamoDB (role/tenant visible immediately to client).
        user_record   = _lookup_user_by_email(email)
        role          = user_record.get("role", "EMPLOYEE") if user_record else "EMPLOYEE"
        tenant_id     = user_record.get("tenantId", "")    if user_record else ""
        first_name    = user_record.get("firstName", "")   if user_record else ""
        last_name     = user_record.get("lastName", "")    if user_record else ""
        tenant_name   = ""

        if tenant_id and tenant_id != "SYSTEM":
            try:
                t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item", {})
                tenant_name = t.get("name", "")
            except Exception:
                pass

        # Update last login metadata — do NOT write sessionToken (removed).
        if user_record:
            try:
                USERS_T.update_item(
                    Key={"userId": user_record["userId"]},
                    UpdateExpression="SET lastLoginAt = :ts, lastLoginIp = :ip, authProvider = :ap",
                    ExpressionAttributeValues={
                        ":ts": datetime.now(timezone.utc).isoformat(),
                        ":ip": ip,
                        ":ap": "cognito",
                    },
                )
            except Exception as exc:
                print(f"LAST_LOGIN_UPDATE_ERROR: {exc}")

        security_audit("LOGIN_SUCCESS", email, tenant_id or "AUTH", ip, device,
                       f"Cognito OTP verified. Login from {ip}")

        return resp(200, {
            "access_token":  access_token,
            "id_token":      id_token,
            "refresh_token": refresh_token,
            "role":          role,
            "tenant_id":     tenant_id,
            "tenant_name":   tenant_name,
            "email":         email,
            "first_name":    first_name,
            "last_name":     last_name,
            "provider":      "cognito",
        })

    # ── POST /api/auth/refresh ────────────────────────────────────────────────
    if path.endswith("/refresh") and method == "POST":
        refresh_token = body.get("refresh_token") or ""
        if not refresh_token:
            return err(400, "refresh_token required")

        if not COGNITO_CLIENT_ID:
            return err(500, "Cognito client not configured")

        try:
            cog_resp = cognito_idp.initiate_auth(
                AuthFlow="REFRESH_TOKEN_AUTH",
                AuthParameters={"REFRESH_TOKEN": refresh_token},
                ClientId=COGNITO_CLIENT_ID,
            )
        except Exception as exc:
            print(f"TOKEN_REFRESH_ERROR: {exc}")
            return err(401, "Refresh token expired or invalid. Please log in again.")

        auth_result = cog_resp.get("AuthenticationResult", {})
        return resp(200, {
            "access_token": auth_result.get("AccessToken", ""),
            "id_token":     auth_result.get("IdToken", ""),
        })

    # ── POST /api/auth/logout ─────────────────────────────────────────────────
    if path.endswith("/logout") and method == "POST":
        access_token = body.get("access_token") or ""
        if access_token:
            try:
                cognito_idp.global_sign_out(AccessToken=access_token)
            except Exception as exc:
                print(f"LOGOUT_ERROR: {exc}")
                # Best-effort — client should clear cookies regardless.
        return resp(200, {"message": "Logged out"})

    return err(404, f"Route not found: {method} {path}")


def handler(event: dict, context: object) -> dict:
    try:
        return _handler_impl(event, context)
    except Exception as exc:
        import traceback
        print(f"UNHANDLED_ERROR: {traceback.format_exc()}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "success": False,
                "error_code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again.",
                "detail": str(exc)[:200] if os.environ.get("STAGE") == "dev" else None,
            }),
        }
