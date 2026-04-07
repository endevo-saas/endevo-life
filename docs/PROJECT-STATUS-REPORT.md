# Endevo Life — Project Status Report
**Date:** April 7, 2026 | **Version:** 2.0 | **Status:** UAT Live — Production Ready for Demo
**Repository:** GitHub (Private) | **Live URL:** https://uat.endevo.life

---

## 1. Executive Summary

Endevo Life is an enterprise SaaS platform that delivers digital legacy and estate planning as a structured employee benefit. Built for Fortune 500 HR departments, the platform guides employees through legal, financial, physical, and digital readiness via a gamified Learning Management System (LMS).

In 17 days (March 20 — April 7, 2026), a 3-person team built a production-grade, multi-region, serverless platform from scratch — 140 commits, 23,500+ lines of code, 13 DynamoDB tables replicated across 2 AWS regions, and a complete authentication system migration from AWS Cognito to WorkOS with zero-password OTP login.

**The platform is live at https://uat.endevo.life and ready for investor demos.**

---

## 2. What We Built — Day by Day

### Week 1: Foundation (March 20–21)
| Day | What Happened |
|-----|---------------|
| Mar 20 | Project created from zero. AWS CDK infrastructure: S3, DynamoDB (9 tables), IAM, API Gateway, Amplify, Cognito. GitHub Actions CI/CD. Next.js 15 frontend. Python Lambda functions (auth, admin, HR, employee). First deployment. |
| Mar 21 | Technical architecture documented. Admin Lambda bugs fixed. Documentation consolidated. |

### Week 2: Product (March 28–31)
| Day | What Happened |
|-----|---------------|
| Mar 28 | IAM dashboard with captcha login. User CRUD. Tenant management. Settings pages for all 3 roles. Gamified dashboards. Pagination + search + validation across APIs. |
| Mar 29 | Duolingo-style UI/UX overhaul with 4 themes (Eclipse, Canvas, Neon, Pearl). Health monitoring page with real AWS data. Employee invite system via SES email. 10 seed tenants provisioned. |
| Mar 31 | Repo transferred to `endevo-life` GitHub org. CI/CD verified end-to-end. Live `/status` page. |

### Week 3: LMS Engine (April 1–4)
| Day | What Happened |
|-----|---------------|
| Apr 1 | LMS v2 engine built from scratch. Readiness Assessment (40 questions, 4 domains). Module system (6 modules). CDK dependency fixes. |
| Apr 3 | Enterprise LMS foundation: CDK fixes, video resume (saves position, resumes -5s), random question order, module architecture. Deep QA: 14 frontend bugs fixed. Video/PDF upload pipeline. |
| Apr 4 | 4 quiz types: multiple choice, Likert scale, open text, checklist. Real content from product owner's Typeform. 15 lessons for Module 1. Employee dashboard redesign. Subscription pricing. Dynamic company branding. Investor-grade README (851 lines). |

### Week 4: Enterprise Transformation (April 5–7)
| Day | What Happened |
|-----|---------------|
| Apr 5 | **Enterprise architecture audit.** AWS services inventory. 6 critical findings. Cognito limitation discovered (single-region, blocks enterprise). Auth migration research: WorkOS chosen (9.6/10 score). Active-active multi-region deployed. Route 53 DNS failover (50s switchover). CloudTrail + S3 Object Lock audit. 32 CloudWatch alarms. |
| Apr 5–6 | **Cognito → WorkOS migration (complete).** 30+ Cognito API calls removed from 5 Lambdas. Custom OTP login (email + SMS). Session-based authentication. 10-agent code review: 10 security vulnerabilities patched. 3 runtime crash bugs fixed. 82 legacy users cleaned. Passwordless registration. Permanent DNS (uat.endevo.life → CloudFront). 13 commits. |
| Apr 7 | **Production hardening.** us-west-2 Lambdas updated with WorkOS code. IAM policy fixed for multi-region DynamoDB. Cognito env vars removed from all regions. Security incident: exposed AWS key in script → detected, rotated, quarantine resolved. Active-active verified both regions green. |

---

## 3. Architecture

