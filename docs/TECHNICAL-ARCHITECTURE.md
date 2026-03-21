# Endevo Life — Technical Architecture

> **Status:** Phase 1 Complete | Phase 2+ Pending
> **Last Updated:** 2026-03-21
> **Author:** Shahzad (architect) + Claude AI (implementation partner)

---

## 1. System Overview

Endevo Life is a multi-tenant B2B SaaS platform for corporate HR teams. Companies (tenants) use it to assign digital legacy & estate planning training to their employees, track completion, and issue certificates.

**Three user roles:**
| Role | Access | Description |
|------|--------|-------------|
| `GLOBAL_ADMIN` | `/admin/*` | Platform owner — manages all tenants, all users, system health |
| `HR_ADMIN` | `/hr/*` | Per-tenant HR manager — invites/manages own employees |
| `EMPLOYEE` | `/employee/*` | Takes training, assessments, earns certificates |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  USERS (Browser)                     │
│         https://main.d1vgn9nzfx4cxk.amplifyapp.com  │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────┐
│              AWS Amplify (Hosting)                   │
│         Next.js 15 App Router (SSR + CSR)            │
│  Route groups: (auth) (global-admin) (hr-admin)      │
│                (employee)                            │
└───────────────────────┬─────────────────────────────┘
                        │ fetch() API calls
