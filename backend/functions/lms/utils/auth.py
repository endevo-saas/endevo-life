"""Auth helpers for the LMS Lambda — Cognito JWT version."""
import logging
import os
import sys
from typing import Optional

logger = logging.getLogger(__name__)

# Load shared cognito_auth from backend/shared/
_shared = os.path.join(os.path.dirname(__file__), "..", "..", "..", "shared")
if _shared not in sys.path:
    sys.path.insert(0, _shared)


def get_caller(
    event: dict,
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Extract (tenant_id, email, user_id, role) from a Cognito JWT Bearer token.

    Returns (None, None, None, None) on any auth failure — callers must guard.
    """
    try:
        from cognito_auth import get_caller as _get_caller
        caller = _get_caller(event)
        # user_id is not in the JWT — look up by email from DynamoDB.
        user_id: Optional[str] = None
        try:
            from utils.db import USERS_T
            from boto3.dynamodb.conditions import Key as _K
            res = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_K("email").eq(caller["email"]),
                Limit=1,
            )
            items = res.get("Items", [])
            if items:
                user_id = items[0].get("userId", "")
        except Exception as exc:
            logger.warning("User DynamoDB lookup failed: %s", exc)
        return caller["tenantId"], caller["email"], user_id, caller["role"]
    except Exception as exc:
        logger.warning("AUTH_REJECTED: %s", exc)
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
