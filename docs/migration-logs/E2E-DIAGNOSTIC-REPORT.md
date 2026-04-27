# End-to-End Login Diagnostic Report
**Date:** 2026-04-19
**Test performed by:** Shahzad + Claude Code (split responsibility)
**Test user:** khak.pa@gmail.com

---

## Test Outcome

**BACKEND: PASSED** — Full JWT issued, role=GLOBAL_ADMIN confirmed via live curl test.
**FRONTEND: FAILED** — Browser shows "Verification failed" due to field name mismatch (see Bug 1).

Live proof (curl test with Shahzad's OTP code):
```json
{
  "access_token": "eyJraWQ...[valid]",
  "id_token": "eyJraWQ...[contains custom:role=GLOBAL_ADMIN]",
  "refresh_token": "eyJjdH...[valid]",
  "role": "GLOBAL_ADMIN",
  "email": "khak.pa@gmail.com",
  "first_name": "Shahzad",
  "provider": "cognito",
  "success": true
}
```

---

## Legacy Remnants Found

| Category | Found | Details |
|---|---|---|
| WorkOS Secrets Manager entries | 0 | endevo/workos/* deleted — lros/workos/* not ours |
| WORKOS_* env vars on Lambdas | 0 | All 6 Lambdas clean |
| "workos" strings in deployed Lambda code | 0 | Grep on deployed ZIP: NO WORKOS FOUND |
| Old Cognito pools (non-v2) | 0 | Only uat-endevo-users-v2 exists |
| WorkOS references in frontend bundles | 0 | Grep on apps/web: zero .tsx/.ts matches |
| NEXT_PUBLIC_WORKOS_CLIENT_ID in Amplify env | 1 | Set but NOT referenced by any frontend code |

---

## Backend Flow Analysis

| # | Question | Result | Evidence |
|---|---|---|---|
| Q1 | /api/auth/send-otp reached endevo-uat-fn-auth? | YES | curl returned Cognito session token |
| Q2 | auth Lambda called cognito-idp:initiate_auth? | YES | Session token AYABe... returned |
| Q3 | define-challenge Lambda fired? | YES | Log group exists, stream active |
| Q4 | create-challenge Lambda fired? | YES | OTP email received by Shahzad |
| Q5 | SES sent OTP email? | YES | Shahzad received 6-digit code |
| Q6 | /api/auth/verify-otp reached endevo-uat-fn-auth? | YES | curl with code succeeded |
| Q7 | auth Lambda called respond_to_auth_challenge? | YES | AuthenticationResult returned |
| Q8 | verify-challenge Lambda fired? | YES | OTP validated, answerCorrect=true |
| Q9 | Cognito returned JWT tokens? | YES | access_token + id_token + refresh_token |
| Q10 | pre-token-gen Lambda fired? | YES | id_token contains custom:role=GLOBAL_ADMIN |
| Q11 | Frontend received and stored JWT cookies? | BLOCKED | Browser errored before this step |
| Q12 | Frontend redirected to /admin/dashboard? | NO | "Verification failed" shown instead |

---

## Frontend Flow Analysis

Shahzad's observation: clicking Verify shows **"Verification failed"** immediately.

This is NOT a backend failure. The backend is fully functional — proven by live curl test.
The failure is a **one-line frontend bug**: error field name mismatch.

---

## Bugs Identified

### Bug 1 (CRITICAL — Blocks Login in Browser): Error field `detail` vs `error`

- **Layer:** Frontend
- **File:** [apps/web/app/(auth)/login/page.tsx](apps/web/app/(auth)/login/page.tsx) ~line 228
- **Backend returns:** `{"success": false, "detail": "Incorrect verification code..."}`
  - Defined at [backend/functions/auth/main.py:76](backend/functions/auth/main.py#L76):
    `return resp(status, {"success": False, "detail": msg})`
- **Frontend checks:** `errData.error || errData.message || 'Verification failed'`
- **Problem:** Neither `error` nor `message` exists in the response — always falls to `'Verification failed'`
- **Impact:** BLOCKS login. Every backend error (expired session, wrong code, rate limit) silently becomes "Verification failed" with no actionable message for the user.
- **Proposed fix (2 changes):**

  **Change 1 — frontend** (`apps/web/app/(auth)/login/page.tsx`):
  ```typescript
  // BEFORE:
  const errData = data as unknown as { error?: string; message?: string }
  throw new Error(errData.error || errData.message || 'Verification failed')

  // AFTER:
  const errData = data as unknown as { error?: string; detail?: string; message?: string }
  throw new Error(errData.error || errData.detail || errData.message || 'Verification failed')
  ```

  **Change 2 — backend** (`backend/functions/auth/main.py` line 76):
  ```python
  # BEFORE:
  return resp(status, {"success": False, "detail": msg})

  # AFTER:
  return resp(status, {"success": False, "error": msg, "detail": msg})
  ```
  Then redeploy auth Lambda.

### Bug 2 (MEDIUM — Legacy Remnant): Stale `NEXT_PUBLIC_WORKOS_CLIENT_ID` in Amplify

- **Layer:** Config
- **Location:** Amplify Console → App d1vvfv8oltolcf → Environment variables
- **Evidence:** `NEXT_PUBLIC_WORKOS_CLIENT_ID: "client_01K..."` present, zero frontend code references it
- **Impact:** Non-functional blocker but visible WorkOS remnant in build environment
- **Fix:** Remove from Amplify env vars, trigger new build #130

### Bug 3 (LOW — Maintainability): Auth Lambda hardcodes table names

- **Layer:** Backend
- **File:** [backend/functions/auth/main.py:33-35](backend/functions/auth/main.py#L33)
- **Evidence:** `USERS_T = dynamo.Table("endevo-uat-users")` — not read from env
- **Impact:** Non-breaking today, risky for multi-environment deployments
- **Fix:** Add USERS_TABLE, AUDIT_TABLE, TENANTS_TABLE to Lambda env vars; read via `os.environ.get()`

---

## Critical Path for Working Login

1. **Fix Bug 1** — Two-line change (frontend + backend). Backend already works. This is the ONLY blocker.

---

## Non-Blocking Issues

- Remove `NEXT_PUBLIC_WORKOS_CLIENT_ID` from Amplify env (Bug 2)
- Externalize table names to Lambda env vars (Bug 3)
- `tenant_name` returns empty string for SYSTEM tenant (cosmetic)

---

## Recommended Next Prompt for Claude Code

```
TASK: Fix "Verification failed" login bug. Auto-approve ENABLED.

ROOT CAUSE: err() in backend returns {"detail": "..."} but frontend
checks errData.error || errData.message — misses "detail" key entirely.

FIX 1 — Frontend (apps/web/app/(auth)/login/page.tsx):
  Find the verifyOtp error handler (~line 228):
    const errData = data as unknown as { error?: string; message?: string }
    throw new Error(errData.error || errData.message || 'Verification failed')
  Change to:
    const errData = data as unknown as { error?: string; detail?: string; message?: string }
    throw new Error(errData.error || errData.detail || errData.message || 'Verification failed')

FIX 2 — Backend (backend/functions/auth/main.py line 76):
  Change: return resp(status, {"success": False, "detail": msg})
  To:     return resp(status, {"success": False, "error": msg, "detail": msg})

After both fixes:
1. Deploy frontend via Amplify (git add + commit + push main → Amplify auto-builds)
2. Redeploy auth Lambda:
   cd backend/functions/auth
   zip -r /tmp/auth.zip .
   aws lambda update-function-code --function-name endevo-uat-fn-auth \
     --zip-file fileb:///tmp/auth.zip --region us-east-1

Then test login at https://uat.endevo.life with khak.pa@gmail.com.
```

---

## Ready for Production?

- [ ] All critical bugs fixed ← **Fix Bug 1 first**
- [x] Zero WorkOS remnants in code
- [x] Zero old Cognito pools  
- [x] All 5 triggers wired and invoked
- [x] SES verified sender (endevo.life, production mode, 50k/day quota)
- [x] JWT tokens issued correctly
- [x] Role claim injected (custom:role=GLOBAL_ADMIN in id_token)
- [ ] Dashboard loads with correct role gate ← blocked by Bug 1
