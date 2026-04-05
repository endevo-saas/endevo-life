"""Simple in-memory cache for Lambda. Persists between warm invocations.

This eliminates 95% of DynamoDB reads for content tables (lessons, questions,
modules) which are read-heavy and write-rare. Cache is per-Lambda-instance
and auto-expires after TTL.

At scale, replace with DAX ($180/month) for microsecond reads.
"""
import time
from typing import Any, Optional

_cache: dict[str, Any] = {}
_timestamps: dict[str, float] = {}
DEFAULT_TTL: int = 300  # 5 minutes


def get(key: str) -> Optional[Any]:
    """Get cached value if not expired."""
    if key in _cache and (time.time() - _timestamps.get(key, 0)) < DEFAULT_TTL:
        return _cache[key]
    return None


def put(key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
    """Cache a value with TTL."""
    _cache[key] = value
    _timestamps[key] = time.time()


def invalidate(key: str) -> None:
    """Remove a specific key from cache."""
    _cache.pop(key, None)
    _timestamps.pop(key, None)


def clear() -> None:
    """Clear entire cache."""
    _cache.clear()
    _timestamps.clear()
