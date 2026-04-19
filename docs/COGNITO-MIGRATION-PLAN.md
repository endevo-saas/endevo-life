# Cognito Federation Migration Plan

**Generated:** 2026-04-18
**Branch:** feat/cognito-federation-migration
**Status:** Discovery phase (no code changes yet)

---

## 1. Current WorkOS Footprint

### 1.1 Files that reference WorkOS

| File Path | Purpose | Lines touching WorkOS | Risk if removed |
|---|---|---|---|
| `backend/functions/auth/main.py` | Auth Lambda — SSO login + callback routes | ~25 lines (routes 354–453, secret fetches) | **HIGH** — SSO login path broken until replaced |
| `backend/functions/auth/utils/workos_auth.py` | Deprecated JWKS validator (not used for auth) | 132 lines (entire file) | **LOW** — explicitly marked deprecated, not called from auth path |
| `backend/functions/admin/main.py` | Admin Lambda — WorkOS user management (create/delete/reset) | ~40 lines (lines 125–143, 512, 840–873, 1034–1125, 1197–1217) | **HIGH** — invite + password-reset flows call WorkOS User Management API |
| `backend/functions/admin/utils/workos_auth.py` | Deprecated JWKS validator | 132 lines (entire file) | **LOW** |
| `backend/functions/hr/main.py` | HR Lambda — WorkOS user create + password reset | ~20 lines (lines 50–79, 374–388, 563–577) | **HIGH** — invite + credential-reset broken until replaced |
| `backend/functions/hr/utils/workos_auth.py` | Deprecated JWKS validator | 132 lines (entire file) | **LOW** |
| `backend/functions/employee/main.py` | Employee Lambda — comment only (WorkOS JWT path explicitly rejected) | ~3 lines (comment) | **LOW** — no active call |
| `backend/functions/employee/utils/workos_auth.py` | Deprecated JWKS validator | 132 lines (entire file) | **LOW** |
| `backend/functions/lms/utils/workos_auth.py` | Deprecated JWKS validator | 132 lines (entire file) | **LOW** |
| `apps/web/lib/auth/workos.ts` | Frontend SSO utility (dormant — only active when `NEXT_PUBLIC_WORKOS_CLIENT_ID` set) | 52 lines (entire file) | **MED** — SSO button/flow would break; OTP login unaffected |
| `apps/web/app/api/auth/callback/route.ts` | Next.js OAuth callback — calls Lambda `/api/auth/workos/callback`, sets `auth_provider: workos` cookie | 44 lines (entire file) | **MED** — only the SSO path; OTP login uses no callback |
| `apps/web/app/(auth)/login/page.tsx` | Login page footer text only ("Protected by WorkOS") | 1 line (line 540) | **LOW** — UI text, not functional |
| `apps/web/app/(auth)/register/page.tsx` | Register/activation page footer text only | 1 line (line 131) | **LOW** |
| `apps/web/app/(auth)/status/page.tsx` | Status page — static hardcoded "WorkOS Auth: ok" check | 2 lines | **LOW** |
| `apps/web/app/(global-admin)/admin/health/page.tsx` | Admin health dashboard — WorkOS section with static values | ~30 lines | **LOW** — display only |
| `apps/web/app/(global-admin)/admin/executive-brief/page.tsx` | Executive brief — "WorkOS SSO / SAML Federation" feature card | ~5 lines | **LOW** — display only |
| `apps/web/app/(global-admin)/admin/dashboard/page.tsx` | Admin dashboard — "WorkOS" in tech stack string | 1 line | **LOW** |
| `apps/web/next.config.ts` | Exports `NEXT_PUBLIC_WORKOS_CLIENT_ID` env var | 1 line | **MED** — env var must be replaced |
| `infrastructure/lib/05-api-stack.ts` | Lambda env vars: `WORKOS_API_KEY_SECRET`, `WORKOS_CLIENT_ID_SECRET` | 2 lines | **HIGH** — must be replaced with Cognito env vars |
| `infrastructure/lib/04-iam-stack.ts` | IAM policy grants Secrets Manager access to `endevo/workos/*` | 1 line | **MED** — must be updated to `endevo/cognito/*` or removed |
| `infrastructure/lib/06-amplify-stack.ts` | Hardcodes `NEXT_PUBLIC_WORKOS_CLIENT_ID` value in Amplify env | 1 line | **MED** — must be replaced with Cognito env vars |
| `infrastructure/lib/01-cognito-stack.ts` | Cognito CDK stack — complete pool definition, NOT imported in app.ts | 82 lines | **POSITIVE** — ready to re-enable |

