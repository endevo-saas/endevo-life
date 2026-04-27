# UIUX-08 — Cosmetic / Legacy UI Issues
**Date:** 2026-04-19

## Issue 1: Certificate Stats on Admin Dashboard (Still Visible)

Certificate feature was removed from admin sidebar (GA-RECOVERY Phase 5) but the dashboard still renders certificate KPI cards.

**Files:**
- `apps/web/app/(global-admin)/admin/dashboard/page.tsx` line 174: `label="Certificates" value={data?.total_certificates ?? 0}`
- `apps/web/app/(global-admin)/admin/dashboard/page.tsx` line 207: `value={data?.lms_certificates_issued ?? 0}`
- `apps/web/app/(global-admin)/admin/dashboard/page.tsx` line 250: `label: 'Certificate Rate'`

**Impact:** Admin sees "Certificates: 0" and "Certificate Rate: 0%" on every dashboard load. Confusing since no cert nav link exists.

---

## Issue 2: HR Sidebar Still Shows "Certificates" Nav Item

**File:** `apps/web/app/(hr-admin)/layout.tsx` line 33:
```
{ href: '/hr/certificates', icon: Award, label: 'Certificates' }
```
Admin sidebar had Certificates removed. HR sidebar was not updated.

---

## Issue 3: HR "Reset Password" Button Calls 410 Endpoint

**File:** `apps/web/app/(hr-admin)/hr/employees/page.tsx` line 132
**Calls:** `api.hrResetPassword()` → `POST /api/hr/employees/{id}/credential-reset` → **always 410 Gone**
**Message returned:** "passwordless — use OTP login"

HR clicks Reset Password → sees an error every time.

---

## Issue 4: Admin "Reset Password" Button Also Returns 410

**File:** `apps/web/app/(global-admin)/admin/users/page.tsx`
**Calls:** `api.adminResetPassword(id)` → `POST /api/admin/users/{id}/reset-password` → **410 Gone**

Same problem as Issue 3 on the admin side.

---

## Summary

| # | File | Line(s) | Issue | Priority |
|---|------|---------|-------|----------|
| 1 | admin/dashboard/page.tsx | 174, 207, 250 | Certificate stat cards still rendered | P2 |
| 2 | (hr-admin)/layout.tsx | 33 | Certificates nav item in HR sidebar | P2 |
| 3 | hr/employees/page.tsx | ~132 | Reset Password → 410 Gone | P1 |
| 4 | admin/users/page.tsx | varies | Reset Password → 410 Gone | P1 |
