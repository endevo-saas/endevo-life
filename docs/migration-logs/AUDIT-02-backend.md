# Audit: Domain 2 — Backend API Inventory
**Date:** 2026-04-19 | **Auditor:** Autonomous audit session

---

## Lambda Function Inventory

| Function | main.py Lines | cognito_auth | Purpose |
|----------|--------------|--------------|---------|
| endevo-uat-fn-admin | 2,630 | YES | Global admin — tenant/user/subscription/LMS mgmt |
| endevo-uat-fn-auth | 452 | YES | Auth: OTP send/verify, activate, refresh, logout |
| endevo-uat-fn-employee | 1,354 | YES | Employee dashboard, profile, playbook, certs, checklist |
| endevo-uat-fn-hr | 1,015 | YES | HR admin: employees, invites, audit, training |
| endevo-uat-fn-jesse | 2,629 | YES | Jesse AI chat, knowledge base, recommendations |
| endevo-uat-fn-lms | 69 (dispatcher) | YES | LMS: dispatches to 7 route sub-modules |
| cognito-triggers | separate files | N/A | 5 Cognito triggers (define/create/verify challenge, post-confirm, pre-token-gen) |

---

## Lambda Runtime Config

| Function | Memory | Timeout | Runtime | X-Ray | DLQ |
|----------|--------|---------|---------|-------|-----|
| fn-admin | 256 MB | 30s | python3.12 | PassThrough | None |
| fn-auth | 256 MB | 30s | python3.12 | PassThrough | None |
| fn-employee | 256 MB | 30s | python3.12 | PassThrough | None |
| fn-hr | 256 MB | 30s | python3.12 | PassThrough | None |
| fn-jesse | 512 MB | 60s | python3.12 | PassThrough | None |
| fn-lms | 256 MB | 30s | python3.12 | Active | None |

---

## API Route Summary — Admin (~47 routes)

| Method | Path | Auth Guard |
|--------|------|------------|
| GET | /api/admin/dashboard | GLOBAL_ADMIN |
| GET/POST | /api/admin/tenants | GLOBAL_ADMIN |
| GET/PUT/DELETE | /api/admin/tenants/{id} | GLOBAL_ADMIN |
| POST | /api/admin/tenants/{id}/mfa,disable,enable | GLOBAL_ADMIN |
| GET | /api/admin/tenants/export | GLOBAL_ADMIN |
| GET/POST | /api/admin/users | GLOBAL_ADMIN |
| GET/PUT/DELETE | /api/admin/users/{id} | GLOBAL_ADMIN |
| POST | /api/admin/users/{id}/deactivate,reactivate,lock,unlock,reset-password | GLOBAL_ADMIN |
| POST | /api/admin/invite | GLOBAL_ADMIN |
| GET | /api/admin/audit | GLOBAL_ADMIN |
| GET | /api/admin/health | GLOBAL_ADMIN |
| GET/PUT | /api/admin/config | GLOBAL_ADMIN |
| GET | /api/admin/certificates | GLOBAL_ADMIN |
| GET | /api/admin/training-enrollment | GLOBAL_ADMIN |
| GET | /api/admin/subscriptions | GLOBAL_ADMIN |
| GET/POST/PUT | /api/admin/subscriptions/{id},invoice,plan,cancel | GLOBAL_ADMIN |
| GET/PUT | /api/admin/plan-config | GLOBAL_ADMIN |
| GET | /api/admin/metrics/overview | GLOBAL_ADMIN |
| POST | /api/admin/re-engage | GLOBAL_ADMIN |
| POST | /api/admin/tenants/import | GLOBAL_ADMIN |
| GET | /api/admin/system/status | GLOBAL_ADMIN |
| GET | /api/admin/archive/users,tenants | GLOBAL_ADMIN |
| POST | /api/admin/archive/restore | GLOBAL_ADMIN |
| GET | /api/admin/employees/export | GLOBAL_ADMIN |
| GET | /api/admin/knowledge/files | GLOBAL_ADMIN |
| GET/PUT | /api/admin/features | GLOBAL_ADMIN |
| GET | /api/admin/finops | GLOBAL_ADMIN |
| GET | /api/admin/executive-brief | GLOBAL_ADMIN |

## API Route Summary — Auth (7 routes)

| Method | Path | Auth Guard |
|--------|------|------------|
| GET | /api/auth/health | None |
| POST | /api/auth/activate | None |
| GET | /api/auth/me | Bearer JWT |
| POST | /api/auth/send-otp | None |
| POST | /api/auth/verify-otp | Session token |
| POST | /api/auth/refresh | Refresh token |
| POST | /api/auth/logout | Bearer JWT |

## API Route Summary — LMS (~17 routes)

| Method | Path | Auth Guard |
|--------|------|------------|
| GET | /api/lms/assessment/questions | Employee |
| GET | /api/lms/assessment/questions/by-domain | Employee |
| POST | /api/lms/assessment/submit | Employee |
| GET | /api/lms/assessment/status | Employee |
| GET | /api/lms/assessment/history | Employee |
| GET | /api/lms/course/modules | Employee |
| GET | /api/lms/course/modules/{n} | Employee |
| GET | /api/lms/course/video/{id}/url | Employee |
| GET | /api/lms/course/asset/{key}/url | Employee |
| GET | /api/lms/lessons/{moduleNum} | Employee |
| GET | /api/lms/lessons/{moduleNum}/{lessonId} | Employee |
| POST | /api/lms/lessons/{moduleNum}/{lessonId}/complete | Employee |
| POST | /api/lms/quiz/submit | Employee |
| GET | /api/lms/progress/summary | Employee |
| GET | /api/lms/admin/modules | HR_ADMIN/GLOBAL_ADMIN |
| POST/PUT/DELETE | /api/lms/admin/modules/... | HR_ADMIN/GLOBAL_ADMIN |
| GET | /api/lms/admin/users/progress | HR_ADMIN/GLOBAL_ADMIN |

---

## WorkOS Remnants in Backend
- Functional code: **ZERO** ✓
- Comments only in `backend/functions/auth/main.py` lines 16-20 (documenting removed routes)
- `infrastructure/cdk.out/` contains a copy — CDK build artifact, not deployed

---

## Live Endpoint Test (GLOBAL_ADMIN JWT, 2026-04-19T19:52)

| Endpoint | HTTP | Status |
|----------|------|--------|
| GET /api/admin/dashboard | 200 | Working |
| GET /api/admin/features | 200 | Working (P1 fix applied) |
| GET /api/hr/dashboard | 401 | Known gap — no tenantId in GLOBAL_ADMIN JWT |
| GET /api/employee/dashboard | 401 | Known gap — same |
| GET /api/lms/assessment/status | 401 | Known gap — same |
| GET /api/jesse/health | 200 | Working |

**Root cause of HR/Employee/LMS 401:** Cognito pre-token-gen trigger injects `custom:role` but not `custom:tenantId`. HR/employee/LMS gates reject requests with no tenantId. Fix exists in `stash@{0}: wip-global-admin-bypass` — not yet committed.

---

## Issues

| Severity | Issue |
|----------|-------|
| P1 | HR / Employee / LMS return 401 for GLOBAL_ADMIN (stash fix pending) |
| P1 | No DLQ on any of 6 Lambdas — failed invocations silently lost |
| P2 | X-Ray PassThrough on 5/6 functions — tracing not active |
| P2 | /api/admin/system/status consistently >2500ms |
| P2 | fn-admin (2,630 lines) and fn-jesse (2,629 lines) approaching file-size limit |
