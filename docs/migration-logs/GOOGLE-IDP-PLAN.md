# Google Identity Provider Implementation Plan
**Target date:** Monday 2026-04-20
**Owner:** Shahzad + Claude Code
**Estimated duration:** 4–6 hours
**Dependencies:** Architecture decision from Shahzad (see Model choice below)

---

## Prerequisites (Shahzad must complete BEFORE execution)

1. **Google Cloud Console** — create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized JavaScript origins: `https://uat.endevo.life`
   - Authorized redirect URI: `https://uat-endevo-users-v2.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
   - Save **Client ID** + **Client Secret** (will go into Cognito)

2. **Architecture decision** — pick one of the three models below.

---

## Architecture Decision — User Provisioning Model

### Model 1 — Invite-only ✅ RECOMMENDED (Cigna-ready)
- Admin creates DynamoDB user record first with email + tenant + role
- User signs in with Google → Cognito matches by email
- Unknown email → login rejected by pre-token-gen Lambda
- pre-token-gen Lambda: reads existing DynamoDB record, injects tenant/role into JWT

**Pro:** Zero self-signup risk, HIPAA/enterprise-ready, clean data model
**Con:** Every new user requires admin action first

### Model 2 — Self-signup B2C
- Any Google user auto-creates as B2C individual tenant + EMPLOYEE role
- Admin can promote/merge later
- Requires: auto-tenant creation logic, email verification, anti-abuse controls

**Pro:** Frictionless for B2C
**Con:** Unknown users enter the system; harder to control data quality

### Model 3 — Hybrid (domain-aware)
- `@corporate-domain.com` → invite-only (B2B)
- `@gmail.com` / `@hotmail.com` → self-signup (B2C)
- Requires: domain allowlist in `endevo-uat-config` table

**Pro:** Best of both worlds
**Con:** More complex; domain allowlist must be maintained

---

## Execution Steps (Model 1)

### Step 1 — Cognito: Add Google IdP (30 min)

```bash
aws cognito-idp create-identity-provider \
  --user-pool-id us-east-1_mZ1axgz46 \
  --provider-name Google \
  --provider-type Google \
  --provider-details \
    client_id=YOUR_GOOGLE_CLIENT_ID,\
    client_secret=YOUR_GOOGLE_CLIENT_SECRET,\
    authorize_scopes="openid email profile" \
  --attribute-mapping email=email,sub=custom:google_sub \
  --region us-east-1

aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_mZ1axgz46 \
  --client-id 3ahgmd4tletmpm3f0nbn1b9230 \
  --supported-identity-providers COGNITO Google \
  --region us-east-1
```

### Step 2 — Cognito Hosted UI domain (20 min)

```bash
aws cognito-idp create-user-pool-domain \
  --domain endevo-uat \
  --user-pool-id us-east-1_mZ1axgz46 \
  --region us-east-1
```

Hosted UI URL: `https://endevo-uat.auth.us-east-1.amazoncognito.com`

### Step 3 — Frontend: "Sign in with Google" button (1–2 hrs)

File: `apps/web/app/(auth)/login/page.tsx`

- Add Google button below OTP form
- Button redirects to Cognito Hosted UI authorize endpoint with `identity_provider=Google`
- Callback URL: `https://uat.endevo.life/auth/callback`
- Create `/auth/callback` page to exchange `code` for tokens via Cognito token endpoint
- Store tokens in cookies (same pattern as existing OTP flow)

### Step 4 — pre-token-gen Lambda update (30 min)

File: `backend/functions/auth/main.py` (Cognito trigger)

When federated user logs in:
- Lookup DynamoDB user record by email
- If found → inject `custom:tenantId`, `custom:role` into JWT claims
- If not found (Model 1) → raise exception to reject login with clear error

### Step 5 — Test (30 min)

- Google sign-in with `khak.pa@gmail.com` → redirects to `/admin` dashboard
- Google sign-in with unknown email → rejected with error page
- Verify JWT claims: `tenantId = "SYSTEM"`, `role = "GLOBAL_ADMIN"`

### Step 6 — Deploy (30 min)

```bash
git commit -m "feat(auth): add Google IdP via Cognito Hosted UI"
git push origin main && git push github main
# Amplify auto-triggers; CodeBuild for Lambda
```

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| OAuth scopes | `openid email profile` only — no Google Drive/Calendar/etc. access |
| Client secret | Store in AWS Secrets Manager, not Lambda env var |
| Token refresh | Handled by Cognito automatically |
| Account linking | Cognito merges same-email accounts per pool rules |
| Audit logging | Log all federated logins in `endevo-uat-audit` at INFO severity |

---

## Rollback Plan

If Google IdP breaks existing OTP login:

1. `git revert HEAD` + redeploy frontend
2. Remove Google from app client:
   ```bash
   aws cognito-idp update-user-pool-client \
     --user-pool-id us-east-1_mZ1axgz46 \
     --client-id 3ahgmd4tletmpm3f0nbn1b9230 \
     --supported-identity-providers COGNITO \
     --region us-east-1
   ```
3. OTP flow continues working unchanged

---

## Post-Launch Monitoring

- CloudWatch metric: `cognito-idp` `FederationSignIn` count
- Alarm: Google login error rate > 5% over 5 min window
- Weekly review: Google vs OTP login split

---

## Future Providers

| Provider | Effort | Notes |
|----------|--------|-------|
| Microsoft (Entra ID) | 1 day | Covers Outlook/Hotmail/Live — high value for B2B |
| GitHub | 1 day | Developer accounts |
| Facebook | 1–2 weeks | Requires Facebook app review process |
