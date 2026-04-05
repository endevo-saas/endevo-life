# Architecture Review — Enterprise Scale Assessment

> **Date:** 2026-04-05
> **Reviewer:** Enterprise Architecture Audit
> **Verdict:** Solid MVP foundation. 6 critical changes needed for enterprise active-active.

---

## Current State: Single-Region Serverless MVP

The current architecture is a well-designed, cost-effective serverless MVP running in us-east-1. It works perfectly for UAT and early production. However, it is **fundamentally hardcoded for a single region.** If us-east-1 goes down, Endevo Life goes down.

---

## 6 Critical Findings

### 1. The Multi-Region Identity Trap (Cognito)

**Finding:** Cognito User Pools cannot be deployed active-active across regions. Passwords don't sync. If us-east-1 fails, the DR site has an empty auth system.

**Current:** 82 users, 8 Cognito API calls in auth Lambda, JWT with custom:role + custom:tenantId.

**Impact:** CRITICAL — Total authentication failure in DR scenario.

**Fix Options:**
| Option | Active-Active | Cost | Effort | Enterprise SSO |
|--------|:---:|---:|---|:---:|
| Custom DynamoDB JWT Auth | YES | $5/mo | 4 weeks | Need to build SAML/OIDC |
| Keycloak on multi-region EKS | YES | $200/mo | 6 weeks | Built-in SAML/OIDC |
| Auth0 Enterprise | Partial | $150/mo | 3 weeks | Built-in |

**Recommendation:** Keycloak on EKS for enterprise (supports SAML/OIDC for Microsoft Entra ID, Okta federation). Custom DynamoDB auth as interim step.

---

### 2. DynamoDB Hot Partition Timebomb

**Finding:** Heavy use of `tenantId` as sole partition key. Single partition limit: 3,000 RCU + 1,000 WCU per second.

**Scenario:** Enterprise client with 50,000 employees all completing training on Friday morning = all traffic hits ONE partition = throttling + downtime.

**Affected Tables:**
- `endevo-uat-audit` (PK: tenantId)
- `endevo-uat-training` (PK: tenantId)
- `endevo-uat-questions` (PK: tenantId)
- `endevo-uat-lms-lessons` (PK: tenantId)

**Fix:** Composite Sharding Strategy
```
Before: PK = tenantId
After:  PK = tenantId#shard (e.g., tenant-00001#3)
   or:  PK = tenantId#userId (natural distribution)
```

**Also required:** Enable DynamoDB Global Tables for all 13 tables.

---

### 3. The "Zero Dependency" Liability

**Finding:** Pure boto3 Lambda functions with zero pip dependencies. Minimal cold starts but no structured routing, validation, or observability.

**Risk:** 81+ endpoints with manual HTTP parsing = security vulnerabilities + spaghetti code as team grows.

**Fix:** Adopt AWS Lambda Powertools for Python
- Structured routing (like Flask/FastAPI but Lambda-native)
- Automatic tracing (X-Ray)
- Structured logging (CloudWatch Insights compatible)
- Payload validation (Pydantic integration)
- Cold start impact: +50ms (negligible)

---

### 4. Amplify Gen 1 Glass Ceiling

**Finding:** Amplify abstracts CloudFront + S3. Cannot configure active-active frontend across regions.

**Fix Options:**
| Option | Multi-Region | Effort |
|--------|:---:|---|
| Static export to S3 + CloudFront (both regions) | YES | 1 week |
| Containerize Next.js on ECS + ALB + Global Accelerator | YES | 2 weeks |
| Keep Amplify for UAT, break out for production | Hybrid | - |

**Recommendation:** Keep Amplify for UAT/staging. For production, containerize and deploy via ECS + Global Accelerator.

---

### 5. Infrastructure as Code Red Flags

**Findings:**
1. Manual `npx cdk deploy --all` — no automated multi-region deployment
2. Wildcard IAM ARNs — fails SOC2 Type II audit
3. DynamoDB decoupled from CDK — configuration drift risk

