# Audit: Domain 1 — Frontend UI Inventory
**Date:** 2026-04-19 | **Auditor:** Autonomous audit session

---

## Route Inventory — 55 total page.tsx files

### Auth (3)
| URL | use client | Purpose |
|-----|------------|---------|
| /login | yes | OTP passwordless login (send-otp → verify-otp) |
| /register | yes | Invite-link account activation |
| /status | yes | API health check page |

### Global Admin (22)
| URL | Purpose |
|-----|---------|
| /admin/dashboard | Tenant/user counts, health overview |
| /admin/users | User list + management |
| /admin/tenants | Tenant list |
| /admin/tenants/[tenantId] | Tenant detail |
| /admin/subscriptions | Subscription summary |
| /admin/audit | Audit log viewer |
| /admin/archive | Archive (users + tenants) |
| /admin/health | Service health indicators |
| /admin/system | System status (live probes) |
| /admin/features | Feature flag management |
| /admin/plan-config | Plan configuration |
| /admin/import-export | Bulk import/export |
| /admin/knowledge | Knowledge base files |
| /admin/finops | Cost/FinOps dashboard |
| /admin/certificates | Certificate management |
| /admin/settings | System settings |
| /admin/developers | Developer tools |
| /admin/executive-brief | Executive summary (printable) |
| /admin/lms/modules | LMS module list |
| /admin/lms/modules/[moduleNum] | LMS module detail |
| /admin/lms/progress | User progress across LMS |
| /admin/lms/questions | Question bank management |

### HR Admin (10)
| URL | Purpose |
|-----|---------|
| /hr/dashboard | HR overview |
| /hr/employees | Employee list |
| /hr/invite | Invite new employee |
| /hr/training | Training overview |
| /hr/lms/progress | LMS progress per employee |
| /hr/certificates | Certificate viewer |
| /hr/subscription | Tenant subscription |
| /hr/audit | HR audit log |
| /hr/archive | Archived employees |
| /hr/settings | HR settings |

### Employee (19)
| URL | Purpose |
|-----|---------|
| /employee/dashboard | Main employee home |
| /employee/assessment | Legacy assessment list |
| /employee/assessment/[courseId] | Course-specific assessment |
| /employee/lms | LMS home |
| /employee/lms/assessment | 40-question readiness assessment |
| /employee/lms/module/[moduleNum] | Module overview |
| /employee/lms/module/[moduleNum]/lesson/[lessonId] | Lesson viewer |
| /employee/lms/module/[moduleNum]/video/[videoId] | Video player |
| /employee/certificates | Certificate viewer (regular + LMS completion) |
| /employee/checklist | Legacy planning checklist |
| /employee/master-classes | Master class catalog |
| /employee/playbook | AI-generated personalized playbook |
| /employee/profile | User profile |
| /employee/sessions | Sessions/1:1 |
| /employee/settings | Employee settings |
| /employee/subscription | Subscription/upgrade page |
| /employee/support | Support page |
| /employee/training | Training materials |

_(Note: 19+22+10+3+1 shared = 55 total — the shared `status` page is under auth)_

---

## Component Inventory (15 components)

| Component | Purpose |
|-----------|---------|
| `AmbientMesh.tsx` | Animated background mesh |
| `CompassionGuard.tsx` | Content sensitivity guard |
| `copilot/CopilotWidget.tsx` | AI copilot widget (separate from Jesse — status unclear) |
| `ErrorBoundary.tsx` | React error boundary (Sentry not yet wired) |
| `jesse/ActionCard.tsx` | Jesse chat action card |
| `jesse/JesseAIWidget.tsx` | Jesse AI floating widget (present in all 3 layouts) |
| `jesse/JesseChatWindow.tsx` | Jesse chat window |
| `lms/LessonSidebar.tsx` | LMS lesson navigation sidebar |
| `lms/PdfLesson.tsx` | PDF lesson viewer |
| `lms/QuizEngine.tsx` | Quiz/assessment engine |
| `lms/ScorecardDisplay.tsx` | Readiness scorecard display |
| `lms/VideoLesson.tsx` | Video lesson wrapper |
| `lms/VideoPlayer.tsx` | Video player component |
| `ThemePicker.tsx` | Theme picker (all layouts) |
| `ToastContainer.tsx` | Toast notification container |

---

## Feature Detection

| Feature | Status | Evidence |
|---------|--------|---------|
| LMS (modules, videos, quizzes) | ✓ PRESENT | 7 LMS routes + 6 LMS components |
| Assessment (40-question readiness) | ✓ PRESENT | /employee/lms/assessment, ScorecardDisplay |
| Certificates | ✓ PRESENT | Regular + LMS completion certs |
| Checklist | ✓ PRESENT | /employee/checklist |
| Playbook | ✓ PRESENT | /employee/playbook with AI generation |
| Subscription/Upgrade | ✓ PRESENT | /employee/subscription + /hr/subscription |
| Jesse AI Chat Widget | ✓ PRESENT | JesseAIWidget in all 3 dashboard layouts |
| Archive | ✓ PRESENT | admin/archive + hr/archive |
| Executive Brief | ✓ PRESENT | Printable PDF-style report |
| Master Classes | ⚠ PAGE ONLY | Page exists; `endevo-uat-master-classes` table is empty |
| Sessions / 1:1 | ⚠ PAGE ONLY | /employee/sessions page exists; no backend data confirmed |
| FinOps dashboard | ⚠ PAGE ONLY | Admin finops page; `endevo-uat-costs` table is empty |
| Meetings | ✗ NO PAGE | No dedicated /meetings route |

---

## WorkOS Remnants in Frontend
**ZERO.** No WorkOS imports or references in any `.tsx`/`.ts` under `apps/web/`. ✓

---

## TODO / FIXME / HACK Count: 1

| File | Line | Content |
|------|------|---------|
| `components/ErrorBoundary.tsx` | 34 | `TODO: Replace with Sentry.captureException` |

---

## Issues

| Severity | Issue |
|----------|-------|
| P2 | `master-classes` backend table empty — MasterClasses page shows no content |
| P2 | `endevo-uat-costs` table empty — FinOps page shows no data |
| P2 | Sentry not wired in ErrorBoundary |
| P2 | `CopilotWidget.tsx` exists but unclear if active or orphaned |
| INFO | No Meeting route exists (not necessarily a gap — may be in Sessions) |
