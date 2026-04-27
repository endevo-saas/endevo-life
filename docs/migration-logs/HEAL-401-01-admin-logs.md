# HEAL-401-01 — Admin Lambda Logs (Last 10 min)

**Date:** 2026-04-19  
**Log Group:** `/aws/lambda/endevo-uat-fn-admin`  
**Region:** `us-east-1`  
**Period:** Last 10 minutes

## Raw Filtered Output (grep: ERROR|Traceback|401|Unauthorized|InvalidToken|Signature)

```
2026-04-19T17:57:27 AUTH_REJECTED: No module named 'cognito_auth'
2026-04-19T17:57:52 AUTH_REJECTED: No module named 'cognito_auth'
```

## Root Cause

**CRITICAL — `cognito_auth` module is not bundled in the Lambda deployment package.**

Every authenticated request hits `get_caller()` in `admin/main.py`, which does:
```python
from cognito_auth import get_caller as _get_caller, UnauthorizedError
```
This import fails at runtime because `backend/shared/cognito_auth.py` is not included in the deployed ZIP.

The `get_caller()` wrapper catches all exceptions and returns `(None, None)`, causing the handler to return:
```json
{"statusCode": 401, "body": "{\"success\": false, \"detail\": \"Not authenticated\"}"}
```

## Impact

- **All** admin API endpoints return `401 Not authenticated`.
- No JWT is ever verified — the failure is a Python import error, not a token error.
- No Traceback is emitted because the exception is swallowed by the `except Exception as exc` block in `get_caller()`.

## Fix Required

Include `backend/shared/cognito_auth.py` in the admin Lambda deployment package.  
Options:
1. Copy `shared/cognito_auth.py` into `functions/admin/` during build.
2. Add a Lambda Layer containing `backend/shared/`.
3. Update the buildspec/deploy script to include the `shared/` directory in the ZIP.
