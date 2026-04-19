"""
Cognito PreTokenGeneration trigger.

Reads the user's Cognito group membership and injects 'custom:role' into the
ID token claims so downstream Lambdas can read role without a separate API call.

Cognito groups: GLOBAL_ADMIN (precedence 1), HR_ADMIN (2), EMPLOYEE (3).
The highest-precedence group (lowest number) wins if a user is in multiple groups.
"""
import os

import boto3

REGION = os.environ.get("REGION", "us-east-1")

cognito = boto3.client("cognito-idp", region_name=REGION)


def handler(event: dict, context: object) -> dict:
    user_pool_id = event["userPoolId"]
    username     = event["userName"]

    role = _get_role_from_groups(user_pool_id, username)

    # Inject role into both ID token and access token claims.
    event["response"]["claimsOverrideDetails"] = {
        "claimsToAddOrOverride": {
            "custom:role": role,
        }
    }
    return event


def _get_role_from_groups(user_pool_id: str, username: str) -> str:
    """Return the highest-precedence group name for the user, defaulting to EMPLOYEE."""
    try:
        resp = cognito.admin_list_groups_for_user(
            UserPoolId=user_pool_id,
            Username=username,
            Limit=10,
        )
        groups = resp.get("Groups", [])
        if not groups:
            return "EMPLOYEE"
        # Sort by precedence (lower number = higher privilege).
        groups.sort(key=lambda g: g.get("Precedence", 999))
        return groups[0]["GroupName"]
    except Exception as exc:
        print(f"GROUP_LOOKUP_ERROR: {exc}")
        return "EMPLOYEE"
