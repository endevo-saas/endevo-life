# Endevo Life — Enterprise SaaS Product Vision 2026
> "Software that does the work, not just helps you work."
> Last updated: 2026-03-20

---

## What We Are Building

Endevo Life is an **AI-powered, enterprise-grade Digital Legacy & LMS platform** for Corporate HR teams.
Multi-tenant. Zero-touch AWS infrastructure. Agentic AI. Blockchain-ready.

---

## Module Map (Full Product)

### 1. Core LMS Engine
Inspired by Moodle, Open edX, TalentLMS, Canvas — but cloud-native AWS:

| Feature | Technology |
|---------|-----------|
| Video training library | S3 + CloudFront signed URLs + adaptive HLS |
| Course builder (drag & drop) | No-code via React DnD + DynamoDB |
| SCORM / xAPI compatibility | Lambda parser for imported content |
| Assessments & quizzes | Dynamic question bank, randomisation, time limits |
| Certifications (PDF) | Lambda → WeasyPrint/ReportLab + S3 |
| Learning paths | Prerequisite chains, auto-unlock |
| Discussion forums | DynamoDB + WebSocket (API Gateway) |
| Offline mobile sync | PWA service worker + IndexedDB |
| Live sessions / webinars | Amazon Chime SDK integration |
| Gamification | Points, badges, leaderboards (DynamoDB counters) |

### 2. AI & Agentic Workflows (AWS AI/ML Stack)

| Feature | AWS Service |
|---------|------------|
| AI course content generator | Amazon Bedrock (Claude 3) |
| Personalised learning paths | Amazon Personalize |
| Smart assessment feedback | Bedrock + Lambda |
| Predictive completion forecasting | SageMaker + EventBridge |
| Churn / disengagement risk alerts | SageMaker ML model |
| NLP cognitive search | Amazon Kendra or OpenSearch + Bedrock |
| Voice command / conversational UI | Amazon Lex + Polly |
| Auto-transcription of videos | Amazon Transcribe + Comprehend |
| AI compliance checker | Bedrock agents + audit log scan |
| Agentic HR workflows | Bedrock Agents (auto-invite, remind, escalate) |
| Sentiment analysis (feedback) | Amazon Comprehend |
| Anomaly detection (security) | Amazon GuardDuty + Macie |

### 3. Executive & Analytics Dashboards

Audience: CEO, CFO, CHRO, Compliance Officers, Business Owners

| Dashboard | Data Source | Delivery |
|-----------|------------|---------|
| Workforce completion rates | DynamoDB aggregations | QuickSight Embedded |
| Risk & compliance heatmap | Audit log + SageMaker | QuickSight |
| AI forecast: training ROI | SageMaker predictions | QuickSight |
| ESG carbon + social metrics | Custom metrics table | QuickSight |
| FinOps: cloud spend per tenant | AWS Cost Explorer API | Custom Lambda |
| Tenant health scores | Composite KPI model | Real-time dashboard |
| Certification expiry radar | DynamoDB TTL scan | EventBridge + SES alert |
| Agentic workflow status | Step Functions history | Live feed widget |

### 4. Multi-Tenant Identity & Security

Based on AWS best practices + Zero Trust:

| Feature | Implementation |
|---------|---------------|
| Multi-tenant isolation | DynamoDB tenantId partition key + IAM conditions |
| RBAC (3 roles) | GLOBAL_ADMIN / HR_ADMIN / EMPLOYEE via Cognito custom attributes |
| MFA (TOTP) | Cognito MFA + authenticator app |
| SSO (Google / Azure AD) | Cognito federated identity SAML/OIDC |
| Biometric login (mobile) | WebAuthn / FIDO2 via Cognito hosted UI |
| Zero-Trust per request | Lambda authorizer checks tenantId + role on EVERY request |
| ABAC tagging | IAM tag-based access control per tenant resource |
| Session management | Short-lived JWT (1hr access / 8hr refresh) |
| Audit log (immutable) | DynamoDB endevo-uat-audit + TTL (7yr retention) |
| Threat detection | AWS GuardDuty + automated quarantine via Lambda |
| Data encryption | AES-256 at rest (S3, DynamoDB) + TLS 1.3 in transit |
| Secrets management | AWS Secrets Manager (no env var secrets) |
| WAF | AWS WAF on API Gateway + rate limiting |

### 5. Tenant Administration Portal

HR Admins control 100% of their tenant — no AWS console needed:

- Bulk employee import (CSV/BambooHR/Workday API)
- Seat management + license tracking
- Custom branding per tenant (logo, colours, domain)
- Automated invite + onboarding flows (SES + Bedrock draft)
- Employee groups & cohorts
- Assessment deadline enforcement + automated reminders
- Compliance calendar (GDPR, HIPAA renewal dates)
- Audit log viewer (searchable, exportable)
- FinOps: per-tenant usage cost breakdown

### 6. Global Admin Platform

Endevo internal staff — God-mode management:

- All tenants overview + health scores
- Subscription & billing management (Stripe)
- Feature flag control per tenant
- Impersonation (with full audit trail)
- Infra cost vs revenue per tenant (FinOps)
- AI anomaly alerts (unusual usage, security events)
- Content library management (master video/course repository)

### 7. Employee Experience

Mobile-first. Works offline. Personalised.

