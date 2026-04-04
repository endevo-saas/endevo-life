"""Cognito token validation and auth helpers for the LMS Lambda."""
import logging
import os
from typing import Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

REGION: str = os.environ.get("REGION", "us-east-1")
_cognito = boto3.client("cognito-idp", region_name=REGION)


def get_caller(
    event: dict,
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Extract (tenant_id, email, user_id, role) from a Cognito Bearer token.

    Returns (None, None, None, None) on any auth failure — callers must guard.
    """
    auth_header: str = (event.get("headers") or {}).get("authorization", "")
    token: str = auth_header.replace("Bearer ", "").strip()

    if not token:
        logger.debug("No authorization header present")
        return None, None, None, None

    try:
        response = _cognito.get_user(AccessToken=token)
        attrs: dict[str, str] = {
            a["Name"]: a["Value"] for a in response["UserAttributes"]
        }
        return (
            attrs.get("custom:tenantId"),
            attrs.get("email"),
            attrs.get("sub", ""),
            attrs.get("custom:role", "employee"),
        )
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        logger.warning("Cognito auth failed: %s", error_code)
        return None, None, None, None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Unexpected auth error: %s", exc)
        return None, None, None, None


def require_auth(
    tenant_id: Optional[str], user_id: Optional[str]
) -> Optional[dict]:
    """Return a 401 response dict if caller is not authenticated, else None."""
    from utils.response import err  # local import avoids circular dependency

    if not tenant_id or not user_id:
        return err(401, "Authentication required")
    return None


def require_admin(role: Optional[str]) -> Optional[dict]:
    """Return a 403 response dict if caller does not have admin role, else None."""
    from utils.response import err  # local import avoids circular dependency

    if role not in ("GLOBAL_ADMIN", "HR_ADMIN"):
        return err(403, "Admin access required")
    return None