### 1.2 Environment Variables

| Variable Name | Where Used | Value (redacted) |
|---|---|---|
| `NEXT_PUBLIC_WORKOS_CLIENT_ID` | `next.config.ts`, `apps/web/lib/auth/workos.ts`, Amplify env | `[REDACTED]` (hardcoded in `06-amplify-stack.ts`) |
| `NEXT_PUBLIC_API_URL` | All frontend files — points to API Gateway base URL | `https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com` |
| `WORKOS_API_KEY_SECRET` (Lambda env) | `05-api-stack.ts` → Lambda runtime env | `endevo/workos/api-key` (secret name, not value) |
| `WORKOS_CLIENT_ID_SECRET` (Lambda env) | `05-api-stack.ts` → Lambda runtime env | `endevo/workos/client-id` (secret name, not value) |
| `WORKOS_CLIENT_ID` (Python env) | `auth/utils/workos_auth.py` — read by deprecated validator | `""` (defaults to empty — validator dormant) |

> **Note:** `.env.local` does not exist in `apps/web/`. `.env.production` contains only 3 entries: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BOOKING_LINK`, `NEXT_PUBLIC_SENTRY_DSN` — no WorkOS vars. The WorkOS client ID is injected by Amplify at build time via `06-amplify-stack.ts`.

### 1.3 Package Dependencies

**Frontend (`apps/web/package.json`):**
- No `@workos-inc/node`, `@workos-inc/authkit-nextjs`, or any WorkOS npm package installed.
- WorkOS API is called via raw `fetch()` to the backend Lambda — no frontend SDK.
- No `amazon-cognito-identity-js`, `@aws-amplify/auth`, or Cognito SDK installed.
- Auth-related packages present: `js-cookie` (cookie management), `react-hook-form` + `zod` (form validation).

**Backend (`backend/functions/auth/requirements.txt`):**
- File contains only the comment: `# boto3 is pre-installed in AWS Lambda Python 3.12 runtime — no pip installs needed`
- No `workos` Python package. All WorkOS calls are raw HTTP via `urllib.request`.
- No `python-jose`, `pyjwt`, or Cognito SDK.

### 1.4 AWS Secrets Manager Entries (inferred from code)

- `endevo/workos/api-key` — WorkOS API key, read by auth, admin, and HR Lambdas
- `endevo/workos/client-id` — WorkOS OAuth client ID, read by auth Lambda for SSO flow
- `lros/workos/api-key` — Ghost project, can be deleted
- `lros/workos/client-id` — Ghost project, can be deleted

Secrets to CREATE for Cognito:
- `endevo/cognito/user-pool-id` — Pool ID `us-east-1_DVyEJqgFt`
- `endevo/cognito/client-id` — App client ID (to be created in M1)

---

## 2. Current Auth Flow (as-is)

### 2.1 Login Sequence

**Primary flow — Email OTP (what all users actually use today):**

1. User navigates to `https://uat.endevo.life/login`
2. User enters work email address, clicks "Send Code"
3. Frontend `POST /api/auth/send-otp` → API Gateway → `endevo-uat-fn-auth` Lambda
4. Lambda queries `endevo-uat-users` table (GSI: `email-index`) to look up user record
5. Lambda checks `status != "inactive"` (active users only)
6. Lambda generates cryptographically secure 6-digit OTP (`secrets.randbelow`)
7. Lambda stores OTP in `endevo-uat-audit` table (partition `OTP_STORE`, TTL 5 min)
8. Lambda sends OTP via SES (email) and SNS (SMS if phone number on record)
9. Frontend receives `otp_ref` (UUID) and masked email/phone, shows OTP input
10. User enters 6-digit code, clicks "Verify & Sign In"
11. Frontend `POST /api/auth/verify-otp` with `{email, otp_ref, code}`
12. Lambda fetches OTP record from `endevo-uat-audit` by `(OTP_STORE, otp_ref#email)` key
13. Lambda validates: not expired (5 min TTL), action = `OTP_PENDING`, code matches
14. Lambda deletes OTP record (one-time use)
15. Lambda looks up full user profile from `endevo-uat-users` (email-index GSI)
16. Lambda looks up tenant name from `endevo-uat-tenants` table
17. Lambda generates session token: `endevo_<base64url(sha256(uuid:email:timestamp))>`
18. Lambda stores session token in `endevo-uat-users` record: `sessionToken`, `sessionExpiresAt` (+24h), `lastLoginAt`, `lastLoginIp`
19. Lambda returns `{access_token, role, tenant_id, tenant_name, email, first_name, last_name, provider: "workos"}`
20. Frontend stores in cookies: `access_token`, `user_role`, `user_email`, `tenant_name`, `first_name`, `last_name`
21. Frontend redirects based on role: `/admin/dashboard` | `/hr/dashboard` | `/employee/dashboard`

