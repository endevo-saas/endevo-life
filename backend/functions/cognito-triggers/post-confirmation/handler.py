"""
Cognito PostConfirmation trigger.

Creates a DynamoDB user stub in endevo-uat-users when a user confirms for the
first time.  For passwordless OTP, 'confirmation' happens on first successful login.

Writes: cognitoSub, email, role (from Cognito group), tenantId, createdAt, status=active.
Does NOT overwrite existing records — uses condition expression to skip if userId exists.
"""
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

REGION      = os.environ.get("REGION", "us-east-1")
USERS_TABLE = os.environ.get("USERS_TABLE", "endevo-uat-users")

dynamo  = boto3.resource("dynamodb", region_name=REGION)
users_t = dynamo.Table(USERS_TABLE)
cognito = boto3.client("cognito-idp", region_name=REGION)


def handler(event: dict, context: object) -> dict:
    attrs        = event["request"]["userAttributes"]
    cognito_sub  = attrs.get("sub", "")
    email        = attrs.get("email", "")
    tenant_id    = attrs.get("custom:tenantId", "")
    user_pool_id = event["userPoolId"]
    username     = event["userName"]

    role = _get_role(user_pool_id, username)

    if cognito_sub and email:
        _upsert_user(cognito_sub, email, role, tenant_id)

    return event


def _get_role(user_pool_id: str, username: str) -> str:
    try:
        resp = cognito.admin_list_groups_for_user(
            UserPoolId=user_pool_id, Username=username, Limit=5
        )
        groups = sorted(resp.get("Groups", []), key=lambda g: g.get("Precedence", 999))
        return groups[0]["GroupName"] if groups else "EMPLOYEE"
    except Exception as exc:
        print(f"GROUP_LOOKUP_ERROR: {exc}")
        return "EMPLOYEE"


def _upsert_user(cognito_sub: str, email: str, role: str, tenant_id: str) -> None:
    """Insert user stub if not already present (idempotent)."""
    user_id = str(uuid.uuid4())
    now     = datetime.now(timezone.utc).isoformat()
    try:
        users_t.put_item(
            Item={
                "userId":     user_id,
                "cognitoSub": cognito_sub,
                "email":      email,
                "role":       role,
                "tenantId":   tenant_id or "SYSTEM",
                "status":     "active",
                "createdAt":  now,
                "authProvider": "cognito",
            },
            # Do not overwrite if a record with this email already exists.
            ConditionExpression="attribute_not_exists(userId)",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            # User already exists — update cognitoSub field only.
            _update_cognito_sub(email, cognito_sub)
        else:
            print(f"USER_STUB_CREATE_ERROR: {exc}")


def _update_cognito_sub(email: str, cognito_sub: str) -> None:
    """Backfill cognitoSub on an existing DynamoDB user record found by email."""
    try:
        from boto3.dynamodb.conditions import Key
        result = users_t.query(
            IndexName="email-index",
            KeyConditionExpression=Key("email").eq(email),
            Limit=1,
        )
        items = result.get("Items", [])
        if items:
            users_t.update_item(
                Key={"userId": items[0]["userId"]},
                UpdateExpression="SET cognitoSub = :sub, authProvider = :ap",
                ExpressionAttributeValues={":sub": cognito_sub, ":ap": "cognito"},
            )
    except Exception as exc:
        print(f"COGNITO_SUB_UPDATE_ERROR: {exc}")