```
                           ┌─────────────────┐
                           │   End Users      │
                           │ (Browser/Mobile) │
                           └────────┬─────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              uat.endevo.life  api-uat.endevo.life  │
                    │          (DNS Failover)        │
                    ▼               │               │
              ┌──────────┐    ┌────┴────┐     ┌────┴────┐
              │CloudFront│    │us-east-1│     │us-west-2│
              │  (CDN)   │    │PRIMARY  │     │FAILOVER │
              └────┬─────┘    └────┬────┘     └────┬────┘
                   │               │               │
              ┌────┴────┐    ┌────┴────┐     ┌────┴────┐
              │ Amplify  │    │API GW   │     │API GW   │
              │Next.js 15│    │HTTP API │     │HTTP API │
              └─────────┘    └────┬────┘     └────┬────┘
                                  │               │
                             ┌────┴────┐     ┌────┴────┐
                             │5 Lambda │     │5 Lambda │
                             │Functions│     │Functions│
                             └────┬────┘     └────┬────┘
                                  │               │
                             ┌────┴───────────────┴────┐
                             │  DynamoDB Global Tables  │
                             │  (13 tables, replicated) │
                             └──────────────────────────┘

Auth: WorkOS (OTP via SES email + SNS SMS) → Session token in DynamoDB
```

### Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 15, TypeScript, Tailwind CSS | Server components, app router, enterprise-grade |
| Backend | Python 3.12, AWS Lambda (5 functions) | Zero-dependency, serverless, auto-scaling |
| Database | DynamoDB (13 Global Tables) | Multi-region replication, serverless, unlimited scale |
| Auth | WorkOS + Custom OTP (SES + SNS) | Passwordless, enterprise SSO ready, $0 for 1M users |
| CDN | CloudFront (2 distributions) | Global edge caching, permanent custom domain |
| CI/CD | GitHub Actions → Amplify + Lambda deploy | Push-to-deploy, zero-touch |
| Infrastructure | AWS CDK (TypeScript) | Infrastructure as code, repeatable |
| DNS | Route 53 (failover) + GoDaddy (delegation) | 50-second failover, permanent domains |
| Security | WAF, GuardDuty, CloudTrail, S3 Object Lock | Enterprise compliance ready |
| Monitoring | CloudWatch (35 alarms) | Full observability |

---

## 4. Current System Status

### Live URLs
| URL | Purpose | Status |
|-----|---------|--------|
| https://uat.endevo.life | Frontend (login, dashboards) | LIVE |
| https://api-uat.endevo.life | API (auto-failover east↔west) | LIVE |

### Multi-Region Active-Active

| Component | us-east-1 | us-west-2 |
|-----------|:---------:|:---------:|
| API Gateway | HEALTHY | HEALTHY |
| 5 Lambda Functions | DEPLOYED | DEPLOYED |
| 13 DynamoDB Tables | REPLICATED | REPLICATED |
| S3 (videos + assets) | PRIMARY | REPLICATED |
| WAF | ACTIVE | ACTIVE |
| GuardDuty | ACTIVE | ACTIVE |
| CloudTrail | MULTI-REGION | MULTI-REGION |
| WorkOS Secrets | IN SECRETS MGR | IN SECRETS MGR |
| Health Checks | 10s interval | 10s interval |
| Failover Time | — | ~50 seconds |

### Data State (Clean — Ready for Production)
| Entity | Count |
|--------|-------|
| Super Admins (GLOBAL_ADMIN) | 3 |
| HR Admins | 13 (one per tenant) |
| Employees | 0 (wiped — ready for real users) |
| Tenants | 15 |
| LMS Modules | 6 |
| Assessment Questions | 40 (4 domains × 10) |

---

## 5. Features — What Works Today

### Authentication & Security
- [x] Passwordless login (email OTP, 6-digit code, 5-minute expiry)
- [x] SMS OTP ready (pending AWS SNS sandbox exit — 1-2 day approval)
- [x] Session-based auth with DynamoDB-stored tokens
- [x] Role-based access control (3 roles: Super Admin, HR Admin, Employee)
- [x] Brute-force protection (5 failed attempts → 15-min lockout)
- [x] IP tracking + device fingerprinting on every login
- [x] Immutable audit trail (CloudTrail + S3 Object Lock)
- [x] Zero passwords stored anywhere in the system
- [x] Enterprise SSO ready (WorkOS supports SAML/OIDC — toggle per client)

### Super Admin Dashboard
- [x] View all 15 tenants with user counts
- [x] Create tenants with auto-provisioned HR admin
- [x] Add users (unified invite flow — email sent, one-click activation)
- [x] Enable/disable/lock/unlock users
- [x] Reset user access
- [x] View audit logs
- [x] System health monitoring (real AWS metrics)
- [x] Phone number mandatory for all user creation

### HR Admin Dashboard
- [x] View employees in their tenant
- [x] Invite employees (email + phone required)
- [x] Edit employee details (name, department, job title, phone)
- [x] Deactivate/reactivate employees
- [x] Company-branded experience (logo, name from tenant config)

