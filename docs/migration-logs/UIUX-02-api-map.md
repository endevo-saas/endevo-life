# UIUX-02 — API Endpoint Map
**Date:** 2026-04-19 | **Method:** Static analysis of backend/functions/*/main.py

## AUTH Lambda (endevo-uat-fn-auth)
| Method | Path | Role Guard | Notes |
|--------|------|------------|-------|
| GET | /api/auth/health | none | Health check |
| POST | /api/auth/send-otp | none | Initiate CUSTOM_AUTH |
| POST | /api/auth/verify-otp | none | Returns JWT tokens |
| POST | /api/auth/refresh | none | Exchange refresh token |
| GET | /api/auth/me | any JWT | Current user profile |
| POST | /api/auth/activate | none | Invite-based activation |
| POST | /api/auth/logout | any JWT | Revoke session |

## ADMIN Lambda (endevo-uat-fn-admin)
| Method | Path | Role Guard | Notes |
|--------|------|------------|-------|
| GET | /api/admin/dashboard | GLOBAL_ADMIN | Stats overview |
| GET | /api/admin/tenants | GLOBAL_ADMIN | List all tenants |
| POST | /api/admin/tenants | GLOBAL_ADMIN | Create tenant |
| GET | /api/admin/tenants/{id} | GLOBAL_ADMIN | Tenant detail |
| PUT | /api/admin/tenants/{id} | GLOBAL_ADMIN | Update tenant |
| DELETE | /api/admin/tenants/{id} | GLOBAL_ADMIN | Soft delete (archive) |
| DELETE | /api/admin/tenants/{id}/permanent | GLOBAL_ADMIN | Hard delete |
| GET | /api/admin/users | GLOBAL_ADMIN | List all users |
| POST | /api/admin/users | GLOBAL_ADMIN | Create user |
| GET | /api/admin/users/{id} | GLOBAL_ADMIN | User detail |
| PUT | /api/admin/users/{id} | GLOBAL_ADMIN | Update user |
| DELETE | /api/admin/users/{id} | GLOBAL_ADMIN | Soft delete |
| DELETE | /api/admin/users/{id}/permanent | GLOBAL_ADMIN | Hard delete |
| POST | /api/admin/users/{id}/lock | GLOBAL_ADMIN | Lock user |
| POST | /api/admin/users/{id}/unlock | GLOBAL_ADMIN | Unlock user |
| POST | /api/admin/users/{id}/reset-password | GLOBAL_ADMIN | Returns 410 (passwordless) |
| POST | /api/admin/invite | GLOBAL_ADMIN | Send invite email |
| GET | /api/admin/audit | GLOBAL_ADMIN | Audit log |
| GET | /api/admin/health | none | Health check |
| GET | /api/admin/archive/users | GLOBAL_ADMIN | Archived users |
| POST | /api/admin/archive/users/{id}/restore | GLOBAL_ADMIN | Restore user |
| GET | /api/admin/archive/tenants | GLOBAL_ADMIN | Archived tenants |
| POST | /api/admin/archive/tenants/{id}/restore | GLOBAL_ADMIN | Restore tenant |
| GET | /api/admin/subscriptions | GLOBAL_ADMIN | Billing overview |
| GET | /api/admin/subscriptions/{tenantId} | GLOBAL_ADMIN | Tenant subscription |
| POST | /api/admin/subscriptions/{tenantId}/invoice | GLOBAL_ADMIN | Create manual invoice |
| PUT | /api/admin/subscriptions/{tenantId}/plan | GLOBAL_ADMIN | Change tenant plan |
| GET | /api/admin/metrics/overview | GLOBAL_ADMIN | Platform metrics |
| POST | /api/admin/re-engage | GLOBAL_ADMIN | Send re-engagement emails |
| POST | /api/admin/tenants/import | GLOBAL_ADMIN | Bulk import tenants |
| GET | /api/admin/tenants/export | GLOBAL_ADMIN | Export tenants |
| POST | /api/admin/employees/import | GLOBAL_ADMIN | Bulk import employees |
| GET | /api/admin/employees/export | GLOBAL_ADMIN | Export employees |
| GET | /api/admin/features | GLOBAL_ADMIN | Feature flags |
| PUT | /api/admin/features | GLOBAL_ADMIN | Update feature flags |

## HR Lambda (endevo-uat-fn-hr)
| Method | Path | Role Guard | Notes |
|--------|------|------------|-------|
| GET | /api/hr/dashboard | HR_ADMIN | Dashboard stats |
| GET | /api/hr/employees | HR_ADMIN | List own tenant employees |
| POST | /api/hr/invite | HR_ADMIN | Invite employee |
| PUT | /api/hr/employees/{id} | HR_ADMIN | Update employee |
| DELETE | /api/hr/employees/{id} | HR_ADMIN | Archive employee |
| POST | /api/hr/employees/{id}/reactivate | HR_ADMIN | Reactivate |
| POST | /api/hr/employees/{id}/lock | HR_ADMIN | Lock |
| POST | /api/hr/employees/{id}/unlock | HR_ADMIN | Unlock |
| POST | /api/hr/employees/{id}/credential-reset | HR_ADMIN | Returns 410 Gone (passwordless) |
| GET | /api/hr/audit | HR_ADMIN | HR audit log |
| GET | /api/hr/metrics | HR_ADMIN | Activation/completion rates |
| GET | /api/hr/subscription | HR_ADMIN | Subscription info |
| GET | /api/hr/tenant | HR_ADMIN | Tenant details |
| GET | /api/hr/training | HR_ADMIN | Training courses |
| GET | /api/hr/certificates | HR_ADMIN | Tenant certificates |
| GET | /api/hr/sessions | HR_ADMIN | 1:1 sessions overview |
| POST | /api/hr/sessions/book | HR_ADMIN | Book session |
| POST | /api/hr/upload-url | HR_ADMIN | S3 presigned upload URL |
| POST | /api/hr/branding | HR_ADMIN | Update tenant branding |
| PUT | /api/hr/subscription/plan | HR_ADMIN | Change tenant plan |
| GET | /api/hr/archive/employees | HR_ADMIN | Archived employees |
| POST | /api/hr/archive/employees/{id}/restore | HR_ADMIN | Restore employee |

## EMPLOYEE Lambda (endevo-uat-fn-employee)
| Method | Path | Role Guard | Notes |
|--------|------|------------|-------|
| GET | /api/employee/dashboard | EMPLOYEE | Dashboard data |
| GET | /api/employee/profile | EMPLOYEE | User profile |
| PUT | /api/employee/profile | EMPLOYEE | Update profile |
| GET | /api/employee/training | EMPLOYEE | Training courses |
| POST | /api/employee/progress | EMPLOYEE | Record course progress |
| GET | /api/employee/assessment/{courseId} | EMPLOYEE | Assessment questions |
| POST | /api/employee/assessment/{courseId}/submit | EMPLOYEE | Submit assessment |
| POST | /api/employee/certificate/check | EMPLOYEE | Check eligibility + generate |
| POST | /api/employee/playbook/generate | EMPLOYEE | AI playbook generation |
| POST | /api/employee/email/send-playbook | EMPLOYEE | Send playbook email |
| POST | /api/employee/support/question | EMPLOYEE | Post support question |
| POST | /api/employee/support/question/{id}/rate | EMPLOYEE | Rate answer |
| GET | /api/employee/support/faq | EMPLOYEE | Get FAQ |
| GET | /api/employee/checklist | EMPLOYEE | Task checklist |
| POST | /api/employee/checklist/{id}/complete | EMPLOYEE | Mark task complete |
| GET | /api/employee/checklist/progress | EMPLOYEE | Checklist progress |
| GET | /api/employee/certificates | EMPLOYEE | Employee certificates |
| GET | /api/employee/subscription | EMPLOYEE | Subscription info |
| GET | /api/employee/sessions | EMPLOYEE | 1:1 sessions |
| POST | /api/employee/sessions/book | EMPLOYEE | Book session |
| POST | /api/employee/sessions/{id}/complete | EMPLOYEE | Complete session |
| GET | /api/employee/master-classes | EMPLOYEE | Master classes |
| GET | /api/employee/master-classes/recommended | EMPLOYEE | Recommended classes |

## LMS Lambda (endevo-uat-fn-lms)
| Method | Path | Role Guard | Notes |
|--------|------|------------|-------|
| GET/POST | /api/lms/assessment/* | varies | Assessment routes |
| GET/POST | /api/lms/course/* | varies | Course routes |
| GET/POST | /api/lms/progress/* | varies | Progress routes |
| GET/POST | /api/lms/quiz/* | varies | Quiz routes |
| GET/POST | /api/lms/admin/* | GLOBAL_ADMIN | Admin LMS management |
| GET | /api/lms/health | none | Health check |

## NOT CONFIRMED IN BACKEND (frontend calls — unverified)
| Endpoint | Called by | Risk |
|----------|-----------|------|
| /api/admin/config | admin/settings/page.tsx | HIGH — may not exist, Settings page broken |
| /api/admin/plan-config | api.ts adminGetPlanConfig | MEDIUM |
| /api/admin/finops/* | admin/finops/page.tsx | MEDIUM |
| /api/admin/webhooks/* | admin/developers/page.tsx | MEDIUM |
