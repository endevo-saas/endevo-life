# Endevo Life — Master Reference Document
> **Owner:** Shahzad | **Co-pilot:** Claude Sonnet 4.6 | **AWS Account:** 383423735462
> **Region:** us-east-1 | **Environment:** UAT | **Started:** 2026-03-20
> **GitHub:** shahzadms7/endevo-life | **Stack:** Next.js (UI) + Python (API) + AWS CDK (Infra)

---

## AWS Services & Resources

| Service | Resource Name | Purpose | Status |
|---------|--------------|---------|--------|
| Cognito User Pool | `endevo-uat-users` | Auth, MFA, roles | CDK managed |
| Cognito App Client | `endevo-uat-web-client` | Web login | CDK managed |
| DynamoDB | `endevo-uat-tenants` | Organizations | CDK managed |
| DynamoDB | `endevo-uat-users` | All users + GSIs | CDK managed |
| DynamoDB | `endevo-uat-training` | Training videos | CDK managed |
| DynamoDB | `endevo-uat-questions` | Assessment questions | CDK managed |
| DynamoDB | `endevo-uat-responses` | Employee answers | CDK managed |
| DynamoDB | `endevo-uat-certificates` | Issued certificates | CDK managed |
| DynamoDB | `endevo-uat-audit` | Full audit log | CDK managed |
| DynamoDB | `endevo-uat-video-progress` | Watch progress | CDK managed |
| S3 | `endevo-uat-assets` | PDFs, CSV imports | CDK managed |
| S3 | `endevo-uat-videos` | Training video files | CDK managed |
| API Gateway | `endevo-uat-api` | Python Lambda router | CDK managed |
| Lambda | `endevo-uat-fn-auth` | Auth API (Python) | CDK managed |
| Lambda | `endevo-uat-fn-hr` | HR Admin API (Python) | CDK managed |
| Lambda | `endevo-uat-fn-employee` | Employee API (Python) | CDK managed |
| Lambda | `endevo-uat-fn-admin` | Global Admin API (Python) | CDK managed |
| Amplify | `endevo-uat-frontend` | Next.js hosting | CDK managed |
| CloudFront | `endevo-uat-cdn` | Video + asset CDN | CDK managed |
| SES | `endevo-uat-email` | Invite emails | CDK managed |
| IAM Role | `endevo-uat-lambda-role` | Lambda permissions | CDK managed |

---

## GitHub → AWS Pipeline

```
Push to main branch
       ↓
GitHub Actions: deploy-infrastructure.yml
  - npm install CDK deps
  - cdk diff (shows what changes)
  - cdk deploy --all (creates/updates all AWS resources)
       ↓
GitHub Actions: deploy-app.yml
  - Triggers Amplify build via webhook
  - Next.js builds and deploys automatically
       ↓
Live URL: provided by Amplify after first deploy
```

---

## GitHub Secrets (set, never visible)

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | CDK deploy to AWS |
| `AWS_SECRET_ACCESS_KEY` | CDK deploy to AWS |
| `AWS_REGION` | us-east-1 |
| `AWS_ACCOUNT_ID` | 383423735462 |

---

## DynamoDB Table Design

### endevo-uat-tenants
| Attribute | Type | Note |
|-----------|------|------|
| tenantId (PK) | String | UUID |
| name | String | Company name |
| plan | String | free/pro/enterprise |
| createdAt | String | ISO timestamp |
| isActive | Boolean | |

### endevo-uat-users
| Attribute | Type | Note |
|-----------|------|------|
| userId (PK) | String | UUID |
| tenantId | String | GSI: tenantId-index |
| email | String | GSI: email-index |
| inviteToken | String | GSI: inviteToken-index |
| role | String | EMPLOYEE / HR_ADMIN / GLOBAL_ADMIN |
| status | String | invited / active / disabled |
| firstName | String | |
| lastName | String | |
| jobTitle | String | optional |
| department | String | optional |
| inviteExpires | String | ISO timestamp |
| createdAt | String | ISO timestamp |

### endevo-uat-training
| Attribute | Type | Note |
|-----------|------|------|
| tenantId (PK) | String | |
| videoId (SK) | String | UUID |
| title | String | |
| description | String | |
| s3Key | String | path in S3 videos bucket |
| duration | Number | seconds |
| order | Number | display order |
| isActive | Boolean | |
| createdAt | String | |

### endevo-uat-questions
| Attribute | Type | Note |
|-----------|------|------|
| tenantId (PK) | String | |
| questionId (SK) | String | UUID |
| question | String | |
| options | List | ["A","B","C","D"] |
| correctAnswer | Number | index 0-3 |
| points | Number | |
| order | Number | |

