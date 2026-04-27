# 401 Diagnosis — Admin Dashboard

**Date:** 2026-04-19

## Root Cause

`backend/shared/cognito_auth.py` is NOT bundled inside the admin Lambda deployment ZIP.

Every request that calls `get_caller()` triggers:
```
AUTH_REJECTED: No module named 'cognito_auth'
```
The import path `../../shared` resolves in the local repo but does not exist inside the Lambda runtime. All requests return 401 immediately — no JWT is ever verified.

## Evidence
- Lambda logs: `No module named 'cognito_auth'` on every auth call
- Env vars: CORRECT (us-east-1_mZ1axgz46, no WorkOS)
- Auth logic in shared module: CORRECT (reads env vars, uses custom:role with cognito:groups fallback)

## Fix Required
Copy `backend/shared/cognito_auth.py` into `backend/functions/admin/` before zipping and deploying. Either:
1. **Option A:** Copy file at deploy time: `cp backend/shared/cognito_auth.py backend/functions/admin/`
2. **Option B:** Create a Lambda Layer containing `backend/shared/` and attach to all function Lambdas

## Affected Lambdas
Any Lambda that imports `cognito_auth` from `../../shared/` — likely all 5 API Lambdas (admin, hr, employee, lms, jesse). Verify each.
