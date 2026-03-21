"""
Endevo Life — Auth Lambda
Pure boto3 + json only — no pip install needed, runs on Lambda runtime directly.
Handles: login, register, forgot-password, reset-password, change-password, me
"""
import json
import os
import boto3
import hmac
import hashlib
import base64
from botocore.exceptions import ClientError

POOL_ID    = os.environ.get("COGNITO_POOL_ID", "us-east-1_DVyEJqgFt")
CLIENT_ID  = os.environ.get("COGNITO_CLIENT_ID", "4sbv2j6cv7jpp1oi0d16njsej1")
REGION     = os.environ.get("AWS_REGION", "us-east-1")

cognito = boto3.client("cognito-idp", region_name=REGION)
dynamo  = boto3.resource("dynamodb", region_name=REGION)

def resp(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
        },
        "body": json.dumps(body)
    }

def err(status, msg):
    return resp(status, {"detail": msg})

def get_body(event):
    try:
        return json.loads(event.get("body") or "{}")
    except:
        return {}

def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")

    # CORS preflight
    if method == "OPTIONS":
        return resp(200, {})

    body = get_body(event)

    # ── POST /api/auth/login ──────────────────────────────────────
    if path.endswith("/login") and method == "POST":
        email    = (body.get("email") or "").lower().strip()
        password = body.get("password") or ""
        if not email or not password:
            return err(400, "Email and password required")
        try:
            r = cognito.initiate_auth(
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={"USERNAME": email, "PASSWORD": password},
                ClientId=CLIENT_ID
            )
            if r.get("ChallengeName") == "SOFTWARE_TOKEN_MFA":
                return resp(200, {
                    "mfa_required": True,
                    "session": r["Session"],
                    "challenge": r["ChallengeName"]
                })
            tokens = r["AuthenticationResult"]
            # Get user attributes
            user = cognito.get_user(AccessToken=tokens["AccessToken"])
            attrs = {a["Name"]: a["Value"] for a in user["UserAttributes"]}
            return resp(200, {
                "access_token":  tokens["AccessToken"],
                "id_token":      tokens["IdToken"],
                "refresh_token": tokens["RefreshToken"],
                "role":          attrs.get("custom:role", "EMPLOYEE"),
                "tenant_id":     attrs.get("custom:tenantId", ""),
                "tenant_name":   attrs.get("custom:tenantName", ""),
                "email":         attrs.get("email", email),
                "first_name":    attrs.get("given_name", ""),
                "last_name":     attrs.get("family_name", "")
            })
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code in ("NotAuthorizedException", "UserNotFoundException"):
                return err(401, "Invalid email or password")
            return err(400, str(e.response["Error"]["Message"]))

    # ── POST /api/auth/mfa ────────────────────────────────────────
    if path.endswith("/mfa") and method == "POST":
        session  = body.get("session") or ""
        otp_code = body.get("code") or ""
        email    = body.get("email") or ""
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
            return resp(200, {
                "access_token":  tokens["AccessToken"],
                "id_token":      tokens["IdToken"],
                "refresh_token": tokens["RefreshToken"],
                "role":          attrs.get("custom:role", "EMPLOYEE")
            })
        except ClientError as e:
            return err(401, "Invalid MFA code")

    # ── POST /api/auth/register ───────────────────────────────────
    if path.endswith("/register") and method == "POST":
        token     = body.get("invite_token") or ""
        password  = body.get("password") or ""
        first     = body.get("first_name") or ""
        last      = body.get("last_name") or ""
        if not all([token, password, first, last]):
            return err(400, "All fields required")
        # Look up invite token in DynamoDB
        table = dynamo.Table("endevo-uat-users")
        result = table.scan(
            FilterExpression="inviteToken = :t AND #s = :pending",
            ExpressionAttributeValues={":t": token, ":pending": "pending"},
            ExpressionAttributeNames={"#s": "status"}
        )
        items = result.get("Items", [])
        if not items:
            return err(400, "Invalid or expired invite link")
        user_record = items[0]
        email = user_record["email"]
        tenant_id   = user_record.get("tenantId", "")
        tenant_name = user_record.get("tenantName", "")
        role        = user_record.get("role", "EMPLOYEE")
        try:
            cognito.admin_create_user(
                UserPoolId=POOL_ID,
                Username=email,
                TemporaryPassword=password,
                UserAttributes=[
                    {"Name": "email",              "Value": email},
                    {"Name": "email_verified",     "Value": "true"},
                    {"Name": "given_name",         "Value": first},
                    {"Name": "family_name",        "Value": last},
                    {"Name": "custom:role",        "Value": role},
                    {"Name": "custom:tenantId",    "Value": tenant_id},
                    {"Name": "custom:tenantName",  "Value": tenant_name},
                ],
                MessageAction="SUPPRESS"
            )
            cognito.admin_set_user_password(
                UserPoolId=POOL_ID, Username=email,
                Password=password, Permanent=True
            )
            # Mark invite used
            table.update_item(
                Key={"userId": user_record["userId"]},
                UpdateExpression="SET #s = :active, firstName = :f, lastName = :l",
                ExpressionAttributeValues={":active": "active", ":f": first, ":l": last},
                ExpressionAttributeNames={"#s": "status"}
            )
            return resp(200, {"message": "Account created successfully"})
        except ClientError as e:
            return err(400, str(e.response["Error"]["Message"]))

    # ── POST /api/auth/forgot-password ───────────────────────────
    if path.endswith("/forgot-password") and method == "POST":
        email = (body.get("email") or "").lower().strip()
        try:
            cognito.forgot_password(ClientId=CLIENT_ID, Username=email)
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
                ClientId=CLIENT_ID,
                Username=email,
                ConfirmationCode=code,
                Password=new_pass
            )
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
                PreviousPassword=old_pass,
                ProposedPassword=new_pass
            )
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
