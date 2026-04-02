"""HTTP response helpers with CORS headers for all LMS Lambda responses."""
import json
from typing import Any

CORS_HEADERS: dict[str, str] = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def ok(body: Any, status: int = 200) -> dict:
    """Return a successful JSON response."""
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=str),
    }


def err(status: int, message: str) -> dict:
    """Return an error JSON response. Never expose internal detail."""
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps({"detail": message}),
    }


def cors() -> dict:
    """Return an OPTIONS pre-flight response."""
    return {"statusCode": 200, "headers": CORS_HEADERS, "body": "{}"}