- AI-recommended next course
- Progress tracker (visual, gamified)
- Certificate wallet (shareable LinkedIn link)
- Notification centre (push + email + in-app)
- Peer discussion threads
- Personal knowledge graph (what I know, what's next)
- Digital legacy profile (personal estate planning documents — core product)
- Voice-first navigation (Amazon Lex)
- AR/VR training modules (future — Spatial Computing)
- Wearable companion app (Apple Watch / WearOS alerts)

### 8. Integrations Hub (iPaaS Layer)

| System | Integration |
|--------|------------|
| BambooHR | REST API sync (employees, org structure) |
| Workday | SOAP/REST HR data pull |
| Slack | Bot notifications + course reminders |
| Microsoft Teams | Tab app + adaptive cards |
| Stripe | Subscription billing + usage-based pricing |
| Google Workspace SSO | Cognito OIDC federation |
| Azure Active Directory | SAML 2.0 SSO |
| Salesforce | CRM deal → tenant provisioning webhook |
| Zapier / Make | Low-code webhook triggers for HR workflows |
| LinkedIn | Certificate share + profile update |
| DocuSign | Digital will / legacy document signing |

### 9. Compliance-as-Code

Automated. No manual audits needed.

| Standard | Automated Control |
|----------|------------------|
| GDPR | Data minimisation, right-to-delete Lambda, consent log |
| HIPAA | PHI tagging, Macie scan, access log |
| SOC2 Type II | CloudTrail + Config rules + evidence export |
| CCPA | Data subject request API |
| ISO 27001 | Security control matrix auto-report |
| NIST CSF | Framework control mapping in MASTER.md |

### 10. Blockchain & Web3 (Future Phase)

> Planned for Phase 6+ — architecture is ready

| Feature | Technology |
|---------|-----------|
| Immutable certificate NFTs | Ethereum / Polygon ERC-721 |
| On-chain credential verification | Smart contract + IPFS metadata |
| Decentralised identity (DID) | W3C DID + Verifiable Credentials |
| Digital will on-chain | Solidity smart contract + multi-sig |
| DAO governance for platform features | Token-gated voting (future) |

### 11. Mobile Apps (Android + iOS)

| Feature | Tech |
|---------|------|
| React Native (shared codebase) | Expo + Expo Router |
| Offline-first sync | WatermelonDB + S3 sync |
| Biometric auth | Expo LocalAuthentication (Face ID / fingerprint) |
| Push notifications | Amazon SNS + Expo notifications |
| Video streaming | CloudFront HLS + Expo AV |
| AR training overlays | Expo + ViroReact (future) |
| Foldable layout | Responsive breakpoints + multi-window |

---

## Error Handling & Reliability Standards

Every layer has robust error handling — users NEVER see a raw error:

### Frontend (Next.js)
- Global `error.tsx` boundary per route group (Next.js 15 App Router)
- Form-level zod validation with friendly messages
- API error → toast notification with retry button
- Loading skeleton states (no spinners, no blank pages)
- Offline detection → graceful degraded UI

### API Layer (Python FastAPI + Lambda)
- Pydantic model validation on every request
- HTTP status codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 500 (internal)
- All errors return `{ "detail": "human-readable message" }` — never stack traces to client
- Lambda timeout protection: all DynamoDB calls wrapped with try/except
- Dead letter queue (SQS DLQ) for async Lambda failures
- Structured logging (JSON) → CloudWatch → CloudWatch Alarms → SNS alert

### Infrastructure
- API Gateway 429 rate limiting + WAF rules
- DynamoDB ProvisionedThroughputExceededError → exponential backoff in Lambda
- S3 pre-signed URL expiry + graceful re-request
- Cognito token refresh handled transparently in middleware.ts
- CDK Stack error → GitHub Actions notifies via commit status

### Monitoring & Observability
- CloudWatch dashboards per Lambda function
- AWS X-Ray distributed tracing (request ID across all services)
- CloudWatch Alarms → SNS → Slack alert channel
- Error rate threshold: > 1% in 5 min = auto-alert
- SageMaker model drift detection (AI features)

---

## Technology Stack (Complete)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS, Framer Motion |
| Mobile | React Native (Expo), WatermelonDB |
| Backend API | Python 3.12, FastAPI, Mangum, Pydantic v2 |
| Infrastructure | AWS CDK (TypeScript), 6 stacks |
| Database | DynamoDB (OLTP) + Amazon Aurora Serverless v2 (analytics) |
| AI/ML | Amazon Bedrock, Personalize, SageMaker, Comprehend, Kendra |
| Auth | Amazon Cognito, IAM Identity Center, WebAuthn |
| Storage | S3 + CloudFront (CDN + signed URLs) |
| Messaging | SES (email), SNS (push), SQS (async jobs), Chime (video) |
| CI/CD | GitHub Actions → CDK deploy + Amplify build |
| Observability | CloudWatch, X-Ray, GuardDuty, Macie, Security Hub |
| Analytics | Amazon QuickSight (embedded), EventBridge (events) |
| Payments | Stripe (subscriptions + usage billing) |
| Blockchain | Ethereum/Polygon (Phase 6) |

---

## Phases Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | CDK infra: Cognito, DynamoDB, S3, IAM, API Gateway, Amplify | COMPLETE |
| 1 | Auth: login, register, forgot-password, Python Lambda | IN PROGRESS (Build #6) |
| 2 | HR Admin: employee list, invite, bulk import, audit log | PENDING |
| 3 | Employee: video player, assessment, certificates | PENDING |
| 4 | Demo data + end-to-end test + Niki demo URL | PENDING |
| 5 | AI features: Bedrock content gen, Personalize recommendations | PLANNED |
| 6 | Analytics: QuickSight dashboards, SageMaker forecasting | PLANNED |
| 7 | Integrations: BambooHR, Slack, Teams, Stripe billing | PLANNED |
| 8 | Mobile apps: React Native (Android + iOS) | PLANNED |
| 9 | Blockchain: NFT certificates, on-chain digital will | FUTURE |

---

*This document is the single source of truth for product vision.*
*Engineering decisions must align with this vision.*
*Updated by: Claude + Shahzad | 2026-03-20*
