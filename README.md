# Endevo Life — Enterprise Digital Legacy Platform

> The first purpose-built SaaS platform that transforms estate and legacy planning into a structured, measurable employee benefit — delivered through an enterprise LMS with multi-tenant isolation, serverless infrastructure, and zero-dependency Lambda functions.

[![Live Platform](https://img.shields.io/badge/Live-Platform-brightgreen)](https://uat.endevo.life)
[![AWS Serverless](https://img.shields.io/badge/Stack-AWS_Serverless-orange)](https://aws.amazon.com)
[![Next.js 15](https://img.shields.io/badge/Frontend-Next.js_15-black)](https://nextjs.org)
[![Python 3.12](https://img.shields.io/badge/Backend-Python_3.12-blue)](https://aws.amazon.com/lambda/)
[![107+ Commits](https://img.shields.io/badge/Commits-107%2B-purple)](#)

---

## Build Timeline — From Zero to Enterprise SaaS

### Day 1 — March 20, 2026: Foundation
**Started from nothing.** Laid the entire AWS infrastructure foundation in a single day.
- CDK stacks: S3, DynamoDB (9 tables), IAM, API Gateway, Amplify, Cognito
- GitHub Actions CI/CD: auto-deploy Lambda functions + frontend on every push
- Next.js 15 frontend scaffold with TypeScript
- Python Lambda functions: auth, admin, HR, employee
- First build errors, first fixes, first deployment — the repo was born

### Day 2 — March 21, 2026: Architecture & Documentation
- Technical architecture document written (ARCHITECTURE.md)
- Consolidated documentation to 4 clean markdown files
- Admin Lambda path parsing bugs fixed
- Foundation hardened for what comes next

### Days 3–4 — March 28–29, 2026: The Product Takes Shape
**The platform became real.** In 48 hours, we went from scaffolding to a working multi-tenant SaaS.
- IAM dashboard: captcha login, user CRUD, tenant management, sequential IDs
- Settings pages for all 3 roles (Super Admin, HR Admin, Employee)
- Gamified dashboards with real-time data
- Pagination, search, validation across all APIs
- Duolingo-style UI/UX overhaul with 4 selectable themes (Eclipse, Canvas, Neon, Pearl)
- Health monitoring page with 100% real AWS data
- Employee invite system with email delivery via SES
- 10 seed tenants with HR admins and employees provisioned

### Day 5 — March 31, 2026: CI/CD & Reliability
- Transferred repo to `endevo-life` GitHub organization
- End-to-end CI/CD test: push → build → deploy → verify
- Live `/status` page proving system health with GitHub Actions proof
- Amplify workflow: graceful skip if build already running

### Days 6–7 — April 1–2, 2026: LMS Engine v1
**The learning platform was born.** Built the entire LMS from scratch.
- LMS v2 engine: Readiness Assessment (40 questions, 4 domains)
- Module system with 6 modules, unlock logic, progress tracking
- Admin sidebar + modules management page + LMS stats on dashboard
- CDK cross-stack dependency fixes for clean infrastructure deploys

### Days 8–9 — April 3–4, 2026: LMS v2 — Content & Polish
**The product became usable.** Real content, real quiz types, real video delivery.
- 4 quiz types: Multiple choice, Likert scale, Open text, Checklist
- Real content from Niki's Typeform (Avoidance Quiz, KLT Exercise, Emergency Protocol)
- Lesson engine: video, PDF, podcast, quiz support per lesson
- 15 lessons for Module 1 with sidebar navigation
- Video resume: saves exact second, resumes -5s on return
- PDF viewer with zero-trust S3 security
- Employee dashboard redesign: Duolingo-style with real data
- Assessment scoring: domain breakdown bars, weakest area recommendations
- 14 LMS frontend bugs fixed in deep QA audit
- Subscription pricing: Basic $299/yr + Premium $499/yr
- Dynamic company branding across all layouts
- Investor-grade README: 851 lines, 22 sections

### Days 10–11 — April 5–6, 2026: Enterprise Transformation
**The biggest shift.** 72 hours of non-stop engineering that transformed the platform.

**Infrastructure Hardening (Session 4):**
- Complete AWS services inventory — every service documented with capacity and cost
- Enterprise Architecture Review: 6 critical findings identified
- Cognito limitation discovered: single-region only, blocks multi-region
- Auth migration research: evaluated WorkOS, Keycloak, Auth0, Custom JWT
- Decision: WorkOS (score 9.6/10) — $0 for 1M users, global distribution
- Active-active multi-region failover deployed (us-east-1 + us-west-2)
- Route 53 DNS failover: 10s health checks, 30s TTL, ~50s failover
- CloudTrail + S3 Object Lock for tamper-proof audit logs
- 32 CloudWatch alarms created
- Enterprise Resilience Playbook + Debt Tracker documented

**Cognito → WorkOS Migration (Session 5):**
- Ripped out Cognito from ALL 5 Lambda functions (30+ API calls removed)
- Built custom OTP login: email via SES + SMS via SNS, 5-minute timeout
- Crypto-secure OTP generation (Python `secrets` module)
- Session token authentication across all endpoints
- Permanent DNS: `uat.endevo.life` → dedicated CloudFront → Amplify
- 10-agent parallel code review: 10 security vulnerabilities patched
- Plaintext passwords removed from 5 API responses
- Bearer token parsing hardened (case-insensitive)
- 3 runtime crash bugs caught and fixed (DynamoDB FilterExpression)
- 82 legacy Cognito users cleaned, 33 dummy employees removed
- Passwordless registration: one-click account activation
- Unified "Add User" flow: enter details once → invite email → activate → OTP login
- Phone number mandatory for SMS verification
- All email templates updated for OTP (no password language)
- README.md + ARCHITECTURE.md fully updated
- **13 commits in final session, 50+ AI agents deployed**

### Day 12 — April 7–8, 2026: Phase A+B — Subscriptions + Jesse AI
**Data model + AI integration in a single session.** 12 parallel agents, 20 files, 4 new DynamoDB tables.

**Phase A — Subscription & Billing Data Model:**
- CDK Stack 9: `endevo-uat-subscriptions` + `endevo-uat-sessions` tables
- Admin Lambda: 5 new billing endpoints (subscriptions overview, invoices, plan changes, metrics)
- HR Lambda: 4 new endpoints (3 CEO-mandated metrics, session booking)
- Employee Lambda: 3 new endpoints (subscription view, sessions, progress summary)
- HR Dashboard rebuilt: 3 metrics only (Activation Rate, Completion %, Progress)
- Employee Subscription page: plan card, sessions tracker, plan comparison
- Admin Subscriptions page: MRR/ARR revenue cards, tenant billing table, invoice + plan modals
- Seed script: `seed-subscriptions.py` — populated 15 tenants + 14 subscription records
- Frontend API client: 15 new methods + 16 TypeScript interfaces

**Phase B — Jesse AI Integration (Comprehensive Legacy Readiness Guide):**
- CDK Stack 10: `endevo-uat-jesse-chat` + `endevo-uat-knowledge-base` tables
- New Lambda: `endevo-uat-fn-jesse` — RAG chat via Bedrock Claude Haiku
- Ported from Aryan's TypeScript: scoring (40 signals, 4 domains, 4 tiers), plan generation, chat pipeline
- DynamoDB vector search: Titan Embed V2 (1024-dim) + cosine similarity (replaces Aurora pgvector)
- Jesse chat UI: floating FAB on all employee pages, glassmorphism panel, typing indicators
- Knowledge base ingest script: `jesse-ingest.py` for Aryan to feed content
- API Gateway route: `/api/jesse/{proxy+}` → fn-jesse
- Bedrock IAM permissions added to Lambda role
- **No separate jesse-users table** — Jesse uses enterprise `endevo-uat-users`
- **No Firebase** — WorkOS auth (same as all Lambdas)

### By The Numbers

| Metric | Value |
|--------|-------|
| Total commits | 140+ |
| Calendar days | 18 (March 20 → April 8) |
| Lambda functions | **6** (auth, admin, HR, employee, LMS, **jesse**) |
| DynamoDB tables | **17** |
| CloudWatch alarms | 35 |
| Tenants provisioned | 15 |
| LMS modules | 6 |
| Assessment questions | 40 |
| Quiz types | 4 (multiple choice, Likert, open text, checklist) |
| AWS regions | 2 (active-active failover) |
| AI models | **2** (Bedrock Claude Haiku + Titan Embed V2) |
| Security vulnerabilities patched | 10 |
| Passwords in the system | **0** |
| Auth provider migrations | Cognito → WorkOS (complete) |
| Uptime target | 99.99% |
| Team size | 3 people + 2 upcoming |

### Team

| Name | Role | Focus |
|------|------|-------|
| **Shahzad** | AWS Architect + QA Lead | Infrastructure, security, deployment, quality |
| **Niki** | Product Owner | Vision, content, UX decisions, business strategy |
| **Nermeen** | Developer | Frontend implementation, features (joining at go-live) |
| **Aryan** | AI Engineer | Module 3: AI-Powered Legacy Planning (upcoming) |
| **Zara** | QA Tester | End-to-end testing, bug verification |

---

## The Problem

Estate and legacy planning is the most important employee benefit that no company offers. Employees deal with wills, trusts, digital assets, healthcare directives, and financial succession — yet HR departments have no structured way to guide them through it. When a life event strikes, employees are unprepared, families are left navigating chaos, and employers bear the productivity cost of distracted, stressed workers. The $68B corporate wellness market covers fitness, mental health, and financial literacy — but legacy planning is entirely absent.

The gap exists because estate planning has historically required expensive attorneys and financial advisors, making it inaccessible as a scalable employee benefit. Generic LMS platforms like Coursera or LinkedIn Learning cannot serve this need — they lack the specialized content structure, the sensitivity-aware quiz formats (Likert self-assessment, checklists, reflective exercises), and the multi-tenant HR reporting that corporate buyers require. Endevo Life fills this gap with a purpose-built platform that treats legacy planning as education, not legal advice — making it deployable, trackable, and measurable like any other HR program.

---

## The Solution

Endevo Life is a B2B SaaS platform that delivers estate and legacy planning education to employees through a structured Learning Management System. HR administrators enroll their organization, employees complete a six-module curriculum covering legal, financial, physical, digital, and communication aspects of legacy planning, and the platform tracks every interaction — completion rates, quiz scores, certificate issuance — giving HR teams a measurable benefit to report alongside health insurance and retirement plans.

**Measurable outcomes:**
- Employees receive a personalized Readiness Assessment across four domains (Legal, Financial, Physical, Digital)
- 15 structured lessons in Module 1 alone, spanning video, PDF, podcast, and four distinct quiz types
- Automatic certificate issuance upon module completion — downloadable and shareable
- HR dashboards with per-employee progress tracking, completion analytics, and audit trails
- Multi-tenant isolation ensures each organization's data is completely separate

---

## Platform at a Glance

| Metric | Value |
|--------|-------|
| **DynamoDB Tables** | 17 |
| **Lambda Functions** | 6 (Python 3.12, 256 MB, 30s timeout) |
| **API Endpoints** | 99 (counted from frontend API client) |
| **CDK Stacks** | 10 CloudFormation stacks |
| **Quiz Types** | 4 (Multiple Choice, Likert Scale, Open Text, Checklist) |
| **Learning Modules** | 6 (Module 1 fully built, Modules 2-6 content pending) |
| **Module 1 Lessons** | 15 (video, PDF, podcast, quiz) |
| **Lesson Types** | 5 (video, quiz, pdf, podcast, resource) |
| **User Roles** | 3 (Global Admin, HR Admin, Employee) |
| **Git Commits** | 107+ |
| **QA Test Cases** | 69 (98.6% pass rate) |
| **Cross-Tenant Leaks Found** | 0 |
| **External pip Dependencies** | 0 (pure boto3) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USERS (Browser)                              │
│         https://uat.endevo.life                  │
│         https://uat.endevo.life (custom domain)                      │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ HTTPS (TLS 1.2+)
┌────────────────────────────▼─────────────────────────────────────────┐
│                  AWS Amplify — Next.js 15 App Router                 │
│          Git-push auto-deploy │ Built-in SSL │ CDN edge caching      │
│          Build time: ~3 minutes │ Zero DevOps                        │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ fetch() with Bearer JWT
┌────────────────────────────▼─────────────────────────────────────────┐
│              Amazon API Gateway (HTTP API)                            │
│                                                                      │
│   /api/auth/*      → endevo-uat-fn-auth      (7 routes)             │
│   /api/admin/*     → endevo-uat-fn-admin     (29 routes)            │
│   /api/hr/*        → endevo-uat-fn-hr        (14 routes)            │
│   /api/employee/*  → endevo-uat-fn-employee  (11 routes)            │
│   /api/lms/*       → endevo-uat-fn-lms       (32 routes)            │
│   /api/jesse/*     → endevo-uat-fn-jesse     (6 routes)  [NEW]      │
│                                                                      │
│   WAF protection │ CORS restricted │ ~71% cheaper than REST API      │
└───┬─────────┬─────────┬──────────┬──────────┬───────────────────────┘
    │         │         │          │          │
 fn-auth  fn-admin   fn-hr   fn-employee  fn-lms   fn-jesse
    │         │         │          │          │          │
    │    Python 3.12 │ 256 MB │ 30s timeout │ Pure boto3 (0 deps)
    │         │         │          │          │
┌───▼─────────▼─────────▼──────────▼──────────▼───────────────────────┐
│                  Amazon DynamoDB (17 Tables)                          │
│                                                                      │
│   endevo-uat-tenants            endevo-uat-users                     │
│   endevo-uat-training           endevo-uat-questions                 │
│   endevo-uat-responses          endevo-uat-certificates              │
│   endevo-uat-video-progress     endevo-uat-audit                     │
│   endevo-uat-config             endevo-uat-lms-modules               │
│   endevo-uat-lms-lessons        endevo-uat-lms-lesson-progress       │
│   endevo-uat-lms-user-modules   endevo-uat-subscriptions     [NEW]   │
│   endevo-uat-sessions           endevo-uat-jesse-chat        [NEW]   │
│   endevo-uat-knowledge-base                                  [NEW]   │
│                                                                      │
│   Server-side encryption │ On-demand capacity │ Per-tenant isolation  │
├──────────────────────────────────────────────────────────────────────┤
│                  WorkOS — Authentication & SSO                        │
│   Email + SMS OTP │ JWT with custom:role + custom:tenantId            │
│   Enterprise SSO ready │ Brute-force protection                      │
├──────────────────────────────────────────────────────────────────────┤
│                  Amazon SES — Email OTP Delivery                      │
│   OTP codes via email │ Transactional emails │ Verified domain        │
├──────────────────────────────────────────────────────────────────────┤
│                  Amazon SNS — SMS OTP Delivery                        │
│   OTP codes via SMS │ Multi-region delivery │ Opt-out management      │
├──────────────────────────────────────────────────────────────────────┤
│                  Amazon S3 — LMS Content Storage                     │
│   Video lectures │ PDF documents │ Podcast audio │ Presigned URLs    │
├──────────────────────────────────────────────────────────────────────┤
│                  Amazon CloudFront — Content Delivery                 │
│   Edge caching for video/PDF │ HTTPS-only │ Geographic distribution  │
├──────────────────────────────────────────────────────────────────────┤
│                  Amazon SES — Transactional Email                     │
│   Employee invite emails │ Email OTP delivery │ Verified domain       │
└──────────────────────────────────────────────────────────────────────┘
```

### Why Each Service Was Chosen

| Service | Why This, Not That |
|---------|-------------------|
| **DynamoDB** over RDS/Aurora | Serverless, zero connection pooling overhead, auto-scales to zero, cheaper at low volume. Single-digit millisecond reads. Aurora planned for analytics workloads in Phase 6. |
| **HTTP API Gateway** over REST API | 71% cost reduction for Lambda proxy routing. No need for request/response transformation, API keys, or usage plans at this stage. |
| **WorkOS** over Cognito/Auth0/Firebase Auth | Enterprise SSO ready, Email + SMS OTP passwordless auth, custom claims in JWT (role + tenantId = zero extra DB lookups per request), no Cognito rate-limit ceiling, scales beyond 40 req/s. |
| **Amplify** over Vercel/Netlify | Same ecosystem, Git-push deploy, built-in SSL/CDN, no Docker, no Kubernetes. Zero DevOps for the frontend. |
| **CloudFront** over direct S3 | Edge caching for video content, HTTPS enforcement, geographic distribution. S3 presigned URLs for zero-trust PDF access. |
| **Lambda** over ECS/Fargate | Pure functions with no framework overhead. Single `main.py` per function — no pip dependencies, no Docker, sub-second cold starts. |
| **SES** over SendGrid/Mailgun | Native AWS, cost-effective at scale, delivers Email OTP codes and invite emails. Moving out of sandbox before production launch. |
| **SNS** over Twilio | Native AWS, delivers SMS OTP codes, no additional vendor for passwordless auth. |
| **CDK** over Terraform/CloudFormation YAML | TypeScript type safety, component reuse, IDE autocomplete. 8 stacks that compose cleanly. |

---

## Technology Stack (Deep Dive)

| Layer | Technology | Version | Purpose | Why This Over Alternatives |
|-------|-----------|---------|---------|---------------------------|
| **Frontend Framework** | Next.js | 15 (App Router) | Server-rendered React with route groups per role | App Router enables per-role layouts via route groups; React Server Components reduce client JS bundle |
| **Frontend Language** | TypeScript | 5.x | Type-safe frontend development | Catches interface mismatches at compile time — critical when 81 API endpoints exist |
| **Styling** | Tailwind CSS | 3.x | Utility-first responsive design | Consistent design system without CSS-in-JS runtime cost; purges unused styles in production |
| **Form Handling** | react-hook-form + Zod | Latest | Schema-validated forms | Zod schemas validate at both form and API boundary; zero re-renders during typing |
| **Backend Runtime** | Python | 3.12 | Lambda function implementation | Team expertise, boto3 native support, fast iteration. No framework (Flask/Django) — raw Lambda handlers for minimal cold start |
| **Backend Dependencies** | boto3 (built-in) | Lambda runtime | AWS SDK | Zero pip dependencies. Every Lambda is a single `main.py` file — no layers, no Docker, no zip complexity |
| **Database** | Amazon DynamoDB | On-demand | All application data (13 tables) | Serverless NoSQL, auto-scales, per-tenant partition isolation via hash keys |
| **Authentication** | WorkOS | Latest | Email + SMS OTP passwordless auth with custom claims | `custom:role` + `custom:tenantId` embedded in JWT — zero database lookups for authorization |
| **API Layer** | Amazon API Gateway | HTTP API | Single entry point, Lambda proxy | Routes to 5 Lambda functions by path prefix. 71% cheaper than REST API Gateway |
| **Frontend Hosting** | AWS Amplify | Gen 1 | Git-push auto-deploy with SSL/CDN | GitHub webhook triggers build on push to `main`. Live in ~3 minutes |
| **CDN** | Amazon CloudFront | Latest | Video and PDF content delivery | Edge caching for LMS media, HTTPS-only, geographic distribution |
| **Object Storage** | Amazon S3 | Standard | LMS media files (video, PDF, podcast) | Presigned URLs for zero-trust access. Lifecycle policies for cost optimization |
| **Email** | Amazon SES | v2 | Invite emails and Email OTP delivery | Native AWS, no additional vendor. Sandbox mode for UAT |
| **SMS** | Amazon SNS | Latest | SMS OTP delivery for passwordless auth | Native AWS, multi-region delivery |
| **Infrastructure** | AWS CDK | 2.130+ | 8 CloudFormation stacks | TypeScript IaC with type safety, component reuse, and IDE support |
| **Monorepo** | pnpm + Turborepo | 9+ / Latest | Workspace management | Shared configs, parallel builds, single lockfile |
| **CI/CD** | GitHub Actions + Amplify | Latest | Automated deploys | Lambda: GitHub Actions zips and deploys. Frontend: Amplify auto-deploy on push |

---

## DynamoDB Schema Design

All 13 tables with partition keys, sort keys, and access patterns:

| # | Table | PK (Hash) | SK (Range) | Purpose | Primary Access Pattern |
|---|-------|-----------|------------|---------|----------------------|
| 1 | `endevo-uat-tenants` | `tenantId` | — | Organization accounts | Get tenant by ID; scan all tenants for admin |
| 2 | `endevo-uat-users` | `userId` | — | All users across all tenants | Get user by ID; filter by tenantId for HR queries |
| 3 | `endevo-uat-training` | `tenantId` | `videoId` | Legacy v1 courses (courseId = videoId) | Query courses by tenant; get specific course |
| 4 | `endevo-uat-questions` | `tenantId` | `questionId` | Assessment + lesson quiz questions | Query questions by tenant; filter by type (assessment / lesson_quiz) |
| 5 | `endevo-uat-responses` | `userId` | `submittedAt` | Assessment submissions | Query user's submission history (sorted by time) |
| 6 | `endevo-uat-certificates` | `userId` | `issuedAt` | Earned certificates | Query user's certificates (sorted by issue date) |
| 7 | `endevo-uat-video-progress` | `userId` | `videoId` | Legacy v1 video/course progress | Get progress for specific video; query all progress for user |
| 8 | `endevo-uat-audit` | `tenantId` | `sk` (`{timestamp}#{uuid}`) | Security audit trail | Query audit logs by tenant (sorted by time); scan all for global admin |
| 9 | `endevo-uat-config` | `section` | — | Platform configuration | Get config by section (subscription plans, feature flags) |
| 10 | `endevo-uat-lms-modules` | `tenantId` | `moduleNum` | Module definitions (6 modules) | Query modules by tenant; SYSTEM tenant for shared templates |
| 11 | `endevo-uat-lms-lessons` | `tenantId` | `moduleOrder` (`{module}#{lesson}`) | Ordered lesson sequences | Query lessons by tenant + module prefix; e.g., SK begins_with "1#" for Module 1 |
| 12 | `endevo-uat-lms-lesson-progress` | `userId` | `lessonId` | Per-lesson completion tracking | Get progress for specific lesson; query all lesson progress for user |
| 13 | `endevo-uat-lms-user-modules` | `userId` | `moduleNum` | Per-user module unlock/completion state | Query user's module states; check if specific module is unlocked |

### Multi-Tenant Content Inheritance

Content follows a fallback pattern: the LMS engine first queries for `tenantId`-specific content, then falls back to the `SYSTEM` tenant for shared templates. This enables organizations to receive the default curriculum while allowing tenant-specific customizations without data duplication.

---

## API Surface

81 endpoints across 5 Lambda functions. Every endpoint requires a valid JWT Bearer token. Role enforcement happens per-request via WorkOS JWT validation.

### Auth Service — `endevo-uat-fn-auth` (7 endpoints)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Send Email + SMS OTP code via WorkOS — passwordless login |
| POST | `/api/auth/verify-otp` | Verify OTP code, returns JWT access token |
| POST | `/api/auth/signup` | Self-registration with invite validation |
| GET | `/api/auth/me` | Current user profile from JWT claims |
| POST | `/api/auth/resend-otp` | Resend OTP code via Email or SMS |
| POST | `/api/auth/logout` | Invalidate session |
| POST | `/api/auth/change-password` | Authenticated password change (legacy, OTP-first) |

### Admin Service — `endevo-uat-fn-admin` (24 endpoints)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/dashboard` | Platform-wide stats (tenants, users, certs, locked accounts) |
| GET | `/api/admin/tenants` | All tenants with user/HR/active counts |
| POST | `/api/admin/tenants` | Create organization |
| GET | `/api/admin/tenants/{id}` | Tenant detail with HR admins, employees, stats |
| PUT | `/api/admin/tenants/{id}` | Update name, plan, status, maxSeats |
| POST | `/api/admin/tenants/{id}/disable` | Soft-disable tenant |
| POST | `/api/admin/tenants/{id}/enable` | Re-enable tenant |
| POST | `/api/admin/invite` | Create user with email invite via SES |
| POST | `/api/auth/change-password` | Admin password change (legacy) |
| GET | `/api/admin/users` | All users (optional `?tenantId=` filter) |
| GET | `/api/admin/users/{id}` | Single user detail |
| POST | `/api/admin/users` | Create user with role and tenant assignment |
| PUT | `/api/admin/users/{id}` | Update user + sync role to WorkOS |
| POST | `/api/admin/users/{id}/deactivate` | Deactivate user |
| POST | `/api/admin/users/{id}/reactivate` | Reactivate user |
| POST | `/api/admin/users/{id}/lock` | Disable user via WorkOS |
| POST | `/api/admin/users/{id}/unlock` | Enable user via WorkOS |
| POST | `/api/admin/users/{id}/reset-access` | Reset user auth and send new OTP invite |
| GET | `/api/admin/audit` | Global audit log (all tenants, last 200) |
| GET | `/api/admin/health` | Live probe: DynamoDB + WorkOS status |
| GET | `/api/admin/config` | Platform configuration |
| PUT | `/api/admin/config` | Update configuration section |
| GET | `/api/admin/certificates` | All certificates (optional tenant filter) |
| GET | `/api/admin/training-enrollment` | Training enrollment stats |

### HR Service — `endevo-uat-fn-hr` (10 endpoints)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/hr/dashboard` | Tenant-scoped stats |
| GET | `/api/hr/employees` | Employees in own tenant only |
| POST | `/api/hr/invite` | Invite employee via SES email |
| PUT | `/api/hr/employees/{id}` | Update employee name, department, job title |
| DELETE | `/api/hr/employees/{id}` | Deactivate employee |
| POST | `/api/hr/employees/{id}/reactivate` | Reactivate deactivated employee |
| GET | `/api/hr/audit` | Tenant-scoped audit log |
| GET | `/api/hr/tenant` | Own tenant details |
| GET | `/api/hr/training` | Tenant training courses |
| GET | `/api/hr/certificates` | Tenant certificate stats |

### Employee Service — `endevo-uat-fn-employee` (8 endpoints)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/employee/dashboard` | Progress stats (courses, certs, completion %) |
| GET | `/api/employee/profile` | Own profile |
| PUT | `/api/employee/profile` | Update own profile fields |
| GET | `/api/employee/training` | Courses with per-course progress |
| POST | `/api/employee/progress` | Save video/course progress |
| GET | `/api/employee/assessment/{courseId}` | Assessment questions (answers hidden) |
| POST | `/api/employee/assessment/{courseId}/submit` | Score assessment, issue certificate if passing |
| GET | `/api/employee/certificates` | Own earned certificates |

### LMS Service — `endevo-uat-fn-lms` (32 endpoints)

| Group | Method | Route | Description |
|-------|--------|-------|-------------|
| **Assessment** | GET | `/api/lms/assessment/questions` | Readiness Assessment questions |
| | POST | `/api/lms/assessment/submit` | Submit assessment answers |
| | GET | `/api/lms/assessment/status` | Assessment completion status |
| | GET | `/api/lms/assessment/history` | Past assessment attempts |
| **Course** | GET | `/api/lms/course/modules` | All modules with status |
| | GET | `/api/lms/course/modules/{num}` | Single module detail |
| | GET | `/api/lms/course/video/{id}/url` | Presigned video URL |
| | GET | `/api/lms/course/asset/{key}/url` | Presigned asset URL |
| **Progress** | POST | `/api/lms/progress/video` | Update video watch progress |
| | GET | `/api/lms/progress/video/{id}` | Get video progress (position, %) |
| | POST | `/api/lms/progress/module/complete` | Mark module as completed |
| **Quiz** | GET | `/api/lms/quiz/video/{id}` | Inline video quiz questions |
| | POST | `/api/lms/quiz/answer` | Submit inline quiz answer |
| **Admin** | GET | `/api/lms/admin/questions` | All LMS questions (optional type filter) |
| | POST | `/api/lms/admin/questions` | Create question |
| | PUT | `/api/lms/admin/questions/{id}` | Update question |
| | DELETE | `/api/lms/admin/questions/{id}` | Delete question |
| | GET | `/api/lms/admin/modules` | All modules (admin view) |
| | POST | `/api/lms/admin/modules` | Create/update module |
| | GET | `/api/lms/admin/users/progress` | All users' progress |
| | GET | `/api/lms/admin/users/{id}/progress` | Specific user's progress |
| | POST | `/api/lms/admin/users/{id}/unlock` | Unlock module for user |
| | GET | `/api/lms/admin/modules/{num}/videos` | Module video list |
| | POST | `/api/lms/admin/modules/{num}/videos` | Add video to module |
| | DELETE | `/api/lms/admin/modules/{num}/videos/{id}` | Remove video |
| | POST | `/api/lms/admin/modules/{num}/upload-url` | Get S3 presigned upload URL |
| | POST | `/api/lms/admin/modules/{num}/pdf` | Update module PDF |
| **Lessons** | GET | `/api/lms/lessons/module/{num}` | List lessons for module (with progress) |
| | GET | `/api/lms/lessons/{id}` | Single lesson detail + presigned URLs |
| | POST | `/api/lms/lessons/{id}/start` | Mark lesson as in_progress |
| | POST | `/api/lms/lessons/{id}/progress` | Update lesson progress (video position) |
| | POST | `/api/lms/lessons/{id}/complete` | Mark lesson as completed |
| **Lesson Quiz** | GET | `/api/lms/lessons/{id}/quiz` | Get quiz questions for lesson |
| | POST | `/api/lms/lessons/{id}/quiz/submit` | Submit quiz attempt |
| | GET | `/api/lms/lessons/{id}/quiz/results` | Get past quiz results |

---

## LMS Engine — Technical Specification

The Learning Management System is the core product. It delivers structured, multi-format educational content through a progressive module system with four distinct quiz engines and multi-tenant content inheritance.

### Lesson Types

| Type | Completion Criteria | Tracking |
|------|-------------------|----------|
| **video** | 95% watched (tracked by `lastPosition` / `percentWatched`) | Resume-from-where-you-left-off, inline quiz popups during playback |
| **quiz** | Score >= `passThreshold` (multiple choice) or all questions answered (likert/checklist/open_text) | Per-question answer storage, attempt history |
| **pdf** | Explicit user action (click "Mark Complete") | Access logged via presigned URL generation |
| **podcast** | 95% listened | Same progress model as video |
| **resource** | Explicit user action | Access tracked |

### Quiz Engine — Four Modes with Distinct Scoring

**1. Multiple Choice** (Knowledge Test)
- Standard quiz with correct/incorrect answers
- Scoring: `(correct / total) * 100`
- Pass/fail threshold: configurable per quiz (default 70%)
- Questions randomized per attempt
- Use case: Module knowledge verification

**2. Likert Scale** (Self-Assessment)
- 1-5 rating per question (Strongly Disagree → Strongly Agree)
- No right/wrong answers — completion = all questions answered
- Score = average rating across all questions
- Use case: Avoidance Quiz — measures psychological readiness for legacy planning

**3. Open Text** (Reflective Exercise)
- Free-form text input fields
- No scoring, no pass/fail
- Completion = all required fields answered
- Responses stored securely, never exposed to other users
- Use case: KLT Exercise — "Know, Like, Trust" self-reflection

**4. Checklist** (Action Verification)
- Binary per item: Check / Not Yet
- No pass/fail — tracks what the employee has done vs. not yet
- Completion = all items answered
- Use case: Emergency Protocol — verifying real-world actions taken

### Progress Tracking Model

Progress is tracked at four levels:
1. **Video position** — `lastPosition` (seconds) and `percentWatched` — enables resume
2. **Lesson completion** — binary complete/incomplete per lesson
3. **Module completion** — automatically triggered when ALL required lessons in the module are completed
4. **Certificate issuance** — automatically generated upon module completion

### Multi-Tenant Content Inheritance

```
Query: GET /api/lms/lessons/module/1
  ↓
1. Query endevo-uat-lms-lessons WHERE tenantId = {user's tenantId}
  ↓
2. If no results → fallback query WHERE tenantId = "SYSTEM"
  ↓
3. Merge with user's progress from endevo-uat-lms-lesson-progress
  ↓
4. Return lessons with per-lesson completion status
```

Organizations receive the shared SYSTEM curriculum by default. Tenant-specific content overrides are supported without duplicating the entire lesson library.

### Module Auto-Completion Logic

```
For each lesson in module:
  if lesson.type == "video" or "podcast":
    complete = percentWatched >= 95
  elif lesson.type == "quiz":
    if quizMode == "multiple_choice":
      complete = score >= passThreshold
    else (likert, open_text, checklist):
      complete = all_questions_answered
  elif lesson.type == "pdf" or "resource":
    complete = user_marked_complete

Module complete = ALL required lessons complete
→ Trigger: issue certificate, update user-modules table
```

---

## Security Architecture

### Zero-Trust Authentication Model

Every API request follows this validation chain:

```
Request with Bearer token
  → API Gateway passes to Lambda
    → Lambda validates WorkOS JWT (signature + expiry)
      → Lambda extracts custom:role + custom:tenantId from claims
        → Role checked against route requirements
          → tenantId injected into all database queries
            → Audit log written with IP, user agent, severity
```

No database lookup is required for authorization — role and tenant are embedded in the JWT itself.

### Security Controls

| Control | Implementation | Status |
|---------|---------------|--------|
| **CORS Restrictions** | Restricted to specific allowed origins (no wildcards) | Active |
| **WAF Protection** | Web Application Firewall on API Gateway | Active |
| **Encryption at Rest** | DynamoDB server-side encryption (AWS-managed keys) | Active |
| **Encryption in Transit** | TLS 1.2+ enforced on all endpoints | Active |
| **Brute-Force Protection** | IP tracking + lockout mechanisms in auth Lambda | Active |
| **Zero-Trust PDF Access** | S3 presigned URLs with expiration for document downloads | Active |
| **Input Sanitization** | HTML tags stripped via regex, forbidden characters rejected at boundary | Active |
| **Parameterized Queries** | DynamoDB operations use conditions objects, never string concatenation | Active |
| **Email + SMS OTP** | Passwordless authentication for all roles via WorkOS | Active |
| **Audit Trail** | Every action logged: timestamp, IP address, user agent, severity, actor | Active |
| **Soft Delete** | Tenants are disabled, not deleted — preserves audit history for compliance | Active |

### WorkOS Configuration

| Setting | Value |
|---------|-------|
| Auth Method | Email + SMS OTP (passwordless) |
| Custom Claims | `custom:role` (GLOBAL_ADMIN / HR_ADMIN / EMPLOYEE), `custom:tenantId` |
| OTP Delivery | SES (email) + SNS (SMS) |
| Session Management | JWT with configurable expiry |
| Enterprise SSO | SAML/OIDC ready for Phase 8 |

### US Data Residency

All data is stored and processed in `us-east-1` (N. Virginia). No data leaves the United States. All AWS services used are within a single region.

### Compliance Roadmap

| Standard | Current Status | Planned Controls |
|----------|---------------|-----------------|
| **GDPR** | Data minimization principles applied | Right-to-delete Lambda, consent logging |
| **SOC 2 Type II** | CloudTrail enabled | Config rules, evidence export automation |
| **HIPAA** | PHI tagging architecture designed | Macie scanning, BAA with AWS |
| **ISO 27001** | Security control matrix planned | Auto-report generation |

---

## Multi-Tenant Data Isolation

### How tenantId Flows from JWT to Database

```
1. User logs in via Email/SMS OTP → WorkOS returns JWT with custom:tenantId = "tenant-acme-001"

2. User calls GET /api/hr/employees
   → Lambda extracts token from Authorization header
   → Lambda validates WorkOS JWT and extracts claims
   → JWT contains custom:tenantId = "tenant-acme-001"

3. Lambda queries DynamoDB:
   users_table.scan(FilterExpression=Attr('tenantId').eq('tenant-acme-001'))
   → Returns ONLY Acme Corp employees

4. A TechVision HR Admin calling the same endpoint:
   → Gets custom:tenantId = "tenant-techvision-002"
   → Sees ONLY TechVision employees
   → Zero visibility into Acme Corp data
```

### Isolation Guarantees by Role

| Role | Data Access | Enforcement |
|------|------------|-------------|
| **GLOBAL_ADMIN** | All tenants, all users | Full access, but every action audit-logged with IP and timestamp |
| **HR_ADMIN** | Own tenant's employees only | `tenantId` from JWT injected into every query — cannot be overridden by request parameters |
| **EMPLOYEE** | Own records only | `userId` + `tenantId` from JWT — cannot access other employees' progress, scores, or certificates |

### QA Verification

- **69 test cases** executed across auth, admin, HR, employee, security, input validation, multi-tenant isolation, and edge cases
- **98.6% pass rate** (68/69)
- **0 cross-tenant data leaks** across 4 dedicated isolation test cases
- **97% API route coverage** (27 of 28 routes tested)

---

## Subscription & Billing Architecture

### Current Plans

| Feature | Basic — $299/yr | Premium — $499/yr |
|---------|:---------------:|:-----------------:|
| Module 1: Project Worth Developing | Yes | Yes |
| Module 2: Legal | Yes | Yes |
| Module 3: Financial | — | Yes |
| Module 4: Physical | — | Yes |
| Module 5: Digital | — | Yes |
| Module 6: Communicate Your Wishes | — | Yes |
| Readiness Assessment | Yes | Yes |
| Certificates | Yes | Yes |
| HR Admin Dashboard | Yes | Yes |
| Priority Support | — | Yes |
| AI-Ready Recommendations | — | Planned (Phase 5) |

### Current State (UAT)

In the UAT environment, all modules are currently accessible to all users regardless of plan assignment. Plan enforcement gating will be activated when Stripe integration is completed in Phase 5.

### Plan Enforcement Architecture (Designed)

Plan tier is stored on the tenant record in `endevo-uat-tenants`. The LMS engine checks the tenant's plan before returning module content. Basic plan tenants will receive Modules 1-2 only; Premium tenants receive all 6 modules. This is a server-side enforcement — the frontend shows locked modules with upgrade prompts, but the actual gating happens at the Lambda level.

### Stripe Integration (Phase 5)

- Subscription management via Stripe Checkout
- Webhook-driven plan updates (Stripe → Lambda → DynamoDB)
- Seat-based billing with `maxSeats` enforcement
- Annual billing cycle with auto-renewal

---

## Infrastructure as Code

8 AWS CDK stacks (TypeScript), each responsible for a distinct infrastructure concern:

| Stack | File | Creates |
|-------|------|---------|
| **01 — Auth (WorkOS)** | `01-auth-stack.ts` | WorkOS integration config, SES email OTP, SNS SMS OTP, session management |
| **02 — DynamoDB** | `02-dynamo-stack.ts` | Table definitions (managed separately — stack skipped in deploy to avoid conflicts with existing tables) |
| **03 — S3** | `03-s3-stack.ts` | Content storage buckets for video, PDF, podcast media files |
| **04 — IAM** | `04-iam-stack.ts` | Lambda execution role (`endevo-uat-lambda-role`) with least-privilege policies for DynamoDB, SES, SNS, CloudWatch |
| **05 — API + Lambda** | `05-api-stack.ts` | API Gateway HTTP API, 5 Lambda function definitions, route integrations |
| **06 — Amplify** | `06-amplify-stack.ts` | Amplify app connected to GitHub repo, auto-deploy on push to `main` |
| **07 — CloudFront LMS** | `07-cloudfront-lms-stack.ts` | CloudFront distribution for LMS content delivery (video/PDF CDN) |
| **08 — LMS Infra** | `08-lms-infra-stack.ts` | LMS-specific infrastructure (additional tables, S3 paths, permissions) |

### IAM Policy Summary (Lambda Execution Role)

```
DynamoDB:  PutItem, GetItem, UpdateItem, DeleteItem, Scan, Query
SES:       SendEmail, SendRawEmail (invite emails + Email OTP)
SNS:       Publish (SMS OTP delivery)
Logs:      CreateLogGroup, CreateLogStream, PutLogEvents
```

---

## CI/CD Pipeline

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  Developer   │────▶│   GitHub (main)   │────▶│  AWS Amplify      │
│  git push    │     │   endevo-life     │     │  Auto-build/deploy│
└──────────────┘     └───────┬───────────┘     │  ~3 min to live  │
                             │                 └──────────────────┘
                             │
                     ┌───────▼───────────┐
                     │  GitHub Actions   │
                     │  deploy-lambda.yml│
                     │  Zip + deploy     │
                     │  5 Lambda fns     │
                     └───────────────────┘
```

| Component | Deploy Method | Trigger | Time to Live |
|-----------|--------------|---------|--------------|
| **Frontend** | AWS Amplify auto-deploy | Push to `main` branch | ~3 minutes |
| **Lambda Functions** | GitHub Actions (zip + `aws lambda update-function-code`) | Push to `main` branch | ~1 minute per function |
| **Infrastructure** | `npx cdk deploy --all` | Manual (intentional) | ~5-10 minutes |

Infrastructure deploys are manual by design — CDK changes affect production resources and require review before execution.

---

## Scalability Analysis

### Current Architecture Limits

| Resource | Current Config | Scale Ceiling | Upgrade Path |
|----------|---------------|---------------|-------------|
| **DynamoDB** | On-demand capacity | Virtually unlimited (auto-scales) | Already serverless — no action needed |
| **Lambda** | 256 MB / 30s timeout | 1,000 concurrent executions (default) | Request increase to 10K; provisioned concurrency for predictable loads |
| **API Gateway** | HTTP API | 10,000 requests/second (default) | Request increase; add caching layer |
| **Amplify/CloudFront** | Edge-cached | Global CDN, auto-scales | Already distributed — no action needed |
| **WorkOS** | Managed auth | No per-operation rate ceiling | Enterprise SSO, scales with plan tier |

### Projected Scale

| Metric | Current (UAT) | 1,000 Users | 10,000 Users | 100,000 Users |
|--------|--------------|-------------|--------------|---------------|
| DynamoDB reads/month | ~5K | ~500K | ~5M | ~50M |
| Lambda invocations/month | ~2K | ~200K | ~2M | ~20M |
| S3 storage | ~1 GB | ~10 GB | ~50 GB | ~500 GB |
| CloudFront bandwidth | ~5 GB | ~500 GB | ~5 TB | ~50 TB |

### Design Decisions That Enable Scale

- **Stateless Lambda functions** — horizontal scaling is automatic
- **DynamoDB partition keys on tenantId** — each tenant's data is a natural partition
- **No relational joins** — denormalized data model avoids N+1 query patterns
- **CloudFront edge caching** — video content served from nearest edge location
- **Zero pip dependencies** — cold start times measured in hundreds of milliseconds, not seconds

---

## Cost Analysis

Estimates based on AWS pricing for `us-east-1`, on-demand pricing, no reserved instances.

| Cost Component | 80 Users (UAT) | 1,000 Users | 10,000 Users | 100,000 Users |
|---------------|----------------|-------------|--------------|---------------|
| **DynamoDB** | ~$1/mo (free tier) | ~$5/mo | ~$50/mo | ~$500/mo |
| **Lambda** | ~$0 (free tier) | ~$2/mo | ~$20/mo | ~$200/mo |
| **API Gateway** | ~$0 (free tier) | ~$3/mo | ~$35/mo | ~$350/mo |
| **S3 Storage** | ~$0.02/mo | ~$0.25/mo | ~$1.15/mo | ~$11.50/mo |
| **CloudFront** | ~$0.50/mo | ~$42/mo | ~$425/mo | ~$4,250/mo |
| **Amplify Hosting** | ~$0 (free tier) | ~$15/mo | ~$15/mo | ~$15/mo |
| **WorkOS** | ~$0 (free tier) | ~$49/mo | ~$49/mo | ~$499/mo |
| **SNS (SMS OTP)** | ~$0.10/mo | ~$10/mo | ~$100/mo | ~$1,000/mo |
| **SES** | ~$0.10/mo | ~$1/mo | ~$10/mo | ~$100/mo |
| **Total Estimated** | **~$2/mo** | **~$68/mo** | **~$556/mo** | **~$8,177/mo** |

At $299-$499/yr per organization (not per user), a single 100-employee enterprise client at Basic tier covers annual infrastructure costs for 1,000+ users.

---

## RAID Log — Engineering Challenges

Real issues encountered during development and how they were resolved. This section demonstrates battle-tested engineering — not theoretical architecture.

### Infrastructure Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| CDK cross-stack dependency — IAM referenced DynamoDB/S3 outputs, creating circular imports | Blocked all CDK deploys | Switched IAM to wildcard ARNs; later decoupled DynamoDB management from CDK entirely |
| Amplify app accidentally deleted — new app created with different App ID | Frontend down, DNS broken | Created new Amplify app (`d1vvfv8oltolcf`), updated Route 53 records, reconfigured GitHub webhook |
| CDK version notices causing exit code 1 | CI/CD falsely reported failures | Added `--no-notices` flag to suppress non-error output |
| CloudFormation stuck in REVIEW_IN_PROGRESS | Blocked subsequent deploys | Manually deleted stuck stack via AWS CLI, redeployed cleanly |

### Authentication & Tenant Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| LMS auth role mismatch — frontend checked `super_admin` but JWT used `GLOBAL_ADMIN` | 403 for all LMS users | Updated auth checks to match actual JWT role values |
| Tenant ID mapping — code queried `endevo-global` but DynamoDB used `SYSTEM` | Global admin saw empty LMS content | Added tenant remapping: `endevo-global` → `SYSTEM` at query time |
| Cognito → WorkOS migration — removed password-based auth | Required full auth flow rewrite | Migrated to Email + SMS OTP via WorkOS; SES for email OTP, SNS for SMS OTP |
| OTP delivery reliability — email sometimes delayed | Users unable to log in promptly | Added SMS OTP as fallback channel via SNS |

### LMS & Content Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| Video progress missing `videoId` range key | Progress not saving (silent failure) | Added `videoId = course_id` to all progress writes |
| 14 frontend/backend field mismatches | LMS pages showing empty data or crashing | Deep QA audit: fixed all field mappings across video, module, progress, and quiz interfaces |
| CORS wildcard vulnerability (`Access-Control-Allow-Origin: *`) | Any domain could call the API | Restricted CORS to specific allowed origins |
| Assessment showed "Pass Score: 90%" | Contradicted business rule (no pass/fail gate) | Changed to "Unlocks All: 6 Modules" messaging |

### Build & Deploy Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| TypeScript `React.ElementType` import — Next.js 15 JSX transform issue | Amplify build failures across 3 pages | Added explicit `import React` where `React.*` types were referenced |
| `pnpm --frozen-lockfile` fails without committed lockfile | First Amplify build could never succeed | Changed to `--no-frozen-lockfile` for initial build |
| Amplify build path mismatch after org transfer | Frontend building wrong code | Updated `amplify.yml` base path to `endevo-life` |

---

## Module Content Structure

### Module 1: Project Worth Developing (Fully Built — 15 Lessons)

Module 1 is the foundational module covering why legacy planning matters, how to start, and what a "project worth developing" looks like. It contains 15 lessons across all supported content types:

| # | Lesson | Type | Quiz Mode | Description |
|---|--------|------|-----------|-------------|
| 1 | Introduction Video | video | — | Overview of the legacy planning journey |
| 2 | Why Legacy Matters | video | — | The case for proactive planning |
| 3 | Avoidance Quiz | quiz | likert_scale | Self-assessment: psychological barriers to planning |
| 4 | Getting Started Guide | pdf | — | Printable action guide |
| 5 | KLT Exercise | quiz | open_text | "Know, Like, Trust" reflective writing exercise |
| 6 | Family Conversations | video | — | How to start the conversation |
| 7 | Emergency Protocol | quiz | checklist | Action verification: what you've done vs. not yet |
| 8 | Knowledge Check | quiz | multiple_choice | Module knowledge verification |
| 9 | Estate Planning Basics | video | — | Core concepts overview |
| 10 | Digital Assets Overview | video | — | What counts as a digital asset |
| 11 | Planning Podcast | podcast | — | Expert interview on legacy planning |
| 12 | Legal Foundations | pdf | — | Reference document |
| 13 | Financial Readiness | video | — | Financial preparation overview |
| 14 | Communication Strategies | video | — | How to communicate your wishes |
| 15 | Module Summary | video | — | Recap and next steps |

### Modules 2-6 (Content Planned)

| Module | Title | Content Status |
|--------|-------|---------------|
| 2 | Legal | Content in development |
| 3 | Financial | Content in development |
| 4 | Physical | Content planned |
| 5 | Digital | Content planned |
| 6 | Communicate Your Wishes | Content planned |

All 6 module definitions exist in `endevo-uat-lms-modules`. The LMS engine, quiz engine, progress tracking, and certificate issuance are fully built and module-agnostic — new module content slots into the existing infrastructure without code changes.

---

## Competitive Advantages

### Why Estate Planning Needs a Specialized Platform

| Dimension | Generic LMS (Coursera, LinkedIn Learning, TalentLMS) | Endevo Life |
|-----------|------------------------------------------------------|-------------|
| **Content Model** | Generic courses, one-size-fits-all | Purpose-built for estate/legacy planning with sensitivity-aware quiz formats |
| **Quiz Types** | Multiple choice only | 4 types: Multiple Choice, Likert Scale (self-assessment), Open Text (reflective), Checklist (action verification) |
| **HR Integration** | Separate dashboard, different vendor | Built-in HR dashboard with tenant-scoped analytics, invite flow, and audit trail |
| **Multi-Tenant** | Course catalog is shared | Complete data isolation — each organization is a separate tenant with its own employees, progress, and certificates |
| **Pricing** | Per-user monthly ($20-40/user/mo) | Per-organization annual ($299-499/yr) — dramatically lower cost for HR departments |
| **Compliance** | General LMS compliance | Estate planning-specific: action verification checklists, reflective exercises, readiness scoring |
| **Content Inheritance** | No tenant customization | SYSTEM templates with per-tenant overrides — organizations can customize without duplicating |
| **Data Residency** | Multi-region, often unclear | US-only (us-east-1), single region, clear data residency |

### Technical Moat

1. **Zero-dependency Lambda architecture** — no framework overhead, sub-second cold starts, single-file deploys
2. **Four quiz engines** — not just multiple choice; Likert, Open Text, and Checklist are essential for estate planning pedagogy
3. **Multi-tenant content inheritance** — SYSTEM tenant fallback enables 1,000 organizations to share content with per-tenant overrides
4. **JWT-embedded RBAC** — zero database lookups for authorization; role + tenant flow from WorkOS through every Lambda to DynamoDB
5. **13 purpose-built DynamoDB tables** — schema designed for estate planning workflows, not retrofitted from a generic LMS

---

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 0** | Infrastructure — CDK, WorkOS, DynamoDB, API Gateway, Lambda, Amplify | Complete |
| **Phase 1** | Auth + Role-Based Dashboards + QA (98.6% pass rate, 69 tests) | Complete |
| **Phase 2** | LMS v2 Engine — Lessons, 4 Quiz Types, Video Player, Progress Tracking | Complete |
| **Phase 3** | LMS Content — Module 1 (15 lessons), video upload pipeline, cert display | Complete |
| **Phase 4** | UI Polish + Video Content Production + Certificate Templates | In Progress |
| **Phase 5** | Stripe Billing — Subscription management, payment processing, plan enforcement | Planned |
| **Phase 6** | AI-Ready — Amazon Bedrock content generation, Personalize learning paths, predictive analytics | Planned |
| **Phase 7** | Analytics — QuickSight embedded dashboards, completion forecasting, ROI reporting | Planned |
| **Phase 8** | Integrations — BambooHR, Slack, Teams, SSO (SAML/OIDC), DocuSign, Salesforce | Planned |
| **Phase 9** | Mobile Apps — React Native (Android + iOS), offline-first, biometric auth | Planned |
| **Phase 10** | Blockchain — NFT certificates, on-chain credential verification | Future |

---

## Team

| Name | Role | Responsibilities |
|------|------|------------------|
| **Niki** | Product Owner | Business requirements, content strategy, stakeholder management, sales |
| **Shahzad** | AWS Architect / QA Lead | Infrastructure, backend, security, quality assurance, DevOps |
| **Nermeen** | Full Stack Developer | Frontend + backend development (joins at go-live) |
| **Aryan** | AI Developer | AI-powered features in Phase 6 — Bedrock integration, personalized learning |
| **Zara** | QA Engineer | Testing, bug reporting, user acceptance testing |

---

## Live Environment

| Resource | URL / Value |
|----------|------------|
| **Web Application** | https://uat.endevo.life |
| **Custom Domain** | https://uat.endevo.life |
| **API Gateway** | https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com |
| **GitHub Repository** | https://github.com/shahzadms7/endevo-life |
| **AWS Region** | us-east-1 (N. Virginia) |
| **Auth Provider** | WorkOS (Email + SMS OTP) |
| **Amplify App ID** | d1vvfv8oltolcf |

---

## Due Diligence Quick Facts

| Question | Answer |
|----------|--------|
| **What is the tech stack?** | Next.js 15 + Python 3.12 Lambda + DynamoDB + WorkOS + CDK + Amplify — serverless with passwordless auth |
| **How many engineers built this?** | 1 architect (Shahzad) built the entire platform. 4 additional team members for product, AI, QA, and dev. |
| **How long has it been in development?** | Started 2026-03-18. 107+ commits in 2 weeks. Phases 0-3 complete. |
| **Is it in production?** | UAT environment is live. Production launch planned after Phase 4 (UI polish + video content). |
| **What are the external dependencies?** | Zero pip dependencies on backend. Frontend: Next.js, Tailwind, react-hook-form, Zod, js-cookie. No external SaaS dependencies except AWS. |
| **How is data isolated between tenants?** | `tenantId` is embedded in the WorkOS JWT. Every Lambda extracts it and injects it into every DynamoDB query. QA verified: 0 cross-tenant leaks across 69 test cases. |
| **What is the cost to serve 10K users?** | Estimated ~$556/month on AWS (DynamoDB + Lambda + CloudFront + API Gateway). |
| **What is the revenue model?** | B2B annual subscription: $299/yr (Basic, 2 modules) or $499/yr (Premium, 6 modules) per organization. |
| **Is there vendor lock-in?** | AWS infrastructure + WorkOS auth, but standard patterns (DynamoDB → any NoSQL, Lambda → any serverless, WorkOS → any OIDC). Migration is straightforward. |
| **What about AI?** | AI-Ready architecture. Phase 6 plans Amazon Bedrock for content generation and Personalize for learning paths. No AI features are live today — we do not overstate capability. |
| **What compliance standards are planned?** | GDPR (data minimization applied), SOC 2 Type II (CloudTrail enabled), HIPAA (architecture designed), ISO 27001 (planned). |
| **How is the codebase organized?** | pnpm monorepo: `apps/web/` (Next.js), `backend/functions/` (5 Python Lambdas), `infrastructure/` (8 CDK stacks). |
| **What is the QA coverage?** | 69 test cases, 98.6% pass rate, covering auth, RBAC, tenant isolation, input validation, and edge cases. |
| **What is the deployment model?** | Frontend: Git-push auto-deploy via Amplify (~3 min). Lambda: GitHub Actions auto-deploy. Infrastructure: CDK manual deploy. |
| **Can it handle enterprise scale?** | DynamoDB auto-scales infinitely. Lambda scales to 1,000+ concurrent executions. CloudFront delivers content globally. No fixed servers to provision. |

---

## Getting Started (for Developers)

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22+ | Frontend build and CDK |
| Python | 3.12+ | Lambda functions |
| pnpm | 9+ | Package manager |
| AWS CLI | v2 | Lambda deployment and AWS operations |
| AWS CDK | 2.130+ | Infrastructure as code |

### Clone & Install

```bash
git clone https://github.com/shahzadms7/endevo-life.git
cd endevo-life
pnpm install
```

### Environment Variables

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com
```

AWS credentials must be configured via `aws configure` or environment variables. Never commit credentials to the repository.

### Local Development

```bash
cd apps/web
pnpm dev
# Available at http://localhost:3000
```

### Deploy Lambda Functions

```bash
cd backend/functions/admin
zip -r function.zip main.py
aws lambda update-function-code \
  --function-name endevo-uat-fn-admin \
  --zip-file fileb://function.zip
```

### Deploy Infrastructure

```bash
cd infrastructure
npx cdk deploy --all
```

---

## License

Proprietary. Copyright 2026 Endevo Life Inc. All rights reserved.

Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without explicit written permission from Endevo Life Inc.
