# Phase 3 — Frontend WorkOS Residuals Audit

**Date:** 2026-04-18
**Status:** CLEAN — all live WorkOS code removed

## Files deleted

| File | Reason |
|------|--------|
| `apps/web/lib/auth/workos.ts` | WorkOS SSO helpers — SSO login flow removed |
| `apps/web/app/(auth)/forgot-password/page.tsx` | Forgot-password is irrelevant in a passwordless system |

## Files modified

| File | Change |
|------|--------|
| `apps/web/lib/auth/cognito.ts` | Added `refreshSession()`, full `signOut()` with backend logout call, removed id_token/refresh_token gaps |
| `apps/web/app/(auth)/login/page.tsx` | API contract: `otp_ref` → `session`; removed `phone` field; fixed footer to "Amazon Cognito"; stores `refresh_token` cookie |
| `apps/web/app/(auth)/register/page.tsx` | Footer: "Protected by WorkOS" → "Protected by Amazon Cognito" |
| `apps/web/app/(auth)/status/page.tsx` | "WorkOS Auth" → "Amazon Cognito Auth" |
| `apps/web/app/api/auth/callback/route.ts` | OAuth callback removed — now redirects to /login (OTP-based auth has no OAuth code flow) |
| `apps/web/middleware.ts` | Removed `/forgot-password` from PUBLIC_PATHS |
| `apps/web/lib/api.ts` | `verifyOtp(email, otp_ref, code)` → `verifyOtp(email, session, code)` |
| `apps/web/next.config.ts` | Removed `NEXT_PUBLIC_WORKOS_CLIENT_ID`; added `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_REGION` |
| `apps/web/app/(global-admin)/admin/health/page.tsx` | WorkOS Identity section → Cognito; all 6 WorkOS references updated |
| `apps/web/app/(global-admin)/admin/dashboard/page.tsx` | Footer "WorkOS" → "Cognito" |
| `apps/web/app/(global-admin)/admin/executive-brief/page.tsx` | SSO badge → Cognito passwordless; footer powered-by updated |

## Note on aws-amplify

Amplify was not added. The frontend calls backend API endpoints (`/api/auth/send-otp`, `/api/auth/verify-otp`) which handle all Cognito interaction. Direct frontend-to-Cognito calls are not needed and would add ~200KB to the bundle.

## Verdict

**No live WorkOS code remains in the frontend.** All authentication paths go through the backend API which uses Cognito JWT verification.
