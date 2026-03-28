# Endevo Life — Testing Guide (UAT)
> For QA team: Shahzad, Zara | Last updated: 2026-03-28

---

## Live URLs

| Page | URL |
|------|-----|
| Login | https://main.d1vgn9nzfx4cxk.amplifyapp.com/login |
| Admin Dashboard | https://main.d1vgn9nzfx4cxk.amplifyapp.com/admin/dashboard |
| HR Dashboard | https://main.d1vgn9nzfx4cxk.amplifyapp.com/hr/dashboard |
| Employee Dashboard | https://main.d1vgn9nzfx4cxk.amplifyapp.com/employee/dashboard |
| API Base | https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com |

> **Credentials:** Stored privately in `_sessions/TEST-USERS.md` (local only, not in GitHub).
> Ask Shahzad for login details.

---

## Test Accounts (3 roles)

| Role | Email | Tenant |
|------|-------|--------|
| GLOBAL_ADMIN | admin@endevo.com | All tenants |
| HR_ADMIN | hr@acme.com | Acme Corp |
| EMPLOYEE | ava.anderson@acme.com | Acme Corp |

> All 3 accounts share one password. Ask Shahzad or see `_sessions/TEST-USERS.md` (local only).

---

## Test Scenarios

### Global Admin Tests
| # | Test | Expected |
|---|------|----------|
| 1 | Login as admin@endevo.com | Redirect to /admin/dashboard |
| 2 | Dashboard loads | Shows 4 tenants, 34 users, stats |
| 3 | Tenants page | Lists all 4 tenants with edit/view |
| 4 | Create new tenant | Form saves, appears in list |
| 5 | All Users page | 34 users searchable across all tenants |
| 6 | Audit log | Shows admin actions with timestamp |
| 7 | Health page | Shows service status (green) |

### HR Admin Tests (Acme)
| # | Test | Expected |
|---|------|----------|
| 1 | Login as hr@acme.com | Redirect to /hr/dashboard |
| 2 | Dashboard | Shows only Acme employee stats |
| 3 | Employees page | Shows ONLY Acme employees (not TechVision) |
| 4 | Try login as hr@techvision.com | Can only see TechVision data — tenant isolated |
| 5 | Invite employee | Generates invite URL |
| 6 | Audit log | Shows only Acme actions |

### Employee Tests (Acme)
| # | Test | Expected |
|---|------|----------|
| 1 | Login as ava.anderson@acme.com | Redirect to /employee/dashboard |
| 2 | Dashboard | Shows progress bar, completion stats |
| 3 | Training page | Shows 2 courses |
| 4 | Assessment page | Shows questions (5 per course) |
| 5 | Submit assessment ≥70% | Gets certificate |
| 6 | Certificates page | Shows earned certificate |
| 7 | Profile page | Can edit name, title, department |

### Security Tests
| # | Test | Expected |
|---|------|----------|
| 1 | No token → GET /api/admin/dashboard | 401 Not authenticated |
| 2 | HR token → GET /api/admin/dashboard | 403 Global Admin required |
| 3 | Employee token → GET /api/hr/employees | 403 HR Admin required |
| 4 | Acme HR → get TechVision employees | 0 results (isolated) |

---

## Demo Data (What Exists in UAT)

| Table | Records |
|-------|---------|
| Tenants | 4: Acme, TechVision, GlobalHR, test |
| Users | 34 (including 3 roles above) |
| Training Courses | 8 (2 per tenant) |
| Assessment Questions | 40 (5 per course per tenant) |
| Certificates | 2 (ava.anderson@acme.com) |

### Courses Available
| Course | Duration | Pass Score |
|--------|----------|-----------|
| Digital Legacy Fundamentals | 45 min | 70% |
| Estate Planning & Digital Assets | 60 min | 70% |

---

## Known Issues

| ID | Severity | Description | Workaround |
|----|----------|-------------|------------|
| KNOWN-001 | LOW | PUT fake tenant ID returns 200 instead of 404 | Use valid tenant IDs |
| KNOWN-002 | LOW | Rapid double-submit assessment may create duplicate cert key | Wait 1 second between submits |
| KNOWN-003 | INFO | SES sandbox — invite emails may go to spam | Check spam folder |

---

## QA Sign-off Status

| Phase | Status | Date |
|-------|--------|------|
| Phase 1 — Auth + All Modules | APPROVED (98.6%) | 2026-03-21 |
| Phase 4 — UI Polish + Video + Certs | PENDING | TBD |
| Phase 5 — Stripe Billing | PENDING | TBD |