**Secondary flow — WorkOS SSO (not default; requires `NEXT_PUBLIC_WORKOS_CLIENT_ID` set):**

1. Frontend calls `initiateWorkOSLogin()` from `apps/web/lib/auth/workos.ts`
2. Frontend `GET /api/auth/workos/login` → Lambda fetches WorkOS client ID from Secrets Manager
3. Lambda returns WorkOS AuthKit authorization URL
4. Browser redirects to `https://api.workos.com/user_management/authorize`
5. WorkOS handles OAuth, redirects back to `/api/auth/callback?code=xxx`
6. Next.js route handler `POST /api/auth/workos/callback` to Lambda
7. Lambda exchanges code with WorkOS API (`POST https://api.workos.com/user_management/authenticate`)
8. Lambda receives WorkOS `access_token` + user email
9. Lambda queries `endevo-uat-users` email-index GSI for role + tenant
10. Lambda returns WorkOS `access_token` (NOT an `endevo_*` session token)
11. Frontend sets cookies including `auth_provider: workos`

> **Critical observation:** The SSO path returns a raw WorkOS access token — but ALL Lambda protected endpoints explicitly reject non-`endevo_*` tokens. The SSO path is therefore broken for API calls — it can only be used to get the role/redirect but would fail any subsequent API call. This appears to be an in-progress or untested state.

### 2.2 Session Validation on API Calls

Every protected Lambda (`admin`, `hr`, `employee`, `lms`, `jesse`) uses the same `get_caller()` pattern:

1. Extract `Authorization: Bearer <token>` header
2. If token starts with `endevo_` → query `endevo-uat-users` GSI `sessionToken-index` for matching record
3. Retrieve `role`, `email`, `tenantId`, `userId` from the matching DynamoDB item
4. If token does NOT start with `endevo_` → log `AUTH_REJECTED`, return `None` (explicit reject of WorkOS JWTs)
5. No `sessionExpiresAt` check on API calls (only on `/api/auth/me` endpoint — inconsistency)

Session tokens are **stateful** (stored in DynamoDB). Every API call = 1 DynamoDB read on the `sessionToken-index` GSI.

### 2.3 Role Assignment

- Roles stored in `endevo-uat-users` DynamoDB table, field `role`: `EMPLOYEE` | `HR_ADMIN` | `GLOBAL_ADMIN`
- Set at user creation time by admin (Admin Lambda) or HR (HR Lambda)
- Read from DynamoDB on every API call via session token lookup (not from JWT claim)
- Frontend stores role in `user_role` cookie (set by Lambda response, readable client-side)
- Middleware reads cookie for route-level RBAC (no server-side verification in middleware)

### 2.4 Registration / Activation Flow

Invite-based only (`selfSignUpEnabled: false` in Cognito stack definition):

1. Admin or HR creates user via dashboard → Admin/HR Lambda called
2. Lambda calls WorkOS User Management API (`POST /user_management/users`) to create a WorkOS user record with temp password
3. Lambda stores user in `endevo-uat-users` with `status: pending`, `inviteToken: <uuid>`, `workosUserId: <workos-id>`
4. Lambda sends invite email via SES with link: `https://uat.endevo.life/register?token=<invite_token>`
5. User clicks link → `/register` page auto-calls `POST /api/auth/activate` with token
6. Lambda scans `endevo-uat-users` for matching `inviteToken` where `status = pending`
7. Lambda sets `status: active`, `authProvider: workos`, removes `inviteToken`
8. User redirected to `/login` to authenticate via OTP

**WorkOS dependency in invite flow:** Step 2 calls WorkOS to create a user. If WorkOS fails, the invite fails (though admin Lambda has a fallback: if DynamoDB write fails, it tries to delete the WorkOS user to avoid orphans).

---

## 3. Target Cognito Flow (to-be)

### 3.1 Two-Path Design

**Path A — Non-Federated Tenant (majority of customers):**
- Cognito User Pool as Identity Provider
- Primary auth: Email OTP (existing SES/SNS infrastructure reused via Cognito Lambda triggers, or kept as-is with Cognito as user store only)
- Preferred fast path: Keep existing custom OTP flow, replace DynamoDB session token with Cognito-issued JWT
- MFA: TOTP (Authenticator app) for admin roles; optional for employees

