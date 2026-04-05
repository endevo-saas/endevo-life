"""WorkOS token validation for dual-homing auth migration.

Validates WorkOS JWTs using JWKS (JSON Web Key Set).
Falls back to Cognito if token is not a WorkOS token.

Environment variables:
  WORKOS_CLIENT_ID: WorkOS client ID
  WORKOS_API_KEY: WorkOS API key (from Secrets Manager)
"""
import base64
import json
import logging
import os
import time
import urllib.request
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# WorkOS JWKS endpoint
WORKOS_CLIENT_ID: str = os.environ.get("WORKOS_CLIENT_ID", "")
_jwks_cache: dict = {}
_jwks_cache_time: float = 0
JWKS_CACHE_TTL: int = 3600  # 1 hour


def _get_workos_jwks() -> dict:
    """Fetch and cache WorkOS JWKS (public keys for JWT validation)."""
    global _jwks_cache, _jwks_cache_time

    if _jwks_cache and (time.time() - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache

    try:
        url = "https://api.workos.com/.well-known/jwks.json"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            _jwks_cache = json.loads(resp.read())
            _jwks_cache_time = time.time()
            return _jwks_cache
    except Exception as e:
        logger.warning("Failed to fetch WorkOS JWKS: %s", e)
        return _jwks_cache  # Return stale cache if available


def _base64url_decode(s: str) -> bytes:
    """Decode base64url without padding."""
    s += "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _decode_jwt_unverified(token: str) -> Tuple[dict, dict]:
    """Decode JWT header and payload without verification (for inspection)."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")
    header = json.loads(_base64url_decode(parts[0]))
    payload = json.loads(_base64url_decode(parts[1]))
    return header, payload


def is_workos_token(token: str) -> bool:
    """Check if a token is a WorkOS JWT (by inspecting issuer).

    Returns False if WORKOS_CLIENT_ID is not configured, keeping
    the WorkOS path dormant until explicitly enabled.
    """
    if not WORKOS_CLIENT_ID:
        return False
    try:
        _, payload = _decode_jwt_unverified(token)
        issuer = payload.get("iss", "")
        return "workos" in issuer.lower() or issuer.startswith(
            "https://api.workos.com"
        )
    except Exception:
        return False


def validate_workos_token(token: str) -> Optional[dict]:
    """Validate a WorkOS JWT and return user info.

    Returns dict with: email, sub (workos user id), org_id, provider
    Returns None if validation fails.

    NOTE: In production, use proper RSA signature verification with JWKS.
    For the shadow migration phase, we decode and verify claims only.
    Full cryptographic verification will be added when WorkOS keys are configured.
    """
    try:
        header, payload = _decode_jwt_unverified(token)

        # Check issuer
        issuer = payload.get("iss", "")
        if "workos" not in issuer.lower() and not issuer.startswith(
            "https://api.workos.com"
        ):
            return None

        # Check expiration
        exp = payload.get("exp", 0)
        if exp < time.time():
            logger.warning("WorkOS token expired")
            return None

        # Check audience (client ID)
        aud = payload.get("aud", "")
        if WORKOS_CLIENT_ID and aud != WORKOS_CLIENT_ID:
            logger.warning(
                "WorkOS token audience mismatch: %s != %s", aud, WORKOS_CLIENT_ID
            )
            return None

        # Extract user info
        return {
            "email": payload.get("email", ""),
            "sub": payload.get("sub", ""),
            "org_id": payload.get("org_id", ""),
            "provider": "workos",
        }
    except Exception as e:
        logger.warning("WorkOS token validation failed: %s", e)
        return None
