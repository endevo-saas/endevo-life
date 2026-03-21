# Endevo Life — QA Report
> **Date:** 2026-03-21 | **Engineer:** Shahzad + Claude AI (QA role)
> **Frontend:** https://main.d1vgn9nzfx4cxk.amplifyapp.com
> **API:** https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com

---

## Overall Result: 98.6% PASS — 68/69 Tests

| Category | Tests | Pass | Fail |
|----------|-------|------|------|
| Authentication | 8 | 8 | 0 |
| Global Admin API | 12 | 12 | 0 |
| HR Admin API | 10 | 10 | 0 |
| Employee API | 14 | 14 | 0 |
| Security / RBAC | 10 | 10 | 0 |
| Input Validation | 6 | 6 | 0 |
| Multi-Tenant Isolation | 4 | 4 | 0 |
| Edge Cases | 5 | 4 | 1 |
| **TOTAL** | **69** | **68** | **1** |

---

## Bugs Found & Fixed

### BUG-001 — CRITICAL (FIXED) — Audit Log Silent Failure
- **Symptom:** All HR/Admin audit actions returned 0 entries
- **Root Cause:** `endevo-uat-audit` has composite key (`tenantId` HASH + `sk` RANGE). Lambda wrote items without `sk` — DynamoDB `ValidationException` swallowed by bare `except: pass`
- **Fix:** Audit function now writes `sk = f"{timestamp}#{uuid}"`. Changed `except: pass` → `except Exception as e: print(f"AUDIT_WRITE_ERROR: {e}")`
- **Verified:** 2 audit entries written correctly after HR actions

### BUG-002 — CRITICAL (FIXED) — Assessment Cross-Tenant Contamination
- **Symptom:** Employee got 20 questions (all 4 tenants) instead of 5 (own tenant)
- **Root Cause:** Assessment scan filtered by `courseId` only — all tenants shared the same courseId values
- **Fix:** Changed scan filter to `tenantId = :t AND courseId = :c`
- **Verified:** Employee now gets exactly 5 questions (tenant-scoped)

### BUG-003 — MEDIUM (FIXED) — Progress Not Updated After Passing
- **Symptom:** Employee passed assessment (got certificate), dashboard showed `completed_courses = 0`
- **Root Cause:** Assessment submit endpoint issued cert but never wrote a progress record with `completed = True`
- **Fix:** Added `PROG_T.put_item({completed: True, progressPct: 100})` inside the `if passed:` block
- **Verified:** Dashboard shows `completed_courses = 1`, `progress_pct = 50%` after passing

### BUG-004 — MEDIUM (FIXED) — Video-Progress Write Failing Silently
- **Symptom:** `PROG_T.put_item` failing silently — no errors visible, no data written
- **Root Cause:** `endevo-uat-video-progress` requires `userId` (HASH) + `videoId` (RANGE). Lambda wrote `courseId` but not `videoId`
- **Fix:** Lambda now writes both `videoId = course_id` and `courseId = course_id`
- **Verified:** Progress records written correctly

### BUG-005 — LOW (OPEN) — DynamoDB Upsert on Fake Tenant ID
- **Symptom:** `PUT /api/admin/tenants/fake-id` returns 200 "Tenant updated" instead of 404
- **Root Cause:** DynamoDB `update_item` is an upsert — creates item if it doesn't exist
- **Status:** OPEN — low risk (new admin Lambda adds `get_item` check; not yet deployed in this route)

---

## API Coverage

| Lambda | Routes Tested | Coverage |
|--------|--------------|---------|
| endevo-uat-fn-auth | 6/7 | 86% — `change-password` tested via Cognito directly |
| endevo-uat-fn-admin | 7/7 | 100% |
| endevo-uat-fn-hr | 6/6 | 100% |
| endevo-uat-fn-employee | 8/8 | 100% |
| **Total** | **27/28** | **97%** |

---

## Security Verification

| Test | Result |
|------|--------|
| Unauthenticated → any protected route | ✅ 401 Not authenticated |
| HR_ADMIN → admin endpoint | ✅ 403 Global Admin access required |
| EMPLOYEE → HR endpoint | ✅ 403 HR Admin access required |
| Cross-tenant data access | ✅ 0 cross-tenant results — isolation confirmed |
| TechVision HR → Acme employees | ✅ BLOCKED — 0 results |

---

## Frontend Pages Verified

| Role | Page | API Connected | Status |
|------|------|---------------|--------|
| Global Admin | Dashboard | GET /api/admin/dashboard | ✅ Live stats |
| Global Admin | Tenants | GET + POST + PUT | ✅ Full CRUD |
| Global Admin | All Users | GET /api/admin/users | ✅ Search + filter |
| Global Admin | Audit Log | GET /api/admin/audit | ✅ Search |
| Global Admin | Health | GET /api/admin/health | ✅ Service status |
| HR Admin | Dashboard | GET /api/hr/dashboard | ✅ Live stats |
| HR Admin | Employees | GET + PUT + DELETE | ✅ Full management |
| HR Admin | Invite | POST /api/hr/invite | ✅ Invite URL displayed |
| HR Admin | Audit Log | GET /api/hr/audit | ✅ Tenant-scoped |
| Employee | Dashboard | GET /api/employee/dashboard | ✅ Progress bar |
| Employee | Training | GET /api/employee/training | ✅ Course list |
| Employee | Assessment | GET + POST | ✅ Submit + result |
| Employee | Certificates | GET /api/employee/certificates | ✅ Cards + download |
| Employee | Profile | GET + PUT | ✅ Edit inline |

---

## Data State After QA

| Table | Records | Notes |
|-------|---------|-------|
| endevo-uat-tenants | 4 | Acme, TechVision, GlobalHR, tenant-6a727c72 |
| endevo-uat-users | 34 | 33 seeded + 1 QA invite |
| endevo-uat-training | 8 | 2 courses × 4 tenants |
| endevo-uat-questions | 40 | 5 per course per tenant |
| endevo-uat-audit | 2+ | Writing correctly |
| endevo-uat-certificates | 2 | ava.anderson@acme.com |
| endevo-uat-video-progress | 1 | Writing correctly |

---

## Known Open Items

| ID | Severity | Description |
|----|----------|-------------|
| KNOWN-001 | LOW | PUT /api/admin/tenants/{fake-id} returns 200 (DynamoDB upsert behavior) |
| KNOWN-002 | LOW | Double-submit assessment in same second may produce cert with same `issuedAt` key |
| KNOWN-003 | INFO | SES in sandbox — invite emails may land in spam |

---

**QA Sign-off: Phase 1 APPROVED** — All APIs functional, RBAC enforced, multi-tenant isolation verified, all 14 pages connected to live APIs.
