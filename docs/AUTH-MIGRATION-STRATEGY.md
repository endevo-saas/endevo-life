# Auth Migration Strategy — Cognito Replacement

> **Date:** 2026-04-03 (updated)
> **Status:** DECISION MADE — WorkOS recommended (IAM Identity Center ruled out)
> **Impact:** Critical — blocks multi-region active-active

---

## Why Cognito Must Go

Amazon Cognito User Pools are single-region. No replication, no sync, no Global Tables equivalent.
If us-east-1 goes down, ALL authentication fails. This is unacceptable for enterprise SaaS.

Current state: `us-east-1_DVyEJqgFt` with 82 users, MFA optional.

---

## IAM Identity Center Multi-Region Replication — Research Findings (2026-04-03)

### Is the Feature Real?

YES. AWS announced GA multi-region replication for IAM Identity Center in **February 2026**.

### How It Works

- **Primary-replica model**: One primary region, read-only replicas in additional regions.
- **What gets replicated**: Identities, entitlements, permission sets, and configuration.
- **Failover**: If the primary region is disrupted, users continue accessing AWS accounts via
  already-provisioned entitlements in replica regions. Configuration changes must still be made
  in the primary region.
- **Limitations**:
  - Account instances do NOT support multi-region replication (only organization instances).
  - Microsoft Active Directory and IAM Identity Center directory as identity source are NOT
    supported for multi-region replication.
  - Password policy cannot be customized when using IAM Identity Center's built-in directory.

### Why It CANNOT Replace Cognito for Endevo Life

**IAM Identity Center is a WORKFORCE identity service, NOT a customer identity (CIAM) service.**

This is the critical distinction:

| Aspect | IAM Identity Center | Cognito / CIAM |
|--------|-------------------|----------------|
| **Purpose** | Manage employee access to AWS accounts & business apps | Manage customer/user access to YOUR SaaS app |
| **Users** | Your employees, internal workforce | External customers, HR admins, employees of clients |
| **Login target** | AWS Console, SAML apps (Salesforce, Box) | Your app's login page (endevo.life) |
| **Self-signup** | No — admin provisions users | Yes — users register themselves |
| **Custom claims** | No custom JWT claims (role, tenantId) | Yes — custom attributes in tokens |
| **Hosted login** | No user-facing hosted login for your app | Yes — customizable hosted UI |
| **Email/password** | Limited — designed for SSO federation | Full support |
| **API for CRUD** | Limited — SCIM for provisioning | Full user management API |
| **Multi-tenant** | No concept of tenantId per user | Yes — custom attributes |
| **MFA** | TOTP only for workforce | TOTP, SMS, email OTP |
| **Brute-force protection** | Not applicable (SSO-based) | Built-in adaptive auth |

**Bottom line**: IAM Identity Center lets your *employees* SSO into AWS Console and pre-integrated
SaaS apps. It does NOT let your *customers* (HR admins, employees of client companies) sign up,
log in, and use Endevo Life. It has no hosted login page for your app, no self-signup, no custom
JWT claims, and no concept of multi-tenant customer identity.

**Verdict: RULED OUT. IAM Identity Center is the wrong tool for this job.**

---

## Amazon Verified Permissions — Worth Adding for Authorization

### What It Does

Amazon Verified Permissions is a managed authorization service using the Cedar policy language.
It handles the "is this user allowed to do X?" question — separate from authentication.

### Relevance to Endevo Life

- **Multi-tenant RBAC**: Supports per-tenant policy stores — each tenant gets isolated
  authorization policies.
- **Cedar policies**: Express rules like "HR Admins in tenant X can manage employees" or
  "Employees can only view their own records."
- **Works with any auth provider**: Cognito, WorkOS, or any JWT-issuing IdP.
- **Lambda integration**: Call `IsAuthorized` API from Lambda authorizers.
- **Multi-region**: Deploy policy stores in each region independently.
- **Cost**: $150 per million authorization requests (first 40M/month). At 82 users, cost is
  essentially zero.

### Recommendation

Verified Permissions is a COMPLEMENT to the auth provider, not a replacement. Consider adding it
when role-based access becomes more complex (Module 3+ with LMS permissions, instructor roles,
tenant-specific policies). Not needed for Phase 1-4.

---

## Options Evaluated (2026 Market)

### Tier 1: Managed SaaS (Recommended for Startups)

| Provider | Cost | Multi-Region | Enterprise SSO | Free Tier | Effort |
|----------|------|:---:|:---:|---|---|
| **WorkOS** | $0 | YES (global) | SAML/OIDC free | 1M users | Hours |
| **Kinde** | $0 | YES | SAML included | 10.5K MAU | Hours |
| **Supabase Auth** | $0-25/mo | Regional (Pro) | SAML (Pro) | 50K MAU | Days |
| **Auth0** | $150+/mo | Partial | SAML/OIDC | 25K MAU | Days |

### Tier 2: Self-Hosted (For Regulated Industries)

| Provider | Cost | Multi-Region | Enterprise SSO | Effort |
|----------|------|:---:|:---:|---|
| **Keycloak on ECS** | ~$250/mo | YES (complex) | Native SAML/OIDC | Weeks |
| **Custom DynamoDB JWT** | ~$5/mo | YES (true A/A) | Must build | 4 weeks |

---

## Recommendation: WorkOS

### Why WorkOS Wins for Endevo Life

1. **$0 cost** for 1M users — we have 82
2. **Global distribution** — they handle multi-region, not us
3. **Enterprise SSO in hours** — Microsoft Entra ID, Okta, Google Workspace
4. **Zero maintenance** — no Aurora, no Fargate, no Infinispan cache hell
5. **Fortune 500 ready** — when a client says "we need SAML SSO", we say "yes" same day
6. **TCO savings** — saves ~$3,000/yr (Aurora+Fargate) + ~$20,000 in dev time

