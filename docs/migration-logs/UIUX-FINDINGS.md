# UI/UX Discovery Report
**Date:** 2026-04-19 | **Method:** Static code analysis + API mapping

## Summary
- **Pages audited:** 43 (all roles)
- **APIs mapped:** ~80 endpoints across 5 Lambdas
- **Interactive elements mapped:** ~120
- **Bugs found:** 20

---

## Bug Categories

| Category | Count |
|----------|-------|
| Logout trap (401 → forced logout) | 1 (affects all 43 pages) |
| Reset Password buttons returning 410 | 2 |
| Cosmetic / legacy UI (removed features still shown) | 2 |
| Unverified backend endpoints (frontend calls, not confirmed in Lambda) | 4 |
| Data / identity issues | 1 |
| Hardcoded values | 1 |
| UX gaps | 9 |

---

## Top 20 Critical Bugs (Ranked by Severity)

| Rank | Severity | Bug | File | Fix Sketch |
|------|----------|-----|------|------------|
| 1 | **P0** | **Logout trap** — any 401 → immediate `window.location.href='/login'`, no retry | `lib/api.ts:40-43` | Attempt refresh-token first; only redirect if refresh fails |
| 2 | **P0** | **HR/Employee identity mismatch** — Cognito uses `+alias` emails, DynamoDB seeded with different emails → get_caller() fails → all HR/Employee API calls 403 | `backend/functions/hr/main.py` get_caller | Verify DynamoDB emails match Cognito; reseed if needed |
| 3 | **P1** | **Admin Reset Password → 410 Gone** — button exists, always errors (passwordless app) | `admin/users/page.tsx` | Remove button; add "OTP login" tooltip |
| 4 | **P1** | **HR Reset Password → 410 Gone** — same issue | `hr/employees/page.tsx:132` | Remove button; add OTP guidance |
| 5 | **P1** | **Admin Settings page may be broken** — calls `/api/admin/config` not confirmed in Lambda | `admin/settings/page.tsx:124` | Verify endpoint; add if missing |
| 6 | **P1** | **Admin FinOps page endpoint unconfirmed** — `/api/admin/finops/*` not seen in Lambda | `admin/finops/page.tsx` | Verify; stub or remove page if not implemented |
| 7 | **P1** | **Admin Developers/Webhooks endpoint unconfirmed** — `/api/admin/webhooks` not confirmed | `admin/developers/page.tsx` | Verify endpoint exists |
| 8 | **P1** | **Admin plan-config endpoint unconfirmed** — `/api/admin/plan-config` not in Lambda routes | `lib/api.ts:365-368` | Verify; add if missing |
| 9 | **P2** | **HR Certificates nav item still shown** — cert feature removed from admin sidebar but not HR | `(hr-admin)/layout.tsx:33` | Remove `{ href: '/hr/certificates', ... }` entry |
| 10 | **P2** | **Admin Dashboard shows cert stats** — "Certificates: 0" + "Certificate Rate: 0%" (feature hidden) | `admin/dashboard/page.tsx:174,207,250` | Remove 3 cert stat card instances |
| 11 | **P2** | **Employee dashboard hardcoded module 1** — `lmsGetLessons('1')` fails if module 1 missing | `employee/dashboard/page.tsx:257` | Read module from employee's enrolled plan |
| 12 | **P2** | **HR subscription plan change path mismatch** — `hrChangePlan` vs Lambda PUT path | `lib/api.ts:173` | Verify path alignment with Lambda:942 |
| 13 | **P2** | **Admin Subscriptions uses wrong API** — fetches `adminTenants()` not `adminSubscriptions()` | `admin/subscriptions/page.tsx:200` | Verify intentional; may show wrong data shape |
| 14 | **P2** | **HR Archive has no hard delete** — restore only, no permanent delete option | `hr/archive/page.tsx` | Product decision needed; add or confirm gap |
| 15 | **P2** | **Employee playbook generate** — AI call may timeout (no loading state / error boundary) | `employee/playbook/page.tsx` | Add spinner + 30s timeout with friendly error |
| 16 | **P2** | **HR invite — duplicate email conflict not handled** | `hr/invite/page.tsx` | Test; add user-friendly error message |
| 17 | **P3** | **Admin audit CSV export timestamps** — display fix applied, CSV may still use raw ts | `admin/audit/page.tsx` | Verify CSV timestamp branch matches display fix |
| 18 | **P3** | **HR LMS progress** — calls `/api/lms/*`; LMS Lambda role check for HR_ADMIN unverified | `hr/lms/progress/page.tsx` | Test with HR token; fix role guard if needed |
| 19 | **P3** | **Employee sessions book** — no coach exists in test data; coachId=null handling unverified | `employee/sessions/page.tsx` | Test null coachId; verify backend handles gracefully |
| 20 | **P3** | **Admin Knowledge Base endpoint unconfirmed** | `admin/knowledge/page.tsx` | Verify `/api/admin/knowledge` exists |

---

## Supporting Documents
- [UIUX-01-page-map.md](UIUX-01-page-map.md) — All 43 pages
- [UIUX-02-api-map.md](UIUX-02-api-map.md) — All ~80 API endpoints
- [UIUX-07-logout-trap.md](UIUX-07-logout-trap.md) — Logout trap root cause
- [UIUX-08-cosmetic.md](UIUX-08-cosmetic.md) — Cosmetic + 410 buttons
