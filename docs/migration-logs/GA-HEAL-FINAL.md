# GLOBAL_ADMIN Heal — Final Session Report
**Date:** 2026-04-19  
**Scope:** GLOBAL_ADMIN role — all `/admin/*` pages and API endpoints  
**Test user:** khak.pa@gmail.com (Cognito group: GLOBAL_ADMIN)

---

## Pre-State vs Post-State

| Metric | Before | After |
|--------|--------|-------|
| Admin endpoints returning 200 | 14/14 | 14/14 |
| CloudWatch errors (fn-admin) | 2x FEATURE_FLAGS_GET_ERROR/run | 0 |
| `cognito_auth` module available | ❌ Missing from Lambda ZIP | ✓ Vendored |
| `cryptography` package available | ❌ Not bundled | ✓ pip-installed via buildspec |
| Feature flags read/write | ❌ P1: ValidationException | ✓ Fixed |

---

## Commits (this session)

| Commit | Message |
|--------|---------|
| `55f6c28` | fix(build): bundle cryptography into Lambda ZIPs via pip install |
| `37580d0` | fix(auth): vendor cognito_auth.py into all 6 Lambda folders |
| `7913ebb` | fix(auth): resolve Verification failed bug — detail field + stale bundle |
| `991a398` | fix(admin): remove sk from features DynamoDB key (P1) |

All commits pushed to `origin/main` (AWS CodeCommit) and `github/main`.

---

## Files Modified

| File | Change |
|------|--------|
| `buildspec.yml` | Added `pip install cryptography -t . -q` before each Lambda zip |
| `backend/functions/admin/cognito_auth.py` | Vendored from shared/ |
| `backend/functions/hr/cognito_auth.py` | Vendored from shared/ |
| `backend/functions/auth/cognito_auth.py` | Vendored from shared/ |
| `backend/functions/employee/cognito_auth.py` | Vendored from shared/ |
| `backend/functions/lms/cognito_auth.py` | Vendored from shared/ |
| `backend/functions/jesse/cognito_auth.py` | Vendored from shared/ |
| `backend/functions/admin/main.py` | Line 2013: removed `"sk": "v1"` from features GetItem; lines 2036-2042: removed from PutItem |
| `apps/web/app/(auth)/login/page.tsx` | Fixed Verification failed — `detail` field extraction |

---

## Root Causes Fixed

### 1. `No module named 'cognito_auth'` (all Lambdas)
`backend/shared/cognito_auth.py` was never bundled into Lambda ZIPs.  
Fix: copied into each function folder before zipping.

### 2. `No module named 'cryptography'` (all Lambdas)
Lambda Python 3.12 runtime does not ship `cryptography`.  
Fix: `pip install cryptography -t . -q` in buildspec before each zip step.

### 3. `FEATURE_FLAGS_GET_ERROR: ValidationException` (admin)
`endevo-uat-config` is hash-only (`configKey`). Code passed `{"configKey": "FEATURE_FLAGS", "sk": "v1"}` — extra key `sk` caused ValidationException on every call.  
Fix: removed `"sk": "v1"` from both GetItem and PutItem.

---

## Remaining P2 Items (non-blocking, deferred)

1. `/api/admin/system/status` — 2620ms avg (threshold 2000ms). Live health probe behaviour; acceptable.
2. `endevo-uat-subscriptions`, `endevo-uat-config`, `endevo-uat-sessions` — tables empty. Require data seeding, not code fixes.

---

## Out of Scope (deferred stash)

Stash `wip-global-admin-bypass` holds partial GLOBAL_ADMIN bypass for HR/employee/lms 401s. NOT committed — outside the `admin/*` scope of this session.  
Files in stash: `hr/main.py`, `employee/main.py`, `lms/utils/auth.py`, `lms/routes/assessment.py`, `lms/routes/course.py`

---

## Browser Test Checklist for Shahzad

Log in as khak.pa@gmail.com at https://uat.endevo.life

### Admin Pages to Verify
- [ ] `/admin/dashboard` — shows tenant/user counts
- [ ] `/admin/users` — lists users with pagination
- [ ] `/admin/tenants` — lists tenants
- [ ] `/admin/tenants/[tenantId]` — tenant detail loads
- [ ] `/admin/subscriptions` — shows subscription summary (table may be empty)
- [ ] `/admin/audit` — shows audit log entries
- [ ] `/admin/archive` — archive users and tenants listed
- [ ] `/admin/health` — green status indicators
- [ ] `/admin/system` — system status loads (may be slow ~3s, expected)
- [ ] `/admin/features` — feature flags panel loads, no error toast
- [ ] `/admin/plan-config` — plan config loads
- [ ] `/admin/import-export` — page loads
- [ ] `/admin/knowledge` — knowledge files listed
- [ ] `/admin/finops` — page loads
- [ ] `/admin/certificates` — page loads
- [ ] `/admin/settings` — page loads
- [ ] `/admin/developers` — page loads
- [ ] `/admin/executive-brief` — page loads
- [ ] `/admin/lms/modules` — LMS module list loads
- [ ] `/admin/lms/progress` — progress page loads
- [ ] `/admin/lms/questions` — questions page loads

### What to Watch For
- Any page showing 401 / "Unauthorized" banner → report the endpoint
- `/admin/features` must NOT show an error toast (P1 was fixed)
- `/admin/system` will take ~3s to load — this is expected behaviour
