# UIUX-01 — Page Map
**Date:** 2026-04-19 | **Method:** Static code analysis

| Route | Role | File | API Calls | Interactive Elements | Links |
|-------|------|------|-----------|---------------------|-------|
| /login | public | (auth)/login/page.tsx | /api/auth/send-otp, /api/auth/verify-otp | Email input, OTP digits, Submit | /register |
| /register | public | (auth)/register/page.tsx | /api/auth/activate | Token-from-URL form, Submit | /login |
| /status | public | (auth)/status/page.tsx | /api/admin/health | None (read-only) | — |
| /admin/dashboard | GLOBAL_ADMIN | admin/dashboard/page.tsx | /api/admin/dashboard | Refresh button | all admin pages |
| /admin/tenants | GLOBAL_ADMIN | admin/tenants/page.tsx | /api/admin/tenants, /api/admin/tenants/{id} | Create Tenant, Edit, Disable, Enable | /admin/tenants/{id} |
| /admin/users | GLOBAL_ADMIN | admin/users/page.tsx | /api/admin/users, /api/admin/users/{id}, /api/admin/users/{id}/lock, /api/admin/users/{id}/reset-password | Create User, Edit, Lock, Unlock, Deactivate, Reset PW, Archive | — |
| /admin/subscriptions | GLOBAL_ADMIN | admin/subscriptions/page.tsx | /api/admin/tenants, /api/admin/subscriptions/{id}/invoice, /api/admin/tenants/{id} | Create Invoice, Change Plan | — |
| /admin/audit | GLOBAL_ADMIN | admin/audit/page.tsx | /api/admin/audit | Refresh, CSV Export | — |
| /admin/archive | GLOBAL_ADMIN | admin/archive/page.tsx | /api/admin/archive/users, /api/admin/archive/tenants, /api/admin/users/{id}/permanent, /api/admin/tenants/{id}/permanent, restore endpoints | Restore, Hard Delete (type-confirm modal) | — |
| /admin/lms/modules | GLOBAL_ADMIN | admin/lms/modules/page.tsx | /api/lms/admin/* | Create/Edit/Toggle modules | — |
| /admin/lms/questions | GLOBAL_ADMIN | admin/lms/questions/page.tsx | /api/lms/admin/* | CRUD questions | — |
| /admin/lms/progress | GLOBAL_ADMIN | admin/lms/progress/page.tsx | /api/lms/* | Read-only | — |
| /admin/knowledge | GLOBAL_ADMIN | admin/knowledge/page.tsx | /api/admin/* | Knowledge base CRUD | — |
| /admin/features | GLOBAL_ADMIN | admin/features/page.tsx | /api/admin/features | Toggle feature flags | — |
| /admin/import-export | GLOBAL_ADMIN | admin/import-export/page.tsx | /api/admin/*/import, /api/admin/*/export | Upload JSON, Download | — |
| /admin/developers | GLOBAL_ADMIN | admin/developers/page.tsx | /api/admin/webhooks | Webhook CRUD, API docs display | — |
| /admin/finops | GLOBAL_ADMIN | admin/finops/page.tsx | /api/admin/finops/* | Read-only cost view | — |
| /admin/system | GLOBAL_ADMIN | admin/system/page.tsx | varies | Read-only status | — |
| /admin/health | GLOBAL_ADMIN | admin/health/page.tsx | /api/admin/health | Refresh | — |
| /admin/settings | GLOBAL_ADMIN | admin/settings/page.tsx | /api/admin/config, /api/auth/change-password (indirectly) | Save Config sections, Change Password | — |
| /hr/dashboard | HR_ADMIN | hr/dashboard/page.tsx | /api/hr/metrics, /api/hr/subscription, /api/hr/employees, /api/hr/tenant | Refresh | all hr pages |
| /hr/employees | HR_ADMIN | hr/employees/page.tsx | /api/hr/employees, /api/hr/employees/{id}, lock/unlock/reactivate/credential-reset | Edit, Lock, Unlock, Deactivate, Reactivate, Reset PW | — |
| /hr/invite | HR_ADMIN | hr/invite/page.tsx | /api/hr/invite | Submit invite form | — |
| /hr/audit | HR_ADMIN | hr/audit/page.tsx | /api/hr/audit | Refresh, CSV Export | — |
| /hr/archive | HR_ADMIN | hr/archive/page.tsx | /api/hr/archive/employees, /api/hr/archive/employees/{id}/restore | Restore | — |
| /hr/lms/progress | HR_ADMIN | hr/lms/progress/page.tsx | /api/lms/* | Read-only | — |
| /hr/certificates | HR_ADMIN | hr/certificates/page.tsx | /api/hr/certificates | Read-only | — |
| /hr/subscription | HR_ADMIN | hr/subscription/page.tsx | /api/hr/tenant, /api/hr/subscription, /api/hr/subscription/plan (PUT) | Change Plan | — |
| /hr/settings | HR_ADMIN | hr/settings/page.tsx | /api/admin/config (suspected) | Save settings | — |
| /hr/training | HR_ADMIN | hr/training/page.tsx | /api/hr/training | Read-only | — |
| /employee/dashboard | EMPLOYEE | employee/dashboard/page.tsx | /api/employee/dashboard, /api/lms/assessment/status, /api/lms/lessons/1 (hardcoded), /api/auth/me | Refresh | all employee pages |
| /employee/assessment | EMPLOYEE | employee/assessment/page.tsx | /api/employee/assessment/{id}, /api/employee/assessment/{id}/submit | Submit answers | — |
| /employee/certificates | EMPLOYEE | employee/certificates/page.tsx | /api/employee/certificates | Read-only | — |
| /employee/checklist | EMPLOYEE | employee/checklist/page.tsx | /api/employee/checklist, /api/employee/checklist/{id}/complete | Mark task complete | — |
| /employee/lms/* | EMPLOYEE | employee/lms/*/page.tsx | /api/lms/* | Watch video, mark lesson done | — |
| /employee/master-classes | EMPLOYEE | employee/master-classes/page.tsx | /api/employee/master-classes | Read-only | — |
| /employee/playbook | EMPLOYEE | employee/playbook/page.tsx | /api/employee/playbook/generate | Generate playbook (POST) | — |
| /employee/profile | EMPLOYEE | employee/profile/page.tsx | /api/employee/profile (GET/PUT) | Edit profile, Save | — |
| /employee/sessions | EMPLOYEE | employee/sessions/page.tsx | /api/employee/sessions, /api/employee/sessions/book | Book session | — |
| /employee/settings | EMPLOYEE | employee/settings/page.tsx | /api/employee/profile (PUT) | Save settings | — |
| /employee/subscription | EMPLOYEE | employee/subscription/page.tsx | /api/employee/subscription | Read-only | — |
| /employee/support | EMPLOYEE | employee/support/page.tsx | /api/employee/support/question, /api/employee/support/faq, rate endpoint | Ask question, rate answer | — |
| /employee/training | EMPLOYEE | employee/training/page.tsx | /api/employee/training | Read-only | — |

**Total pages mapped: 43**
