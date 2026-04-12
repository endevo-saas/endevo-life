# ENDEVO LIFE — COMPLETE PROJECT BLUEPRINT
> **Generated:** 2026-04-11 | **Source:** Actual codebase, AWS CLI, git history, SESSION-MASTER.md  
> **Rule:** 100% factual — no guesses, no more, no less

---

## 1. EXECUTIVE SUMMARY

| Field | Value |
|-------|-------|
| **Product** | Endevo Life — Digital Legacy & Estate Planning SaaS for Corporate HR |
| **Company** | Endevo (startup) |
| **Stack** | Next.js 15 + Python Lambda + AWS CDK + DynamoDB + WorkOS + Amplify |
| **Live URL** | https://uat.endevo.life |
| **API URL** | https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com |
| **GitHub** | https://github.com/endevo-saas/endevo-life (single repo) |
| **AWS Account** | 383423735462 (us-east-1) |
| **Started** | 2026-03-18 |
| **Last Deploy** | 2026-04-11 |
| **Total Commits** | 217 |
| **GitHub Issues** | 0 (tracked in SESSION-MASTER.md instead) |
| **Sessions** | 12 development sessions completed |
| **Team** | Shahzad (AWS architect/QA), Niki (owner), Zara (QA), Nermeen (dev), Aryan (Module 3 AI) |
| **Cost** | ~$150/month AWS |
| **Status** | Production LIVE — 70% MVP complete (Phases A-E done, F-I pending) |

---

## 2. LOCAL FILE STRUCTURE (Every File & Its Role)

### 2.1 Root: `SH 2026 MVP/` (Project Workspace)

| File | Role |
|------|------|
| `CLAUDE.md` | Project rules for Claude Code AI sessions |
| `.mcp.json` | MCP server configuration (context-mode) |
| `BUILD-TRACKER-AI-FEATURES.md` | AI feature tracking document |
| `FEATURE-AUDIT-AI-POWERED-EMPLOYEE-EXPERIENCE.md` | AI feature audit |
| `REQUIREMENTS-EMPLOYEE-EXPERIENCE-REDESIGN.md` | Employee redesign requirements |
| `endevo-project-context.txt` | Full project context dump |
| `gsi-access-logs.json` | DynamoDB GSI config for access logs |
| `gsi-master-classes.json` | DynamoDB GSI config for master classes |
| `repomix-output.xml` | Full codebase export for AI context |
| `.geminiignore` | Gemini AI ignore patterns |
| `_sessions/SESSION-MASTER.md` | **SINGLE SOURCE OF TRUTH** — all session history, decisions, status |
| `_sessions/TEST-USERS.md` | Test user credentials for QA |
| `_keys/endevo-sh-uat_accessKeys.csv` | AWS IAM credentials (NEVER commit) |

### 2.2 `endevo-life/` — ACTIVE CODEBASE (GitHub Repo)

**Total: ~170 unique source files** (excluding node_modules, .next, cdk.out, __pycache__, .git)

#### 2.2.1 Root Config Files (16 files)

| File | Role |
|------|------|
| `package.json` | Monorepo root — turbo + pnpm workspace |
| `pnpm-workspace.yaml` | pnpm workspace config (apps/web) |
| `turbo.json` | Turborepo build pipeline config |
| `.npmrc` | npm/pnpm config |
| `amplify.yml` | AWS Amplify build spec (Next.js 15 SSR) |
| `.gitignore` | Git ignore patterns |
| `.githooks/pre-commit` | Pre-commit hook |
| `.github/workflows/deploy-app.yml` | CI/CD: Amplify frontend deploy |
| `.github/workflows/deploy-infrastructure.yml` | CI/CD: CDK infrastructure deploy |
| `.github/workflows/deploy-lambda.yml` | CI/CD: Lambda function deploy |
| `.github/workflows/e2e-tests.yml` | CI/CD: Playwright E2E tests |
| `LICENSE` | Project license |
| `README.md` | GitHub README (project overview) |
| `STATUS-SUMMARY.md` | Executive status summary (642 lines) |
| `BLUEPRINT.md` | **THIS FILE** |
| `document-gen.zip` | Packaged document generation Lambda |

#### 2.2.2 Frontend: `apps/web/` (100+ files)

##### Config (10 files)

| File | Role |
|------|------|
| `package.json` | Next.js 15 dependencies |
| `tsconfig.json` | TypeScript config |
| `tailwind.config.ts` | Tailwind CSS config (4 themes) |
| `postcss.config.js` | PostCSS config |
| `playwright.config.ts` | Playwright E2E test config |
| `.env.local` | Local environment variables |
| `.env.production` | Production environment variables |
| `middleware.ts` | Next.js middleware (auth redirect) |
| `sentry.client.config.ts` | Sentry error tracking (client) |
| `sentry.server.config.ts` | Sentry error tracking (server) |
| `sentry.edge.config.ts` | Sentry error tracking (edge) |
| `instrumentation.ts` | Next.js instrumentation |
| `instrumentation-client.ts` | Client-side instrumentation |

##### App Router Pages — Auth (4 pages)

| File | Role |
|------|------|
| `app/(auth)/login/page.tsx` | Email → OTP login flow |
| `app/(auth)/register/page.tsx` | One-click account activation |
| `app/(auth)/forgot-password/page.tsx` | Password reset |
| `app/(auth)/status/page.tsx` | Auth status check |

##### App Router Pages — Employee Dashboard (16 pages)

| File | Role |
|------|------|
| `app/(employee)/layout.tsx` | Employee layout (sidebar + Jesse AI) |
| `app/(employee)/error.tsx` | Error boundary |
| `app/(employee)/employee/dashboard/page.tsx` | Employee home — 7 feature cards |
| `app/(employee)/employee/assessment/page.tsx` | 40-question assessment start |
| `app/(employee)/employee/assessment/[courseId]/page.tsx` | Assessment taking (domain-wise) |
| `app/(employee)/employee/checklist/page.tsx` | Final Playbook checklist |
| `app/(employee)/employee/playbook/page.tsx` | Final Playbook results |
| `app/(employee)/employee/certificates/page.tsx` | Certificate viewer |
| `app/(employee)/employee/profile/page.tsx` | User profile |
| `app/(employee)/employee/settings/page.tsx` | Account settings |
| `app/(employee)/employee/sessions/page.tsx` | 1:1 coaching sessions |
| `app/(employee)/employee/subscription/page.tsx` | Plan info (Basic/Premium) |
| `app/(employee)/employee/support/page.tsx` | Support / FAQ |
| `app/(employee)/employee/training/page.tsx` | Training overview |
| `app/(employee)/employee/master-classes/page.tsx` | Master class catalog |
| `app/(employee)/employee/lms/page.tsx` | LMS module list |
| `app/(employee)/employee/lms/module/[moduleNum]/page.tsx` | Module detail |
| `app/(employee)/employee/lms/module/[moduleNum]/lesson/[lessonId]/page.tsx` | Lesson viewer |
| `app/(employee)/employee/lms/module/[moduleNum]/video/[videoId]/page.tsx` | Video player |
| `app/(employee)/employee/lms/assessment/page.tsx` | LMS assessment |

##### App Router Pages — HR Admin Dashboard (10 pages)

| File | Role |
|------|------|
| `app/(admin)/layout.tsx` | HR Admin layout (sidebar) |
| `app/(admin)/error.tsx` | Error boundary |
| `app/(admin)/hr/dashboard/page.tsx` | 3 metrics: Activation, Completion, Progress |
| `app/(admin)/hr/employees/page.tsx` | Employee management |
| `app/(admin)/hr/invite/page.tsx` | Invite employees |
| `app/(admin)/hr/training/page.tsx` | Training overview |
| `app/(admin)/hr/certificates/page.tsx` | Certificate management |
| `app/(admin)/hr/settings/page.tsx` | HR settings |
| `app/(admin)/hr/subscription/page.tsx` | Tenant subscription info |
| `app/(admin)/hr/audit/page.tsx` | Audit log viewer |
| `app/(admin)/hr/archive/page.tsx` | Recycle bin |
| `app/(admin)/hr/lms/progress/page.tsx` | LMS progress tracking |