### Employee Experience
- [x] Readiness Assessment (40 questions, 4 domains, shuffled per attempt)
- [x] Readiness score with domain breakdown (Legal, Financial, Physical, Digital)
- [x] Readiness tiers: Peace Champion (85%+), On Your Way (60%+), Getting Clarity (35%+), Starting Fresh (0-34%)
- [x] 6 LMS modules with progressive curriculum
- [x] Video lessons with resume capability (saves position, resumes -5s)
- [x] 4 quiz types: multiple choice, Likert scale, open text, checklist
- [x] PDF document viewer (zero-trust S3 delivery)
- [x] Progress tracking (per module, per video, per quiz)
- [x] Duolingo-style gamified interface

### Infrastructure
- [x] Active-active multi-region (us-east-1 + us-west-2)
- [x] DNS failover with Route 53 health checks
- [x] CloudFront CDN for frontend
- [x] WAF (Web Application Firewall) — both regions
- [x] GuardDuty threat detection — both regions
- [x] CloudTrail multi-region audit — 2 trails
- [x] S3 cross-region replication (videos + assets)
- [x] 35 CloudWatch alarms
- [x] Infrastructure as Code (CDK — fully reproducible)

---

## 6. What's NOT Done — Honest Assessment

### Must Fix Before Production Launch

| # | Item | Priority | Effort | Status |
|---|------|----------|--------|--------|
| 1 | **SNS SMS sandbox exit** — OTP SMS only works for verified numbers | P0 | 1-2 day AWS approval | Pending user submission |
| 2 | **JWT signature verification** — WorkOS tokens decoded but RSA signature not verified | P1 | 2 hours | Mitigated (using session tokens, not JWTs for OTP login) |
| 3 | **DynamoDB GSI for email lookup** — all user lookups use table scan instead of query | P1 | 1 hour | Works at current scale, will be slow at 10K+ users |
| 4 | **Per-employee subscription pricing** — Basic $299 vs Premium $499 per employee | P1 | 1-2 days | Designed, not built |
| 5 | **Module 1 video content** — placeholder content, real videos needed from Niki | P1 | Content team | Waiting on content |
| 6 | **Stripe integration** (Module 4) — company billing | P2 | 3-5 days | Not started |
| 7 | **AI module** (Module 3) — AI-powered legacy planning by Aryan | P2 | 2-3 weeks | Not started |
| 8 | **Certificate PDF generation** — Module 6 completion certificate | P2 | 1 day | Not started |
| 9 | **87-page workbook** → AI processing pipeline | P2 | 1 week | Not started |
| 10 | **Re-engagement notifications** — 7-day inactive email | P3 | 1 day | Not started |

### Known Technical Debt

| Item | Risk | Mitigation |
|------|------|------------|
| Full table scans for user lookup | Slow at scale (>5K users) | Add GSI on email field |
| Session tokens don't expire | Token valid until overwritten | Add TTL-based expiry |
| No rate limiting on API Gateway | DoS vulnerability | Add API Gateway throttling |
| SES not verified in us-west-2 | Email OTP fails if east goes down | Verify SES domain in west |
| No automated backup verification | Backups exist but untested | Schedule monthly restore test |
| CDK deploy doesn't include Route 53 | DNS config is manual | Add Route 53 stack |

---

## 7. Security Posture

### What's Protected
| Control | Status |
|---------|--------|
| Passwordless authentication (OTP) | ACTIVE |
| WAF (Web Application Firewall) | ACTIVE (both regions) |
| GuardDuty (threat detection) | ACTIVE (both regions) |
| CloudTrail (API audit logging) | ACTIVE (multi-region, 2 trails) |
| S3 Object Lock (tamper-proof audit) | ACTIVE (GOVERNANCE mode, 365 days) |
| TLS 1.2+ enforced | ACTIVE |
| CORS restricted to known origins | ACTIVE |
| Brute-force protection | ACTIVE (5 attempts, 15-min lockout) |
| No plaintext passwords in API responses | FIXED (5 leaks patched Apr 6) |
| No hardcoded credentials in code | FIXED (incident Apr 7, key rotated) |
| Crypto-secure OTP generation | ACTIVE (Python `secrets` module) |

### Incident Log
| Date | Incident | Resolution | Lesson |
|------|----------|------------|--------|
| Apr 7 | AWS access key exposed in `scripts/update-modules.py` committed to GitHub | Key detected by AWS, quarantined. New key created. Old key deactivated. Code cleaned. | NEVER hardcode credentials in source files. Use AWS CLI profiles or Secrets Manager only. |

---