### endevo-uat-responses
| Attribute | Type | Note |
|-----------|------|------|
| userId (PK) | String | |
| submittedAt (SK) | String | ISO timestamp |
| tenantId | String | |
| answers | Map | {questionId: answerIndex} |
| score | Number | |
| passed | Boolean | score >= 70 |

### endevo-uat-certificates
| Attribute | Type | Note |
|-----------|------|------|
| userId (PK) | String | |
| issuedAt (SK) | String | ISO timestamp |
| tenantId | String | |
| certificateId | String | UUID |
| pdfS3Key | String | path in assets bucket |
| score | Number | |

### endevo-uat-audit
| Attribute | Type | Note |
|-----------|------|------|
| tenantId (PK) | String | |
| sk (SK) | String | timestamp#eventId |
| userId | String | who did it |
| action | String | LOGIN / INVITE / BULK_IMPORT / etc |
| details | Map | contextual data |

### endevo-uat-video-progress
| Attribute | Type | Note |
|-----------|------|------|
| userId (PK) | String | |
| videoId (SK) | String | |
| position | Number | seconds watched |
| completed | Boolean | |
| completedAt | String | ISO timestamp |

---

## API Routes (Python Lambda)

### Auth — /api/auth/*
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | /api/auth/login | auth/login.py | Cognito InitiateAuth |
| POST | /api/auth/register | auth/register.py | Complete invite registration |
| POST | /api/auth/forgot-password | auth/forgot.py | Cognito ForgotPassword |
| POST | /api/auth/reset-password | auth/reset.py | Cognito ConfirmForgotPassword |
| POST | /api/auth/mfa | auth/mfa.py | Cognito MFA challenge |
| POST | /api/auth/change-password | auth/change.py | Cognito ChangePassword |

### HR Admin — /api/hr/* (requires HR_ADMIN role)
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | /api/hr/stats | hr/stats.py | Dashboard counts |
| GET/POST | /api/hr/employees | hr/employees.py | List / invite |
| POST | /api/hr/imports | hr/imports.py | Process CSV |
| GET | /api/hr/audit | hr/audit.py | Audit log |

### Employee — /api/employee/* (requires EMPLOYEE role)
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | /api/employee/training | employee/training.py | Video list |
| GET | /api/employee/video/{id} | employee/video.py | Signed stream URL |
| POST | /api/employee/video/{id}/progress | employee/progress.py | Save position |
| GET/POST | /api/employee/assessment | employee/assessment.py | Questions + submit |
| GET | /api/employee/certificates | employee/certificates.py | Certificate list |

### Admin — /api/admin/* (requires GLOBAL_ADMIN role)
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | /api/admin/stats | admin/stats.py | System-wide stats |
| GET/POST | /api/admin/tenants | admin/tenants.py | Manage orgs |

---

## Roles & Permissions

| Role | Can Do |
|------|--------|
| GLOBAL_ADMIN | Everything + manage all tenants |
| HR_ADMIN | Manage own tenant employees, training, assessment, audit |
| EMPLOYEE | Own profile, training, assessment, certificates only |

---

## CI/CD Rules (Non-negotiable)
1. All AWS resources created by CDK — never manually
2. All code committed to GitHub before AWS sees it
3. No credentials in code — GitHub Secrets only
4. Every resource tagged: Project=endevo, Environment=uat, ManagedBy=cdk
5. MASTER.md updated after every infrastructure change

---
*Last updated: 2026-03-20 | Next update: after CDK first deploy*

---

## AI/ML Services (Phase 2+)

| Service | Purpose | Lambda | Cost |
|---------|---------|--------|------|
| Amazon Bedrock (Claude) | Smart assessment feedback, chatbot, certificate generation | Python boto3 | Pay per token |
| Amazon Lex | Employee chatbot UI | Integrated with Bedrock | Pay per request |
| Amazon Textract | Extract data from uploaded documents | HR import Lambda | Pay per page |
| Amazon Comprehend | Sentiment analysis on audit events | Admin Lambda | Pay per unit |
| Amazon SageMaker | Custom ML models (Phase 3) | Separate Lambda | Pay per inference |

### How Python connects to Bedrock (3 lines):
```python
import boto3
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
response = bedrock.invoke_model(modelId='anthropic.claude-3-sonnet', body=payload)
```

---

## Security & Privacy Controls (US Compliance)

### Data Minimization (GDPR + CCPA + HIPAA principles)
- Collect ONLY: name, email, job title, department, training progress, assessment scores
- NO SSN, NO health data, NO financial data stored
- All PII encrypted at rest (DynamoDB + S3 AES-256)
- All data in transit encrypted (TLS 1.3)
- Data retention: audit logs TTL 2 years, auto-deleted after