##### App Router Pages — Global Admin (Super Admin) Dashboard (18 pages)

| File | Role |
|------|------|
| `app/(global-admin)/layout.tsx` | Global Admin layout (sidebar) |
| `app/(global-admin)/error.tsx` | Error boundary |
| `app/(global-admin)/admin/dashboard/page.tsx` | Platform overview stats |
| `app/(global-admin)/admin/tenants/page.tsx` | All tenants list |
| `app/(global-admin)/admin/tenants/[tenantId]/page.tsx` | Tenant detail |
| `app/(global-admin)/admin/users/page.tsx` | All users management |
| `app/(global-admin)/admin/subscriptions/page.tsx` | Revenue: MRR, ARR, billing |
| `app/(global-admin)/admin/plan-config/page.tsx` | Plan configuration CRUD |
| `app/(global-admin)/admin/features/page.tsx` | Feature flags toggle |
| `app/(global-admin)/admin/settings/page.tsx` | System settings |
| `app/(global-admin)/admin/health/page.tsx` | System health (21 tables + 6 Lambdas) |
| `app/(global-admin)/admin/audit/page.tsx` | Full audit log |
| `app/(global-admin)/admin/archive/page.tsx` | Recycle bin (soft delete) |
| `app/(global-admin)/admin/certificates/page.tsx` | All certificates |
| `app/(global-admin)/admin/import-export/page.tsx` | Bulk JSON import/export |
| `app/(global-admin)/admin/knowledge/page.tsx` | Knowledge base management |
| `app/(global-admin)/admin/developers/page.tsx` | API Keys, Webhooks, Events |
| `app/(global-admin)/admin/executive-brief/page.tsx` | CHRO/CISO security brief |
| `app/(global-admin)/admin/finops/page.tsx` | AWS cost tracking + margins |
| `app/(global-admin)/admin/system/page.tsx` | System configuration |
| `app/(global-admin)/admin/lms/modules/page.tsx` | LMS module admin |
| `app/(global-admin)/admin/lms/modules/[moduleNum]/page.tsx` | Module detail admin |
| `app/(global-admin)/admin/lms/progress/page.tsx` | LMS progress admin |
| `app/(global-admin)/admin/lms/questions/page.tsx` | Question bank admin |

##### App Router — Root (4 files)

| File | Role |
|------|------|
| `app/layout.tsx` | Root layout (HTML shell) |
| `app/page.tsx` | Landing page → redirect to /login |
| `app/globals.css` | Global CSS + 4 theme definitions |
| `app/error.tsx` | Global error boundary |
| `app/signup/page.tsx` | Signup page |
| `app/api/auth/callback/route.ts` | Auth callback API route |

##### Components (14 files)

| File | Role |
|------|------|
| `components/AmbientMesh.tsx` | CSS-only animated mesh gradients (theme backgrounds) |
| `components/CompassionGuard.tsx` | Auto-detects bereavement context → switches to Sanctuary theme |
| `components/ErrorBoundary.tsx` | React error boundary wrapper |
| `components/ThemePicker.tsx` | 4-theme switcher (Luminous AI, Enterprise, Horizon, Sanctuary) |
| `components/ToastContainer.tsx` | Toast notification system |
| `components/ui/PersonalContactSection.tsx` | OTP-verified personal contact form |
| `components/copilot/CopilotWidget.tsx` | Copilot AI widget |
| `components/copilot/index.ts` | Barrel export |
| `components/jesse/JesseAIWidget.tsx` | Jesse AI widget wrapper |
| `components/jesse/JesseChatWindow.tsx` | Jesse chat UI (glassmorphism, floating) |
| `components/jesse/ActionCard.tsx` | HITL approve/reject buttons for Jesse actions |
| `components/jesse/index.ts` | Barrel export |
| `components/lms/LessonSidebar.tsx` | LMS lesson navigation sidebar |
| `components/lms/PdfLesson.tsx` | PDF lesson viewer (read-only, no download) |
| `components/lms/QuizEngine.tsx` | Quiz component (4 types: likert, MC, open, checklist) |
| `components/lms/ScorecardDisplay.tsx` | Assessment scorecard results |
| `components/lms/VideoLesson.tsx` | Video lesson wrapper |
| `components/lms/VideoPlayer.tsx` | Video player (resume from last position) |

##### Lib / Utilities (6 files)

| File | Role |
|------|------|
| `lib/api.ts` | **Central API client** — 50+ methods, 30+ TypeScript interfaces |
| `lib/auth/cognito.ts` | Legacy Cognito auth (DECOMMISSIONED) |
| `lib/auth/workos.ts` | WorkOS auth integration |
| `lib/domain-assessment.ts` | Domain-wise assessment logic |
| `lib/export.ts` | PDF/Excel export utilities |

##### E2E Tests (18 test files)

| File | Role |
|------|------|
| `e2e/admin-dashboards.spec.ts` | Admin dashboard tests |
| `e2e/assessment.spec.ts` | Assessment flow tests |
| `e2e/checklist.spec.ts` | Checklist tests |
| `e2e/employee-dashboard.spec.ts` | Employee dashboard tests |
| `e2e/flow-1-assessment-checklist-sync.spec.ts` | Flow 1: Assessment → Checklist |
| `e2e/flow-2-assessment-playbook.spec.ts` | Flow 2: Assessment → Playbook |
| `e2e/flow-3-auto-email-delivery.spec.ts` | Flow 3: Auto email |
| `e2e/flow-4-booking-sessions.spec.ts` | Flow 4: Session booking |
| `e2e/flow-5-master-classes.spec.ts` | Flow 5: Master classes |
| `e2e/flow-6-access-portability.spec.ts` | Flow 6: Access portability |
| `e2e/master-classes.spec.ts` | Master class tests |
| `e2e/personal-contact.spec.ts` | Personal contact OTP tests |
| `e2e/phase-a-lms-rename.spec.ts` | Phase A rename tests |
| `e2e/phase-b-checklist.spec.ts` | Phase B checklist tests |
| `e2e/phase-c-40q-sync.spec.ts` | Phase C question sync tests |
| `e2e/phase-d-domain-delivery.spec.ts` | Phase D domain delivery tests |
| `e2e/phase-e-auto-email.spec.ts` | Phase E auto email tests |
| `e2e/phase-f-booking-masterclasses.spec.ts` | Phase F booking tests |
| `e2e/playbook.spec.ts` | Playbook tests |
| `e2e/sessions.spec.ts` | Session tests |
| `e2e/unit-domain-assessment.spec.ts` | Domain assessment unit tests |
| `e2e/helpers/auth.ts` | Auth test helpers |
| `e2e/helpers/fixtures.ts` | Test fixtures |

##### Static Assets (4 files)

| File | Role |
|------|------|
| `public/jesse/avatar.png` | Jesse AI avatar photo |
| `public/jesse/intro.mp4` | Jesse intro video |
| `public/jesse/logo.png` | Jesse logo |
| `public/jesse/logo-white.png` | Jesse logo (white variant) |

#### 2.2.3 Backend: `backend/functions/` (7 Lambda Functions, 40+ files)

##### fn-auth (3 files)

| File | Role |
|------|------|
| `auth/main.py` | Auth Lambda — OTP login, session tokens, email/SMS OTP |
| `auth/requirements.txt` | Dependencies (boto3, workos) |
| `auth/utils/workos_auth.py` | WorkOS token validation |

