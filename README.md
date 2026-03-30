# Endevo Life

**Digital Legacy & Estate Planning SaaS for Corporate HR**

[![Live UAT](https://img.shields.io/badge/Live-UAT-brightgreen)](https://main.d1vgn9nzfx4cxk.amplifyapp.com)
[![v1.1.0](https://img.shields.io/badge/Release-v1.1.0-blue)](https://github.com/shahzadms7/endevo-life/releases/tag/v1.1.0)
[![AWS](https://img.shields.io/badge/Stack-AWS_Serverless-orange)](https://aws.amazon.com)
[![Phase 1](https://img.shields.io/badge/Phase_1-LOCKED-success)](https://github.com/shahzadms7/endevo-life/releases)

---

## What Is Endevo Life?

Multi-tenant B2B SaaS. Corporate HR teams onboard employees onto **Digital Legacy & Estate Planning** training. Employees complete courses, pass assessments, and earn verifiable certificates.

**Business model:** $10,000 setup + $10/seat/month

**Three portals — three roles — one platform:**

| Role | Portal URL | Who |
|------|-----------|-----|
| `GLOBAL_ADMIN` | `/admin/*` | Platform owner — controls everything |
| `HR_ADMIN` | `/hr/*` | Company HR manager — controls own tenant |
| `EMPLOYEE` | `/employee/*` | Learner — completes training and assessments |

---

## Live URLs

| | URL |
|--|-----|
| **Web App** | https://main.d1vgn9nzfx4cxk.amplifyapp.com |
| **API** | https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com |
| **GitHub Releases** | https://github.com/shahzadms7/endevo-life/releases |

### Test Accounts

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Global Admin | `khak.pa@gmail.com` | your password | + email OTP to Gmail |
| HR Admin | `hr@technovasolutions.io` | `Endevo@Test2026!` | TechNova Solutions |
| HR Admin | `hr@maplefinancial.ca` | `Endevo@Test2026!` | Maple Financial Group |
| Employee | `ethan.brooks@technovasolutions.io` | `Endevo@Test2026!` | TechNova employee |
| Employee | `liam.foster@maplefinancial.ca` | `Endevo@Test2026!` | Maple employee |

> All 40 seed accounts use password `Endevo@Test2026!`

---

## Architecture

```
Browser (Next.js 15 — Amplify hosted)
         │
         │ HTTPS / JWT Bearer
         ▼
  API Gateway (HTTP API) ─── endevo-uat-api · 4jms6sdzk9
         │
    ┌────┴────────────────────────────────┐
    │                                     │
  fn-auth     fn-admin     fn-hr     fn-employee
  (9 routes) (25 routes) (10 routes)  (8 routes)
  python3.12  python3.12  python3.12   python3.12
  256MB/30s   256MB/30s   256MB/30s    256MB/30s
         │
         ▼
  DynamoDB (9 tables, PAY_PER_REQUEST, PITR)
  Cognito (77 users, custom:role/tenantId/tenantName)
  S3 (assets + videos buckets — videos empty, LMS Phase 2)
  SES (endevo.life domain verified, sandbox mode)
```

---

## Three Portals — Complete Feature List

### Portal 1: Global Admin `/admin/*`

Full platform control. Belongs to SYSTEM tenant — not any real company.

**Login:** Email + Password + Math CAPTCHA + **Email OTP** (6-digit, 10-min expiry, single-use)

| Page | What it does |
|------|-------------|
| `/admin/dashboard` | Platform KPIs: total tenants, users, certs, system health. Count-up animation. |
| `/admin/tenants` | Full tenant CRUD. Create requires mandatory HR admin email. Disable/Enable (no delete). Tenant code format: tenant-00001. |
| `/admin/tenants/[id]` | Per-tenant dashboard: HR admins, employees, training stats, seat utilization. |
| `/admin/users` | All users across all tenants. Lock/Unlock/Reset Password/Deactivate/Reactivate. Filter by role/status/tenant. CSV export. |
| `/admin/subscriptions` | Per-tenant plan management. Edit plan/seats/price. Suspend/Activate tenant. MRR view. |
| `/admin/certificates` | All certificates platform-wide. Grade badges (Distinction/Merit/Pass/Fail). CSV export. |
| `/admin/audit` | Security audit log: every action, IP, device, severity. Filter by category. CSV export. |
| `/admin/health` | Real AWS infrastructure monitor: 9 DynamoDB tables (live counts), 4 Lambdas (real routes), Cognito, S3, SES, Amplify — zero fake values. |
| `/admin/settings` | 5 tabs: Account (change password), Platform (name/tagline/email/max tenants), Pricing (edit all plan prices), Security (OTP/CAPTCHA/MFA/brute-force policy), Notifications (email settings). Stored in DynamoDB config table. |

**Business rules enforced:**
- One email = one role globally (enforced at API)
- Tenant creation requires HR admin (auto-creates Cognito account + sends welcome email)
- No hard deletes — disable/enable only
- Disabling tenant immediately blocks all its users in Cognito
- Tenant IDs: tenant-00001 format (sequential, collision-checked)

---

### Portal 2: HR Admin `/hr/*`

Full replica of Global Admin — scoped to own tenant only. Zero cross-tenant data possible.

**Login:** Email + Password + Math CAPTCHA (no OTP for HR Admin)

**Isolation guarantee:** JWT `custom:tenantId` extracted on every API call. Every DynamoDB query filtered by `Attr("tenantId").eq(tenant_id)`. HR Admin cannot call `/api/admin/*` (403 returned).

| Page | What it does |
|------|-------------|
| `/hr/dashboard` | Team KPIs: total employees, active, pending invites. Engagement rates. Recent members. Quick action grid. |
| `/hr/employees` | Employee list. Edit name/dept/job title. Lock/Unlock. Reset Password (shows new temp password inline). Deactivate/Reactivate. CSV export. |
| `/hr/invite` | Invite employee by email. Creates Cognito account. Sends branded email with single Accept button → user sets own password. |
| `/hr/training` | Enrollment/completion stats per course. Progress bars. Not-started count. CSV export. |
| `/hr/certificates` | All certs earned by team. Grade badges. Search by name/email. CSV export. |
| `/hr/subscription` | Current plan details. Seat usage bar (green/yellow/red). Active users breakdown. Org details. Read-only — can't change billing. |
| `/hr/audit` | Audit log scoped to own tenant only. |
| `/hr/settings` | Change password. |

---

### Portal 3: Employee `/employee/*`

Learning journey — gamified with Duolingo-style XP progression.

**Login:** Email + Password + Math CAPTCHA

| Page | What it does |
|------|-------------|
| `/employee/dashboard` | XP level bar (5 levels), count-up stats, achievement badges (click unlocked = confetti!), 7-day streak, motivational banner. |
| `/employee/training` | Course list with progress bars. Video player (placeholder until LMS Phase 2 uploads). |
| `/employee/assessment` | Multi-choice questions, auto-scored. 70%+ = certificate issued automatically. |
| `/employee/certificates` | All earned certs with scores and issued dates. |
| `/employee/profile` | Edit name, department, job title inline. |
| `/employee/settings` | Change password with strength bar. |

---

## Login Security Flow

```
ALL ROLES:
  Step 1 → Email + Password
  Step 2 → Math CAPTCHA (e.g. "3 × 4 = ?")

GLOBAL_ADMIN ONLY (extra step):
  Step 3 → 6-digit OTP emailed to Gmail
           Expires in 10 minutes, single-use, stored server-side

BRUTE-FORCE PROTECTION:
  5 failed attempts → IP locked 15 minutes
  Every attempt logged to audit table (IP + device fingerprint)
```

---

## Tenant & User Lifecycle

```
CREATING A TENANT:
  1. Global Admin fills: org name + HR admin (first, last, email) + plan + seats
  2. System creates: tenant record (tenant-00001 format)
  3. System creates: HR admin Cognito account (auto)
  4. System sends: branded welcome email with "Login" button and temp password
  5. HR admin logs in → manages employees

INVITING AN EMPLOYEE (by HR Admin):
  1. HR Admin enters employee email (+ optional name/dept/role)
  2. System creates: Cognito account (auto)
  3. System sends: "Accept Invitation →" email (single button, no confusion)
  4. Employee clicks → /register page → sets own password → logged in

NO DELETIONS EVER:
  - Tenants: Disable (blocks all users) / Enable (restores all)
  - Users: Deactivate (blocks login) / Reactivate (restores)
  - All data preserved permanently — audit trail intact
```

---

## Themes

Three user-selectable themes — saved in browser localStorage, applied instantly:

| Theme | Style | Inspired by |
|-------|-------|------------|
| **Eclipse** | Dark (default) | Linear.app, Vercel |
| **Canvas** | Light — dark text #37352F on white (18:1 contrast, WCAG AAA) | Notion, Apple |
| **Neon** | Vibrant — Duolingo green + coral + gold glows | Duolingo, Stripe |

**Picker:** 3 square swatches at the bottom of every sidebar. Click = instant apply.

---

## AWS Infrastructure (Real Values)

| Resource | ID / Name | Details |
|----------|----------|---------|
| Amplify | `d1vgn9nzfx4cxk` | WEB_COMPUTE, auto-deploy from GitHub main |
| API Gateway | `4jms6sdzk9` | HTTP API, 4 wildcard routes, 52 total endpoints |
| Cognito Pool | `us-east-1_DVyEJqgFt` | 77 users, MFA OPTIONAL, custom attributes |
| Lambda auth | `endevo-uat-fn-auth` | 9 routes, python3.12, 256MB, 30s |
| Lambda admin | `endevo-uat-fn-admin` | 25 routes, python3.12, 256MB, 30s |
| Lambda hr | `endevo-uat-fn-hr` | 10 routes, python3.12, 256MB, 30s |
| Lambda employee | `endevo-uat-fn-employee` | 8 routes, python3.12, 256MB, 30s |
| DynamoDB tenants | `endevo-uat-tenants` | 12 records |
| DynamoDB users | `endevo-uat-users` | 42 records, 3 GSIs |
| DynamoDB training | `endevo-uat-training` | 28 courses |
| DynamoDB questions | `endevo-uat-questions` | 140 questions |
| DynamoDB certificates | `endevo-uat-certificates` | 3 records |
| DynamoDB audit | `endevo-uat-audit` | 65+ events |
| DynamoDB responses | `endevo-uat-responses` | 4 submissions |
| DynamoDB video-progress | `endevo-uat-video-progress` | 2 records |
| DynamoDB config | `endevo-uat-config` | Platform settings |
| S3 assets | `endevo-uat-assets` | Empty — ready |
| S3 videos | `endevo-uat-videos` | Empty — LMS Phase 2 |
| SES domain | `endevo.life` | Verified · Sandbox mode |
| IAM role | `endevo-uat-lambda-role` | Least-privilege inline policy |

---

## Seed Data (UAT — 10 Tenants)

| Tenant ID | Organisation | Plan | Industry |
|-----------|-------------|------|---------|
| tenant-00001 | Maple Financial Group | Enterprise Plus | Finance |
| tenant-00002 | TechNova Solutions | Enterprise | Technology |
| tenant-00003 | Apex Healthcare | Professional | Healthcare |
| tenant-00004 | Horizon Logistics | Professional | Logistics |
| tenant-00005 | GreenLeaf Energy | Starter | Energy |
| tenant-00006 | Atlas Construction | Starter | Construction |
| tenant-00007 | Pinnacle Law Partners | Professional | Legal |
| tenant-00008 | BlueSky Retail Corp | Enterprise | Retail |
| tenant-00009 | Quantum AI Labs | Trial | AI Research |
| tenant-00010 | Meridian Education Group | Enterprise Plus | Education |

All HR admins and employees: `Endevo@Test2026!`

---

## What Is NOT Built Yet (Honest — v2)

| Feature | Phase | Status |
|---------|-------|--------|
| LMS — 6-week video curriculum | Phase 2 | Not started — videos not uploaded |
| Week-locked progression | Phase 2 | DynamoDB schema designed, not built |
| CloudFront CDN for videos | Phase 2 | S3 bucket ready, CDN not configured |
| Certificate PDF generator | Phase 2 | Auto-cert in DB works, PDF not built |
| SES production access | Ops | Still in sandbox — only verified emails receive |
| DNS: uat.endevo.life → Amplify | Ops | Waiting on Niki/Nermeen (GoDaddy) |
| GitHub Actions Lambda CI/CD | Ops | Lambda deploys are manual CLI currently |
| Stripe billing | Phase 3 | Not started |
| AI integration | Phase 4 | Not started |
| OTP for HR Admin + Employee | Config | OTP active for Global Admin only currently |
| WAF / IP Allowlist | Phase 3 | Security roadmap |
| CloudWatch dashboards | Phase 2 | Manual health check only |

---

## Security — What Is Active Right Now

| Control | Status | Details |
|---------|--------|---------|
| Email OTP | ✅ Active | Global Admin login only — 10-min expiry, single-use |
| Math CAPTCHA | ✅ Active | All roles, all login screens |
| Brute-force lockout | ✅ Active | 5 fails → 15-min IP block, audit logged |
| JWT auth | ✅ Active | Cognito access tokens, short-lived |
| RBAC (3 roles) | ✅ Active | Enforced in every Lambda |
| Tenant isolation | ✅ Active | JWT tenantId on every DynamoDB query |
| No hard deletes | ✅ Active | Disable/Enable only — data preserved |
| One email one role | ✅ Active | Global uniqueness check on every create/invite |
| Input sanitization | ✅ Active | XSS strips, HTML tag removal, length limits |
| Cognito rollback | ✅ Active | DynamoDB fail → Cognito user cleaned up |
| HTTPS / TLS | ✅ Active | Amplify + API Gateway enforced |
| Error boundaries | ✅ Active | All 4 route groups + root level |
| Audit logging | ✅ Active | IP + device on every action |
| WAF | ❌ Pending | Phase 3 |
| IP Allowlist | ❌ Pending | Not configured |
| MFA enforced | ❌ Optional | Cognito OPTIONAL mode — not required |

---

## Project Structure

```
endevo-life/
├── apps/web/                        Next.js 15 frontend
│   ├── app/(auth)/                  Login, register, forgot/reset password
│   ├── app/(global-admin)/admin/    Global Admin portal (8 pages)
│   ├── app/(hr-admin)/hr/           HR Admin portal (8 pages)
│   ├── app/(employee)/employee/     Employee portal (6 pages)
│   ├── components/
│   │   └── ThemePicker.tsx          3-theme system (Eclipse/Canvas/Neon)
│   └── lib/
│       ├── api.ts                   All API calls (50+ methods)
│       ├── export.ts                CSV export utility
│       └── auth/cognito.ts          Login/signOut/cookies
│
├── backend/functions/
│   ├── auth/main.py                 Login, OTP, register, password (9 routes)
│   ├── admin/main.py                Platform admin (25 routes)
│   ├── hr/main.py                   HR admin (10 routes)
│   └── employee/main.py             Employee learning (8 routes)
│
├── infrastructure/lib/
│   ├── 01-cognito-stack.ts
│   ├── 02-dynamo-stack.ts           9 tables
│   ├── 03-s3-stack.ts
│   ├── 04-iam-stack.ts
│   ├── 05-api-stack.ts
│   └── 06-amplify-stack.ts
│
├── scripts/
│   ├── seed_clean.py                Creates 10 tenants + 40 users
│   └── setup_all_accounts.py        Creates Cognito accounts + seeds training
│
└── docs/
    ├── ERRORS-LOG.md                37 documented bugs with root causes
    ├── ARCHITECTURE.md
    ├── QA-REPORT.md
    └── TEST-GUIDE.md
```

---

## How to Deploy Lambda (Manual — CI/CD pending)

```bash
# Validate syntax first (always)
python -c "import ast; ast.parse(open('main.py').read()); print('OK')"

# Zip and deploy
python -c "import zipfile; zipfile.ZipFile('lambda.zip','w').write('main.py')"
aws lambda update-function-code \
  --function-name endevo-uat-fn-{auth|admin|hr|employee} \
  --zip-file fileb://lambda.zip \
  --region us-east-1
```

## How to Restore v1 If v2 Breaks Something

```bash
# View a file as it was in v1
git show v1.1.0:apps/web/app/(employee)/employee/dashboard/page.tsx

# Restore one file from v1
git checkout v1.1.0 -- apps/web/app/(employee)/employee/dashboard/page.tsx

# See everything that changed since v1
git diff v1.1.0 main

# Restore entire frontend to v1 (nuclear option)
git checkout v1.1.0 -- apps/web/
```

---

## Team

| Person | Role |
|--------|------|
| Shahzad | AWS Architect + QA Lead |
| Niki | Business Owner |
| Zara | QA Tester |
| Nermeen | Full Stack Dev (joins at go-live) |
| Claude | AI Builder — 100% coding |

---

## Versions

| Version | Date | Description |
|---------|------|-------------|
| v1.0.0 | 2026-03-29 | Phase 1 complete — all portals, all features |
| v1.1.0 | 2026-03-30 | UI/UX final — 3 themes, login rebuild, health page real data |
| v2.0.0 | TBD | Phase 2 — LMS 6-week video curriculum |

---

*Built on AWS serverless stack. All infrastructure as code. Zero manual AWS console actions.*
*GitHub: [shahzadms7/endevo-life](https://github.com/shahzadms7/endevo-life)*
