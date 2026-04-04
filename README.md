# Endevo Life

> AI-Powered Digital Legacy & Estate Planning Platform for Enterprise HR

[![Live Platform](https://img.shields.io/badge/Live-Platform-brightgreen)](https://main.d1vvfv8oltolcf.amplifyapp.com)
[![AWS Serverless](https://img.shields.io/badge/Stack-AWS_Serverless-orange)](https://aws.amazon.com)
[![Next.js 15](https://img.shields.io/badge/Frontend-Next.js_15-black)](https://nextjs.org)
[![Python Lambda](https://img.shields.io/badge/Backend-Python_Lambda-blue)](https://aws.amazon.com/lambda/)

---

## What is Endevo Life?

Endevo Life is an enterprise SaaS platform that helps organizations prepare their employees for life's most important — and most neglected — planning decisions: legacy, estate, legal, financial, and digital affairs. Through a structured Learning Management System (LMS), employees complete guided modules covering everything from wills and trusts to digital asset management, earning verifiable certificates along the way.

Built for Corporate HR teams, Endevo Life turns legacy planning from an uncomfortable conversation into a measurable, trackable employee benefit — one that companies can offer alongside health insurance and retirement plans.

---

## Product Features

### For Employees
- **Readiness Assessment** — Personalized scorecard across Legal, Financial, Physical, and Digital readiness domains with targeted recommendations
- **6-Module Learning Path** — Structured curriculum with video lessons, PDFs, podcasts, and interactive quizzes
- **4 Quiz Types** — Multiple choice, Likert scale, open text, and checklist — each designed for different learning objectives
- **Video Player with Resume** — Pick up exactly where you left off; inline quiz popups during playback
- **Progress Tracking** — Duolingo-style dashboard showing module completion, streaks, and milestones
- **Verifiable Certificates** — Earned upon module completion, downloadable and shareable

### For HR Administrators
- **Tenant-Scoped Dashboard** — See your organization's enrollment, completion rates, and certificate stats
- **Employee Management** — Invite, onboard, and track employee progress through the curriculum
- **Email Invitations** — One-click invite via SES with automatic account provisioning
- **Progress Analytics** — Module-by-module breakdown per employee with completion tracking
- **Audit Trail** — Every action logged with timestamp, IP address, and severity

### For Platform Administrators (Global Admin)
- **Multi-Tenant Control Center** — Manage all organizations, users, and subscriptions from one dashboard
- **LMS Content Management** — Create and edit modules, lessons, quizzes, and video content
- **User & Role Management** — Full CRUD for all users across all tenants with role assignment
- **System Health Monitor** — Live probe of DynamoDB, Cognito, and Lambda status
- **Subscription Management** — Plan assignment, seat limits, and billing tier control
- **Security Audit Log** — Global audit trail with IP tracking, action badges, and CSV export

### Platform-Wide
- **Multi-Tenant Architecture** — Complete data isolation between organizations
- **Three-Role RBAC** — Global Admin, HR Admin, Employee — enforced at the JWT token level
- **Zero Trust Security** — CORS restrictions, WAF protection, brute-force detection, encrypted data at rest and in transit
- **Responsive Design** — Works on desktop, tablet, and mobile browsers
- **Theme Support** — Multiple user-selectable themes (Eclipse, Canvas, Neon)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     USERS (Browser)                      │
│       https://main.d1vvfv8oltolcf.amplifyapp.com         │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│          AWS Amplify — Next.js 15 App Router             │
│     Auto-deploy: GitHub push → live in ~3 minutes        │
└────────────────────────┬────────────────────────────────┘
                         │ fetch() API calls
┌────────────────────────▼────────────────────────────────┐
│        Amazon API Gateway (HTTP API)                     │
│                                                          │
│   /api/auth/*      → endevo-uat-fn-auth                  │
│   /api/admin/*     → endevo-uat-fn-admin                 │
│   /api/hr/*        → endevo-uat-fn-hr                    │
│   /api/employee/*  → endevo-uat-fn-employee              │
│   /api/lms/*       → endevo-uat-fn-lms (content engine)  │
└───────┬────────┬────────┬──────────┬──────────┬─────────┘
        │        │        │          │          │
    fn-auth  fn-admin   fn-hr   fn-employee  fn-lms
        │        │        │          │          │
┌───────▼────────▼────────▼──────────▼──────────▼─────────┐
│               Amazon DynamoDB (8+ Tables)                 │
│     endevo-uat-tenants    endevo-uat-users                │
│     endevo-uat-training   endevo-uat-questions            │
│     endevo-uat-responses  endevo-uat-certificates         │
│     endevo-uat-video-progress  endevo-uat-audit           │
├──────────────────────────────────────────────────────────┤
│            Amazon Cognito User Pool                       │
│     JWT tokens with custom:role + custom:tenantId         │
├──────────────────────────────────────────────────────────┤
│     Amazon S3 — Video & PDF content storage               │
│     Amazon CloudFront — Content delivery                  │
│     Amazon SES — Transactional email                      │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | Next.js 15 (App Router) | Server-rendered React with route groups per role |
| **Language (FE)** | TypeScript | Type-safe frontend development |
| **Styling** | Tailwind CSS | Utility-first responsive design |
| **Forms** | react-hook-form + Zod | Schema-validated form handling |
| **Backend** | Python 3.12 (Lambda) | 5 serverless functions, pure boto3 — no pip dependencies |
| **Database** | Amazon DynamoDB | Serverless NoSQL with per-tenant isolation |
| **Auth** | Amazon Cognito | JWT-based auth with MFA, custom role/tenant attributes |
| **API** | Amazon API Gateway (HTTP) | Single entry point routing to Lambda functions |
| **Hosting** | AWS Amplify | Git-push auto-deploy with built-in SSL and CDN |
| **CDN** | Amazon CloudFront | Video and PDF content delivery |
| **Storage** | Amazon S3 | LMS media files (video, PDF, podcast) |
| **Email** | Amazon SES | Invite emails and password resets |
| **Infrastructure** | AWS CDK (TypeScript) | 8 CloudFormation stacks, fully codified |
| **Monorepo** | pnpm + Turborepo | Workspace management across apps and packages |
| **CI/CD** | GitHub Actions + Amplify | Automated Lambda deploy + frontend auto-deploy |

---

## LMS Engine (v2)

The Learning Management System is the heart of Endevo Life. It delivers structured, multi-format educational content through a progressive module system.

### How It Works

1. **Readiness Assessment** — Every employee starts with a comprehensive assessment that evaluates their preparedness across Legal, Financial, Physical, and Digital domains. There is no pass/fail gate — completing the assessment unlocks all 6 modules simultaneously.

2. **Module Progression** — Each module contains multiple lessons in varied formats: video lectures, PDF documents, podcasts, and interactive quizzes. Employees work through lessons at their own pace.

3. **4 Quiz Types** — The engine supports four distinct quiz formats, each suited to different learning objectives:
   - **Multiple Choice** — Standard knowledge checks with randomized question selection
   - **Likert Scale** — Self-assessment surveys (e.g., Avoidance Quiz) measuring attitudes and readiness
   - **Open Text** — Free-form written responses for reflective exercises (e.g., KLT exercise)
   - **Checklist** — Action verification for practical tasks (e.g., Emergency Protocol completion)

4. **Video Player** — Supports resume-from-where-you-left-off, inline quiz popups during playback, replay overlay, and next-lesson navigation.

5. **Progress Tracking** — Real-time tracking at every level: per-video, per-lesson, per-module. The employee dashboard shows a Duolingo-style interface with completion percentages and visual progress indicators.

6. **Auto-Complete** — Modules automatically mark as complete when all constituent lessons are finished. Certificates are issued upon module completion.

### Content Architecture

Content is multi-tenant aware. Organizations can receive shared template content (from the SYSTEM tenant) or have tenant-specific customizations. The LMS queries fall back to shared templates when no tenant-specific content exists.

---

## Security & Compliance

### Authentication & Authorization
- **Cognito JWT tokens** with `custom:role` and `custom:tenantId` embedded — zero extra database lookups per request
- **Per-request RBAC** — every Lambda call validates the token and checks role permissions
- **Email OTP** for Global Admin login — additional verification layer
- **MFA support** via Cognito (TOTP authenticator apps)
- **Brute-force protection** — IP tracking and lockout mechanisms

### Data Security
- **Encryption at rest** — DynamoDB server-side encryption enabled
- **Encryption in transit** — HTTPS enforced on all endpoints
- **CORS restrictions** — restricted to specific allowed origins (no wildcards)
- **WAF protection** — Web Application Firewall on API Gateway
- **Zero-trust PDF access** — signed URLs with expiration for document downloads

### Multi-Tenant Isolation
- HR Admins can only access their own tenant's data (enforced by `tenantId` from JWT)
- Employees can only access their own records (enforced by `userId` + `tenantId` from JWT)
- Global Admins have full access but every action is recorded in the audit trail
- QA verified: **0 cross-tenant data leaks** across 69 test cases

### Input Validation
- All user input sanitized — HTML tags stripped via regex, forbidden characters rejected at the boundary
- Parameterized DynamoDB operations — no string concatenation in queries
- Schema-based validation on frontend (Zod) and backend (Python)

### Compliance Roadmap
| Standard | Status |
|----------|--------|
| GDPR | Data minimization principles applied; right-to-delete planned |
| SOC 2 Type II | CloudTrail enabled; Config rules planned |
| HIPAA | PHI tagging architecture designed |
| ISO 27001 | Security control matrix planned |

### US Data Residency
All data stored in `us-east-1` (N. Virginia). No data leaves the United States.

---

## Subscription Plans

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
| AI-Powered Recommendations | — | Planned |

---

## Module Structure

| Module | Title | Lessons | Status |
|--------|-------|---------|--------|
| 1 | Project Worth Developing | 15 | Built |
| 2 | Legal | TBD | Planned |
| 3 | Financial | TBD | Planned (Aryan — AI integration) |
| 4 | Physical | TBD | Planned |
| 5 | Digital | TBD | Planned |
| 6 | Communicate Your Wishes | TBD | Planned |

**Module 1** is fully built with 15 lessons covering the foundational concepts of legacy planning — why it matters, how to start, and what a "project worth developing" looks like. Lessons include video lectures, PDFs, podcasts, and all 4 quiz types.

---

## RAID Log (Risks, Actions, Issues, Decisions)

Real engineering challenges encountered during development and how they were resolved.

### Infrastructure Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| **CDK cross-stack dependency failure** — IAM stack referenced DynamoDB/S3 stack outputs, creating circular imports | Blocked all CDK deploys | Switched IAM to wildcard ARNs instead of cross-stack references; later skipped DynamoDB stack entirely as tables were managed separately |
| **Amplify app accidentally deleted** — new app created with different App ID, broke DNS and deploy pipeline | Frontend down | Created new Amplify app (`d1vvfv8oltolcf`), updated Route 53 records, reconfigured GitHub webhook |
| **CDK version notices causing exit code 1** — `cdk deploy` printed version upgrade notices and returned non-zero exit | CI/CD pipeline falsely reported failures | Added `--no-notices` flag (or acknowledged notices) to prevent false exit codes |
| **CloudFormation stuck in REVIEW_IN_PROGRESS** — partial deploy left stack in unrecoverable state | Blocked subsequent deploys | Manually deleted stuck stack via AWS CLI, redeployed cleanly |

### Authentication & Tenant Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| **LMS auth role mismatch** — frontend checked `super_admin` / `admin` but Cognito used `GLOBAL_ADMIN` / `HR_ADMIN` | LMS pages returned 403 for all users | Updated auth checks to use actual Cognito role values |
| **Tenant ID mapping** — code queried with `endevo-global` but DynamoDB used `SYSTEM` as the global tenant ID | Global admin saw empty LMS content | Added tenant remapping: `endevo-global` → `SYSTEM` at query time |
| **Cognito auth flows wiped by token update** — updating Cognito client token settings reset all enabled auth flows | Login broken for all users | Restored `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH` flows |
| **OTP applied to all roles** — email OTP gate was blocking HR Admin and Employee logins | Non-admin users could not log in | Restricted OTP requirement to `GLOBAL_ADMIN` only |

### LMS & Content Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| **Video progress DynamoDB expression error** — `put_item` missing required `videoId` range key | Video progress silently not saving | Added `videoId = course_id` to all progress writes |
| **14 frontend/backend field mismatches** — frontend interfaces did not match actual API response shapes | Multiple LMS pages showing empty data or crashing | Deep QA audit: fixed all field mappings across video, module, progress, and quiz interfaces |
| **CORS wildcard vulnerability** — `Access-Control-Allow-Origin: *` on API responses | Security risk: any domain could call the API | Restricted CORS to specific allowed origins |
| **Assessment showed "Pass Score: 90%"** — contradicted business rule (no pass/fail, all scores unlock modules) | Users confused about unlock mechanics | Changed to "Unlocks All: 6 Modules" messaging |

### Build & Deploy Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| **TypeScript `React.ElementType` import** — Next.js 15 JSX transform does not auto-import React namespace | Amplify build failures across 3 dashboard pages | Added explicit `import React` where `React.*` types were referenced |
| **pnpm frozen lockfile on first build** — `--frozen-lockfile` fails without committed `pnpm-lock.yaml` | First Amplify build could never succeed | Changed to `--no-frozen-lockfile` for initial build |
| **Amplify build path mismatch** — `amplify.yml` pointed to wrong repo directory after org transfer | Frontend deploys building wrong code | Updated `amplify.yml` base path to `endevo-life` |

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
| Git | latest | Version control |

### Clone & Install

```bash
git clone https://github.com/endevo-saas/endevo-life.git
cd endevo-life
pnpm install
```

### Environment Variables

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com
```

For Lambda development, AWS credentials must be configured via `aws configure` or environment variables. Never commit credentials to the repository.

### Local Development

```bash
# Start the Next.js dev server
cd apps/web
pnpm dev

# The app will be available at http://localhost:3000
```

### Project Structure

```
endevo-life/
├── apps/web/                  # Next.js 15 frontend (TypeScript)
│   ├── app/
│   │   ├── (auth)/            # Login, register, forgot-password
│   │   ├── (global-admin)/    # Platform admin pages
│   │   ├── (hr-admin)/        # HR admin pages (tenant-scoped)
│   │   └── (employee)/        # Employee learning portal
│   ├── components/            # Shared React components
│   └── lib/                   # API client, utilities
├── backend/functions/         # Python Lambda functions
│   ├── auth/main.py           # Authentication flows
│   ├── admin/main.py          # Global admin operations
│   ├── hr/main.py             # HR admin operations
│   ├── employee/main.py       # Employee operations
│   └── lms/                   # LMS content engine
├── infrastructure/lib/        # AWS CDK stacks (TypeScript)
│   ├── 01-cognito-stack.ts    # User pool + app client
│   ├── 02-dynamo-stack.ts     # All DynamoDB tables
│   ├── 03-s3-stack.ts         # Content storage buckets
│   ├── 04-iam-stack.ts        # Lambda execution role
│   ├── 05-api-stack.ts        # API Gateway + Lambda
│   ├── 06-amplify-stack.ts    # Frontend hosting
│   ├── 07-cloudfront-lms-stack.ts  # CDN for LMS content
│   └── 08-lms-infra-stack.ts  # LMS-specific infra
├── scripts/                   # Seed data + utilities
├── docs/                      # ARCHITECTURE.md, ERRORS-LOG.md
└── .github/workflows/         # CI/CD pipelines
```

---

## Deployment

### Frontend (Automatic)

Push to `main` branch on GitHub. Amplify detects the push and builds + deploys automatically in approximately 3 minutes. No manual action required.

### Lambda Functions (CLI)

```bash
# Deploy a single Lambda function
cd backend/functions/admin
zip -r function.zip main.py
aws lambda update-function-code \
  --function-name endevo-uat-fn-admin \
  --zip-file fileb://function.zip
```

Repeat for `auth`, `hr`, `employee`, and `lms` functions. GitHub Actions automates this on push to the `main` branch.

### Infrastructure (CDK)

```bash
cd infrastructure
npx cdk deploy --all
```

CDK manages 8 CloudFormation stacks covering Cognito, DynamoDB, S3, IAM, API Gateway, Amplify, CloudFront, and LMS infrastructure.

---

## AI Integration Points (for Aryan)

Module 3 (Financial) is designated for AI-powered content. Key integration surfaces:

| Integration Point | Where | How |
|-------------------|-------|-----|
| **AI Content Generation** | `backend/functions/lms/` | New routes for Bedrock-generated lesson content |
| **Personalized Learning Paths** | `backend/functions/employee/` | Amazon Personalize recommendations based on assessment scores |
| **AI Scorecard** | `apps/web/components/lms/ScorecardDisplay.tsx` | Assessment results already display domain scores — AI can enhance recommendations |
| **Quiz Generation** | `backend/functions/lms/` | AI-generated quiz questions tailored to user's weak areas |
| **LMS API Client** | `apps/web/lib/api.ts` | All API calls are centralized here — add new AI endpoints in one place |

The LMS engine already supports the content types (video, PDF, quiz, podcast) that AI-generated lessons will use. The multi-tenant content architecture ensures AI content can be tenant-specific or shared globally.

---

## Team

| Name | Role | Responsibilities |
|------|------|------------------|
| **Shahzad** | AWS Architect / QA Lead | Infrastructure, backend, security, quality assurance |
| **Niki** | Product Owner | Business requirements, content strategy, stakeholder management |
| **Nermeen** | Full Stack Developer | Frontend + backend development (joins at go-live) |
| **Aryan** | AI Developer | Module 3 (Financial) — AI content generation and personalization |
| **Zara** | QA Engineer | Testing, bug reporting, user acceptance |

---

## Project Timeline

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 0** | Infrastructure — CDK, Cognito, DynamoDB, API Gateway, Lambda, Amplify | Completed |
| **Phase 1** | Auth + Role-Based Dashboards + QA (98.6% pass rate, 69 tests) | Completed |
| **Phase 2** | LMS v2 Engine — Lessons, Quizzes, Video Player, Progress Tracking | Completed |
| **Phase 3** | UI Polish + Video Content + Certificates | In Progress |
| **Phase 4** | AI Integration — Bedrock, Personalize, AI Scorecard | Planned |
| **Phase 5** | Stripe Billing — Subscription management, payment processing | Planned |
| **Phase 6** | Analytics — QuickSight dashboards, completion forecasting | Planned |
| **Phase 7** | Integrations — BambooHR, Slack, Teams, SSO | Planned |
| **Phase 8** | Mobile Apps — React Native (Android + iOS) | Planned |
| **Phase 9** | Blockchain — NFT certificates, on-chain digital will | Future |

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **Pure boto3, no pip dependencies** | Single `main.py` per Lambda — no zip layers, faster cold starts, simpler deployments |
| **DynamoDB over RDS** | Serverless, no connection pooling, auto-scales, cheaper at low volume |
| **Cognito custom attributes for RBAC** | `custom:role` + `custom:tenantId` in JWT — zero extra DB lookups per request |
| **HTTP API Gateway over REST** | ~71% cost reduction for simple Lambda proxy routing |
| **Next.js 15 App Router** | Route groups provide clean per-role layouts; Suspense handles dynamic rendering |
| **Soft delete for tenants** | Preserves audit history and data for billing/legal compliance |
| **Amplify for hosting** | Zero DevOps — Git push to live site with built-in SSL/CDN |

---

## Live URLs

| | URL |
|--|-----|
| **Web App** | https://main.d1vvfv8oltolcf.amplifyapp.com |
| **API** | https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com |
| **GitHub** | https://github.com/endevo-saas/endevo-life |

---

## License

Proprietary. Copyright 2026 Endevo Life Inc. All rights reserved.

Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without explicit written permission from Endevo Life Inc.