##### fn-admin (4 files)

| File | Role |
|------|------|
| `admin/main.py` | Admin Lambda — tenants, users, subscriptions, FinOps, webhooks, events |
| `admin/requirements.txt` | Dependencies (boto3, workos, openpyxl) |
| `admin/utils/workos_auth.py` | WorkOS token validation |
| `admin/admin-lambda.zip` | Packaged Lambda zip |

##### fn-hr (4 files)

| File | Role |
|------|------|
| `hr/main.py` | HR Lambda — employees, metrics, sessions, recycle bin |
| `hr/requirements.txt` | Dependencies |
| `hr/utils/workos_auth.py` | WorkOS token validation |
| `hr/hr-lambda.zip` | Packaged Lambda zip |

##### fn-employee (9 files)

| File | Role |
|------|------|
| `employee/main.py` | Employee Lambda — profile, subscription, progress, OTP |
| `employee/personal_contact.py` | OTP-verified personal contact CRUD |
| `employee/requirements.txt` | Dependencies |
| `employee/utils/workos_auth.py` | WorkOS token validation |
| `employee/utils/bedrock_analyzer.py` | Bedrock AI analysis for assessments |
| `employee/utils/checklist_manager.py` | Checklist task persistence |
| `employee/utils/email_generator.py` | SES email generation |
| `employee/utils/master_classes.py` | Master class logic |
| `employee/utils/sessions.py` | 1:1 session management |
| `employee/utils/support_qa.py` | Support Q&A |
| `employee/tests/test_personal_contact.py` | Personal contact unit tests |
| `employee/employee-lambda.zip` | Packaged Lambda zip |

##### fn-lms (16 files)

| File | Role |
|------|------|
| `lms/main.py` | LMS Lambda — entry point, route dispatcher |
| `lms/requirements.txt` | Dependencies |
| `lms/routes/admin.py` | Admin LMS routes (module CRUD, reorder) |
| `lms/routes/assessment.py` | Assessment routes (40-Q, scoring, shuffle) |
| `lms/routes/course.py` | Course/module listing routes |
| `lms/routes/lesson_quiz.py` | Lesson + quiz routes |
| `lms/routes/lessons.py` | Lesson CRUD routes |
| `lms/routes/progress.py` | Progress tracking (video resume, completion) |
| `lms/routes/quiz.py` | Quiz submission + grading |
| `lms/engine/readiness_engine.py` | Readiness score calculation engine |
| `lms/utils/auth.py` | Auth middleware |
| `lms/utils/cache.py` | In-memory cache (5 min TTL) |
| `lms/utils/db.py` | DynamoDB helpers |
| `lms/utils/response.py` | HTTP response helpers |
| `lms/utils/s3.py` | S3 presigned URL generation |
| `lms/utils/workos_auth.py` | WorkOS token validation |
| `lms/tests/test_domain_ordering.py` | Domain ordering unit tests |

##### fn-jesse (6 files)

| File | Role |
|------|------|
| `jesse/main.py` | Jesse AI Lambda — chat, scoring, plan generation |
| `jesse/requirements.txt` | Dependencies (boto3, bedrock) |
| `jesse/knowledge_compressed.txt` | Compressed knowledge base for RAG |
| `jesse/knowledge_niki.txt` | Niki's knowledge content |
| `jesse/knowledge_platform.txt` | Platform knowledge content |
| `jesse/jesse-lambda.zip` | Packaged Lambda zip |

##### fn-document-gen (2 files)

| File | Role |
|------|------|
| `document-gen/handler.py` | EventBridge-triggered PDF generation |
| `document-gen/requirements.txt` | Dependencies |

##### Templates (2 files)

| File | Role |
|------|------|
| `backend/templates/mfp-checklist.pdf` | My Final Playbook checklist PDF template |
| `backend/templates/mfp-checklist.xlsx` | My Final Playbook checklist Excel template |

#### 2.2.4 Infrastructure: `infrastructure/` (18 CDK Stacks)

| File | Stack Name | Resources Created |
|------|-----------|-------------------|
| `lib/01-cognito-stack.ts` | EndevoUatCognito | Cognito User Pool (DECOMMISSIONED — WorkOS replaced it) |
| `lib/02-dynamo-stack.ts` | EndevoUatDynamo | 9 DynamoDB tables (core) |
| `lib/03-s3-stack.ts` | EndevoUatS3 | S3 buckets (assets, videos) |
| `lib/04-iam-stack.ts` | EndevoUatIam | Lambda execution role + all IAM policies |
| `lib/05-api-stack.ts` | EndevoUatApi | API Gateway HTTP API + Lambda integrations |
| `lib/06-amplify-stack.ts` | EndevoUatAmplify | Amplify app + branch + domain |
| `lib/07-cloudfront-lms-stack.ts` | EndevoUatCloudFrontLms | CloudFront for LMS video delivery |
| `lib/08-lms-infra-stack.ts` | EndevoUatLmsInfra | Imports existing LMS tables + Lambda |
| `lib/09-subscription-stack.ts` | EndevoUatSubscriptions | Subscriptions + Sessions DynamoDB tables |
| `lib/10-jesse-stack.ts` | EndevoUatJesse | Jesse chat DynamoDB table + knowledge base table |
| `lib/11-features-stack.ts` | EndevoUatFeatures | Notifications table |
| `lib/12-eventbridge-stack.ts` | EndevoUatEventBridge | EventBridge bus + 8 rules + DLQ |
| `lib/13-finops-stack.ts` | EndevoUatFinOps | Cost + webhook DynamoDB tables + CE IAM |
| `lib/14-kms-stack.ts` | EndevoUatKms | Customer Managed Key (AES-256, rotation enabled) |
| `lib/15-cloudfront-api-stack.ts` | EndevoUatCloudFrontApi | CloudFront for API Gateway |
| `lib/15-document-gen-stack.ts` | EndevoUatDocumentGen | Document generation Lambda + EventBridge rule |
| `lib/16-email-queue-stack.ts` | EndevoUatEmailQueue | SQS email queue + dead letter |
| `lib/17-observability-stack.ts` | EndevoUatObservability | CloudWatch alarms (32) + dashboards |
| `lib/18-jesse-agent-stack.ts` | EndevoUatJesseAgent | Bedrock Agent + Action Groups |
| `bin/app.ts` | — | CDK app entry point (instantiates all stacks) |
| `cdk.json` | — | CDK configuration |
| `package.json` | — | CDK dependencies |
| `tsconfig.json` | — | CDK TypeScript config |

#### 2.2.5 Scripts (14 files)

| File | Role |
|------|------|
| `scripts/seed-lms.py` | Seed 6 LMS modules + 15 lessons per module |
| `scripts/seed-plan-config.py` | Seed plan configuration (Basic/Premium) |
| `scripts/seed-subscriptions.py` | Seed subscription data for tenants |
| `scripts/seed_clean.py` | Clean all seed/dummy data |
| `scripts/seed-training.sh` | Seed training content |
| `scripts/setup_all_accounts.py` | Setup all user accounts |
| `scripts/update-modules.py` | Update module metadata |
| `scripts/update-modules-all-tenants.py` | Update modules across all tenants |
| `scripts/build-knowledge-index.py` | Build Jesse knowledge index |
| `scripts/embed-knowledge.py` | Generate knowledge embeddings |
| `scripts/ingest-knowledge.py` | Ingest knowledge into DynamoDB |
| `scripts/jesse-ingest.py` | Jesse knowledge base ingest |
| `scripts/jesse-vector-search.py` | Jesse vector search utility |
| `scripts/migrate-aurora-to-dynamo.py` | Migrate Aryan's Aurora data to DynamoDB |

