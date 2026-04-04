"""HTTP response helpers with CORS headers for all LMS Lambda responses."""
import json
from typing import Any

ALLOWED_ORIGINS: list[str] = [
    "https://uat.endevo.life",
    "https://main.d1vvfv8oltolcf.amplifyapp.com",
    "http://localhost:3000",
]

# Module-level event reference — set once per invocation via set_event().
_current_event: dict = {}


def set_event(event: dict) -> None:
    """Store the current Lambda event so response helpers can read the Origin header."""
    global _current_event  # noqa: PLW0603
    _current_event = event


def _get_cors_origin() -> str:
    """Return the request Origin if it is in the allow-list, else the first allowed origin."""
    origin = (_current_event.get("headers") or {}).get("origin", "")
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0]


def _cors_headers() -> dict[str, str]:
    """Build CORS headers using the dynamic origin."""
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": _get_cors_origin(),
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }


def ok(body: Any, status: int = 200) -> dict:
    """Return a successful JSON response."""
    return {
        "statusCode": status,
        "headers": _cors_headers(),
        "body": json.dumps(body, default=str),
    }


def err(status: int, message: str) -> dict:
    """Return an error JSON response. Never expose internal detail."""
    return {
        "statusCode": status,
        "headers": _cors_headers(),
        "body": json.dumps({"detail": message}),
    }


def cors() -> dict:
    """Return an OPTIONS pre-flight response."""
    return {"statusCode": 200, "headers": _cors_headers(), "body": "{}"}