**Path B — Federated Tenant (enterprise customers, e.g. Cigna with existing IdP):**
- Cognito federates to tenant's SAML 2.0 or OIDC Identity Provider
- Tenant configures IdP metadata in Cognito (SAML entity descriptor or OIDC discovery URL)
- User logs in via Hosted UI or custom UI → Cognito handles federation
- SAML attributes (email, groups) mapped to Cognito user pool attributes
- Cognito groups map to application roles (`GLOBAL_ADMIN`, `HR_ADMIN`, `EMPLOYEE`)
- Supported IdPs: Azure AD (OIDC/SAML), Okta, Google Workspace, Ping, OneLogin

### 3.2 Login Sequence (Proposed)

**Path A — Native Cognito OTP (non-federated):**

Option 1 (minimal change — recommended for speed): Keep custom OTP Lambda logic, replace `endevo_*` session token with Cognito JWT

1. User enters email → frontend `POST /api/auth/send-otp` (unchanged)
2. Lambda verifies user exists in `endevo-uat-users` (unchanged)
3. Lambda generates OTP, stores in `endevo-uat-audit`, sends via SES/SNS (unchanged)
4. User enters OTP → frontend `POST /api/auth/verify-otp` (unchanged)
5. Lambda validates OTP (unchanged)
6. Lambda calls Cognito Admin API: `admin_initiate_auth` → `CUSTOM_AUTH` flow or `admin_set_user_password` + issue token
7. Lambda returns Cognito `access_token` (JWT), `id_token`, `refresh_token`
8. Frontend stores tokens in cookies: `access_token` (Cognito JWT), `id_token`, `refresh_token`
9. Role embedded in JWT custom claim `custom:role`; no DynamoDB lookup needed per request

**Path B — Enterprise SAML/OIDC Federation:**

1. Tenant admin configures IdP in Cognito via admin panel (M16)
2. User visits `/login` → enters work email → tenant domain detected (from `endevo-uat-tenants` table)
3. Frontend calls Cognito Hosted UI or custom auth initiation endpoint
4. Cognito redirects to tenant's IdP (Azure AD, Okta, etc.)
5. IdP authenticates user, returns SAML assertion or OIDC token to Cognito
6. Cognito maps attributes → Cognito user pool attributes + group membership
7. Cognito issues `access_token` (JWT), `id_token`, `refresh_token`
8. Frontend callback route receives tokens, stores in cookies
9. Roles resolved from Cognito groups via JWT `cognito:groups` claim

### 3.3 JWT Verification (Proposed)

Replace DynamoDB session token lookup with stateless JWT verification:

- Cognito JWKS endpoint: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DVyEJqgFt/.well-known/jwks.json`
- Cache JWKS in Lambda memory (1-hour TTL — same pattern as existing `workos_auth.py`)
- Verify: signature, expiry (`exp`), issuer (`iss` = Cognito pool URL), audience (`aud` = app client ID)
- Extract claims: `sub` (Cognito user ID), `custom:role`, `custom:tenantId`, `email`
- Each Lambda `get_caller()` function: replace DynamoDB GSI query with JWKS JWT verification (~1ms vs ~5-10ms)
- DynamoDB `sessionToken` and `sessionToken-index` GSI become deprecated (can be removed after cutover)

**Stateless win:** Eliminates 1 DynamoDB read per API call. At 6 Lambda functions × all API calls, this is a significant latency and cost reduction.

### 3.4 Role Assignment (Proposed)

- Cognito User Pool groups: `GLOBAL_ADMIN`, `HR_ADMIN`, `EMPLOYEE`
- On user creation (admin invite): Lambda calls `cognito-idp:admin_add_user_to_group`
- Role embedded in JWT `cognito:groups` claim → no DynamoDB lookup for role
- `endevo-uat-users` DynamoDB table retains `role` field as secondary source of truth for audit trail + migration period dual-read
- For federated (SAML) tenants: SAML attribute `groups` or `memberOf` mapped to Cognito groups via attribute mapping rules
- Role changes: Lambda calls `admin_add_user_to_group` / `admin_remove_user_from_group` → takes effect on next token refresh

---

## 4. Migration Tasks (Ordered, with Dependencies)

### M1–M5: Cognito Pool Setup (AWS Side)

**M1 — Re-enable CognitoStack in CDK**
- What changes: Uncomment `CognitoStack` import in `infrastructure/bin/app.ts`; `01-cognito-stack.ts` is ready and complete
- Files: `infrastructure/bin/app.ts`
- Depends on: Nothing
- Risk: **LOW** — stack already written; pool `endevo-uat-users` already exists in AWS (created manually); CDK will import it if `removalPolicy: RETAIN` is set
- Rollback: Re-comment import; existing pool unaffected due to RETAIN policy
- Note: Verify CDK will not recreate the pool — may need `fromUserPoolId()` import instead of new construct

**M2 — Create Cognito App Client with OAuth + Custom Auth flows**
- What changes: Add App Client to `01-cognito-stack.ts` supporting: `USER_PASSWORD_AUTH`, `CUSTOM_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`, OAuth code grant; configure callback URLs for `uat.endevo.life` and `localhost:3000`
- Files: `infrastructure/lib/01-cognito-stack.ts`
- Depends on: M1
- Risk: **LOW** — additive
- Rollback: Delete app client

**M3 — Add Cognito custom attributes for role and tenantId**
- What changes: Verify `custom:role`, `custom:tenantId`, `custom:tenantName` exist on pool (already in `01-cognito-stack.ts` definition); confirm they are present on existing pool
- Files: AWS Console or CDK update to `01-cognito-stack.ts`
- Depends on: M1
- Risk: **LOW** — attributes are defined in existing stack
- Rollback: N/A (attributes can't be removed but can be unused)

**M4 — Store Cognito credentials in Secrets Manager**
- What changes: Create `endevo/cognito/user-pool-id` and `endevo/cognito/client-id` secrets; update IAM policy in `04-iam-stack.ts` to grant access
- Files: `infrastructure/lib/04-iam-stack.ts`, AWS Secrets Manager
- Depends on: M2
- Risk: **LOW** — additive
- Rollback: Delete secrets

**M5 — Migrate existing 6 DynamoDB users to Cognito User Pool**
- What changes: Write one-time migration script (read-only discovery done; write script calls `cognito-idp:admin_create_user` for each active user, `admin_set_user_password`, `admin_add_user_to_group` for role)
- Files: New script `scripts/migrate-users-to-cognito.py`
- Depends on: M3, M4
- Risk: **MEDIUM** — 6 users; must not send welcome emails (use `MessageAction: SUPPRESS`); test with one user first
- Rollback: `admin_delete_user` on Cognito; DynamoDB untouched

### M6–M10: Backend Lambda Auth Rewrite

**M6 — Replace `get_caller()` with Cognito JWT verification in all Lambdas**
- What changes: Replace DynamoDB `sessionToken-index` lookup with JWKS JWT verification; new shared `utils/cognito_auth.py` module (replaces 5 copies of `workos_auth.py`); extract: `sub`, `custom:role`, `custom:tenantId`, `email` from JWT claims
- Files: `backend/functions/admin/main.py`, `backend/functions/hr/main.py`, `backend/functions/employee/main.py`, `backend/functions/lms/utils/auth.py`, `backend/functions/jesse/main.py`; new `utils/cognito_auth.py` per function
- Depends on: M4
- Risk: **HIGH** — all API calls break if JWT verification is wrong; deploy behind feature flag or parallel path
- Rollback: Re-enable `endevo_*` session token path (keep old code in parallel during transition)

**M7 — Rewrite auth Lambda — OTP verify returns Cognito JWT**
- What changes: In `backend/functions/auth/main.py` verify-otp handler: after OTP validation, call `cognito-idp:initiate_auth` (CUSTOM_AUTH flow) or `admin_create_auth_challenge` to issue Cognito tokens; return `id_token` + `access_token` (JWT) instead of `endevo_*` session token; remove `sessionToken` update on `endevo-uat-users`
- Files: `backend/functions/auth/main.py`
- Depends on: M2, M6
- Risk: **HIGH** — primary login path; must test thoroughly before prod
- Rollback: Feature flag — revert to `endevo_*` token generation path

**M8 — Rewrite auth Lambda — remove WorkOS SSO routes**
- What changes: Remove `GET /api/auth/workos/login` and `POST /api/auth/workos/callback` routes; remove `_get_secret("endevo/workos/api-key")` and `_get_secret("endevo/workos/client-id")` calls; remove `workos_auth.py`
- Files: `backend/functions/auth/main.py`, `backend/functions/auth/utils/workos_auth.py` (delete)
- Depends on: M7 (new flow must be stable)
- Risk: **MEDIUM** — SSO path removed; any user using SSO flow breaks
- Rollback: Git revert

**M9 — Rewrite admin Lambda — replace WorkOS user management with Cognito admin APIs**
- What changes: Replace `_workos_api("POST", "/user_management/users", ...)` with `cognito-idp:admin_create_user` + `admin_add_user_to_group`; replace password reset with `admin_set_user_password`; remove `_workos_api()` helper; store Cognito `sub` in `cognitoUserId` field on DynamoDB (replace `workosUserId`); update admin health check
- Files: `backend/functions/admin/main.py`, `backend/functions/admin/utils/workos_auth.py` (delete)
- Depends on: M4, M6
- Risk: **HIGH** — invite flow + password reset are critical HR operations; bugs would block user onboarding
- Rollback: Dual-write pattern during transition: call both WorkOS and Cognito, then cut WorkOS

**M10 — Rewrite HR Lambda — replace WorkOS user management with Cognito admin APIs**
- What changes: Same as M9 but in HR Lambda; replace `_workos_api()` calls with Cognito admin APIs
- Files: `backend/functions/hr/main.py`, `backend/functions/hr/utils/workos_auth.py` (delete)
- Depends on: M4, M6
- Risk: **HIGH** — same as M9
- Rollback: Same dual-write strategy

### M11–M15: Frontend Integration

**M11 — Replace `endevo_*` cookie handling with Cognito JWT cookies**
- What changes: Frontend receives `id_token` + `access_token` (JWTs) instead of opaque `endevo_*` token; update cookie names/storage in `apps/web/app/(auth)/login/page.tsx`; update `apps/web/lib/auth/cognito.ts` with JWT decode for role claim; update `apps/web/lib/api.ts` `authHeaders()` to send Cognito JWT
- Files: `apps/web/app/(auth)/login/page.tsx`, `apps/web/lib/auth/cognito.ts`, `apps/web/lib/api.ts`
- Depends on: M7
- Risk: **HIGH** — all authenticated pages break if JWT not correctly stored/sent
- Rollback: Feature flag on login page

**M12 — Update middleware to validate Cognito JWT instead of opaque cookie**
- What changes: `apps/web/middleware.ts` currently trusts cookie presence (no cryptographic check); add lightweight JWT decode (verify `exp` and extract `custom:role`) using Edge-compatible code; no full RSA verification in middleware (Edge runtime limitation) — verify on Lambda instead
- Files: `apps/web/middleware.ts`
- Depends on: M11
- Risk: **MEDIUM** — middleware runs on every request; errors = site-wide outage
- Rollback: Git revert

**M13 — Replace WorkOS callback route with Cognito OAuth callback**
- What changes: `apps/web/app/api/auth/callback/route.ts` currently calls `/api/auth/workos/callback`; replace with Cognito token exchange (call `POST https://cognito-idp.us-east-1.amazonaws.com/oauth2/token` with auth code); update cookie: `auth_provider: cognito`
- Files: `apps/web/app/api/auth/callback/route.ts`
- Depends on: M2
- Risk: **MEDIUM** — only affects SSO path (OTP path has no callback)
- Rollback: Git revert