#### 2.2.6 Documentation: `docs/` (18 files)

| File | Role |
|------|------|
| `docs/ARCHITECTURE.md` | Master architecture document (417 lines) |
| `docs/ARCHITECTURE-REVIEW-2026.md` | Principal Architect review |
| `docs/AWS-SERVICES-INVENTORY.md` | Complete AWS inventory (505 lines) |
| `docs/AUTH-MIGRATION-STRATEGY.md` | Cognito → WorkOS migration plan |
| `docs/WORKOS-MIGRATION-PLAN.md` | WorkOS implementation details |
| `docs/DEPLOYMENT-READINESS-CHECKLIST.md` | Pre-deploy checklist |
| `docs/DYNAMODB-SHARDING-DESIGN.md` | DynamoDB partition design |
| `docs/EMPLOYEE-DASHBOARD-QA.md` | Employee dashboard QA report |
| `docs/ENTERPRISE-RESILIENCE-PLAYBOOK.md` | Enterprise resilience runbook |
| `docs/ERRORS-LOG.md` | Bug/error log (692 lines, 37+ issues) |
| `docs/IAM-AUDIT-2026-04-03.md` | IAM permissions audit |
| `docs/PROJECT-STATUS-REPORT.md` | Executive status report (430 lines) |
| `docs/QA-REPORT.md` | Phase 1 QA: 98.6% pass (68/69 tests) |
| `docs/QA-LMS-REPORT.md` | LMS QA: 14 bugs found + fixed |
| `docs/RESILIENCE-DEBT-TRACKER.md` | Multi-region resilience gaps |
| `docs/SOC2-READINESS.md` | SOC 2 Type II readiness (38% baseline) |
| `docs/TEST-GUIDE.md` | Testing guide |
| `docs/TROUBLESHOOTING-GUIDE.md` | Troubleshooting runbook (8 categories) |

---

## 3. GITHUB STATUS

| Field | Value |
|-------|-------|
| **Repo** | https://github.com/endevo-saas/endevo-life |
| **Type** | Single monorepo (consolidated 2026-04-04) |
| **Default Branch** | main |
| **Active Branch** | develop |
| **Total Commits** | 217 (across all branches) |
| **Open Issues** | 0 |
| **Closed Issues** | 0 |
| **Pull Requests** | Issues tracked in SESSION-MASTER.md |

### GitHub Actions (4 Workflows)

| Workflow | File | Status | Last Run |
|----------|------|--------|----------|
| Deploy App (Amplify) | `deploy-app.yml` | SUCCESS | 2026-04-02 |
| Deploy Lambda Functions | `deploy-lambda.yml` | FAILED (fn-lms missing — now fixed) | 2026-04-02 |
| Deploy Infrastructure (CDK) | `deploy-infrastructure.yml` | FAILED (table conflict — FIXED) | 2026-04-02 |
| E2E Tests (Playwright) | `e2e-tests.yml` | SKIPPED (CI config issue) | — |

### Recent 20 Commits

```
49be4cf docs: comprehensive status summary
edbac3a fix: remove responseId GSI, use scan filter in document-gen
2c53115 fix: resolve 2 CRITICAL DynamoDB key bugs + 8 HIGH severity issues
13226f7 feat(employee-redesign): phase-F-booking-master-classes
ef6d7c5 feat(employee-redesign): phase-E-email-delivery
0ef9750 feat(employee-redesign): phase-D-domain-delivery
363594a feat(employee-redesign): phase-C-question-sync-fix
27f2521 feat(employee-redesign): phase-B-checklist-system
1d14362 feat(employee-redesign): phase-A-navigation-rename
427c51a chore: fix .gitignore to exclude CDK named outputs
bf8b5cd fix: employee dashboard complete with 7 features + Sentry + CVE patches
d3f0a11 fix: HR + Employee overhaul — real data, role validation, audit
4a3224b feat: Bedrock Agent deployed — disable EmailQueue until cyclic dep fixed
fdb6fe0 fix: remove cross-stack addToPolicy cyclic deps
962f218 fix: guard HITL ActionCard rendering with null check
b11faf5 fix: make JesseBubble action props optional
6951113 feat: Jesse Bedrock Agent — CDK + Lambda + HITL UI
ff61aab feat: 3-tier error-proofing — ErrorBoundary, backend try/except, CloudWatch
064b775 fix: add Bedrock guardrail + model permissions to IAM
52effd3 feat: Enterprise hardening — CloudFront WAF, SQS email queue, Jesse async
```

---

## 4. AWS SERVICES — A TO Z

### 4.1 Complete Service Inventory

| # | AWS Service | Resource | ID / ARN | Status |
|---|------------|----------|----------|--------|
| 1 | **Amplify** | Frontend hosting (Next.js 15 SSR) | App ID: `d1vvfv8oltolcf` | LIVE |
| 2 | **API Gateway** | HTTP API (v2) | API ID: `4jms6sdzk9` | LIVE |
| 3 | **Bedrock** | Jesse AI (Amazon Nova Micro/Lite) | us-east-1 | LIVE |
| 4 | **Bedrock Agents** | Jesse Agent (HITL) | Agent ID: `XR2QDIVFB6` | LIVE |
| 5 | **Bedrock Guardrails** | Content filtering | us-east-1 | LIVE |
| 6 | **Bedrock Knowledge Bases** | RAG knowledge store | us-east-1 | LIVE |
| 7 | **CloudFront** | UAT frontend CDN | Distribution: `E2488R45H4UGLK` | LIVE |
| 8 | **CloudFront** | LMS video CDN | Stack 07 | BUILT |
| 9 | **CloudFront** | API CDN | Stack 15 | BUILT |
| 10 | **CloudTrail** | Enterprise audit trail | `endevo-enterprise-trail` | LIVE |
| 11 | **CloudWatch** | 32 alarms (Lambda, API, DynamoDB) | us-east-1 | LIVE |
| 12 | **CloudWatch Logs** | Lambda + EventBridge logs | 30-day retention | LIVE |
| 13 | **Cognito** | User Pool (DECOMMISSIONED) | `us-east-1_DVyEJqgFt` | DECOMMISSIONED |
| 14 | **Cost Explorer** | FinOps cost tracking | IAM ce:GetCostAndUsage | LIVE |
| 15 | **DynamoDB** | 21 tables (see Section 6) | us-east-1 | LIVE |
| 16 | **EventBridge** | Custom event bus | `endevo-uat-events` | LIVE |
| 17 | **EventBridge Rules** | 8 event rules + DLQ | assessment.completed, user.created, etc. | LIVE |
| 18 | **IAM** | Lambda execution role | `endevo-uat-lambda-role` | LIVE |
| 19 | **IAM** | Bedrock access policy | `endevo-bedrock-access` | LIVE |
| 20 | **KMS** | Customer Managed Key | `alias/endevo-uat-vault` | LIVE |
| 21 | **Lambda** | 6 functions (see Section 7) | Python 3.12 | LIVE |
| 22 | **Route 53** | Hosted zone | `Z00556611RY5GCMKE4K5H` | LIVE |
| 23 | **Route 53** | Health checks (10s interval) | East + West | LIVE |
| 24 | **Route 53** | DNS failover (api-uat.endevo.life) | Primary/Secondary | LIVE |
| 25 | **S3** | Assets bucket | `endevo-uat-assets` | LIVE |
| 26 | **S3** | Videos bucket | `endevo-uat-videos` | LIVE |
| 27 | **S3** | Audit trail bucket (Object Lock) | `endevo-audit-trail-383423735462` | LIVE |
| 28 | **Secrets Manager** | WorkOS API key | `endevo/workos/api-key` | LIVE |
| 29 | **Secrets Manager** | WorkOS client ID | `endevo/workos/client-id` | LIVE |
| 30 | **SES** | Email sending (OTP, invites, re-engagement) | us-east-1 | LIVE |
| 31 | **SNS** | SMS OTP delivery | us-east-1 (SANDBOX) | LIVE (limited) |
| 32 | **SQS** | EventBridge DLQ | `endevo-uat-events-dlq` | LIVE |
| 33 | **SQS** | Email queue | Stack 16 | BUILT |
| 34 | **WAF** | Web ACL | `endevo-uat-waf` | CREATED (not associated) |

