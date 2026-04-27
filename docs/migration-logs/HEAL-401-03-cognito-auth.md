# HEAL-401-03 — Cognito Auth Module Analysis

**Date:** 2026-04-19  
**Files examined:**
- `backend/shared/cognito_auth.py`
- `backend/functions/admin/main.py`

---

## 1. JWKS URL — Hardcoded or Env Var?

**From env var. CORRECT.**

`cognito_auth.py` line 35:
```python
COGNITO_JWKS_URL = os.environ.get("COGNITO_JWKS_URL", "")
```
If the env var is missing, `_fetch_jwks()` raises `InvalidTokenError("COGNITO_JWKS_URL is not configured")`.  
Env var is present and correct (confirmed in HEAL-401-02).

---

## 2. Issuer Check — Hardcoded or Env Var?

**No explicit `iss` claim validation is performed.**

`verify_jwt()` validates: algorithm (RS256), expiry (`exp`), not-before (`nbf`), and audience (`aud`/`client_id`).  
It does NOT verify the `iss` (issuer) claim against an expected value.

- This is a LOW-severity gap — the JWKS URL already pins to the correct pool, so a token from a different pool would fail the `kid` lookup.
- However, adding an explicit `iss` check would strengthen defense-in-depth.

---

## 3. Role Extraction — `cognito:groups` or `custom:role`?

**Both, with `custom:role` preferred. CORRECT.**

`cognito_auth.py` lines 168–169:
```python
groups = claims.get("cognito:groups", [])
role   = claims.get("custom:role") or (groups[0] if groups else "EMPLOYEE")
```

- Primary: `custom:role` — injected by the `pre-token-gen` Cognito trigger into both ID and access tokens.
- Fallback: first entry in `cognito:groups` list.
- Default: `"EMPLOYEE"` if neither is present.

The `pre-token-gen` trigger (`backend/functions/cognito-triggers/pre-token-gen/handler.py`) reads `admin_list_groups_for_user`, sorts by precedence (lower = higher privilege), and injects `custom:role` into `claimsToAddOrOverride`. This is the correct pattern.

---

## 4. Admin `get_caller()` Wrapper

`admin/main.py` dynamically inserts `../../shared` onto `sys.path` at runtime:
```python
_shared = _os.path.join(_os.path.dirname(__file__), "..", "..", "shared")
if _shared not in _sys.path:
    _sys.path.insert(0, _shared)
from cognito_auth import get_caller as _get_caller, UnauthorizedError
```

This path resolution works locally but **fails in Lambda** because the deployment ZIP does not include `shared/cognito_auth.py`. At Lambda runtime `__file__` resolves inside `/var/task/`, and the relative `../../shared` path does not exist.

---

## Summary

| Check | Result |
|---|---|
| JWKS URL from env var | PASS |
| Issuer (`iss`) claim validated | WARN — not checked (low severity, mitigated by kid lookup) |
| Role from `custom:role` (preferred) with `cognito:groups` fallback | PASS |
| `cognito_auth` module available at Lambda runtime | **FAIL — root cause of all 401s** |

## Required Fix

The deployment package for `endevo-uat-fn-admin` must include `cognito_auth.py`.  
Recommended: copy `backend/shared/cognito_auth.py` into `backend/functions/admin/` as part of the build step, or use a Lambda Layer containing `backend/shared/`.