**M14 — Remove WorkOS frontend utility and env vars**
- What changes: Delete `apps/web/lib/auth/workos.ts`; remove `NEXT_PUBLIC_WORKOS_CLIENT_ID` from `next.config.ts`, `06-amplify-stack.ts`; add `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`; update footer text in login/register pages; update admin health and status pages
- Files: `apps/web/lib/auth/workos.ts` (delete), `apps/web/next.config.ts`, `infrastructure/lib/06-amplify-stack.ts`, login/register/status/health pages
- Depends on: M13
- Risk: **LOW** — UI text and dead code removal
- Rollback: Git revert

**M15 — Add token refresh flow**
- What changes: Cognito `refresh_token` (valid 30 days) must be used before `access_token` expiry (configurable, recommend 8h); add silent refresh in `apps/web/lib/api.ts` — on 401, attempt Cognito token refresh before redirecting to login; store `refresh_token` in `httpOnly` cookie
- Files: `apps/web/lib/api.ts`, `apps/web/lib/auth/cognito.ts`
- Depends on: M11
- Risk: **MEDIUM** — if refresh fails, users silently logged out
- Rollback: Remove refresh logic, fall back to redirect-on-401

### M16–M18: Federation Setup (SAML/OIDC for Enterprise Tenants)

**M16 — Add SAML/OIDC identity provider support to Cognito pool**
- What changes: Add `CfnUserPoolIdentityProvider` construct to `01-cognito-stack.ts` (parameterized, per-tenant); create admin UI for SAML metadata upload; store IdP config in `endevo-uat-tenants` DynamoDB table under new `idpConfig` field
- Files: `infrastructure/lib/01-cognito-stack.ts`, new admin UI page, admin Lambda
- Depends on: M1, M2
- Risk: **HIGH** — complex AWS configuration; test with Azure AD sandbox first
- Rollback: Disable identity provider in Cognito; non-federated tenants unaffected

