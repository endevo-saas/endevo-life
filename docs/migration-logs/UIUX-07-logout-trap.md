# UIUX-07 — Logout Trap Analysis
**Date:** 2026-04-19 | **Severity:** CRITICAL (P0)

## Root Cause

**File:** `apps/web/lib/api.ts` lines 39–43

```typescript
// Handle 401 — redirect to login
if (res.status === 401) {
  showToast('Session expired — redirecting to login', 'warning')
  window.location.href = '/login'   // ← THE TRAP
}
```

Every API call goes through `apiFetch()`. Any 401 response **immediately hard-redirects** to `/login`.

## Why This Is Severe

- Expired token → logout (expected, but no graceful re-auth)
- Wrong role calling wrong endpoint → 401 → logout
- Backend temporary 401 (cold start, race condition) → logout
- No retry, no refresh-token attempt, no grace period

## All Redirect-to-Login Patterns Found

| File | Line | Trigger | Type |
|------|------|---------|------|
| apps/web/lib/api.ts | 40–43 | Any 401 response from ANY endpoint | **Auto-redirect (BUG)** |
| apps/web/app/(auth)/register/page.tsx | 39 | Activation success after 3s | Intentional |
| apps/web/app/(auth)/register/page.tsx | 102 | "Back to login" button | Intentional |
| apps/web/app/signup/page.tsx | 64 | Signup success after 3s | Intentional |
| apps/web/app/(global-admin)/layout.tsx | 214 | Logout button onClick={signOut} | Intentional |
| apps/web/app/(hr-admin)/layout.tsx | 130 | Logout button onClick={signOut} | Intentional |
| apps/web/app/(employee)/layout.tsx | 191 | Logout button onClick={signOut} | Intentional |
| apps/web/lib/auth/cognito.ts | 6–18 | signOut() function | Intentional |

## Proposed Fix (Option A — Try Refresh First)

In `apps/web/lib/api.ts` lines 40–43, replace hard-redirect with:
1. Attempt `api.refreshSession()` using the stored refresh_token cookie
2. If refresh succeeds, retry the original request once
3. If refresh fails, THEN redirect to /login

**Option B (minimal, 15-min fix):** Remove `window.location.href` entirely. Show persistent error toast with a "Re-login" link. Let user decide.

## Impact Scope

ALL 43 pages across all 3 roles. Most commonly triggered when:
1. Cognito access token expires (1-hour TTL) mid-session
2. Page hard-reload with expired token
3. Backend returns transient 401