┌───────────────────────▼─────────────────────────────┐
│         Amazon API Gateway (HTTP API)                │
│   https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com
│   Routes:                                           │
│     /api/auth/*    → endevo-uat-fn-auth             │
│     /api/admin/*   → endevo-uat-fn-admin            │
│     /api/hr/*      → endevo-uat-fn-hr               │
│     /api/employee/* → endevo-uat-fn-employee        │
└──────┬──────────┬──────────┬────────────┬───────────┘
       │          │          │            │
   fn-auth    fn-admin    fn-hr      fn-employee
       │          │          │            │
┌──────▼──────────▼──────────▼────────────▼───────────┐
│              Amazon DynamoDB (8 Tables)              │
└─────────────────────────────────────────────────────┘
       │
┌──────▼────────────────────┐
│  Amazon Cognito User Pool  │
│  (us-east-1_DVyEJqgFt)    │
└───────────────────────────┘
```

---

## 3. AWS Services & Configuration

| Service | Resource Name | Purpose | Region |
|---------|--------------|---------|--------|
| **Amplify** | `endevo-uat-app` (ID: `d1vgn9nzfx4cxk`) | Next.js hosting + CI/CD | us-east-1 |
| **API Gateway** | HTTP API | Single entry point for all Lambda | us-east-1 |
| **Lambda** | `endevo-uat-fn-auth` | Auth flows | us-east-1 |
| **Lambda** | `endevo-uat-fn-admin` | Global admin operations | us-east-1 |
| **Lambda** | `endevo-uat-fn-hr` | HR admin operations | us-east-1 |
| **Lambda** | `endevo-uat-fn-employee` | Employee operations | us-east-1 |
| **Cognito** | `endevo-uat-pool` (Pool: `us-east-1_DVyEJqgFt`, Client: `4sbv2j6cv7jpp1oi0d16njsej1`) | User authentication + JWT | us-east-1 |
| **DynamoDB** | 8 tables (see below) | All application data | us-east-1 |
| **SES** | Verified domain | Invite emails | us-east-1 |
| **IAM** | `endevo-uat-lambda-role` | Lambda execution role | Global |

---

## 4. DynamoDB Table Schemas

> **Critical:** Composite keys require ALL key attributes in every `put_item`. Missing range key = silent `ValidationException`.

| Table | Hash Key | Range Key | Purpose |
|-------|----------|-----------|---------|
| `endevo-uat-tenants` | `tenantId` | — | Tenant accounts |
| `endevo-uat-users` | `userId` | — | All users |
| `endevo-uat-training` | `tenantId` | `videoId` | Courses per tenant |
| `endevo-uat-questions` | `tenantId` | `questionId` | Assessment questions |
| `endevo-uat-responses` | `userId` | `submittedAt` | Assessment submissions |
| `endevo-uat-certificates` | `userId` | `issuedAt` | Completion certificates |
| `endevo-uat-video-progress` | `userId` | `videoId` | Course progress tracking |
| `endevo-uat-audit` | `tenantId` | `sk` | Audit trail (`sk = "{timestamp}#{uuid}"`) |

### Seeded Data (as of 2026-03-21)
| Table | Count | Contents |
|-------|-------|----------|
| tenants | 4 | Acme Corp, TechVision, GlobalHR, tenant-6a727c72 |
| users | 34 | 33 seeded + 1 QA invite |
| training | 8 | 2 courses × 4 tenants |
| questions | 40 | 5 questions × 2 courses × 4 tenants |
| audit | 2+ | Growing as actions taken |

---

## 5. Lambda Functions — Route Map

### `endevo-uat-fn-auth`
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Cognito `initiate_auth`, returns JWT |
| POST | `/api/auth/register` | Validate invite token, create account |
| GET | `/api/auth/me` | Returns caller profile |
| POST | `/api/auth/forgot-password` | Sends Cognito reset code |
| POST | `/api/auth/reset-password` | Confirms reset with code |
| POST | `/api/auth/change-password` | Logged-in user changes password |
| POST | `/api/auth/mfa` | MFA verification |

### `endevo-uat-fn-admin` (GLOBAL_ADMIN only)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/dashboard` | Platform-wide stats |
| GET | `/api/admin/tenants` | All tenants with user counts |
| POST | `/api/admin/tenants` | Create tenant |
| GET | `/api/admin/tenants/{id}` | Tenant detail + users + stats |
| PUT | `/api/admin/tenants/{id}` | Update tenant (name/plan/status/maxSeats) |
| DELETE | `/api/admin/tenants/{id}` | Soft delete tenant |
| GET | `/api/admin/users` | All users (optional `?tenantId=` filter) |
| POST | `/api/admin/users` | Create GLOBAL_ADMIN / HR_ADMIN / EMPLOYEE |
| GET | `/api/admin/users/{id}` | Single user detail |
| PUT | `/api/admin/users/{id}` | Update user + sync role to Cognito |
| DELETE | `/api/admin/users/{id}` | Hard delete (Cognito + DynamoDB) |
| POST | `/api/admin/users/{id}/lock` | Disable user in Cognito |
| POST | `/api/admin/users/{id}/unlock` | Enable user in Cognito |
| POST | `/api/admin/users/{id}/reset-password` | Generate + set new password |
| GET | `/api/admin/audit` | Global audit log (all tenants) |
| GET | `/api/admin/health` | Live probe: DynamoDB + Cognito status |

### `endevo-uat-fn-hr` (HR_ADMIN only — own tenant)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/hr/dashboard` | Tenant stats |
| GET | `/api/hr/employees` | Tenant employees only |
| POST | `/api/hr/invite` | Create invite, send email via SES |
| PUT | `/api/hr/employees/{id}` | Update employee |
| DELETE | `/api/hr/employees/{id}` | Deactivate employee |
| GET | `/api/hr/audit` | Tenant-scoped audit log |

### `endevo-uat-fn-employee` (EMPLOYEE only — own data)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/employee/dashboard` | Progress stats |
| GET | `/api/employee/profile` | Own profile |
| PUT | `/api/employee/profile` | Update name/title/dept |
| GET | `/api/employee/training` | Courses with progress % |
| POST | `/api/employee/progress` | Save video progress |
| GET | `/api/employee/assessment/{courseId}` | Questions (no correct answers) |
| POST | `/api/employee/assessment/{courseId}/submit` | Score, issue cert if ≥70% |
| GET | `/api/employee/certificates` | Earned certificates |

---

## 6. Frontend Architecture

### Stack
- **Framework:** Next.js 15 App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Forms:** react-hook-form + Zod validation
- **Auth state:** `js-cookie` (`access_token`, `user_role` cookies)
- **Package manager:** pnpm (monorepo with Turborepo)
- **Hosting:** AWS Amplify (auto-deploys on push to `main`)

### Route Groups
```
apps/web/app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── forgot-password/page.tsx
├── (global-admin)/
│   ├── layout.tsx              ← sidebar nav
│   └── admin/
│       ├── dashboard/page.tsx
│       ├── tenants/page.tsx
│       ├── tenants/[id]/page.tsx   ← PENDING BUILD
│       ├── users/page.tsx
│       ├── audit/page.tsx
│       └── health/page.tsx
├── (hr-admin)/
│   ├── layout.tsx
│   └── hr/
│       ├── dashboard/page.tsx
│       ├── employees/page.tsx
│       ├── invite/page.tsx
│       └── audit/page.tsx
└── (employee)/
    ├── layout.tsx
    └── employee/
        ├── dashboard/page.tsx
        ├── training/page.tsx
        ├── assessment/page.tsx
        ├── assessment/[courseId]/page.tsx
        ├── certificates/page.tsx
        └── profile/page.tsx
```

### Shared API Client
`apps/web/lib/api.ts` — all API calls, TypeScript interfaces, auth headers injection.

---

## 7. Authentication Flow

```
User enters email + password
        ↓
POST /api/auth/login
        ↓
Lambda calls Cognito initiate_auth()
        ↓
Cognito returns AccessToken + IdToken
        ↓
Lambda decodes JWT → extracts custom:role, custom:tenantId
        ↓
Response: { access_token, role, tenant_id, email }
        ↓
Frontend stores in js-cookie (access_token, user_role)
        ↓
Redirects to role-based dashboard:
  GLOBAL_ADMIN → /admin/dashboard
  HR_ADMIN     → /hr/dashboard
  EMPLOYEE     → /employee/dashboard
```

### RBAC Enforcement
Every Lambda call:
1. Extracts `Authorization: Bearer <token>` header
2. Calls `cognito.get_user(AccessToken=token)` to verify + get attributes
3. Checks `custom:role` against required role
4. Returns 401 if not authenticated, 403 if wrong role

---

## 8. Multi-Tenant Isolation

All data queries include `tenantId` filter. Rules:
- **GLOBAL_ADMIN**: can see all tenants' data
- **HR_ADMIN**: can only see own `tenantId` data — enforced in Lambda via `custom:tenantId` from JWT
- **EMPLOYEE**: can only see own `userId` data + own `tenantId` training content

Verified in QA: 0 cross-tenant data leaks across all roles.

---

## 9. IAM Policy — Lambda Role

**Role:** `endevo-uat-lambda-role`

**Permissions granted:**
```json
{
  "dynamodb": ["PutItem", "GetItem", "UpdateItem", "DeleteItem", "Scan", "Query"],
  "cognito-idp": [
    "GetUser", "AdminCreateUser", "AdminSetUserPassword",
    "AdminDeleteUser", "AdminDisableUser", "AdminEnableUser",
    "AdminUpdateUserAttributes", "AdminInitiateAuth",
    "AdminRespondToAuthChallenge", "InitiateAuth",
    "ForgotPassword", "ConfirmForgotPassword",
    "DescribeUserPool", "ListUsers"
  ],
  "ses": ["SendEmail", "SendRawEmail"],
  "logs": ["CreateLogGroup", "CreateLogStream", "PutLogEvents"]
}
```

---

## 10. CI/CD Pipeline

```
Developer pushes to GitHub (shahzadms7/endevo-life)
        ↓
AWS Amplify detects push to 'main' branch
        ↓
amplify.yml runs:
  preBuild: pnpm install --no-frozen-lockfile
  build:    cd apps/web && pnpm build
  artifacts: .next
        ↓
Amplify deploys to CDN edge
        ↓
Live at: https://main.d1vgn9nzfx4cxk.amplifyapp.com
```

Lambda deployments are manual (AWS CLI `update-function-code`) until GitHub Actions workflow is added in Phase 2.

---

## 11. Test Credentials (UAT Only)

| Role | Email | Password |
|------|-------|----------|
| GLOBAL_ADMIN | admin@endevo.com | Admin@2026! |
| HR_ADMIN (Acme) | hr@acme.com | HRAdmin@2026! |
| HR_ADMIN (TechVision) | hr@techvision.com | HRAdmin@2026! |
| EMPLOYEE (Acme) | ava.anderson@acme.com | Employee@2026! |

---

## 12. Pending Work (Phase 2+)

| Item | Priority | Description |
|------|----------|-------------|
| Admin Tenant Detail page | HIGH | `/admin/tenants/[id]` — drill into tenant, see HR admins + employees, manage plan |
| Admin Users page — full | HIGH | Create user modal, lock/unlock/delete/reset-password buttons |
| Subscription/Plan management | MEDIUM | Plan tiers: Starter/Professional/Enterprise with maxSeats + billing cycle |
| HR Admin enhancements | MEDIUM | View employee progress + certificates from HR dashboard |
| Lambda CI/CD | LOW | GitHub Actions workflow to auto-deploy Lambdas on push |
| Domain | LOW | Register endevol ife.com on Route 53, connect to Amplify |
| Fix Issue #013 | LOW | `PUT /api/admin/tenants/{fake-id}` returns 200 — add `get_item` pre-check |

---

## 13. Known Issues

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| KNOWN-001 | LOW | PUT /api/admin/tenants/{fake-id} returns 200 (DynamoDB upsert) | Open |
| KNOWN-002 | LOW | Double-submit assessment may produce duplicate cert with same issuedAt | Open |
| KNOWN-004 | INFO | SES in sandbox — invite emails may go to spam | Expected |

---

## 14. Key Decisions & Why

| Decision | Rationale |
|----------|-----------|
| **Pure boto3 (no pip)** | Lambda deployment is a single `main.py` file — no zip dependency layers needed. Faster iteration. |
| **DynamoDB over RDS** | Serverless, no connection pooling issues, scales automatically, cheaper at low volume |
| **Cognito custom attributes** | `custom:role` and `custom:tenantId` embedded in JWT — no extra DB lookup per request |
| **HTTP API Gateway** | Cheaper and faster than REST API Gateway for simple Lambda proxy routing |
| **Next.js 15 App Router** | Route groups enable clean per-role layouts without shared state bleeding |
| **js-cookie for tokens** | Simpler than httpOnly cookies for SPA; acceptable for UAT phase |
| **Amplify for hosting** | Zero DevOps — GitHub push → live site, built-in SSL, CDN, no Docker needed |

---

*Document maintained by the engineering team. Update with every architecture change.*