### Why NOT Keycloak (for now)

1. **$250/mo infrastructure tax** (Aurora Global + Fargate + ALB + NAT Gateway)
2. **Infinispan cross-region cache** — the #1 cause of session-not-found errors in active-active
3. **JVM memory** — needs 2 vCPU / 4GB RAM per task minimum
4. **Maintenance burden** — updates, DB migrations, security patches
5. **3-person team** — can't afford the operational overhead

### When to Consider Keycloak

- Government/banking clients requiring on-premise auth
- Regulatory requirement to self-host identity data
- 100K+ users where $250/mo is negligible vs revenue

---

## Keycloak Architecture (If Needed Later)

### The Infinispan Problem

Keycloak uses Infinispan for distributed caching. In cross-region:
- User logs into Region A → session in Region A cache
- Next request hits Region B (via Global Accelerator) → "session not found"

**Fix options:**
1. **Sticky sessions** — force user to one region (weakens 99.99% goal)
2. **X-Site Replication** — Infinispan sync via JGroups TCP (complex but seamless)

### Database Architecture

```
Region A (us-east-1)              Region B (us-west-2)
Keycloak ECS Tasks                Keycloak ECS Tasks
      |                                 |
Aurora Writer <=== Global DB ===> Aurora Reader
                                 (Write Forwarding)
```

- Aurora Global Database (PostgreSQL) with write forwarding
- 2 vCPU / 4GB RAM per Fargate task
- Auto-scale on CPU + concurrent connections
- Secrets Manager for DB credentials

### Migration from Cognito to Keycloak

**Option A:** Force password reset (annoying but clean)
**Option B:** Lazy migration — Keycloak checks Cognito on login, migrates user, kills Cognito record

---

## WorkOS Integration Plan

### Phase 1: Setup (2-4 hours)
1. Create WorkOS account
2. Configure OIDC connection
3. Set up redirect URIs for uat.endevo.life

### Phase 2: Backend Changes (1-2 days)
1. Replace 8 Cognito API calls in auth Lambda with WorkOS API
2. JWT validation: WorkOS issues JWTs → validate locally with JWKS
3. Keep custom:role and custom:tenantId in WorkOS user metadata
4. MFA: WorkOS handles it natively

### Phase 3: Frontend Changes (1 day)
1. Replace Cognito token storage with WorkOS session
2. Update login page to use WorkOS hosted login or embedded components
3. Add "Sign in with Microsoft" button for enterprise SSO

### Phase 4: Enterprise SSO (hours per client)
1. Client provides SAML/OIDC metadata
2. Configure in WorkOS dashboard
3. Their employees login with corporate credentials
4. Zero code changes per client

---

## Cost Comparison (Year 1)

| Solution | Infrastructure | Dev Time | Total Year 1 |
|----------|---------------|----------|--------------|
| Cognito (current) | $0 | $0 | $0 (but blocks enterprise) |
| **WorkOS** | **$0** | **$2,000** (3 days) | **$2,000** |
| Keycloak | $3,000 | $20,000 (4 weeks) | $23,000 |
| Auth0 | $1,800 | $3,000 (1 week) | $4,800 |

---

## Decision Matrix

| Factor | Weight | WorkOS | Keycloak | Auth0 | Custom |
|--------|--------|:---:|:---:|:---:|:---:|
| Cost (Year 1) | 25% | 10 | 3 | 6 | 8 |
| Multi-region | 25% | 9 | 10 | 7 | 10 |
| Enterprise SSO | 20% | 10 | 10 | 9 | 3 |
| Dev effort | 15% | 9 | 3 | 7 | 4 |
| Maintenance | 15% | 10 | 3 | 8 | 5 |
| **Total** | 100% | **9.6** | **5.7** | **7.3** | **6.3** |

**Winner: WorkOS (9.6/10)**

---

---

## Final Decision (2026-04-03)

### What We Investigated

Shahzad asked whether AWS IAM Identity Center (with its new Feb 2026 multi-region replication)
could replace Cognito for Endevo Life.

### The Honest Answer

**No. IAM Identity Center is fundamentally the wrong service for customer-facing SaaS.**

It is a workforce identity service designed for employees accessing AWS Console and pre-integrated
SaaS apps (Salesforce, Box, etc.). It cannot:
- Serve as a login system for your SaaS application
- Handle self-registration of external users
- Issue JWTs with custom claims (tenantId, role)
- Provide a hosted login page for endevo.life
- Support multi-tenant customer identity

### What IS the Right AWS-Native Multi-Region Auth?

There is **no AWS-native multi-region customer auth service** as of April 2026. Cognito remains
single-region with no replication. AWS has not announced Cognito multi-region support.

### The Correct Path for Endevo Life

1. **Short term (now)**: Stay on Cognito in us-east-1. It works, it's free, and we have 82 users.
2. **When enterprise clients need multi-region or SSO**: Migrate to **WorkOS** (score: 9.6/10).
   - $0 for 1M users
   - Global distribution handled by WorkOS
   - Enterprise SSO (SAML/OIDC) in hours
   - 2-3 days migration effort
3. **When authorization gets complex (LMS Module 3+)**: Add **Amazon Verified Permissions** as
   a Cedar-based authorization layer alongside whatever auth provider we use.
4. **IAM Identity Center**: Use ONLY if we need to manage internal team access to AWS Console
   (which we already do via IAM — no change needed).

### Decision: WorkOS remains the recommended Cognito replacement. IAM Identity Center is not applicable.

*This document should be reviewed when: (1) first enterprise client signs, (2) 10K users reached, (3) regulated industry requirement appears.*
