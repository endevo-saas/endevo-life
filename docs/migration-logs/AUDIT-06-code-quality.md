# Audit: Domain 6 — Code Quality
**Date:** 2026-04-19 | **Auditor:** Autonomous audit session

---

## Git History

| Metric | Value |
|--------|-------|
| Total commits | 216 |
| Date range | All within last 30 days |
| Active contributors | 1 (Shahzad) |
| Branches | main (only active branch) |
| Current branch | feat/cognito-federation-migration (audit session) |
| Stash entries | 1: `stash@{0}: wip-global-admin-bypass` |

### Recent Commits (last 5)

| Hash | Message |
|------|---------|
| 0d035b5 | feat(cognito): fresh deploy - UserPoolV2, named CF exports, all stacks migrated |
| 0f9a3fa | feat(auth): replace WorkOS with Cognito passwordless (M1-M15) - full migration |
| 2abc1e6 | ci: add CodeBuild buildspec for Lambda deployment |
| bf8b5cd | fix: employee dashboard complete with 7 features, Sentry, and Next.js CVE patches |
| d3f0a11 | fix: HR + Employee overhaul — real data, role validation, audit logging |

---

## WorkOS Remnants

| Location | Type | Status |
|----------|------|--------|
| `backend/functions/auth/main.py` lines 16-20 | Comments only (documenting removed routes) | Harmless |
| `infrastructure/cdk.out/` | CDK build artifact copy | Not deployed, not source |
| Secrets Manager: `endevo/workos/api-key` | Stale secret | Should be deleted |
| Secrets Manager: `endevo/workos/client-id` | Stale secret | Should be deleted |
| Secrets Manager: `lros/workos/api-key` | Stale secret | Should be deleted |
| Secrets Manager: `lros/workos/client-id` | Stale secret | Should be deleted |

**Functional WorkOS code: ZERO** ✓
**Frontend WorkOS imports: ZERO** ✓

---

## TODO / FIXME / HACK Scan

| File | Line | Content |
|------|------|---------|
| `apps/web/components/ErrorBoundary.tsx` | 34 | `TODO: Replace with Sentry.captureException` |

**Total: 1 TODO. Zero FIXME. Zero HACK.**

---

## File Size Audit

| File | Lines | Status |
|------|-------|--------|
| `backend/functions/admin/main.py` | 2,630 | ⚠ Far over 800-line guideline |
| `backend/functions/jesse/main.py` | 2,629 | ⚠ Far over 800-line guideline |
| `backend/functions/employee/main.py` | 1,354 | ⚠ Over guideline |
| `backend/functions/hr/main.py` | 1,015 | ⚠ Over guideline |
| `backend/functions/auth/main.py` | 452 | ✓ Within guideline |
| `backend/functions/lms/main.py` | 69 (dispatcher) | ✓ Dispatcher pattern — routes to sub-modules |

---

## Pending Stash Work

| Stash | Contents | Risk |
|-------|----------|------|
| `stash@{0}: wip-global-admin-bypass` | `hr/main.py`, `employee/main.py`, `lms/utils/auth.py`, `lms/routes/assessment.py`, `lms/routes/course.py` | Low — adds GLOBAL_ADMIN bypass in HR/employee/LMS auth gates |

---

## Dead Code

| Item | Location | Action |
|------|----------|--------|
| `CopilotWidget.tsx` | `apps/web/components/copilot/` | Status unclear — may be orphaned. Verify or delete. |
| WorkOS comments | `backend/functions/auth/main.py` lines 16-20 | Safe to remove |

---

## Issues

| Severity | Issue |
|----------|-------|
| P2 | fn-admin (2,630 lines) and fn-jesse (2,629 lines) — extract route handlers into sub-modules |
| P2 | fn-employee (1,354) and fn-hr (1,015) over 800-line guideline |
| P2 | Sentry not wired in `ErrorBoundary.tsx` — errors silently dropped |
| P2 | 4 stale WorkOS secrets in Secrets Manager — should be deleted |
| P2 | `stash@{0}: wip-global-admin-bypass` never committed — GLOBAL_ADMIN gets 401 on HR/employee/LMS |
| P2 | `CopilotWidget.tsx` orphan status unclear — verify or remove |