### Authentication Security
| Control | Implementation |
|---------|---------------|
| MFA | TOTP via Cognito (Google Authenticator) |
| Password policy | Min 12 chars, upper+lower+number+symbol |
| Session timeout | 8 hours access token, 30 days refresh |
| Brute force | Cognito built-in lockout |
| Invite expiry | 72 hours, token single-use |

### Access Control
| Control | Implementation |
|---------|---------------|
| Role-based (RBAC) | GLOBAL_ADMIN / HR_ADMIN / EMPLOYEE |
| Tenant isolation | Every DynamoDB query filters by tenantId |
| Least privilege IAM | Lambda role has only required permissions |
| No cross-tenant access | Enforced at API layer in every Python function |

### Compliance Checklist
- [ ] SOC 2 Type II — audit log complete, access controls documented
- [ ] GDPR — data minimization, right to delete (soft delete + TTL)
- [ ] CCPA — California data privacy, opt-out support
- [ ] NIST Cybersecurity Framework — identify, protect, detect, respond, recover

---

## Third-Party & API Integrations (Planned)

### HR System Integrations
| System | Integration Type | Status |
|--------|----------------|--------|
| BambooHR | REST API — sync employees | Phase 3 |
| Workday | REST API — sync org structure | Phase 3 |
| ADP | REST API — payroll sync | Phase 4 |
| SAP SuccessFactors | REST API | Phase 4 |

### Communication
| System | Purpose | Status |
|--------|---------|--------|
| Slack | Notify HR when employee completes training | Phase 2 |
| Microsoft Teams | Same as Slack | Phase 2 |
| SendGrid | Fallback email (if SES unavailable) | Phase 2 |
| Twilio | SMS notifications (MFA + reminders) | Phase 3 |

### SSO / Identity
| System | Purpose | Status |
|--------|---------|--------|
| Google Workspace | SSO via Cognito federation | Phase 2 |
| Microsoft Azure AD | SSO for enterprise clients | Phase 2 |
| Okta | Enterprise SSO | Phase 3 |
| SAML 2.0 | Generic SSO standard | Phase 3 |

### Payment
| System | Purpose | Status |
|--------|---------|--------|
| Stripe | Subscription billing, invoices | Phase 2 |

### AI / External APIs
| System | Purpose | Status |
|--------|---------|--------|
| OpenAI / Anthropic | Smart assessment + chatbot | Phase 2 |
| AWS Bedrock | Native Claude/Titan models | Phase 2 |
| Google Analytics | Usage analytics | Phase 1 |

### How integrations are built
- Each integration = separate Python Lambda function
- Credentials stored in AWS SSM Parameter Store (encrypted)
- Never hardcoded, never in GitHub
- Webhook endpoints via API Gateway
- OAuth tokens rotated automatically


---

## Phase 0 — COMPLETED 2026-03-20 ✅

### Live Resource IDs (CDK deployed — do not edit manually)

| Resource | ID / URL |
|----------|---------|
| Cognito User Pool | `us-east-1_DVyEJqgFt` |
| Cognito App Client | `4sbv2j6cv7jpp1oi0d16njsej1` |
| API Gateway URL | `https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com/` |
| Amplify App ID | `d1vgn9nzfx4cxk` |
| Amplify Live URL | `https://main.d1vgn9nzfx4cxk.amplifyapp.com` |
| S3 Assets Bucket | `endevo-uat-assets` |
| S3 Videos Bucket | `endevo-uat-videos` |
| Lambda Auth | `endevo-uat-fn-auth` |
| Lambda HR | `endevo-uat-fn-hr` |
| Lambda Employee | `endevo-uat-fn-employee` |
| Lambda Admin | `endevo-uat-fn-admin` |

### GitHub Actions Runs — Phase 0
| Run | Result | Issue Fixed |
|-----|--------|------------|
| #1 | FAILED | `totp` → `otp` in Cognito MFA config |
| #2 | FAILED | CDK token used as CfnOutput construct ID |
| #3 | FAILED | EndevoUatAmplify stack stuck in REVIEW_IN_PROGRESS |
| #4 | **SUCCESS** | All 6 stacks CREATE_COMPLETE |

---

## Phase 1 — IN PROGRESS (next)

### Deliverables
- [ ] Python auth Lambda — login, register, MFA, forgot password
- [ ] Next.js frontend — login page, register page, forgot password
- [ ] Cognito integration — token handling in frontend
- [ ] Protected routes middleware
- [ ] First admin user seeded

