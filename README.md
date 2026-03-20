# Endevo Life

**Digital Legacy & Estate Planning SaaS for Corporate HR**

[![Deploy Infrastructure](https://github.com/shahzadms7/endevo-life/actions/workflows/deploy-infrastructure.yml/badge.svg)](https://github.com/shahzadms7/endevo-life/actions/workflows/deploy-infrastructure.yml)
[![Deploy App](https://github.com/shahzadms7/endevo-life/actions/workflows/deploy-app.yml/badge.svg)](https://github.com/shahzadms7/endevo-life/actions/workflows/deploy-app.yml)

---

## What is Endevo Life?

A multi-tenant SaaS platform that helps corporate HR teams manage employee training, assessment, and digital legacy planning. Employees complete training videos, pass assessments, and receive verifiable certificates.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (TypeScript) — hosted on AWS Amplify |
| Backend API | Python FastAPI on AWS Lambda |
| Database | Amazon DynamoDB |
| Auth | Amazon Cognito (MFA enabled) |
| Storage | Amazon S3 |
| CDN | Amazon CloudFront |
| Email | Amazon SES |
| Infrastructure | AWS CDK (TypeScript) |
| CI/CD | GitHub Actions → AWS |

---

## Roles

| Role | Access |
|------|--------|
| `GLOBAL_ADMIN` | Manage all tenants, system-wide |
| `HR_ADMIN` | Manage own org employees, training, assessment |
| `EMPLOYEE` | Own training, assessment, certificates only |

---

## Repository Structure

```
endevo-life/
├── .github/workflows/          # CI/CD pipelines
│   ├── deploy-infrastructure.yml
│   └── deploy-app.yml
├── infrastructure/             # AWS CDK — all AWS in code
│   ├── bin/app.ts              # CDK entry point
│   └── lib/
│       ├── 01-cognito-stack.ts
│       ├── 02-dynamo-stack.ts
│       ├── 03-s3-stack.ts
│       ├── 04-iam-stack.ts
│       ├── 05-api-stack.ts
│       └── 06-amplify-stack.ts
├── backend/                    # Python Lambda functions
│   └── functions/
│       ├── auth/               # login, register, MFA
│       ├── hr/                 # employees, invite, import
│       ├── employee/           # training, assessment, certs
│       └── admin/              # tenant management
├── apps/
│   └── web/                    # Next.js frontend
├── MASTER.md                   # Full AWS architecture reference
└── README.md                   # This file
```

---

## Quick Start (for developers)

```bash
# Clone
git clone https://github.com/shahzadms7/endevo-life.git
cd endevo-life

# Install frontend deps
npm install -g pnpm
pnpm install

# Install CDK deps
cd infrastructure && npm install

# Deploy infrastructure (requires AWS credentials)
cd infrastructure && npm run deploy
```

---

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user for deployments |
| `AWS_SECRET_ACCESS_KEY` | IAM user for deployments |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCOUNT_ID` | AWS account number |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions |

---

## Documentation

- [MASTER.md](./MASTER.md) — Full AWS architecture, all resources, all parameters
- [docs/API.md](./docs/API.md) — All API endpoints
- [docs/RUNBOOK.md](./docs/RUNBOOK.md) — Operations guide

---

*Owner: Shahzad | Environment: UAT | Region: us-east-1*
