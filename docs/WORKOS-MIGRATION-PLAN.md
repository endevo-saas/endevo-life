# WorkOS Migration Plan — 72-Hour Sprint

> **Date:** 2026-04-05
> **Status:** APPROVED — Execute immediately
> **Goal:** Zero-downtime migration from Cognito to WorkOS

---

## Why WorkOS

- $0 for 1M users
- Multi-region "Active-Active" handled by WorkOS (no sync logic needed)
- Enterprise SSO (SAML/OIDC) is a pre-built toggle
- 72-hour migration sprint, not 4-week project

---

## Day 1: Shadow User Setup

### 1.1 WorkOS Environment Configuration
- Create WorkOS account + organization
- Configure redirect URIs: `https://uat.endevo.life/api/auth/callback`
- Set up environment (development + production)
- Get API key + client ID

### 1.2 WebHook Setup
- Configure WorkOS webhook → Lambda endpoint
- On first WorkOS login, webhook triggers `fn-auth`
- Lambda checks `endevo-uat-users` table:
  - User exists → link WorkOS ID to existing DynamoDB record
  - User doesn't exist → create new record

### 1.3 DynamoDB Schema Update
Add to `endevo-uat-users` table:
```
workosId: string (GSI for lookup)
authProvider: "cognito" | "workos"
migratedAt: ISO timestamp
```

---

## Day 2: JWT Transition

### 2.1 Lambda Auth Changes
Current flow (Cognito):
```
Token → cognito.get_user(AccessToken) → extract role/tenantId from Cognito attributes
```

New flow (WorkOS):
```
Token → verify WorkOS JWT (JWKS) → extract email → query DynamoDB → get role/tenantId
```

### 2.2 Files to Modify
- `backend/functions/lms/utils/auth.py` — replace `cognito.get_user` with JWT decode
- `backend/functions/auth/main.py` — replace all 8 Cognito API calls
- `backend/functions/*/main.py` — update auth headers parsing (if any)

### 2.3 Role Management
WorkOS doesn't store custom roles. Move to DynamoDB:
```python
# Old (Cognito)
role = attrs.get("custom:role", "EMPLOYEE")
tenant_id = attrs.get("custom:tenantId", "")

# New (WorkOS + DynamoDB)
email = workos_jwt["email"]
user = users_table.query(IndexName="email-index", KeyConditionExpression=Key("email").eq(email))
role = user["role"]
tenant_id = user["tenantId"]
```

### 2.4 Pro-Tip Applied
WorkOS JWT → extract email → DynamoDB lookup for role/tenantId → inject into request context.
This is actually MORE flexible than Cognito — roles can be changed instantly in DynamoDB without re-issuing tokens.

---

## Day 3: Kill Switch

### 3.1 Frontend Changes
- Replace Cognito token storage with WorkOS session
- Update login page: WorkOS hosted login OR embedded AuthKit
- Add "Sign in with Microsoft" button (enterprise SSO)
- Update `lib/auth/cognito.ts` → `lib/auth/workos.ts`

### 3.2 Deployment
- Deploy updated Lambdas to both regions (us-east-1 + us-west-2)
- Deploy updated frontend via Amplify
- Test all 3 roles: GLOBAL_ADMIN, HR_ADMIN, EMPLOYEE

### 3.3 Cognito Decommission
- Verify all 82 users can login via WorkOS
- Export Cognito user list as backup
- Disable Cognito user pool (don't delete yet — keep 30 days)
- Delete after 30 days with zero issues

---

## Audit Trail Integration

WorkOS webhooks → logged to `endevo-uat-audit` DynamoDB table:
- `user.created` → audit entry
- `user.updated` → audit entry
- `authentication.succeeded` → audit entry with IP, device
- `authentication.failed` → audit entry with severity WARNING
- `connection.activated` → audit entry (SSO enabled for client)

All audit entries backed up to S3 with Object Lock (already configured).

---

## Password Migration Strategy

Cognito does NOT export password hashes. Options:
1. **Force reset** — all 82 users reset password on first WorkOS login
2. **Lazy migration** — on first login attempt, if WorkOS fails, try Cognito → if success, migrate user → kill Cognito record
3. **Magic link** — send email with one-time login link, user sets new password

**Recommendation:** Option 2 (Lazy migration) for zero disruption.

---

## Enterprise SSO Rollout (per client)

When a Fortune 500 client signs up:
1. Client IT provides SAML metadata or OIDC config
2. Configure in WorkOS dashboard (5 minutes)
3. Their employees login with corporate credentials
4. Zero code changes — WorkOS handles federation
5. Audit: `connection.activated` logged

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| WorkOS downtime | WorkOS SLA: 99.99%. Fallback: temporary Cognito re-enable |
| JWT format change | Abstract JWT validation behind interface — swap providers without Lambda rewrites |
| Role desync | Roles in DynamoDB (source of truth), not in auth provider |
| Audit gap | WebHook → DynamoDB audit + S3 WORM backup |

---

## Cost

| Item | Monthly |
|------|---------|
| WorkOS (1M users free) | $0 |
| DynamoDB (existing) | $0 extra |
| Lambda (existing) | $0 extra |
| **Total** | **$0** |

---

*Execute this plan when Shahzad approves. Current users: 82. All test accounts. Zero risk.*