**M17 — Implement tenant-aware login routing (domain → IdP)**
- What changes: On email submission to `/api/auth/send-otp`, if tenant has `idpConfig`, return `{federated: true, loginUrl: <Cognito Hosted UI URL>}` instead of sending OTP; frontend redirects to Cognito Hosted UI for federation
- Files: `backend/functions/auth/main.py`, `apps/web/app/(auth)/login/page.tsx`
- Depends on: M16
- Risk: **MEDIUM** — requires tenant record to have `idpConfig`; clear fallback to OTP if not configured
- Rollback: Feature flag on tenant `idpConfig` field

**M18 — SAML attribute mapping and group assignment**
- What changes: Configure Cognito attribute mapping: SAML `email` → `email`, SAML `groups`/`memberOf` → Cognito groups; write Cognito Pre-Token-Generation Lambda trigger to map Cognito groups → `custom:role` JWT claim; verify end-to-end with test IdP (Azure AD dev tenant)
- Files: `infrastructure/lib/01-cognito-stack.ts` (trigger), new Lambda `backend/functions/cognito-triggers/pre-token-gen.py`
- Depends on: M16, M17
- Risk: **HIGH** — attribute mapping errors = wrong roles for federated users
- Rollback: Disable pre-token-gen trigger; roles fall back to DynamoDB lookup

### M19–M20: WorkOS Removal (Last)

**M19 — Delete WorkOS secrets and IAM policy**
- What changes: Delete Secrets Manager secrets `endevo/workos/api-key`, `endevo/workos/client-id`; remove `endevo/workos/*` IAM policy from `04-iam-stack.ts`
- Files: `infrastructure/lib/04-iam-stack.ts`; delete secrets via AWS CLI or Console
- Depends on: M8, M9, M10 all deployed and stable for ≥2 weeks
- Risk: **LOW** — by this point all code references removed
- Rollback: Recreate secrets (values still in WorkOS dashboard)

**M20 — Cancel WorkOS subscription**
- What changes: Cancel WorkOS account/subscription after confirming zero API calls in CloudWatch logs; archive WorkOS org data per GDPR/data retention policy; remove `lros/workos/*` secrets
- Files: No code changes — business/ops action
- Depends on: M19, zero WorkOS API calls confirmed via CloudWatch for 30 days
- Risk: **LOW** — final cleanup
- Rollback: Reinstate WorkOS (self-service)

---

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Existing 6 users' sessions invalidated during cutover | HIGH | MEDIUM | Schedule cutover in off-hours; pre-notify users; session migration script |
| `endevo_*` session token format hardcoded in frontend cookies and middleware | HIGH | HIGH | Feature flag on verify-otp handler; dual-path until all clients updated |
| Cognito CDK stack recreates pool instead of importing existing one | MEDIUM | HIGH | Use `UserPool.fromUserPoolId()` for import; do NOT deploy CognitoStack if pool already exists |
| SAML attribute mapping returns wrong role for federated users | MEDIUM | HIGH | End-to-end test with Azure AD dev tenant before enabling per-tenant |
| WorkOS user count (77 in health dashboard) vs DynamoDB user count (6) mismatch | HIGH | MEDIUM | Audit before M5: reconcile WorkOS ↔ DynamoDB; understand the 71-user gap |
| `admin_create_user` Cognito sends welcome email before we want | MEDIUM | MEDIUM | Always pass `MessageAction: SUPPRESS` in Lambda; send own invite email via SES |
| Lambda cold start increase from JWKS HTTP fetch | LOW | LOW | Cache JWKS in Lambda memory; keep JWKS_CACHE_TTL = 3600s |
| Cognito refresh token (`httpOnly` cookie) not accessible to frontend | LOW | MEDIUM | Keep `httpOnly: true`; handle refresh server-side in Next.js API route |
| `endevo-uat-users` `sessionToken-index` GSI removal blocks rollback | MEDIUM | HIGH | Keep GSI in place for 60 days post-cutover; only remove after stable |
| `forgot-password` page calls `/api/auth/forgot-password` and `/api/auth/reset-password` — these routes do NOT exist in current auth Lambda | HIGH | MEDIUM | These are dead routes; must implement as M7 extension or remove the page |