### 4.2 Multi-Region Status

| Resource | us-east-1 | us-west-2 |
|----------|-----------|-----------|
| API Gateway | LIVE (`4jms6sdzk9`) | LIVE (`62q88h374e`) |
| Lambda (5 functions) | LIVE | DEPLOYED |
| DynamoDB Global Tables | LIVE | REPLICATED |
| S3 | LIVE | CRR configured |
| Route 53 Health Checks | 10s interval, 2-failure | 10s interval, 2-failure |
| Secrets Manager | LIVE | NOT REPLICATED (gap) |
| Cognito | DECOMMISSIONED | N/A |
| CloudFront | LIVE (global) | N/A (global) |

### 4.3 Monthly Cost Breakdown

| Service | Monthly Cost |
|---------|-------------|
| DynamoDB (21 tables, on-demand) | ~$5 |
| Lambda (6 functions) | ~$2 |
| API Gateway | ~$1 |
| S3 (3 buckets) | ~$1 |
| CloudFront | ~$1 |
| Route 53 (health checks) | ~$2 |
| Amplify | ~$0 (free tier) |
| SES | ~$0.10 |
| CloudWatch | ~$3 |
| CloudTrail | ~$5 |
| KMS | ~$1 |
| Secrets Manager | ~$1 |
| WAF | ~$5 (when associated) |
| **TOTAL** | **~$27/month (UAT)** |
| **Projected at 1000 users** | **~$150/month** |

---

## 5. 4-TIER ARCHITECTURE