**Fix:**
- GitHub Actions pipeline: deploy to BOTH regions sequentially
- Least-privilege IAM with specific resource ARNs
- Bring ALL DynamoDB tables back under CDK control
- Add `cdk diff` as PR check to catch drift

---

### 6. Stateful Media Blind Spot (S3)

**Finding:** S3 buckets are regional. New presigned URL requests fail if us-east-1 is down.

**Fix:**
- Enable S3 Cross-Region Replication (CRR) to us-west-2
- Lambda functions must be region-aware: generate presigned URLs for LOCAL region bucket
- CloudFront origin failover: primary us-east-1, fallback us-west-2

---

## Migration Priority Matrix

| Priority | Change | Impact | Effort | When |
|----------|--------|--------|--------|------|
| P0 | DynamoDB partition key sharding | Prevents throttling at scale | 2 weeks | Before enterprise onboarding |
| P0 | Enable Global Tables | Data replication for DR | 1 day (CDK) | Before enterprise onboarding |
| P1 | Replace Cognito | Unblocks multi-region auth | 4 weeks | At 500 users |
| P1 | S3 Cross-Region Replication | Media DR | 1 day (CDK) | With Global Tables |
| P2 | Lambda Powertools adoption | Code quality + observability | 2 weeks | Next major refactor |
| P2 | Automated CI/CD to both regions | Eliminates deployment drift | 1 week | With multi-region |
| P3 | Break out of Amplify | Full frontend control | 2 weeks | Production launch |
| P3 | Least-privilege IAM | SOC2 compliance | 1 week | Before audit |

---

## Target Architecture (2026 Enterprise)

```
                     Global Users
                          |
                   AWS Global Accelerator
                    (Anycast routing)
                     |            |
              US-EAST-1      US-WEST-2
              =========      =========
              ALB/CF          ALB/CF
              Next.js         Next.js
              (ECS)           (ECS)
                |               |
              API GW          API GW
              Lambda          Lambda
              (Powertools)    (Powertools)
                |               |
              DynamoDB  <==>  DynamoDB
              (Global Tables, sharded PKs)
                |               |
              S3        <==>  S3
              (CRR bidirectional)
                |               |
              Keycloak  <==>  Keycloak
              (EKS + Aurora Global DB)
              
              Route 53: Health checks + failover
              CloudFront: Global CDN (unchanged)
              WAF: Attached to Global Accelerator
```

---

## What's GOOD About the Current Architecture

Despite the limitations, the foundation is strong:

1. **Serverless-first** — right choice for MVP, scales to 10K users without rearchitecting
2. **Multi-tenant isolation** — tenantId in JWT, enforced at every Lambda, QA-verified
3. **DynamoDB** — already supports Global Tables (just needs enabling)
4. **CloudFront** — already global, no changes needed
5. **CDK** — infrastructure as code exists, needs automation
6. **Cost efficiency** — $50/month at 80 users is excellent
7. **LMS engine** — 4 quiz types, video player, progress tracking — enterprise-grade features

The code quality and feature set are production-ready. The infrastructure needs the 6 changes above to be enterprise-ready.

---

## Cost of Enterprise Architecture

| Component | Current | Enterprise (2 regions) |
|-----------|---------|----------------------|
| Compute (Lambda → ECS) | $5/mo | $200/mo |
| Database (DynamoDB Global) | $10/mo | $25/mo |
| Auth (Cognito → Keycloak/EKS) | $0 | $200/mo |
| CDN (CloudFront) | $10/mo | $15/mo |
| Storage (S3 + CRR) | $20/mo | $40/mo |
| Global Accelerator | $0 | $18/mo + data |
| Monitoring (X-Ray, GuardDuty) | $0 | $20/mo |
| **Total** | **$50/mo** | **~$550/mo** |

Enterprise-grade active-active: ~$550/month. That's one Premium subscription ($499/yr) covering the entire infrastructure.

---

*This document should be reviewed quarterly and updated as the architecture evolves.*