## 8. Cost — Real Numbers

### Current Monthly Cost: ~$11.30/month

| Service | Monthly Cost | Notes |
|---------|:-----------:|-------|
| Route 53 (hosted zone) | $0.50 | Fixed |
| Route 53 health checks (2) | $1.50 | $0.75 each |
| CloudWatch alarms (25 paid) | $2.50 | First 10 free |
| Secrets Manager (2 secrets) | $0.80 | $0.40 each |
| WAF (1 Web ACL) | $6.00 | Fixed |
| S3 storage (~870 MB) | $0.02 | Pennies |
| Lambda | $0.00 | Free tier (1M requests) |
| DynamoDB | $0.00 | Free tier (25 GB) |
| API Gateway | $0.00 | Free tier (1M requests) |
| Amplify | $0.00 | Free tier |
| CloudFront | $0.00 | Free tier (1 TB) |
| SES | $0.00 | Free tier (62K emails) |
| WorkOS | $0.00 | Free for 1M users |
| **TOTAL** | **$11.30** | |

### Projected Cost at Scale

| Users | Monthly Cost | Per-User | Revenue (Basic $299/yr) |
|-------|:-----------:|:--------:|:----------------------:|
| 100 | $15 | $0.15 | $29,900/yr |
| 500 | $25 | $0.05 | $149,500/yr |
| 2,000 | $80 | $0.04 | $598,000/yr |
| 10,000 | $350 | $0.035 | $2,990,000/yr |
| 100,000 | $3,500 | $0.035 | $29,900,000/yr |

**Gross margin: 99%+** at any scale due to serverless architecture.

---

## 9. Team

| Name | Role | Contribution |
|------|------|-------------|
| **Shahzad** | AWS Architect + QA Lead | Infrastructure, security, deployment, quality, code review |
| **Niki** | Product Owner | Vision, LMS content, UX decisions, business strategy, quiz content |
| **Nermeen** | Developer (active) | Frontend implementation, UI/UX polish, feature development |
| **Aryan** | AI Engineer (upcoming) | Module 3: AI-Powered Legacy Planning |
| **Zara** | QA Tester | End-to-end testing, bug verification |

---

## 10. What Each Team Member Needs

### Nermeen (Developer) — Start Here
1. **Codebase:** `apps/web/` — Next.js 15, TypeScript, Tailwind CSS
2. **Priority tasks:**
   - Per-employee subscription UI (Basic/Premium toggle on employee list)
   - Employee self-service plan upgrade page
   - Billing summary dashboard for HR + Super Admin
   - UI/UX polish across all dashboards
3. **Test at:** https://uat.endevo.life (login: khak.pa@gmail.com → OTP)
4. **API docs:** See `docs/ARCHITECTURE.md` for all endpoints

### Aryan (AI Engineer) — Module 3 Brief
1. **Goal:** AI-Powered Legacy Planning module
2. **Input:** Employee assessment scores (40 questions, 4 domains)
3. **Output:** Personalized legacy plan recommendations
4. **Tech:** AWS Bedrock (Claude/Titan) or external API
5. **Data:** Assessment responses in `endevo-uat-responses` table
6. **87-page workbook:** Needs processing into structured knowledge base
7. **API:** `POST /api/lms/ai/generate-plan` → returns personalized plan

### Zara (QA) — Test Plan
1. **Roles to test:** Super Admin, HR Admin, Employee
2. **Critical flows:**
   - Login with OTP (email code)
   - Super Admin → Add User → invite email → activate → login
   - HR Admin → Invite Employee → employee registers → login
   - Employee → Assessment (40 questions) → Score → Module access
   - Employee → Video lessons → Progress tracking → Resume capability
   - Employee → Quiz (4 types) → Submit → Score
3. **Security tests:** Brute-force lockout, CORS, unauthorized access attempts
4. **Multi-region:** Test via direct east/west API URLs
5. **Browser:** Chrome, Safari, Mobile (responsive)

### Niki (Product Owner) — Content Needed
1. **Module 1 videos:** MP4 files → upload to S3
2. **87-page workbook:** PDF for AI processing
3. **Module 2-6 lesson content:** Video scripts, quiz questions, PDF documents
4. **Subscription tier definition:** What does Premium unlock vs Basic?

---

## 11. Emerging Technology Considerations