### 5.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TIER 4: PRESENTATION                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Super Admin  │  │  HR Admin    │  │  Employee    │  Next.js 15      │
│  │  Dashboard   │  │  Dashboard   │  │  Dashboard   │  (Amplify SSR)   │
│  │  18 pages    │  │  10 pages    │  │  16 pages    │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                 │                 │                           │
│  ┌──────┴─────────────────┴─────────────────┴───────┐                  │
│  │              Jesse AI (on ALL dashboards)          │                  │
│  │     Role-aware: Admin/HR/Employee Assistant        │                  │
│  └──────────────────────┬───────────────────────────┘                  │
└─────────────────────────┼──────────────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────┼──────────────────────────────────────────────┐
│                   TIER 3: API GATEWAY                                   │
│  ┌──────────────────────┴───────────────────────────┐                  │
│  │         API Gateway HTTP API (4jms6sdzk9)         │                  │
│  │   /api/auth/*  /api/admin/*  /api/hr/*            │                  │
│  │   /api/employee/*  /api/lms/*  /api/jesse/*       │                  │
│  └──┬────────┬────────┬────────┬────────┬────────┬──┘                  │
│     │        │        │        │        │        │                      │
└─────┼────────┼────────┼────────┼────────┼────────┼─────────────────────┘
      │        │        │        │        │        │
┌─────┼────────┼────────┼────────┼────────┼────────┼─────────────────────┐
│     ▼        ▼        ▼        ▼        ▼        ▼   TIER 2: COMPUTE   │
│  fn-auth  fn-admin  fn-hr  fn-employee fn-lms  fn-jesse                │
│  (30KB)   (139KB)  (56KB)  (146KB)    (LMS)   (Jesse)                 │
│  Python 3.12 Lambda Functions                                          │
│                                                                        │
│  ┌─────────────────────────────────────────────┐                       │
│  │  fn-document-gen (EventBridge triggered)     │                       │
│  │  assessment.completed → PDF generation       │                       │
│  └─────────────────────────────────────────────┘                       │
│                                                                        │
│  ┌─────────────────────────────────────────────┐                       │
│  │  Bedrock Agent (XR2QDIVFB6) — Jesse HITL    │                       │
│  │  Amazon Nova Micro (chat) + Titan V2 (embed) │                       │
│  └─────────────────────────────────────────────┘                       │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
┌────────────────────────────┼───────────────────────────────────────────┐
│                    TIER 1: DATA & EVENTS                               │
│                            │                                           │
│  ┌─────────────────────────┴──────────────────────┐                    │
│  │            DynamoDB (21 tables)                  │                    │
│  │  users, tenants, training, questions, responses  │                    │
│  │  certificates, audit, video-progress, config     │                    │
│  │  lms-modules, lms-user-modules, lms-lessons      │                    │
│  │  lms-lesson-progress, subscriptions, sessions    │                    │
│  │  jesse-chat, knowledge-base, notifications       │                    │
│  │  costs, webhooks, personal-contacts              │                    │
│  └──────────────────────────────────────────────────┘                    │
│                                                                        │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  EventBridge  │  │     S3       │  │    SES/SNS   │                │
│  │  8 event rules│  │  3 buckets   │  │  Email + SMS │                │
│  │  + DLQ (SQS)  │  │  + Object    │  │  OTP delivery│                │
│  │               │  │    Lock      │  │              │                │
│  └───────────────┘  └──────────────┘  └──────────────┘                │
│                                                                        │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │     KMS       │  │  Secrets Mgr │  │  CloudTrail  │                │
│  │  AES-256      │  │  WorkOS keys │  │  Audit trail │                │
│  │  Auto-rotate  │  │              │  │  S3 + Object │                │
│  │               │  │              │  │  Lock 365d   │                │
│  └───────────────┘  └──────────────┘  └──────────────┘                │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.2 4-Tier SaaS Pricing Model

| Tier | Name | Target | Price | Features |
|------|------|--------|-------|----------|
| 1 | Starter | 1-50 employees | — | Modules 1-2, basic HR, shared infra |
| 2 | Professional | 50-500 employees | — | All 6 modules, Jesse AI, analytics, digital vault |
| 3 | Enterprise | 500-5000 employees | — | SSO/SAML, SCIM, API access, KMS, custom branding |
| 4 | Platinum/White-Label | 5000+ employees | — | Cell-based isolation, BYOK crypto, 99.99% SLA |

### 5.3 Current Employee Pricing (MVP)

| Plan | Annual | Sessions | Features |
|------|--------|----------|----------|
| Basic | $299/yr | 2 one-on-one | 6 modules, assessment, checklist, playbook |
| Premium | $499/yr | 6 one-on-one | Basic + Jesse AI, master classes, priority support |

> Company pays. Employee never touches billing. HR controls plan assignment.

---

## 6. DYNAMODB TABLES (All 21)

| # | Table Name | PK | SK | GSIs | Purpose |
|---|-----------|-----|-----|------|---------|
| 1 | `endevo-uat-tenants` | tenantId | — | — | Company/organization records |
| 2 | `endevo-uat-users` | pk (tenantId) | sk (userId) | email-index | All users (admin, HR, employee) |
| 3 | `endevo-uat-training` | tenantId | courseId | — | Training course catalog |
| 4 | `endevo-uat-questions` | tenantId | questionId | — | 40 assessment questions (4 domains × 10) |
| 5 | `endevo-uat-responses` | userId | submittedAt | — | Assessment answers |
| 6 | `endevo-uat-certificates` | tenantId | certId | — | Issued certificates |
| 7 | `endevo-uat-audit` | pk | sk | — | Immutable audit trail |
| 8 | `endevo-uat-video-progress` | pk | sk | — | Video watch position (resume -5s) |
| 9 | `endevo-uat-config` | configKey | — | — | Plan config, feature flags |
| 10 | `endevo-uat-lms-modules` | tenantId | moduleNum | — | 6 LMS modules per tenant |
| 11 | `endevo-uat-lms-user-modules` | userId | moduleNum | — | Per-user module progress |
| 12 | `endevo-uat-lms-lessons` | moduleKey | lessonId | — | 15 lessons per module |
| 13 | `endevo-uat-lms-lesson-progress` | userId | lessonKey | — | Per-user lesson progress |
| 14 | `endevo-uat-subscriptions` | tenantId | sk | — | Billing history, invoices |
| 15 | `endevo-uat-sessions` | userId | sessionId | — | 1:1 coaching sessions |
| 16 | `endevo-uat-jesse-chat` | userId | createdAt | — | Jesse AI chat history |
| 17 | `endevo-uat-knowledge-base` | sourceFile | chunkIndex | — | Jesse RAG knowledge vectors |
| 18 | `endevo-uat-notifications` | userId | notificationId | — | User notifications |
| 19 | `endevo-uat-costs` | dateKey | sk | — | FinOps AWS cost data (TTL 90d) |
| 20 | `endevo-uat-webhooks` | tenantId | sk | — | Tenant webhooks + API keys |
| 21 | `endevo-uat-personal-contacts` | userId | contactId | — | OTP-verified personal contacts |

### Current Data State (Clean — Seed Data Wiped 2026-04-09)

- 3 GLOBAL_ADMIN users: khak.pa@gmail.com, niki@finalplaybook.com, bluesproutagency@gmail.com
- 2 System tenants: SYSTEM, tenant-ind
- 0 Customer tenants (create from UI)
- 0 HR Admins (auto-created with tenant)
- 0 Employees (invited by HR)
- 40 Assessment questions (SYSTEM + tenant-ind)
- 6 LMS modules seeded (SYSTEM + tenant-ind)

---

## 7. LAMBDA FUNCTIONS (All 7)

| # | Function Name | Size | Runtime | Routes | Role |
|---|--------------|------|---------|--------|------|
| 1 | `endevo-uat-fn-auth` | 30KB | Python 3.12 | /api/auth/* | OTP login, session tokens, email/SMS |
| 2 | `endevo-uat-fn-admin` | 139KB | Python 3.12 | /api/admin/* | Tenants, users, billing, FinOps, webhooks, events |
| 3 | `endevo-uat-fn-hr` | 56KB | Python 3.12 | /api/hr/* | Employees, metrics, sessions, recycle bin |
| 4 | `endevo-uat-fn-employee` | 146KB | Python 3.12 | /api/employee/* | Profile, subscription, OTP, checklist, contacts |
| 5 | `endevo-uat-fn-lms` | — | Python 3.12 | /api/lms/* | Modules, lessons, quizzes, assessment, progress |
| 6 | `endevo-uat-fn-jesse` | — | Python 3.12 | /api/jesse/* | AI chat, scoring, plan generation, RAG |
| 7 | `fn-document-gen` | 6KB | Python 3.12 | EventBridge trigger | PDF generation on assessment.completed |

---

## 8. EVENTBRIDGE RULES (All 8)

| # | Rule | Event | Target |
|---|------|-------|--------|
| 1 | user.created | New user registered | CloudWatch Logs |
| 2 | user.activated | Account activated | CloudWatch Logs |
| 3 | module.completed | LMS module finished | CloudWatch Logs |
| 4 | assessment.completed | 40-Q assessment done | fn-document-gen (PDF) |
| 5 | certificate.issued | Certificate generated | CloudWatch Logs |
| 6 | subscription.changed | Plan upgrade/downgrade | CloudWatch Logs |
| 7 | subscription.cancelled | Plan cancelled | CloudWatch Logs |
| 8 | tenant.created | New company onboarded | CloudWatch Logs |

---

## 9. LMS MODULE STRUCTURE

| Module | Title | Domain | Lessons | Status |
|--------|-------|--------|---------|--------|
| 1 | Project Worth Developing | Foundation | 15 (7 video, 3 quiz, 2 pdf, 3 podcast) | SEEDED + CONTENT |
| 2 | Legal Readiness | Legal | Seeded | SEEDED, content pending |
| 3 | AI-Powered Legacy Planning | AI | Seeded | SEEDED, Aryan owns |
| 4 | Financial Accounts & Payment | Financial | Seeded | SEEDED, Stripe pending |
| 5 | Physical Readiness | Physical | Seeded | SEEDED, content pending |
| 6 | Digital Readiness + Communicate Wishes | Digital | Seeded | SEEDED, content pending |

### Assessment Engine

- 40 questions across 4 domains (Legal/Financial/Physical/Digital × 10 each)
- All 40 answered → ALL modules unlock simultaneously
- Scoring: A=10, B=6, C=3, D=0
- Readiness tiers: Peace Champion (85%+) / On Your Way (60%+) / Getting Clarity (35%+) / Starting Fresh (0-34%)
- Unlimited retakes, no cooldown
- Certificate issued on Module 6 completion

---

## 10. ALL BUGS, ERRORS, ISSUES, FAILURES & BLOCKAGES

### 10.1 Summary Counts

| Category | Total | Fixed | Open | Blocking |
|----------|-------|-------|------|----------|
| CRITICAL bugs | 9 | 9 | 0 | 0 |
| HIGH bugs | 14 | 14 | 0 | 0 |
| MEDIUM bugs | 8 | 8 | 0 | 0 |
| LOW bugs | 3 | 2 | 1 | 0 |
| Infrastructure failures | 5 | 4 | 1 | 1 |
| Gap fixes (enterprise) | 8 | 8 | 0 | 0 |
| **TOTAL** | **47** | **45** | **2** | **1** |

### 10.2 CRITICAL Bugs (All 9 — ALL FIXED)

| # | Bug | Root Cause | Fix | Session |
|---|-----|-----------|-----|---------|
| C1 | Audit Log Silent Failure | Composite key missing `sk`, error swallowed by `except: pass` | Added sk to put_item, removed bare except | S3 (QA) |
| C2 | Assessment Cross-Tenant Contamination | Employee got 20 Qs (all 4 tenants) instead of 5 | Fixed query to filter by tenantId | S3 (QA) |
| C3 | OTP Composite Key Bug | get_item/update_item with only PK, missing SK (userId) | Added userId to Key parameter | S10 |
| C4 | Document-gen Responses Query Bug | Tried fetch by responseId but PK is (userId, submittedAt) | Used Scan with FilterExpression | S10 |
| C5 | Quiz questions key mismatch | Frontend expected `quizzes`, backend returned `questions` | Fixed frontend key | S8 (LMS QA) |
| C6 | Module detail wrapper mismatch | Frontend expected `res.module`, backend returned flat object | Fixed frontend wrapper | S8 (LMS QA) |
| C7 | Admin questions wrong type | Frontend sent `'quiz'`, backend required `'inline'` | Fixed type parameter | S8 (LMS QA) |
| C8 | Admin progress modal empty | Frontend expected `res.user`, backend returned flat | Fixed response parsing | S8 (LMS QA) |
| C9 | Plaintext passwords in 5 API responses | Passwords returned in user objects | Removed from all responses | S5 |

### 10.3 HIGH Bugs (All 14 — ALL FIXED)

| # | Bug | Root Cause | Fix | Session |
|---|-----|-----------|-----|---------|
| H1 | Progress Not Updated After Passing | Dashboard showed completed_courses=0 | Fixed progress write | S3 (QA) |
| H2 | Video-Progress Write Failing Silently | Missing videoId in DynamoDB write | Added videoId | S3 (QA) |
| H3 | Video interface field mismatches | Progress always 0% | Fixed field mapping | S8 (LMS QA) |
| H4 | HR progress status mismatch | `'completed'` vs `'complete'` | Normalized status strings | S8 (LMS QA) |
| H5 | Missing `import React` | Amplify build failure | Added import | S8 (LMS QA) |
| H6 | openpyxl invalid version | 3.10.0 doesn't exist | Changed to 3.1.5 | S10 |
| H7 | Final playbook route wrong | /employee/final-playbook vs /employee/playbook | Fixed route | S10 |
| H8 | OTP TTL not populated | Auto-expiry broken | Set TTL attribute | S10 |
| H9 | Checklist tasks not persisted | Tasks not written to DynamoDB | Added DynamoDB put_item | S10 |
| H10 | S3 key paths include bucket name | Invalid S3 keys | Removed bucket prefix | S10 |
| H11 | Email/phone not validated before OTP | OTP sent to invalid addresses | Added validation | S10 |
| H12 | HR_ADMIN error messages (5 occurrences) | Role renamed but error messages not updated | Updated all 5 | S10 |
| H13 | MRR calculation wrong ($49M phantom) | Used maxSeats instead of user_count | Fixed to real count | S9 |
| H14 | DynamoDB scan Limit=1 bug | Token lookup returned wrong user | Fixed query | S5 |

### 10.4 MEDIUM Bugs (All 8 — ALL FIXED)

| # | Bug | Fix | Session |
|---|-----|-----|---------|
| M1 | System Status AccessDeniedException | Added DescribeTable, GetFunction, GetSendQuota IAM | S9 |
| M2 | Recycle Bin crash | Fixed response keys (items→users/tenants/employees) | S9 |
| M3 | Health page stale | Added 30s auto-refresh polling | S9 |
| M4 | Certificates standalone menu | Moved into LMS nav group | S9 |
| M5 | Dashboard missing subscription stats | Added subscription_basic/premium to API | S9 |
| M6 | Plan filters showing Starter/System | Backend filters active tenants only | S9 |
| M7 | Subscription filters disconnected | Fixed data binding | S9 |
| M8 | Duplicate stat cards + settings | Merged cards, consolidated nav | S9 |

### 10.5 Enterprise Gap Fixes (All 8 — ALL FIXED)

| # | Gap | Fix | Session |
|---|-----|-----|---------|
| G1 | No event-driven architecture | EventBridge bus + 8 rules + DLQ | S9 |
| G2 | No cost tracking | FinOps stack + Cost Explorer API | S9 |
| G3 | No webhook system | Webhook + API key DynamoDB tables | S9 |
| G4 | No encryption at rest | KMS Customer Managed Key | S9 |
| G5 | KMS/IAM cyclic dependency | Key policy instead of addToPolicy | S9 |
| G6 | No developer portal | API keys, webhooks, events UI | S9 |
| G7 | No executive brief | CHRO/CISO printable brief page | S9 |
| G8 | No CloudTrail | Enterprise audit trail + S3 Object Lock | S9 |

### 10.6 ACTIVE BLOCKERS (1)

| # | Blocker | Impact | Workaround | Status |
|---|---------|--------|------------|--------|
| B1 | CDK deployment fails — CloudFormation EarlyValidation on DynamoDB | Cannot redeploy infrastructure via `cdk deploy` | Manual AWS CLI Lambda deployment | WORKAROUND IN PLACE |

### 10.7 OPEN ISSUES (1)

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| O1 | DynamoDB upsert on fake tenantId returns 200 instead of 404 | LOW | Minimal — only affects invalid API calls |

---

## 11. QUOTAS, LIMITS & CONSTRAINTS

### 11.1 AWS Service Quotas

| Service | Limit | Current | Status |
|---------|-------|---------|--------|
| Lambda concurrent executions | 10 (default) | Requested 1000 | PENDING AWS approval |
| Lambda memory | 256MB (all functions) | — | OK for now |
| Lambda timeout | 30s (default) | — | OK |
| API Gateway throttle | 10,000 req/s (default) | — | OK |
| DynamoDB on-demand | 40,000 RCU / 40,000 WCU | ~10 RCU/WCU | OK |
| S3 bucket limit | 100 per account | 3 used | OK |
| SES sending | Sandbox (200/day) | — | Need to exit sandbox |
| SNS SMS | Sandbox (10 numbers) | — | Need to exit sandbox |
| Secrets Manager | 500,000 secrets | 2 used | OK |
| EventBridge | 300 rules per bus | 8 used | OK |
| CloudWatch alarms | 5,000 per region | 32 used | OK |
| Amplify apps | 25 per region | 1 used | OK |
| Route 53 health checks | 200 per account | 2 used | OK |

### 11.2 Application Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| OTP expiry | 5 minutes | Security best practice |
| Session token expiry | 60 minutes | Balance security/UX |
| Refresh token | 30 days | Standard |
| Video progress save | Every 15 seconds | Minimize data loss |
| Video completion threshold | 95% watched | Enterprise LMS standard |
| Assessment questions | 40 (fixed) | 4 domains × 10 |
| Assessment retakes | Unlimited | Niki's decision |
| Knowledge cache TTL | 5 minutes | Lambda warm cache |
| CloudWatch log retention | 30 days | Cost optimization |
| Audit S3 Object Lock | 365 days GOVERNANCE | SOC 2 requirement |
| FinOps cost data TTL | 90 days | DynamoDB cleanup |
| DNS failover TTL | 30 seconds | Fast failover (~50s worst case) |

### 11.3 Known Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| Lambda concurrency = 10 | 11+ concurrent requests = throttling | Quota increase pending |
| SNS in sandbox mode | Can only send SMS to 10 verified numbers | Submit exit request via Console |
| SES in sandbox mode | 200 emails/day limit | Submit exit request via Console |
| CDK cannot redeploy | Cannot modify infrastructure via code | Manual AWS CLI workaround |
| WAF not associated | API not protected by WAF rules | Need CloudFront association |
| Cognito decommissioned | Legacy code still references it | WorkOS is active replacement |
| No automated E2E tests in CI | CI config issue | Fix workflow config |
| Secrets Manager not replicated | us-west-2 failover would fail auth | Replicate to us-west-2 |

---

## 12. WHAT'S BUILT (Phases A-E — 70% MVP)

### Phase A: OTP + Personal Contact Form ✅
- Email → OTP → 6-digit code → session token
- Personal contact CRUD with composite key OTP verification
- SES email + SNS SMS delivery

### Phase B: Checklist + Task Persistence ✅
- Final Playbook checklist (from Excel template)
- Task persistence to DynamoDB
- PDF export capability

### Phase C: Document Generation ✅
- EventBridge-triggered PDF generation
- assessment.completed → fn-document-gen → S3
- Scorecard, checklist, results PDFs

### Phase D: Role-Based Access Control ✅
- GLOBAL_ADMIN / HR_ADMIN / EMPLOYEE roles
- Route protection (middleware + backend)
- Audit logging for all role-based actions

### Phase E: Employee Experience Dashboard ✅
- 7-feature employee dashboard
- Sentry error tracking
- Next.js CVE patches applied
- Domain-wise assessment delivery
- Navigation rename (LMS → Training)

### Enterprise Infrastructure (Built Across Sessions 4-11) ✅
- WorkOS auth (replaced Cognito)
- EventBridge event-driven architecture
- KMS encryption (AES-256, auto-rotate)
- CloudTrail audit trail (S3 Object Lock 365d)
- FinOps cost tracking
- Developer Portal (API keys, webhooks)
- 4 world-class themes (Luminous AI, Enterprise, Horizon, Sanctuary)
- Jesse AI chatbot (Bedrock Nova Micro, RAG)
- Jesse HITL Action Cards
- CompassionGuard (bereavement auto-switch)
- Multi-region failover (Route 53 DNS, ~50s)
- 32 CloudWatch alarms
- WAF Web ACL (created, not associated)

---

## 13. WHAT'S PENDING (Phases F-I — 30% MVP)

### Phase F: Master Classes + Access Portability (~500 lines, 1-2 weeks)
- Master class booking system (3 endpoints)
- Tenant access portability (2 endpoints)
- Master class catalog UI
- **Owner:** Shahzad
- **Blocker:** Need master_classes + access_logs DynamoDB tables

### Phase G: Subscriptions & Billing (~800 lines, 2-3 weeks)
- Self-service plan upgrade/downgrade
- Invoice generation
- Payment tracking (manual invoicing, Stripe post-MVP)
- Per-employee billing (Basic $299 / Premium $499)
- **Owner:** Shahzad + Nermeen
- **Blocker:** None (data model exists)

### Phase H: Jesse AI Full Integration (~2000 lines, 3-4 weeks)
- Jesse on all 3 dashboards (currently employee only)
- Action Mode (execute tasks, not just chat)
- Knowledge base from Aryan's content
- Voice input/output (future)
- **Owner:** Shahzad
- **Blocker:** Aryan handoff — need Aurora pgvector data export

### Phase I: Admin Dashboards (~1200 lines, 2-3 weeks)
- 7 admin dashboard endpoints
- Advanced analytics
- Tenant management improvements
- Bulk operations
- **Owner:** Shahzad + Nermeen

---

## 14. WHAT'S PLANNED (Post-MVP — Horizon 2 & 3)

### Horizon 2: Enterprise Features (Q3-Q4 2026)

| Feature | Priority | Dependency |
|---------|----------|------------|
| Stripe payment integration | HIGH | Module 4 content |
| SCIM Directory Sync (WorkOS) | HIGH | Enterprise contracts |
| SOC 2 Type II certification | HIGH | Vanta/Drata setup |
| Trust Center page (trust.endevo.life) | HIGH | GTM |
| JWT signature verification (WorkOS JWKS) | HIGH | Pre-production |
| Session token GSI (replace full table scan) | MEDIUM | Performance |
| CloudFront for LMS video delivery | MEDIUM | Module content |
| HLS adaptive video streaming | MEDIUM | Video content |
| Mobile app (React Native or Flutter) | MEDIUM | MVP stable |
| Webhook outbound delivery | MEDIUM | EventBridge wired |
| CloudFront + WAF for API Gateway | MEDIUM | Security |
| Branch protection on main | LOW | Team process |
| Automated E2E tests in CI | LOW | CI fix |

### Horizon 3: Agentic AI Platform (Q4 2026 — Q1 2027)

| Layer | Component | Investment | Timeline |
|-------|-----------|-----------|----------|
| 1 | Automated Reasoning (compliance checking) | $15k | Q2 2026 |
| 1 | Bedrock Data Automation (PDF ingestion) | $10k | Q2 2026 |
| 2 | AgentCore Memory (session persistence) | $8k | Q3 2026 |
| 2 | Agentic RAG (smart knowledge selection) | $12k | Q3 2026 |
| 3 | Multi-Agent Network (Finance/Legal/Health/Executor) | $25k | Q4 2026 |
| 4 | Browser Automation + Code Interpreter | $15k | Q4 2026 |
| 5 | FinOps + Intelligent Model Routing | $8k | Q1 2027 |
| **TOTAL** | | **$93k** | **9 months** |

### Future LMS Modules (7-12)

| Module | Topic |
|--------|-------|
| 7 | Digital Legacy Management (passwords, crypto, social media) |
| 8 | Insurance & Benefits Optimization |
| 9 | Tax-Efficient Wealth Transfer (IRAs, estate tax) |
| 10 | Caregiving & Elder Law |
| 11 | Mental Health & Grief Preparation |
| 12 | Business Succession (executive transition) |

### 3 Agentic Clones (Bedrock Agents + HITL)

| Clone | Role | Capability |
|-------|------|-----------|
| Super Admin Clone | SRE Agent | Monitor CloudWatch, detect bottlenecks, generate CDK fixes |
| HR Admin Clone | Predictive Analyst | Readiness analysis, draft campaigns, unlock modules |
| Employee Clone | Legacy Architect | Voice → entity extraction → Digital Vault → draft will |

### GTM Strategy (5 Pillars)

1. **Compassion Mode UX** — Context-aware theme switching for bereavement
2. **Trust Center** — trust.endevo.life (public security brief)
3. **Land & Expand** — 3-5 pilot companies (500-1000 emp), 6 months free
4. **Data Flywheel** — At 10k users: industry benchmarks that don't exist
5. **SOC 2 Type II** — Non-negotiable for US Enterprise SaaS

---

## 15. TEAM & ROLES

| Name | Role | Responsibilities | Status |
|------|------|-----------------|--------|
| Shahzad | AWS Architect / QA Lead | Infrastructure, CDK, Lambda, architecture, QA | ACTIVE |
| Niki | Product Owner | Product decisions, pricing, content, GTM | ACTIVE |
| Zara | QA Tester | Manual testing, bug reporting | ACTIVE |
| Nermeen | Developer | Frontend/backend implementation | REJOINED (2026-04-05) |
| Aryan | Module 3 AI (Student) | Jesse AI, Aurora pgvector, knowledge base | LEAVING — handoff critical |

---

## 16. KEY URLS & CREDENTIALS

| Resource | URL / ID |
|----------|----------|
| Live App | https://uat.endevo.life |
| Amplify Direct | https://main.d1vvfv8oltolcf.amplifyapp.com |
| API Gateway | https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com |
| API (failover) | https://api-uat.endevo.life |
| GitHub Repo | https://github.com/endevo-saas/endevo-life |
| CloudFront (UAT) | E2488R45H4UGLK (d2z75s6nio8jtv.cloudfront.net) |
| AWS Account | 383423735462 |
| AWS Region | us-east-1 (primary), us-west-2 (DR) |
| WorkOS Client ID | client_01KNFZCZQZYGTDRS91KW12TGXK |
| Route 53 Zone | Z00556611RY5GCMKE4K5H |
| EventBridge Bus | endevo-uat-events |
| KMS Key | alias/endevo-uat-vault |
| Bedrock Agent | XR2QDIVFB6 |

---

## 17. SECURITY POSTURE

| Control | Status |
|---------|--------|
| Authentication | WorkOS (OTP + session tokens) |
| Encryption at rest | KMS AES-256 (auto-rotate) |
| Encryption in transit | TLS 1.2+ (CloudFront + API Gateway) |
| Audit trail | CloudTrail → S3 Object Lock (365d GOVERNANCE) |
| IAM | Least privilege (endevo-uat-lambda-role) |
| Secrets | AWS Secrets Manager (zero hardcoded) |
| WAF | Created (endevo-uat-waf), NOT associated |
| CORS | Restricted to uat.endevo.life + amplify + localhost |
| RBAC | 3 roles enforced (GLOBAL_ADMIN, HR_ADMIN, EMPLOYEE) |
| Multi-tenant isolation | tenantId partition on all queries |
| SOC 2 readiness | 38% baseline (8 categories assessed) |
| CloudWatch monitoring | 32 alarms active |
| DNS failover | ~50s worst case (10s health checks) |

---

*Generated from actual codebase, AWS resources, git history, and SESSION-MASTER.md on 2026-04-11.*
*Total: 217 commits | 170+ source files | 21 DynamoDB tables | 7 Lambda functions | 18 CDK stacks | 34 AWS resources | 47 issues tracked (45 fixed, 1 blocking, 1 open)*
