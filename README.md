# Endevo Life

**Digital Legacy & Estate Planning SaaS for Corporate HR**

[![Live](https://img.shields.io/badge/Live-UAT-green)](https://main.d1vgn9nzfx4cxk.amplifyapp.com)
[![API](https://img.shields.io/badge/API-Lambda-orange)](https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com)
[![Stack](https://img.shields.io/badge/Stack-AWS_Serverless-yellow)](docs/ARCHITECTURE.md)
[![Phase](https://img.shields.io/badge/Phase-1_Complete-blue)](docs/QA-REPORT.md)

---

## Live URLs

| Environment | URL |
|-------------|-----|
| **Web App** | https://main.d1vgn9nzfx4cxk.amplifyapp.com |
| **API Gateway** | https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com |
| **Region** | AWS us-east-1 |

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Global Admin | `khak.pa@gmail.com` | your password + email OTP |
| HR Admin | `hr@technovasolutions.io` | `Endevo@Test2026!` |
| Employee | `ethan.brooks@technovasolutions.io` | `Endevo@Test2026!` |

---

## What Is Endevo Life?

Multi-tenant B2B SaaS platform. Corporate HR teams onboard employees onto Digital Legacy & Estate Planning training. Employees complete 6-week LMS courses, pass assessments, and earn verifiable certificates.

**Business Model:** $10,000 setup + $10/seat/month

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ENDEVO LIFE                             │
│                   AWS Serverless Architecture                    │
└─────────────────────────────────────────────────────────────────┘

  Browser (Next.js 15)
       │
       │  HTTPS
       ▼
  ┌─────────────┐     ┌──────────────────┐
  │   AWS        │     │  AWS Cognito      │
  │   Amplify    │────▶│  User Pool        │
  │  (Hosting)   │     │  JWT Auth + MFA   │
  └─────────────┘     └──────────────────┘
       │
       │  REST API (JWT Bearer)
       ▼
  ┌─────────────────────────────┐
  │     API Gateway (HTTP API)  │
  │   4jms6sdzk9.execute-api    │
  └──────┬──────┬───────┬──────┘
         │      │       │
    ┌────▼┐  ┌──▼──┐  ┌─▼──────┐  ┌──────────┐
    │Auth │  │Admin│  │  HR   │  │ Employee │
    │ λ  │  │  λ  │  │   λ   │  │    λ     │
    └────┘  └─────┘  └───────┘  └──────────┘
         │      │       │             │
         └──────┴───────┴─────────────┘
                        │
              ┌──────────────────┐
              │    DynamoDB       │
              │  9 Tables (PAY)   │
              └──────────────────┘
                        │
              ┌──────────────────┐
              │   S3 Buckets      │
              │  Assets + Videos  │
              └──────────────────┘
```

### AWS Resources

| Service | Resource | Purpose |
|---------|----------|---------|
| Amplify | `d1vgn9nzfx4cxk` | Next.js hosting + CI/CD |
| Cognito | `endevo-uat-user-pool` | Authentication + JWT |
| API Gateway | `endevo-uat-api` | HTTP API routing |
| Lambda | `endevo-uat-fn-auth` | Auth routes (7) |
| Lambda | `endevo-uat-fn-admin` | Global admin routes (20+) |
| Lambda | `endevo-uat-fn-hr` | HR admin routes (10) |
| Lambda | `endevo-uat-fn-employee` | Employee routes (8) |
| DynamoDB | `endevo-uat-tenants` | Tenant organisations |
| DynamoDB | `endevo-uat-users` | All users (all roles) |
| DynamoDB | `endevo-uat-training` | Training courses |
| DynamoDB | `endevo-uat-questions` | Assessment questions |
| DynamoDB | `endevo-uat-responses` | Assessment submissions |
| DynamoDB | `endevo-uat-certificates` | Issued certificates |
| DynamoDB | `endevo-uat-audit` | Security audit log |
| DynamoDB | `endevo-uat-video-progress` | Video watch progress |
| DynamoDB | `endevo-uat-config` | Platform configuration |
| S3 | `endevo-uat-assets` | Images + documents |
| S3 | `endevo-uat-videos` | Training videos |
| IAM | `endevo-uat-lambda-role` | Lambda execution role |

---

## Three Portals — How They Work

### Portal 1: Global Admin (`/admin/*`)

**Who:** Platform owner (Endevo Life staff). One per platform.

**Login:** Email + Password + Math CAPTCHA + **Email OTP** (security enforced)

**Full Control:**

```
Dashboard → Platform metrics (all tenants, all users, system health)
     │
     ├── Tenants → Create / Edit / Disable / Re-enable / View Detail
     │     └── Tenant Dashboard → HR Admins + Employees + Training (per tenant)
     │
     ├── All Users → Create / Edit / Lock / Unlock / Reset PW / Deactivate
     │
     ├── Subscriptions → Plan management + MRR + Suspend/Activate per tenant
     │
     ├── Certificates → All certs platform-wide + grades + CSV export
     │
     ├── Audit Log → Every action by every user across all tenants
     │
     ├── System Health → AWS service status (DynamoDB, Cognito, SES, Lambda)
     │
     └── Settings → Platform config (pricing, security policy, notifications, OTP)
```

**Business Rules:**
- Global Admin belongs to `SYSTEM` tenant — not any real org
- One email = one role globally (enforced at API level)
- Tenants cannot be deleted — only disabled/enabled
- Disabling a tenant immediately blocks all its users
- `tenant-00001` format IDs — sequential, consistent

---

### Portal 2: HR Admin (`/hr/*`)

**Who:** One HR administrator per tenant organisation. Manages their company's employees only.

**Login:** Email + Password + Math CAPTCHA (no OTP — direct login)

**Full Control Within Own Tenant:**

```
Dashboard → Team KPIs (employees, active, pending, engagement)
     │
     ├── Employees → Edit / Lock / Unlock / Reset PW / Deactivate / Reactivate
     │               + CSV export of filtered view
     │
     ├── Invite Employee → Creates Cognito account + sends branded welcome email
     │
     ├── Training & Courses → Enrollment rate + completion rate per course
     │                         + who started / not started + CSV export
     │
     ├── Certificates → All certs earned by team + grades + CSV export
     │
     ├── Subscription → Current plan + seat usage + org details (read-only)
     │
     ├── Audit Log → All actions within own tenant only
     │
     └── Settings → Change password
```

**Security Guarantee:**
- JWT `custom:tenantId` extracted on every API call
- Every DynamoDB query filtered by `tenantId` — zero cross-tenant data possible
- HR Admin cannot call `/api/admin/*` endpoints (403 returned)

---

### Portal 3: Employee (`/employee/*`)

**Who:** Individual employees assigned by their company's HR admin.

**Login:** Email + Password + Math CAPTCHA (no OTP)

**Learning Journey:**

```
Dashboard → XP level bar + courses completed + certificates earned
     │
     ├── Training → Course list + video player + progress bar per course
     │               Week-locked: Week 2 unlocks only after Week 1 complete
     │
     ├── Assessment → Multi-choice questions + auto-scored
     │                Certificate issued automatically on 70%+ pass
     │
     ├── Certificates → All earned certs + scores + download
     │
     ├── Profile → Edit name, department, job title
     │
     └── Settings → Change password
```

---

## Login Security Flow

```
All Roles:
  [1] Enter email + password
  [2] Solve math CAPTCHA (prevents bots)
  [3a] GLOBAL_ADMIN → 6-digit OTP emailed → enter code → access
  [3b] HR_ADMIN / EMPLOYEE → direct access after CAPTCHA

Brute-force protection:
  - 5 failed attempts → IP locked for 15 minutes
  - Every login attempt logged to audit table with IP + device
  - OTP expires in 10 minutes, single-use
```

---

## Tenant Lifecycle

```
Global Admin creates tenant
    │
    ├── Enters: org name, HR admin name + email, plan, seat limit
    │
    ├── System automatically:
    │     ├── Creates tenant record (tenant-00001 format)
    │     ├── Creates HR admin Cognito account
    │     ├── Sets temp password
    │     └── Sends branded welcome email to HR admin
    │
    └── HR admin logs in → invites employees → employees complete training
```

---

## Subscription Plans

| Plan | Monthly | Seats | Status |
|------|---------|-------|--------|
| Trial | Free | 10 | 14-day free trial |
| Starter | $249 | 25 | Active |
| Professional | $599 | 100 | Active |
| Enterprise | $1,499 | 500 | Active |
| Enterprise Plus | Custom | Unlimited | Active |

All prices configurable from Global Admin → Settings → Pricing (stored in `endevo-uat-config` table).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Lucide Icons |
| Auth | AWS Cognito (User Pools, JWT, TOTP MFA) |
| Backend | Python 3.12 Lambda (pure boto3, no pip) |
| Database | DynamoDB (PAY_PER_REQUEST, PITR enabled) |
| Storage | S3 (assets + videos) |
| Email | AWS SES (domain verified: endevo.life) |
| Hosting | AWS Amplify (CI/CD from GitHub main branch) |
| Infrastructure | AWS CDK (TypeScript, 6 stacks) |
| CI/CD | GitHub Actions (3 workflows) |

---

## Project Structure

```
endevo-life/
├── apps/web/                   Next.js 15 frontend
│   ├── app/(auth)/             Login, register, forgot-password
│   ├── app/(global-admin)/     /admin/* — Global Admin portal
│   ├── app/(hr-admin)/         /hr/* — HR Admin portal
│   ├── app/(employee)/         /employee/* — Employee portal
│   └── lib/                    api.ts, auth, export utilities
│
├── backend/functions/
│   ├── auth/main.py            Login, OTP, register, password routes
│   ├── admin/main.py           Global admin routes (tenants, users, config)
│   ├── hr/main.py              HR admin routes (employees, training, certs)
│   └── employee/main.py        Employee routes (training, assessment, certs)
│
├── infrastructure/lib/
│   ├── 01-cognito-stack.ts     User Pool + App Client
│   ├── 02-dynamo-stack.ts      All 9 DynamoDB tables
│   ├── 03-s3-stack.ts          Assets + Videos buckets
│   ├── 04-iam-stack.ts         Lambda execution role
│   ├── 05-api-stack.ts         API Gateway + Lambda integrations
│   └── 06-amplify-stack.ts     Amplify hosting
│
├── scripts/
│   ├── seed_clean.py           Creates 10 tenants + 40 users
│   └── setup_all_accounts.py  Creates Cognito accounts + seeds training
│
└── docs/
    ├── ARCHITECTURE.md
    ├── QA-REPORT.md
    ├── TEST-GUIDE.md
    └── ERRORS-LOG.md
```

---

## Seed Data (UAT)

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

All HR admin and employee accounts: password `Endevo@Test2026!`

---

## What's Built (Phase 1 — Complete)

- [x] Authentication (login, OTP, CAPTCHA, MFA, register, forgot/reset password)
- [x] Global Admin portal — full platform control
- [x] HR Admin portal — tenant-scoped, full replica of global admin
- [x] Employee portal — training, assessment, certificates, profile
- [x] Multi-tenant isolation — JWT-enforced, zero cross-tenant data
- [x] Email OTP for Global Admin login
- [x] Brute-force protection
- [x] Error boundaries on all portals
- [x] CSV export on all data tables
- [x] Platform config (pricing, security, notifications) via DynamoDB
- [x] Enable/Disable tenants and users (no hard delete)
- [x] Automatic HR admin creation on tenant signup
- [x] Branded welcome emails via SES

## What's Next (Phase 2 — LMS)

- [ ] 6-week video LMS — week-locked progression
- [ ] Video upload to S3 + CloudFront CDN
- [ ] Per-employee per-week progress tracking
- [ ] HR admin training management (upload courses, assign to employees)
- [ ] Certificate PDF generator
- [ ] DNS cutover: `uat.endevo.life` → Amplify
- [ ] Stripe billing integration

---

## Known Issues

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| KNOWN-001 | LOW | `PUT /api/admin/tenants/{fake-id}` returns 200 (DynamoDB upsert) | Open |
| KNOWN-002 | INFO | SES sandbox — emails only to verified addresses | Pending production access |

---

## Development

### Deploy Lambda (manual)

```bash
# From backend/functions/{name}/
python -c "
import zipfile
with zipfile.ZipFile('lambda.zip','w',zipfile.ZIP_DEFLATED) as z: z.write('main.py')
"
aws lambda update-function-code \
  --function-name endevo-uat-fn-{name} \
  --zip-file fileb://lambda.zip \
  --region us-east-1
```

### Validate Lambda before deploy

```bash
python -c "import ast; ast.parse(open('main.py').read()); print('SYNTAX OK')"
```

### Run seed scripts

```bash
C:/Python314/python.exe scripts/seed_clean.py
C:/Python314/python.exe scripts/setup_all_accounts.py
```

### Frontend (local dev)

```bash
cd apps/web
npm install
npm run dev
# Runs on http://localhost:3000
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

*Built with AWS serverless stack. All infrastructure defined as code. No manual AWS console actions.*
