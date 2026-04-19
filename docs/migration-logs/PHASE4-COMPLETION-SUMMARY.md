# WorkOS → Cognito Migration — Completion Summary

**Date:** 2026-04-18
**Branch:** feat/cognito-federation-migration
**Status:** ALL PHASES COMPLETE — ready for review

---

## What Changed

### Phase 1 — CDK Infrastructure

| File | Change |
|------|--------|
| `infrastructure/lib/01-cognito-stack.ts` | Full rewrite — new pool "uat-endevo-users-v2", 3 pool groups (GLOBAL_ADMIN/HR_ADMIN/EMPLOYEE), passwordless-only app client, domain, JWKS URL output |
| `infrastructure/lib/07-cognito-triggers-stack.ts` | **NEW** — 5 Lambda trigger functions (define/create/verify challenge, pre-token-gen, post-confirmation) |
| `infrastructure/lib/04-iam-stack.ts` | Removed endevo/workos/* secrets access; added Cognito IdP policy (12 actions) |
| `infrastructure/lib/05-api-stack.ts` | Removed WORKOS_* env vars; added COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_JWKS_URL |
| `infrastructure/lib/06-amplify-stack.ts` | Removed NEXT_PUBLIC_WORKOS_CLIENT_ID; added NEXT_PUBLIC_COGNITO_* vars |
| `infrastructure/bin/app.ts` | Full rewrite — CognitoStack + CognitoTriggersStack instantiation; app-level tags |

### Phase 2 — Backend Lambdas

| File | Change |
|------|--------|
| `backend/shared/cognito_auth.py` | **NEW** — shared JWKS-based JWT verifier; 1-hour JWKS cache; rejects endevo_* tokens |
| `backend/functions/cognito-triggers/define-challenge/handler.py` | **NEW** |
| `backend/functions/cognito-triggers/create-challenge/handler.py` | **NEW** — 6-digit OTP; SES email; DynamoDB OTP_STORE |
| `backend/functions/cognito-triggers/verify-challenge/handler.py` | **NEW** — OTP verify + consume |
| `backend/functions/cognito-triggers/pre-token-gen/handler.py` | **NEW** — injects custom:role claim |
| `backend/functions/cognito-triggers/post-confirmation/handler.py` | **NEW** — creates/backfills DynamoDB user record |
| `backend/functions/auth/main.py` | Full rewrite — Cognito OTP/JWT; /send-otp returns Cognito session; /verify-otp returns JWT tokens |
| `backend/functions/admin/main.py` | WorkOS user creation → _cognito_create_user; reset-password → 410; health → Cognito describe_user_pool |
| `backend/functions/hr/main.py` | WorkOS invite → _cognito_create_user; credential-reset → 410 |
| `backend/functions/employee/main.py` | get_caller → cognito_auth (Cognito JWT) |
| `backend/functions/lms/utils/auth.py` | Full rewrite → cognito_auth |
| `backend/functions/jesse/main.py` | get_caller → cognito_auth; removed _secrets client |

**Deleted:**
- `backend/functions/auth/utils/workos_auth.py`
- `backend/functions/admin/utils/workos_auth.py`
- `backend/functions/hr/utils/workos_auth.py`
- `backend/functions/employee/utils/workos_auth.py`
- `backend/functions/lms/utils/workos_auth.py`

### Phase 3 — Frontend

| File | Change |
|------|--------|
| `apps/web/lib/auth/cognito.ts` | Added refreshSession(), full signOut() with backend logout |
| `apps/web/app/(auth)/login/page.tsx` | API contract: otp_ref → session; removed phone field; Cognito branding; refresh_token cookie |
| `apps/web/app/(auth)/register/page.tsx` | Footer branding updated |
| `apps/web/app/(auth)/status/page.tsx` | "WorkOS Auth" → "Amazon Cognito Auth" |
| `apps/web/app/api/auth/callback/route.ts` | OAuth callback → redirect to /login |
| `apps/web/middleware.ts` | Removed /forgot-password from PUBLIC_PATHS |
| `apps/web/lib/api.ts` | verifyOtp: otp_ref → session param |
| `apps/web/next.config.ts` | Removed WORKOS env var; added COGNITO env vars |
| `apps/web/app/(global-admin)/admin/health/page.tsx` | All WorkOS refs → Cognito |
| `apps/web/app/(global-admin)/admin/dashboard/page.tsx` | Footer updated |
| `apps/web/app/(global-admin)/admin/executive-brief/page.tsx` | SSO badge → Cognito passwordless |

**Deleted:**
- `apps/web/lib/auth/workos.ts`
- `apps/web/app/(auth)/forgot-password/page.tsx`

---

## Known Residuals (non-executable, intentionally left)

| File | Reference | Reason |
|------|-----------|--------|
| `backend/functions/auth/main.py` | Docstring mentions removed WorkOS routes | Documents what was removed; no runtime impact |
| `infrastructure/lib/04-iam-stack.ts` | Comment: "WorkOS secrets left in place 60 days" | Architecture decision — secrets retained for rollback window |
| `infrastructure/docs/jesse-iam-policy.json` | Legacy IAM policy doc | Documentation only; not used in CDK |
| `scripts/setup_all_accounts.py` | WorkOS seed script | Historical one-time script; seed_training_data() + check_ses() still useful; WorkOS functions dead code |
| `.audit-temp/*.json` | Audit snapshot data | Temporary audit files; not deployed |

---

## Statistics

| Category | Count |
|----------|-------|
| Files deleted | 7 |
| Files created (new) | 7 |
| Files modified | 23 |
| Live workos references remaining | 0 |

---

## Architecture Decisions Implemented

- **A** PASSWORDLESS ONLY: Email OTP via Cognito custom auth ✅
- **B** FRESH COGNITO POOL: "uat-endevo-users-v2" ✅
- **C** STATELESS JWT: API Gateway JWKS verification; no sessionToken writes ✅
- **D** POOL GROUPS = ROLES: GLOBAL_ADMIN (1), HR_ADMIN (2), EMPLOYEE (3) ✅
- **E** DYNAMODB STAYS: cognitoSub field added; workosUserId writes stopped ✅
- **F** NO SEED DATA MIGRATION: Pool starts empty ✅
- **G** NO FEDERATION: SAML/OIDC out of scope ✅
- **H** TAGS: Project, Environment, Owner, Component, ManagedBy on all new resources ✅

---

## Next Steps (for Shahzad review)

1. **Review all diffs** — no commits or deployments have been made
2. **CDK deploy** — `cd infrastructure && cdk deploy CognitoTriggersStack CognitoStack` (in that order)
3. **Update env vars** — set COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_JWKS_URL in API stack
4. **Update Amplify env vars** — NEXT_PUBLIC_COGNITO_* in Amplify console or stack
5. **Test OTP flow** — send-otp → verify-otp → JWT cookies → dashboard
6. **60-day cleanup** — after 2026-06-18: remove sessionToken-index GSI, remove workosUserId column, delete endevo/workos/* secrets
