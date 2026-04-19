"""
Shared Cognito JWT authentication helpers.

Used by all Lambda functions to verify Cognito-issued JWTs and extract caller identity.
Replaces the deprecated DynamoDB session-token (endevo_*) lookup pattern.

Environment variables required:
  COGNITO_JWKS_URL  — e.g. https://cognito-idp.us-east-1.amazonaws.com/<pool-id>/.well-known/jwks.json
  COGNITO_CLIENT_ID — the app client ID (used as JWT audience)

No pip packages — uses only stdlib (urllib, json, base64, hmac, time).

RSA signature verification without third-party libraries works by:
  1. Fetching the JWKS (JSON Web Key Set) from Cognito.
  2. Matching the JWT header 'kid' to a JWK entry.
  3. Reconstructing the RSA public key from the JWK 'n' and 'e' fields.
  4. Verifying the JWT signature using Python's built-in `cryptography` module,
     which IS available in the Lambda Python 3.12 runtime without pip install.

NOTE: The `cryptography` package ships with the Lambda Python 3.12 runtime
(as a transitive dep of botocore/boto3) and does NOT require a requirements.txt entry.
"""
import base64
import json
import os
import time
import urllib.request
from typing import Optional

# ── Module-level JWKS cache (valid for one Lambda container lifetime) ─────────
_jwks_cache: dict = {}
_jwks_cache_ts: float = 0.0
_JWKS_TTL: int = 3600  # 1 hour

COGNITO_JWKS_URL  = os.environ.get("COGNITO_JWKS_URL", "")
COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")


class InvalidTokenError(Exception):
    """Raised when JWT verification fails for any reason."""


class UnauthorizedError(Exception):
    """Raised when caller cannot be identified from request headers."""


# ── JWKS helpers ──────────────────────────────────────────────────────────────

def _fetch_jwks() -> dict:
    """Fetch JWKS from Cognito with 1-hour module-level cache."""
    global _jwks_cache, _jwks_cache_ts
    now = time.time()
    if _jwks_cache and (now - _jwks_cache_ts) < _JWKS_TTL:
        return _jwks_cache
    if not COGNITO_JWKS_URL:
        raise InvalidTokenError("COGNITO_JWKS_URL is not configured")
    with urllib.request.urlopen(COGNITO_JWKS_URL, timeout=5) as resp:
        _jwks_cache = json.loads(resp.read())
        _jwks_cache_ts = now
    return _jwks_cache


def _b64url_decode(s: str) -> bytes:
    """Base64url decode without padding requirement."""
    s += "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _decode_jwt_parts(token: str) -> tuple[dict, dict, bytes, bytes]:
    """Split JWT into header, payload, and signature — no verification yet."""
    parts = token.split(".")
    if len(parts) != 3:
        raise InvalidTokenError("Malformed JWT")
    header  = json.loads(_b64url_decode(parts[0]))
    payload = json.loads(_b64url_decode(parts[1]))
    sig     = _b64url_decode(parts[2])
    signing_input = f"{parts[0]}.{parts[1]}".encode()
    return header, payload, sig, signing_input


def _build_rsa_key(jwk: dict):
    """Reconstruct RSA public key object from JWK n/e fields using cryptography lib."""
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
    from cryptography.hazmat.backends import default_backend

    def _to_int(b64: str) -> int:
        return int.from_bytes(_b64url_decode(b64), "big")

    pub_numbers = RSAPublicNumbers(e=_to_int(jwk["e"]), n=_to_int(jwk["n"]))
    return pub_numbers.public_key(default_backend())


def _verify_rsa_signature(public_key, signing_input: bytes, signature: bytes) -> None:
    """Verify RS256 signature — raises InvalidTokenError if invalid."""
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.exceptions import InvalidSignature

    try:
        public_key.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())
    except InvalidSignature:
        raise InvalidTokenError("JWT signature verification failed")


# ── Public API ─────────────────────────────────────────────────────────────────

def verify_jwt(token: str) -> dict:
    """
    Verify a Cognito-issued JWT (RS256) and return its decoded claims.

    Raises InvalidTokenError on any failure (bad sig, expired, wrong audience).
    """
    header, payload, sig, signing_input = _decode_jwt_parts(token)

    if header.get("alg") != "RS256":
        raise InvalidTokenError(f"Unsupported algorithm: {header.get('alg')}")

    kid = header.get("kid", "")
    jwks = _fetch_jwks()
    jwk  = next((k for k in jwks.get("keys", []) if k["kid"] == kid), None)
    if not jwk:
        raise InvalidTokenError(f"No JWK found for kid={kid}")

    public_key = _build_rsa_key(jwk)
    _verify_rsa_signature(public_key, signing_input, sig)

    # ── Claims validation ──────────────────────────────────────────────────
    now = int(time.time())
    if payload.get("exp", 0) < now:
        raise InvalidTokenError("Token expired")
    if payload.get("nbf", now) > now:
        raise InvalidTokenError("Token not yet valid")

    # Audience check — Cognito access tokens use 'client_id', ID tokens use 'aud'.
    aud = payload.get("aud") or payload.get("client_id", "")
    if COGNITO_CLIENT_ID and aud != COGNITO_CLIENT_ID:
        raise InvalidTokenError(f"Token audience mismatch: {aud}")

    return payload


def get_caller(event: dict) -> dict:
    """
    Extract and verify caller identity from the Lambda event Authorization header.

    Returns a dict with: sub, email, role, tenantId, tenantName.
    Raises UnauthorizedError if the header is missing or the token is invalid.
    """
    auth_header: str = (event.get("headers") or {}).get("authorization", "")
    if not auth_header:
        raise UnauthorizedError("Authorization header missing")

    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else auth_header.strip()
    if not token:
        raise UnauthorizedError("Bearer token missing")

    # Reject legacy session tokens — migration complete, all tokens must be Cognito JWTs.
    if token.startswith("endevo_"):
        raise UnauthorizedError("Legacy session tokens no longer accepted — please log in again")

    try:
        claims = verify_jwt(token)
    except InvalidTokenError as exc:
        raise UnauthorizedError(str(exc)) from exc

    # cognito:groups is a list; the pre-token-gen trigger also sets custom:role.
    # Prefer custom:role (injected by PreTokenGeneration trigger) for consistency.
    groups    = claims.get("cognito:groups", [])
    role      = claims.get("custom:role") or (groups[0] if groups else "EMPLOYEE")
    tenant_id = claims.get("custom:tenantId", "")

    return {
        "sub":        claims.get("sub", ""),
        "email":      claims.get("email", ""),
        "role":       role,
        "tenantId":   tenant_id,
        "tenantName": claims.get("custom:tenantName", ""),
    }
