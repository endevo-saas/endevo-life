"""WorkOS token validation and auth helpers for the LMS Lambda."""
import logging
from typing import Optional

from utils.workos_auth import is_workos_token, validate_workos_token

logger = logging.getLogger(__name__)


def get_caller(
    event: dict,
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Extract (tenant_id, email, user_id, role) from a Bearer token.

    Validates WorkOS JWT and resolves caller identity from DynamoDB.
    Returns (None, None, None, None) on any auth failure — callers must guard.
    """
    auth_header: str = (event.get("headers") or {}).get("authorization", "")
    token: str = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else auth_header.strip()

    if not token:
        logger.debug("No authorization header present")
        return None, None, None, None

    # ── Session token (from OTP login) ──────────────────────────────────────────
    if token.startswith("endevo_"):
        try:
            from utils.db import USERS_T
            from boto3.dynamodb.conditions import Key as _SessKey
            resp = USERS_T.query(
                IndexName="sessionToken-index",
                KeyConditionExpression=_SessKey("sessionToken").eq(token),
                Limit=1,
            )
            items = resp.get("Items", [])
            if items:
                user = items[0]
                # Check session expiry (24h TTL)
                expires = user.get("sessionExpiresAt", "")
                if expires:
                    from datetime import datetime, timezone
                    exp_dt = datetime.fromisoformat(expires)
                    if datetime.now(timezone.utc) > exp_dt:
                        logger.info("Session token expired for user %s", user.get("email", ""))
                        return None, None, None, None
                return (
                    user.get("tenantId", ""),
                    user.get("email", ""),
                    user.get("userId", ""),
                    user.get("role", "EMPLOYEE"),
                )
        except Exception as exc:
            logger.warning("Session lookup failed: %s", exc)
        return None, None, None, None

    # ── WorkOS JWT fallback ──────────────────────────────────────────────────
    if not is_workos_token(token):
        logger.warning("Token is not a valid session or WorkOS JWT")
        return None, None, None, None

    workos_user = validate_workos_token(token)
    if not workos_user:
        logger.warning("WorkOS token validation failed")
        return None, None, None, None

    email = workos_user.get("email", "")
    try:
        from utils.db import USERS_T
        from boto3.dynamodb.conditions import Key
        resp = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=Key("email").eq(email),
        )
        items = resp.get("Items", [])
        if items:
            user = items[0]
            return (
                user.get("tenantId", ""),
                email,
                user.get("userId", ""),
                user.get("role", "EMPLOYEE"),
            )
    except Exception as exc:
        logger.warning("WorkOS user DynamoDB lookup failed: %s", exc)
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
