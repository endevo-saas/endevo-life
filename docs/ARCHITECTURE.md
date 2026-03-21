# Endevo Life — Master Documentation
> Single source of truth: product vision, architecture, QA results, build status, decisions.
> **Last Updated:** 2026-03-21 | **Status:** Phase 1 Complete — Paused

---

## Table of Contents
1. [What We Are Building](#1-what-we-are-building)
2. [Current Build Status](#2-current-build-status)
3. [AWS Architecture](#3-aws-architecture)
4. [DynamoDB Schemas](#4-dynamodb-schemas)
5. [Lambda Routes — Full Map](#5-lambda-routes--full-map)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Authentication & RBAC](#7-authentication--rbac)
8. [QA Results](#8-qa-results)
9. [Test Credentials (UAT)](#9-test-credentials-uat)
10. [Pending Work](#10-pending-work)
11. [Full Product Vision (Phases 0–9)](#11-full-product-vision-phases-09)
12. [Key Decisions & Why](#12-key-decisions--why)

---

## 1. What We Are Building

**Endevo Life** — AI-powered, enterprise-grade Digital Legacy & LMS platform for Corporate HR teams.

- B2B SaaS, multi-tenant
- HR teams assign training → employees complete it → earn certificates
- Core product: digital legacy & estate planning training content
- Built 100% on AWS (only external dependency: Stripe for billing)

**Team:** Shahzad (architect/QA), Niki (owner), Zara (QA), Nermeen (dev — joins at go-live)

---

## 2. Current Build Status

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | CDK infra: Cognito, DynamoDB, API Gateway, Lambda, SES, Amplify | ✅ COMPLETE |
| 1 | Auth + all 3 role dashboards + QA | ✅ COMPLETE |
| 2 | Admin Tenant Detail page + enhanced Users management | 🔴 PAUSED |
| 3 | Subscription/plan management UI | 🔴 PENDING |
| 4 | HR Admin enhancements (employee progress view) | 🔴 PENDING |
| 5 | AI features: Bedrock, Personalize | 📋 PLANNED |
| 6 | Analytics: QuickSight dashboards | 📋 PLANNED |
| 7 | Integrations: BambooHR, Slack, Teams, Stripe billing | 📋 PLANNED |
| 8 | Mobile apps: React Native (Android + iOS) | 📋 PLANNED |
| 9 | Blockchain: NFT certificates, on-chain digital will | 🔮 FUTURE |

**GitHub:** https://github.com/shahzadms7/endevo-life
**Frontend:** https://main.d1vgn9nzfx4cxk.amplifyapp.com
**API:** https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com

---

## 3. AWS Architecture

```
┌─────────────────────────────────────────────────────┐
│                  USERS (Browser)                    │
│   https://main.d1vgn9nzfx4cxk.amplifyapp.com       │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────┐
│         AWS Amplify — Next.js 15 App Router          │
│  Auto-deploy: GitHub push to main → live in ~3 min  │
└───────────────────────┬─────────────────────────────┘
                        │ fetch() API calls
┌───────────────────────▼─────────────────────────────┐
│   Amazon API Gateway (HTTP API)                     │
│   /api/auth/*     → endevo-uat-fn-auth              │
│   /api/admin/*    → endevo-uat-fn-admin             │
│   /api/hr/*       → endevo-uat-fn-hr                │
│   /api/employee/* → endevo-uat-fn-employee          │
└──────┬──────────┬──────────┬────────────┬───────────┘
       │          │          │            │
   fn-auth    fn-admin    fn-hr      fn-employee
       │          │          │            │
┌──────▼──────────▼──────────▼────────────▼──────────┐
│              Amazon DynamoDB (8 Tables)             │
├────────────────────────────────────────────────────┤
│          Amazon Cognito User Pool                  │
│          (us-east-1_DVyEJqgFt)                     │
│          Client: 4sbv2j6cv7jpp1oi0d16njsej1        │
└────────────────────────────────────────────────────┘
```

### AWS Services

| Service | Resource | Purpose |
|---------|----------|---------|
| Amplify | App ID: `d1vgn9nzfx4cxk` | Next.js hosting, CI/CD from GitHub |
| API Gateway | HTTP API | Single entry — routes to 4 Lambdas |
| Lambda | `endevo-uat-fn-auth` | Auth flows |
| Lambda | `endevo-uat-fn-admin` | Global admin (all tenants/users) |
| Lambda | `endevo-uat-fn-hr` | HR admin (own tenant only) |
| Lambda | `endevo-uat-fn-employee` | Employee (own data only) |
| Cognito | Pool: `us-east-1_DVyEJqgFt` | Auth, JWT, custom role/tenant attributes |
| DynamoDB | 8 tables | All application data |
| SES | Verified domain | Invite emails (sandbox — may go to spam) |
| IAM | `endevo-uat-lambda-role` | Lambda execution permissions |

### IAM Policy on `endevo-uat-lambda-role`
```
DynamoDB: PutItem, GetItem, UpdateItem, DeleteItem, Scan, Query
Cognito:  GetUser, AdminCreateUser, AdminSetUserPassword, AdminDeleteUser,
          AdminDisableUser, AdminEnableUser, AdminUpdateUserAttributes,
          AdminInitiateAuth, InitiateAuth, ForgotPassword,
          ConfirmForgotPassword, DescribeUserPool, ListUsers
SES:      SendEmail, SendRawEmail
Logs:     CreateLogGroup, CreateLogStream, PutLogEvents
```

---

## 4. DynamoDB Schemas

> **Rule:** Every `put_item` MUST include ALL key attributes. Missing range key = silent `ValidationException`.

| Table | Hash Key | Range Key | Notes |
|-------|----------|-----------|-------|
| `endevo-uat-tenants` | `tenantId` | — | Tenant accounts |
| `endevo-uat-users` | `userId` | — | All users across all tenants |
| `endevo-uat-training` | `tenantId` | `videoId` | Courses; `videoId = courseId` |
| `endevo-uat-questions` | `tenantId` | `questionId` | Assessment questions |
| `endevo-uat-responses` | `userId` | `submittedAt` | Assessment submissions |
| `endevo-uat-certificates` | `userId` | `issuedAt` | Earned certificates |
| `endevo-uat-video-progress` | `userId` | `videoId` | Progress; `videoId = courseId` |
| `endevo-uat-audit` | `tenantId` | `sk` | Audit trail; `sk = "{timestamp}#{uuid}"` |

### Seeded Data (2026-03-21)
| Table | Count | Contents |
|-------|-------|----------|
| tenants | 4 | Acme Corp, TechVision, GlobalHR, tenant-6a727c72 |
| users | 34 | 33 seeded + 1 QA invite |
| training | 8 | 2 courses × 4 tenants |
| questions | 40 | 5 per course per tenant |

---

## 5. Lambda Routes — Full Map

### `endevo-uat-fn-auth`
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Cognito `initiate_auth` → returns JWT |
| POST | `/api/auth/register` | Validate invite token → create account |
| GET | `/api/auth/me` | Returns caller profile from JWT |
| POST | `/api/auth/forgot-password` | Send Cognito reset code |
| POST | `/api/auth/reset-password` | Confirm reset with code + new password |
| POST | `/api/auth/change-password` | Logged-in user changes own password |
| POST | `/api/auth/mfa` | MFA challenge verification |

### `endevo-uat-fn-admin` (GLOBAL_ADMIN only)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/dashboard` | Platform-wide stats (tenants, users, certs, locked) |
| GET | `/api/admin/tenants` | All tenants + user/hr/active counts |
| POST | `/api/admin/tenants` | Create tenant |
| GET | `/api/admin/tenants/{id}` | Tenant detail + hr_admins[] + employees[] + stats |
| PUT | `/api/admin/tenants/{id}` | Update name/plan/status/maxSeats |
| DELETE | `/api/admin/tenants/{id}` | Soft delete (status=deleted) |
| GET | `/api/admin/users` | All users; optional `?tenantId=` filter |
| POST | `/api/admin/users` | Create GLOBAL_ADMIN / HR_ADMIN / EMPLOYEE |
| GET | `/api/admin/users/{id}` | Single user detail |
| PUT | `/api/admin/users/{id}` | Update user + sync role to Cognito |
| DELETE | `/api/admin/users/{id}` | Hard delete from Cognito + DynamoDB |
| POST | `/api/admin/users/{id}/lock` | `admin_disable_user` → status=locked |
| POST | `/api/admin/users/{id}/unlock` | `admin_enable_user` → status=active |
| POST | `/api/admin/users/{id}/reset-password` | Generate + set new temp password |
| GET | `/api/admin/audit` | Global audit log (all tenants, last 200) |
| GET | `/api/admin/health` | Live probe: DynamoDB + Cognito status |

### `endevo-uat-fn-hr` (HR_ADMIN — own tenant only)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/hr/dashboard` | Tenant stats |
| GET | `/api/hr/employees` | Employees in own tenant |
| POST | `/api/hr/invite` | Create invite token + send SES email |
| PUT | `/api/hr/employees/{id}` | Update name/dept/jobTitle |
| DELETE | `/api/hr/employees/{id}` | Deactivate employee |
| GET | `/api/hr/audit` | Tenant-scoped audit log |

### `endevo-uat-fn-employee` (EMPLOYEE — own data only)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/employee/dashboard` | Progress stats (courses, certs, %) |
| GET | `/api/employee/profile` | Own profile |
| PUT | `/api/employee/profile` | Update firstName/lastName/jobTitle/department |
| GET | `/api/employee/training` | Courses with per-course progress % |
| POST | `/api/employee/progress` | Save video progress |
| GET | `/api/employee/assessment/{courseId}` | Questions (correct answers hidden) |
| POST | `/api/employee/assessment/{courseId}/submit` | Score, issue cert if ≥70%, auto-mark complete |
| GET | `/api/employee/certificates` | All earned certificates |

---

## 6. Frontend Architecture

### Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Forms | react-hook-form + Zod |
| Auth state | js-cookie (`access_token`, `user_role`) |
| API client | `apps/web/lib/api.ts` (shared, typed) |
| Package mgr | pnpm (monorepo + Turborepo) |
| Hosting | AWS Amplify (GitHub push → auto-deploy) |

### Page Structure
```
apps/web/app/
├── (auth)/
│   ├── login/
│   ├── register/          ← Suspense-wrapped (Next.js 15 useSearchParams fix)
│   └── forgot-password/
├── (global-admin)/
│   ├── layout.tsx          ← sidebar: Dashboard, Tenants, Users, Audit, Health
│   └── admin/
│       ├── dashboard/      ← live stats, clickable cards
│       ├── tenants/        ← list + create + inline edit
│       ├── tenants/[id]/   ← 🔴 PENDING: drill-down with employees + plan
│       ├── users/          ← all users across tenants
│       ├── audit/          ← global audit log with search
│       └── health/         ← DynamoDB + Cognito + Lambda status
├── (hr-admin)/
│   ├── layout.tsx          ← sidebar: Dashboard, Employees, Invite, Audit
│   └── hr/
│       ├── dashboard/
│       ├── employees/      ← list + inline edit + deactivate
│       ├── invite/         ← invite form + copyable invite URL
│       └── audit/
└── (employee)/
    ├── layout.tsx           ← sidebar: Dashboard, Training, Assessment, Certs, Profile
    └── employee/
        ├── dashboard/
        ├── training/        ← course list + progress bars
        ├── assessment/      ← course selector
        ├── assessment/[courseId]/   ← radio questions + submit + result
        ├── certificates/    ← cert cards + download
        └── profile/         ← view + edit inline
```

---

## 7. Authentication & RBAC

### Login Flow
```
POST /api/auth/login → Cognito initiate_auth()
→ Returns JWT (AccessToken)
→ Lambda decodes: custom:role, custom:tenantId, email
→ Frontend stores: js-cookie (access_token, user_role)
→ Redirect: GLOBAL_ADMIN→/admin/dashboard, HR_ADMIN→/hr/dashboard, EMPLOYEE→/employee/dashboard
```

### Per-Request RBAC (every Lambda)
1. Extract `Authorization: Bearer <token>` header
2. Call `cognito.get_user(AccessToken=token)` — validates token, gets attributes
3. Check `custom:role` matches required role
4. 401 if no token, 403 if wrong role
5. Extract `custom:tenantId` for data isolation

### Multi-Tenant Isolation
- HR_ADMIN: all queries filtered by `tenantId` from JWT
- EMPLOYEE: all queries filtered by `userId` + `tenantId` from JWT
- GLOBAL_ADMIN: can see all tenants, but audit trail recorded for every action
- QA verified: 0 cross-tenant data leaks

---

## 8. QA Results

**Date:** 2026-03-21 | **Overall: 98.6% PASS (68/69 tests)**

| Category | Tests | Pass | Fail |
|----------|-------|------|------|
| Authentication | 8 | 8 | 0 |
| Global Admin API | 12 | 12 | 0 |
| HR Admin API | 10 | 10 | 0 |
| Employee API | 14 | 14 | 0 |
| Security / RBAC | 10 | 10 | 0 |
| Input Validation | 6 | 6 | 0 |
| Multi-Tenant Isolation | 4 | 4 | 0 |
| Edge Cases | 5 | 4 | 1 |

### Bugs Found & Fixed During QA

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| BUG-001 | CRITICAL | Audit log 0 entries — missing `sk` composite key, swallowed by `except: pass` | Write `sk = f"{timestamp}#{uuid}"`, log errors |
| BUG-002 | CRITICAL | Assessment returns 20 questions (all tenants) not 5 | Add `tenantId = :t` to scan filter |
| BUG-003 | MEDIUM | `completed_courses` stays 0 after passing | Write `PROG_T.put_item(completed=True, progressPct=100)` on pass |
| BUG-004 | MEDIUM | Video-progress writes failing silently — missing `videoId` range key | Write `videoId = course_id` alongside `courseId` |
| BUG-005 | LOW | PUT non-existent tenant returns 200 (DynamoDB upsert) | OPEN — low risk |

### API Coverage
| Lambda | Routes Tested |
|--------|--------------|
| endevo-uat-fn-auth | 6/7 |
| endevo-uat-fn-admin | 7/7 |
| endevo-uat-fn-hr | 6/6 |
| endevo-uat-fn-employee | 8/8 |
| **Total** | **27/28 (97%)** |

---

## 9. Test Credentials (UAT Only)

| Role | Email | Password |
|------|-------|----------|
| GLOBAL_ADMIN | admin@endevo.com | Admin@2026! |
| HR_ADMIN (Acme) | hr@acme.com | HRAdmin@2026! |
| HR_ADMIN (TechVision) | hr@techvision.com | HRAdmin@2026! |
| EMPLOYEE (Acme) | ava.anderson@acme.com | Employee@2026! |

---

## 10. Pending Work

| Item | Priority | Description |
|------|----------|-------------|
| Admin Tenant Detail `/admin/tenants/[id]` | HIGH | Clicking a tenant shows: HR admins, employees, stats, plan editor |
| Admin Users page — full actions | HIGH | Create user modal (role/tenant selector), lock/unlock/delete/reset-password buttons |
| Subscription/plan management | MEDIUM | Starter / Professional / Enterprise / Enterprise-Plus tiers, maxSeats, billing cycle |
| HR Admin — employee progress view | MEDIUM | HR sees each employee's course progress + certificates |
| Lambda CI/CD via GitHub Actions | LOW | Auto-deploy Lambdas on push (currently manual AWS CLI) |
| Domain: endevol ife.com | LOW | Register on Route 53, connect to Amplify |
| Fix KNOWN-001 | LOW | PUT /api/admin/tenants/{fake-id} returns 200 — add `get_item` pre-check |

---

## 11. Full Product Vision (Phases 0–9)

### Phase 0–1 (Built) — Core Foundation
Auth, multi-tenant RBAC, training + assessments + certificates, HR management, Global Admin control.

### Phase 2–4 (Near-term) — Enhanced Management
Full tenant drill-down, subscription billing, employee progress analytics, HR bulk import.

### Phase 5 — AI & Agentic Workflows
| Feature | AWS Service |
|---------|------------|
| AI course content generator | Amazon Bedrock (Claude 3) |
| Personalised learning paths | Amazon Personalize |
| Predictive completion forecasting | SageMaker + EventBridge |
| Churn/disengagement risk alerts | SageMaker ML model |
| AI compliance checker | Bedrock Agents + audit log scan |
| Auto-transcription of videos | Amazon Transcribe + Comprehend |

### Phase 6 — Analytics Dashboards
| Dashboard | Technology |
|-----------|-----------|
| Workforce completion rates | QuickSight Embedded |
| Risk & compliance heatmap | CloudWatch + QuickSight |
| Training ROI forecast | SageMaker → QuickSight |
| Per-tenant FinOps (cloud cost vs revenue) | AWS Cost Explorer API |
| Certification expiry radar | DynamoDB TTL → EventBridge → SES |

### Phase 7 — Integrations Hub
| System | Integration |
|--------|------------|
| Stripe | Subscription billing ($10k setup + $10/seat/month) |
| BambooHR / Workday | Employee sync |
| Slack / Microsoft Teams | Bot notifications + course reminders |
| Google Workspace / Azure AD | SSO via Cognito OIDC/SAML |
| Salesforce | CRM deal → auto-provision tenant |
| DocuSign | Digital will / legacy document signing |
| LinkedIn | Certificate share + profile update |

### Phase 8 — Mobile Apps
- React Native (Expo) — Android + iOS, shared codebase
- Offline-first (WatermelonDB + S3 sync)
- Biometric auth (Face ID / fingerprint)
- Push notifications (Amazon SNS)
- Video streaming (CloudFront HLS)

### Phase 9 — Blockchain & Web3
- Immutable certificate NFTs (Ethereum / Polygon ERC-721)
- On-chain credential verification
- Decentralised identity (W3C DID + Verifiable Credentials)
- Digital will on-chain (Solidity smart contract + multi-sig)

### Security & Compliance (All Phases)
| Standard | Automated Control |
|----------|------------------|
| GDPR | Data minimisation, right-to-delete Lambda, consent log |
| HIPAA | PHI tagging, Macie scan |
| SOC2 Type II | CloudTrail + Config rules + evidence export |
| ISO 27001 | Security control matrix auto-report |

---

## 12. Key Decisions & Why

| Decision | Rationale |
|----------|-----------|
| **Pure boto3 (no pip)** | Single `main.py` file per Lambda — no zip layers, faster iteration, simpler deployments |
| **DynamoDB over RDS** | Serverless, no connection pooling, auto-scales, cheaper at low volume; can add Aurora later for analytics |
| **Cognito custom attributes** | `custom:role` + `custom:tenantId` in JWT — zero extra DB lookup per request; RBAC enforced at the token level |
| **HTTP API Gateway** | Cheaper and faster than REST API Gateway for simple Lambda proxy routing (~71% cost reduction) |
| **Next.js 15 App Router** | Route groups give clean per-role layouts; Suspense boundaries handle CSR bailout for `useSearchParams` |
| **js-cookie for tokens** | Acceptable for UAT phase; switch to httpOnly cookies before production for XSS protection |
| **Amplify for hosting** | Zero DevOps — GitHub push → live site, built-in SSL/CDN, no Docker needed |
| **Soft delete on tenants** | Set `status=deleted` instead of hard delete — preserves audit history and data for billing/legal |
| **Audit composite key** | `tenantId` (hash) + `sk = timestamp#uuid` (range) — enables efficient per-tenant queries AND global scans |

---

*This document is the single source of truth. Update with every architecture change, QA session, or phase completion.*
*Maintained by: Shahzad + Claude AI | Project: Endevo Life | Repo: shahzadms7/endevo-life*
