# Auth Migration Strategy — Cognito Replacement

> **Date:** 2026-04-05
> **Status:** DECISION NEEDED
> **Impact:** Critical — blocks multi-region active-active

---

## Why Cognito Must Go

Amazon Cognito User Pools are single-region. No replication, no sync, no Global Tables equivalent.
If us-east-1 goes down, ALL authentication fails. This is unacceptable for enterprise SaaS.

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

*This document should be reviewed when: (1) first enterprise client signs, (2) 10K users reached, (3) regulated industry requirement appears.*