---

## 6. Out of Scope

- **SCIM directory sync** — automated user provisioning/deprovisioning from enterprise IdP (Okta SCIM, Azure AD SCIM); requires WorkOS or custom SCIM endpoint implementation
- **BYOK (Bring Your Own Key)** — customer-managed KMS keys for Cognito user data encryption
- **Mobile app auth** — no mobile app exists; if added later, Cognito Amplify libraries handle native mobile flows
- **Social login** (Google, Microsoft personal) — not a B2B use case; excluded by design
- **Passkey / FIDO2 / WebAuthn** — Cognito supports passkeys but adding this is a separate initiative
- **Cognito Advanced Security Features (ASF)** — adaptive auth, compromised credential protection; add as follow-on after stable migration
- **SCIM lifecycle management** (deactivation on IdP side propagating to Cognito) — V2 feature
- **Multi-region Cognito replication** — us-east-1 only for now; DR strategy for auth is separate workstream
- **`endevo-uat-analytics` zero-tag / PITR-disabled table** — flagged in RESOURCES.md; out of scope for auth migration
- **lros-* resource cleanup** — out of scope; tracked in Bucket D of RESOURCES.md

---

## 7. Questions for Shahzad

1. **WorkOS user count discrepancy:** The admin health page hardcodes "Total WorkOS Users: 77" but the DynamoDB `endevo-uat-users` table has only 6 items (from the audit). Were 71 users created in WorkOS but never in DynamoDB? Or is the 77 a stale/static number in the UI? This needs to be reconciled before M5 (user migration) — should the 6 DynamoDB users be migrated, or is there a larger set somewhere?

2. **Forgot-password page:** `apps/web/app/(auth)/forgot-password/page.tsx` calls `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`, but these routes **do not exist** in `backend/functions/auth/main.py`. Is this page dead code, or is it wired to a different Lambda/endpoint that wasn't in scope for this discovery?

3. **WorkOS SSO status:** The `GET /api/auth/workos/login` and `POST /api/auth/workos/callback` routes exist in the auth Lambda, and `apps/web/lib/auth/workos.ts` utility exists — but the SSO callback returns a WorkOS JWT that all other Lambdas explicitly reject. Is the SSO path intentionally disabled (pending migration) or was it ever functional in production? Should it be treated as dead code for migration purposes?

4. **Cognito pool state:** The pool `us-east-1_DVyEJqgFt` (`endevo-uat-users`) exists in AWS with 0 users. The `01-cognito-stack.ts` is written but commented out in `app.ts`. Is this pool the authoritative one to use, or should a fresh pool be created? Recreating would change the pool ID (affects JWKS URL, Amplify env vars, etc.).

5. **`authProvider: workos` in DynamoDB:** The activate route sets `authProvider: workos` on activation. Post-migration, new activations should set `authProvider: cognito`. Do existing activated users need a data migration to update this field, or is it only used for audit/display purposes?

6. **`workosUserId` field in DynamoDB:** Admin and HR Lambdas store `workosUserId` on each user record. After migration, this should become `cognitoSub` (the Cognito `sub` UUID). For the 6 existing users, should a migration script populate `cognitoSub`, or can this be done lazily on first Cognito login?

7. **Token lifetime:** Current session token is valid 24 hours (stored in DynamoDB). Proposed Cognito access token (`accessTokenValidity: 8h` in `01-cognito-stack.ts`), refresh token (`30 days`). Should the access token lifetime be aligned to 24h to match current UX, or is 8h acceptable?

8. **Federated tenant priority:** Is there a specific enterprise tenant (e.g., Cigna) that needs SAML federation before the WorkOS removal can happen? If so, M16–M18 need to precede M19–M20, making the overall timeline longer. Clarifying this drives the critical path.

9. **`endevo-uat-users` `sessionToken-index` GSI:** After migration to stateless JWT, this GSI becomes unused. What is the data retention requirement for existing session tokens? When is it safe to remove the GSI and stop writing `sessionToken` to the table?

10. **`amplify.yml` hardcodes `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BOOKING_LINK` as build-time env vars:** `NEXT_PUBLIC_WORKOS_CLIENT_ID` is NOT in `amplify.yml` but IS in `06-amplify-stack.ts` (Amplify env vars). Should new Cognito env vars go into `amplify.yml`, `06-amplify-stack.ts`, or both?
