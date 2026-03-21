"""
Endevo Life — Auth Lambda (Python/FastAPI)
Handles: login, register, MFA, forgot-password, reset-password, change-password
Version: 1.0.1 — 2026-03-21
"""
import os
import boto3
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from pydantic import BaseModel
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

app = FastAPI(title="Endevo Auth API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

REGION       = os.environ.get("REGION", "us-east-1")
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
CLIENT_ID    = os.environ.get("USER_POOL_CLIENT_ID", "")
USERS_TABLE  = "endevo-uat-users"

cognito = boto3.client("cognito-idp", region_name=REGION)
dynamo  = boto3.resource("dynamodb", region_name=REGION)

# ── Models ──────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    invite_token: str
    password: str
    first_name: str = ""
    last_name: str = ""

class MfaRequest(BaseModel):
    session: str
    code: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    access_token: str
    old_password: str
    new_password: str

# ── Helpers ──────────────────────────────────────────────────────────────
def parse_attrs(user: dict) -> dict:
    attrs = {a["Name"]: a["Value"] for a in user.get("UserAttributes", [])}
    return {
        "email":     attrs.get("email", ""),
        "role":      attrs.get("custom:role", "EMPLOYEE"),
        "tenant_id": attrs.get("custom:tenantId", ""),
        "name":      f"{attrs.get('given_name','')} {attrs.get('family_name','')}".strip(),
    }

# ── Routes ───────────────────────────────────────────────────────────────
@app.get("/api/auth/health")
def health():
    return {"status": "ok", "service": "auth"}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    try:
        resp = cognito.initiate_auth(
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": req.email.lower().strip(),
                "PASSWORD": req.password,
            },
            ClientId=CLIENT_ID,
        )
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("NotAuthorizedException", "UserNotFoundException"):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])

    if resp.get("ChallengeName") == "SOFTWARE_TOKEN_MFA":
        return {"challenge": "MFA_REQUIRED", "session": resp["Session"]}

    tokens = resp["AuthenticationResult"]
    user   = cognito.get_user(AccessToken=tokens["AccessToken"])
    attrs  = parse_attrs(user)
    return {
        "access_token":  tokens["AccessToken"],
        "id_token":      tokens["IdToken"],
        "refresh_token": tokens["RefreshToken"],
        "role":          attrs["role"],
        "email":         attrs["email"],
        "name":          attrs["name"],
        "tenant_id":     attrs["tenant_id"],
    }

@app.post("/api/auth/mfa")
def verify_mfa(req: MfaRequest):
    try:
        resp = cognito.respond_to_auth_challenge(
            ClientId=CLIENT_ID,
            ChallengeName="SOFTWARE_TOKEN_MFA",
            Session=req.session,
            ChallengeResponses={"SOFTWARE_TOKEN_MFA_CODE": req.code, "USERNAME": "placeholder"},
        )
    except ClientError:
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    tokens = resp["AuthenticationResult"]
    user   = cognito.get_user(AccessToken=tokens["AccessToken"])
    attrs  = parse_attrs(user)
    return {
        "access_token": tokens["AccessToken"],
        "id_token":     tokens["IdToken"],
        "role":         attrs["role"],
        "email":        attrs["email"],
        "name":         attrs["name"],
    }

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    if len(req.password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")

    table  = dynamo.Table(USERS_TABLE)
    result = table.query(
        IndexName="inviteToken-index",
        KeyConditionExpression=Key("inviteToken").eq(req.invite_token),
        Limit=1,
    )
    items = result.get("Items", [])
    if not items or items[0].get("status") != "invited":
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")

    invited = items[0]
    email   = invited["email"]
    fn      = req.first_name or invited.get("firstName", "")
    ln      = req.last_name  or invited.get("lastName", "")

    try:
        cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            MessageAction="SUPPRESS",
            UserAttributes=[
                {"Name": "email",           "Value": email},
                {"Name": "email_verified",  "Value": "true"},
                {"Name": "given_name",      "Value": fn},
                {"Name": "family_name",     "Value": ln},
                {"Name": "custom:role",     "Value": invited.get("role", "EMPLOYEE")},
                {"Name": "custom:tenantId", "Value": invited["tenantId"]},
            ],
        )
        cognito.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=email,
            Password=req.password,
            Permanent=True,
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=e.response["Error"]["Message"])

    table.update_item(
        Key={"userId": invited["userId"]},
        UpdateExpression="SET #s=:active, inviteToken=:n, inviteExpires=:n, activatedAt=:now",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":active": "active",
            ":n": None,
            ":now": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"success": True, "email": email}

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    try:
        cognito.forgot_password(ClientId=CLIENT_ID, Username=req.email.lower().strip())
    except ClientError:
        pass
    return {"message": "If that email exists, a reset code has been sent"}

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    if len(req.new_password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")
    try:
        cognito.confirm_forgot_password(
            ClientId=CLIENT_ID,
            Username=req.email.lower().strip(),
            ConfirmationCode=req.code,
            Password=req.new_password,
        )
    except ClientError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    return {"success": True}

@app.post("/api/auth/change-password")
def change_password(req: ChangePasswordRequest):
    if len(req.new_password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")
    try:
        cognito.change_password(
            AccessToken=req.access_token,
            PreviousPassword=req.old_password,
            ProposedPassword=req.new_password,
        )
    except ClientError:
        raise HTTPException(status_code=400, detail="Password change failed")
    return {"success": True}

@app.get("/api/auth/me")
def get_me(authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")
    try:
        user  = cognito.get_user(AccessToken=token)
        return parse_attrs(user)
    except ClientError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# Lambda entry point
handler = Mangum(app, lifespan="off")