| Technology | Relevance | When |
|-----------|-----------|------|
| **AWS Bedrock (Claude/Titan)** | Module 3 AI — personalized legacy plans | Phase 2 (Aryan) |
| **HLS Adaptive Streaming** | Replace MP4 presigned URLs with adaptive bitrate | Phase 2 (>1K users) |
| **Amazon Verified Permissions (Cedar)** | Fine-grained authorization policies per tenant | Phase 3 (complex RBAC) |
| **WorkOS Enterprise SSO** | SAML/OIDC for Fortune 500 clients (toggle per tenant) | First enterprise client |
| **DynamoDB DAX** | In-memory cache for hot partition reads | Phase 3 (>5K users) |
| **ECS Fargate** | Container migration if Lambda cold starts become an issue | Phase 4 (>50K users) |
| **Amazon Connect** | Phone-based support/coaching for premium users | Phase 4 |

---

## 12. Risks & Blindspots

### Active Risks
| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| SES email delivery to corporate domains blocked | Medium | High | Add SPF, DKIM, DMARC records for endevo.life |
| DynamoDB scan performance at >5K users | High | Medium | Add GSI on email field — 1 hour fix |
| Session tokens never expire | Medium | Medium | Add 24-hour TTL check in auth |
| Single Amplify app for frontend | Low | High | CloudFront is permanent front door — can swap origin |
| WorkOS rate limits under heavy load | Low | Medium | WorkOS has no published rate ceiling |

### Blindspots to Monitor
| Blindspot | Why It Matters |
|-----------|----------------|
| **Email deliverability** | Corporate email servers may block OTP emails. Need SPF/DKIM/DMARC. |
| **Mobile experience** | UI is responsive but not tested on all devices. Need Nermeen to verify. |
| **Accessibility (WCAG)** | No accessibility audit done. Required for enterprise/government clients. |
| **Data residency** | Currently US-only. EU clients may require EU data residency (GDPR). |
| **Backup restore testing** | DynamoDB backups exist but never tested a full restore. |
| **Load testing** | No load test performed. Unknown breaking point. |
| **Browser compatibility** | Only tested Chrome. Safari, Firefox, Edge untested. |

---

## 13. Metrics & Code Stats

| Metric | Value |
|--------|-------|
| Total commits | 140 |
| Calendar days | 17 (March 20 → April 7) |
| Lines of code (frontend) | 16,337 |
| Lines of code (backend) | 7,214 |
| Frontend files | 63 |
| Backend files | 30 |
| Infrastructure files | 9 |
| Documentation files | 14 |
| Lambda functions | 5 (× 2 regions = 10) |
| DynamoDB tables | 13 (all Global Tables) |
| S3 buckets | 9 |
| CloudWatch alarms | 35 |
| CloudFront distributions | 2 |
| Health checks | 2 (10s interval) |
| AWS regions | 2 (active-active) |
| Security patches | 10 |
| Passwords in system | 0 |
| Monthly AWS cost | $11.30 |
| Team size | 3 (active) + 2 (upcoming) |

---

## 14. Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.1 | Mar 20 | Infrastructure foundation — CDK, Lambda, DynamoDB, GitHub Actions |
| 0.2 | Mar 21 | Architecture documented, first bugs fixed |
| 0.5 | Mar 28 | Multi-tenant SaaS — dashboards, user CRUD, tenant management |
| 0.6 | Mar 29 | Duolingo UI, 4 themes, health monitoring, invite system |
| 0.7 | Mar 31 | CI/CD verified, GitHub org transfer, status page |
| 1.0 | Apr 1 | LMS v1 — assessment engine, module system |
| 1.5 | Apr 3-4 | LMS v2 — 4 quiz types, video resume, 15 lessons, real content |
| 2.0 | Apr 5-7 | Enterprise transformation — WorkOS, multi-region active-active, OTP auth, permanent DNS |

---

## 15. Next Milestones

| # | Milestone | Owner | Target |
|---|-----------|-------|--------|
| 1 | Per-employee subscription pricing (Basic/Premium) | Nermeen + Shahzad | Apr 10 |
| 2 | Module 1 real video content uploaded | Niki | Apr 12 |
| 3 | Stripe company billing integration | Shahzad | Apr 15 |
| 4 | AI Module 3 prototype | Aryan | Apr 25 |
| 5 | QA full test cycle | Zara | Apr 12 |
| 6 | SNS production SMS access | AWS approval | Apr 8-9 |
| 7 | Email deliverability (SPF/DKIM/DMARC) | Shahzad | Apr 10 |
| 8 | Load testing (1K concurrent users) | Shahzad | Apr 20 |
| 9 | Certificate PDF generation | Nermeen | Apr 15 |
| 10 | First investor demo | Niki + Shahzad | Apr 15 |

---

*This document is the single source of truth for the Endevo Life project. Updated April 7, 2026.*
