# Endevo Life

**Digital Legacy & Estate Planning SaaS for Corporate HR**

[![Amplify](https://img.shields.io/badge/AWS_Amplify-Live-green)](https://main.d1vgn9nzfx4cxk.amplifyapp.com)
[![Phase](https://img.shields.io/badge/Phase_1-Complete-blue)](docs/ARCHITECTURE.md)
[![QA](https://img.shields.io/badge/QA-98.6%25_Pass-brightgreen)](docs/QA-REPORT.md)

---

## What Is Endevo Life?

Multi-tenant B2B SaaS. Corporate HR teams assign digital legacy & estate planning training to employees. Employees complete courses, pass assessments, earn verifiable certificates.

**Three roles:**

| Role | Access | URL |
|------|--------|-----|
| `GLOBAL_ADMIN` | Platform owner — all tenants, all users, full control | `/admin/*` |
| `HR_ADMIN` | Per-company HR manager — own employees only | `/hr/*` |
| `EMPLOYEE` | Own training, assessments, certificates | `/employee/*` |

---

## Live Environments

| Resource | URL |
|----------|-----|
| Frontend | https://main.d1vgn9nzfx4cxk.amplifyapp.com |
| API Gateway | https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com |
| GitHub Repo | https://github.com/shahzadms7/endevo-life |
| AWS Region | us-east-1 |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS |
| Backend | Python 3.12, pure boto3 — 4 Lambda functions |
| Database | Amazon DynamoDB (8 tables) |
| Auth | Amazon Cognito — JWT, MFA, custom role attributes |
| Email | Amazon SES |
| Hosting | AWS Amplify (auto-deploy on GitHub push) |
| Infrastructure | AWS CDK (TypeScript) |

---

## Repository Structure

```
endevo-life/
├── apps/web/               → Next.js 15 frontend (all 15 pages)
│   ├── app/(auth)/         → login, register, forgot-password
│   ├── app/(global-admin)/ → admin dashboard, tenants, users, audit, health
│   ├── app/(hr-admin)/     → HR dashboard, employees, invite, audit
│   ├── app/(employee)/     → employee dashboard, training, assessment, certificates, profile
│   └── lib/api.ts          → shared API client (typed)
├── backend/functions/
│   ├── auth/main.py        → 7 auth routes
│   ├── admin/main.py       → 16 admin routes (full granular control)
│   ├── hr/main.py          → 6 HR routes
│   └── employee/main.py    → 8 employee routes
├── infrastructure/         → AWS CDK stacks (6 stacks)
├── docs/
│   ├── ARCHITECTURE.md     → Full technical architecture, AWS resources, all routes
│   ├── QA-REPORT.md        → QA test results and findings
│   └── ERRORS-LOG.md       → All bugs, root causes, fixes, lessons learned
└── README.md               → This file
```

---

## Quick Start

```bash
git clone https://github.com/shahzadms7/endevo-life.git
cd endevo-life

# Frontend
npm install -g pnpm
pnpm install
cd apps/web && pnpm dev

# Deploy Lambda (manual)
cd backend/functions/admin
powershell Compress-Archive -Path main.py -DestinationPath fn.zip -Force
aws lambda update-function-code --function-name endevo-uat-fn-admin --zip-file fileb://fn.zip --region us-east-1
```

---

## GitHub Secrets Required

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM deploy user |
| `AWS_SECRET_ACCESS_KEY` | IAM deploy user |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCOUNT_ID` | AWS account number |

---

## Documentation

| File | Contents |
|------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system design, AWS resources, DynamoDB schemas, all Lambda routes, auth flow, IAM policy, product roadmap, key decisions |
| [docs/QA-REPORT.md](docs/QA-REPORT.md) | 69 test results, bug findings, API coverage map, frontend pages verified |
| [docs/ERRORS-LOG.md](docs/ERRORS-LOG.md) | Every bug encountered, root cause, exact fix, lesson learned — permanent record |

---

*Owner: Shahzad | Status: Phase 1 Complete — Paused | Region: us-east-1*
