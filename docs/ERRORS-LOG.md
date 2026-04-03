# Endevo Life — Errors, Bugs & Resolutions Log
> Every issue encountered during build is recorded here permanently.
> Format: Date | File | Error | Root Cause | Fix | Lesson Learned

---

## How to Read This Log

| Column | Meaning |
|--------|---------|
| **#** | Issue number (sequential) |
| **Phase** | Which build phase (0=infra, 1=auth, 2=HR, 3=employee, 4=polish) |
| **Run** | GitHub Actions run number |
| **File** | Exact file that caused the error |
| **Error** | Exact error message from log |
| **Root Cause** | Why it happened |
| **Fix** | Exact change made |
| **Lesson** | What to remember for future |

---

## Phase 0 — Infrastructure (CDK + GitHub Actions)

---

### Issue #001
- **Date:** 2026-03-20
- **Phase:** 0 — CDK Infrastructure
- **Run:** GitHub Actions Run #1
- **File:** `infrastructure/lib/01-cognito-stack.ts` line 20
- **Error:**
  ```
  TSError: Unable to compile TypeScript:
  lib/01-cognito-stack.ts(20,26): error TS2561:
  Object literal may only specify known properties,
  but 'totp' does not exist in type 'MfaSecondFactor'.
  Did you mean to write 'otp'?
  ```
- **Root Cause:** AWS CDK 2.130 uses `otp` (one-time password) as the property name for TOTP authenticator apps. The property `totp` does not exist in this version of the CDK type definitions.
- **Fix:** Changed `mfaSecondFactor: { totp: true, sms: false }` → `mfaSecondFactor: { otp: true, sms: false }` in `01-cognito-stack.ts`
- **Commit:** `fix: MFA second factor property is otp not totp (CDK 2.130 API)`
- **Lesson:** Always check CDK version-specific property names. `otp` = TOTP authenticator (Google Authenticator etc.). `sms` = SMS text message. Both are valid MFA methods in Cognito.

---

### Issue #002
- **Date:** 2026-03-20
- **Phase:** 0 — CDK Infrastructure
- **Run:** GitHub Actions Run #2
- **File:** `infrastructure/lib/02-dynamo-stack.ts`
- **Error:**
  ```
  Error: Resolution error: ID components may not include
  unresolved tokens: Table-${Token[TOKEN.33]}.
  ```
- **Root Cause:** CDK `CfnOutput` IDs must be static strings known at synthesis (compile) time. The code used `t.tableName` dynamically inside a loop — but `tableName` is a CDK Token (a reference that resolves later at deploy time), not a plain string. CDK cannot use tokens as construct IDs.
- **Fix:** Replaced dynamic `Table-${t.tableName}` output ID with hardcoded array `['tenants','users','training',...]` indexed by loop position.
- **Commit:** `fix: CfnOutput IDs must be hardcoded — CDK tokens not allowed in construct IDs`
- **Lesson:** In CDK, construct IDs (`this` first argument) must ALWAYS be static strings. CloudFormation token references (anything that starts with `${Token[`) cannot be used as IDs. Use a hardcoded name or index instead.

---

## Phase 1 — Auth (Cognito + Python Lambda)

### Issue #007
- **Date:** 2026-03-20
- **Phase:** 1 — Frontend Build
- **Build:** Amplify Jobs #6, #7
- **File:** `apps/web/app/(auth)/register/page.tsx`
- **Error:**
  ```
  ⨯ useSearchParams() should be wrapped in a suspense boundary at page "/register".
  Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
  Error occurred prerendering page "/register".
  ```
- **Root Cause:** In Next.js 15 App Router, `useSearchParams()` triggers a "client-side rendering bailout" during static generation — even in `'use client'` components. Next.js attempts a static pre-render pass for ALL pages by default. `useSearchParams` requires reading from the URL at request time, which is impossible during static generation, so Next.js throws unless the component is wrapped in `<Suspense>`. Adding `export const dynamic = 'force-dynamic'` alone was NOT sufficient — Next.js 15 still performs a render pass and throws before the dynamic flag takes effect.
- **Fix:** Split the page into two components:
  1. `RegisterForm` — inner component that calls `useSearchParams()`, contains all logic
  2. `RegisterPage` (default export) — outer shell that wraps `<RegisterForm>` in `<Suspense fallback={...}>`
  ```tsx
  export default function RegisterPage() {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <RegisterForm />  {/* useSearchParams() lives here */}
      </Suspense>
    )
  }
  ```
- **Commit:** `fix: wrap RegisterForm in Suspense boundary for Next.js 15 useSearchParams`
- **Lesson:** In Next.js 15, EVERY component using `useSearchParams()` MUST be wrapped in `<Suspense>`. This applies even with `'use client'` and `dynamic = 'force-dynamic'`. The pattern: always split into outer page shell (Suspense) + inner content component. This is a breaking change from Next.js 13/14. Apply this pattern to any future page using `useSearchParams`, `usePathname` with dynamic segments, or any hook that reads request-time data.

---

### Issue #005
- **Date:** 2026-03-20
- **Phase:** 1 — Frontend Build
- **Build:** Amplify Job #5
- **File:** `apps/web/app/(auth)/forgot-password/page.tsx` line 76
- **Error:**
  ```
  Type error: Argument of type '(data: { email: string; }) => Promise<void>'
  is not assignable to parameter of type 'SubmitHandler<FieldValues>'.
    Types of parameters 'data' and 'data' are incompatible.
    Property 'email' is missing in type 'FieldValues' but required in type '{ email: string; }'.
  ```
- **Root Cause:** `useForm()` without a generic type parameter defaults to `FieldValues` (which is `Record<string, any>`). When `handleSubmit` is called with a typed callback `(data: { email: string }) => ...`, TypeScript cannot guarantee the typed property exists in `FieldValues`, causing an incompatible types error. Login and register pages correctly used `useForm<FormData>(...)` but forgot-password missed the generic.
- **Fix:** Added Zod-inferred generic to both form instances:
  ```typescript
  // Before (broken):
  const emailForm = useForm({ resolver: zodResolver(emailSchema) })
  // After (fixed):
  const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) })
  ```
- **Commit:** `b8fcca8 fix: TypeScript SubmitHandler type error in forgot-password page`
- **Lesson:** ALWAYS pass the Zod schema type as generic to `useForm<z.infer<typeof schema>>()`. Without it, TypeScript loses the type contract between the form schema and submit handler, causing TS errors only at build time (not in the editor if strict mode is off locally).

---

## Phase 2 — HR Admin
*Not started yet*

---

## Phase 3 — Employee
*Not started yet*

---

## Phase 4 — Polish & Demo
*Not started yet*

---

## Pre-Phase 0 — Legacy Issues (before proper GitHub CI/CD was established)

These issues occurred before the GitHub-first approach was adopted. Recorded for full transparency and learning.

| # | Error | Root Cause | Fix |
|---|-------|-----------|-----|
| L001 | `pnpm: prisma command not found` | Prisma binary not in PATH during Amplify build | Removed Prisma entirely, rebuilt with DynamoDB SDK |
| L002 | `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND` | Build commands ran from wrong directory | Used `$CODEBUILD_SRC_DIR/repo-name` |
| L003 | `Artifacts base directory not found` | `baseDirectory: apps/web/.next` wrong — should be `.next` relative to appRoot | Changed to `baseDirectory: .next` |
| L004 | Amplify repo reconnect blocked | GitHub token had push but not admin rights on endevo-life org | Moved to shahzadms7/endevo-life repo |
| L005 | Secret name `GITHUB_TOKEN_*` rejected | GitHub reserves all `GITHUB_` prefix names | Renamed to `GH_TOKEN_AMPLIFY` |

---

## Error Pattern Analysis

| Pattern | Occurrences | Prevention |
|---------|-------------|-----------|
| CDK TypeScript type mismatch | 1 (Issue #001) | Check CDK changelog before using new constructs |
| CDK Token used as string | 1 (Issue #002) | Never use `resource.propertyName` as a construct ID |
| Wrong directory in build commands | 1 (L002) | Always use absolute env vars like `$CODEBUILD_SRC_DIR` |
| Reserved prefix in secret names | 1 (L005) | Avoid `GITHUB_`, `AWS_` prefixes in custom secret names |

---

## [2026-04-03] Deep QA Audit — LMS Module

### BUG-001: Video page fetches quiz questions with wrong response key
- **File:** `apps/web/app/(employee)/employee/lms/module/[moduleNum]/video/[videoId]/page.tsx` line 37, 42
- **Issue:** `api.lmsGetQuizQuestions()` was typed as returning `{ quizzes: QuizPopup[] }` and accessed as `quizRes.quizzes`. The actual backend (`routes/quiz.py`) returns `{ videoId, questions: [...] }`. Result: inline quiz popups NEVER appeared during video playback.
- **Fix:** Changed type to `{ questions: QuizPopup[] }` and access to `quizRes.questions`.
- **Severity:** CRITICAL — quiz popups silently broken for all users

### BUG-002: Module detail page wraps API response in wrong key
- **File:** `apps/web/app/(employee)/employee/lms/module/[moduleNum]/page.tsx` line 128-130
- **Issue:** Code did `res.module` but `_get_module_detail` returns a flat object at the top level (not nested under a `module` key). Result: `module` state was always `null`, page showed "Module not found" for every module.
- **Fix:** Changed `res.module` → `res` and typed as `ModuleDetail` directly.
- **Severity:** CRITICAL — entire module detail page was broken

### BUG-003: Module detail page video type/progress mismatch with backend schema
- **File:** `apps/web/app/(employee)/employee/lms/module/[moduleNum]/page.tsx`
- **Issue:** Frontend `Video` interface used `type` (backend returns `videoType`), `progressPct` (backend returns `progress.percent`), `completed` (backend returns `progress.completed`), `durationSeconds` (backend returns `duration`). Result: video cards always showed 0% progress, wrong video type badges, wrong completion state, wrong duration.
- **Fix:** Updated `Video` interface to include both field names. Added `normaliseVideo()` helper that maps backend shape to frontend shape before rendering.
- **Severity:** HIGH — progress display broken for all module videos

### BUG-004: Admin questions page uses wrong question type value for inline quizzes
- **File:** `apps/web/app/(global-admin)/admin/lms/questions/page.tsx`
- **Issue:** `QuestionType` was `'assessment' | 'quiz'` and the dropdown submitted `type: 'quiz'`. Backend (`routes/admin.py`) only accepts `'assessment'` or `'inline'`. Creating an inline quiz question would always fail with 400.
- **Fix:** Changed `QuestionType` to `'assessment' | 'inline'`. Updated dropdown option value and all conditional checks from `'quiz'` to `'inline'`. Updated tab filter array.
- **Severity:** CRITICAL — admin could not create inline quiz questions

### BUG-005: ScorecardDisplay domain icons never match (wrong lookup key)
- **File:** `apps/web/components/lms/ScorecardDisplay.tsx`
- **Issue:** `DOMAIN_ICONS` used short keys (`'Legal'`, `'Financial'`) but the scorecard `domainScores` object is keyed by full domain names (`'Legal Readiness'`, `'Financial Readiness'`). Also `moduleRecommendations` uses `'Foundation'` and `'Communicate Your Wishes'` as domain names. Result: all domain icons showed `📌` fallback instead of meaningful icons.
- **Fix:** Added full domain name entries to `DOMAIN_ICONS` map alongside the short names. Also added `'Foundation'` and `'Communicate Your Wishes'` entries.
- **Severity:** MEDIUM — visual only but affects assessment results page appearance

### BUG-006: Assessment intro screen shows wrong "Pass Score: 90%" stat
- **File:** `apps/web/app/(employee)/employee/lms/assessment/page.tsx` line 138-141
- **Issue:** The stat card showed "Pass Score: 90%" which directly contradicts the business rule that there is no pass/fail gate — completing the assessment (any score) unlocks all modules.
- **Fix:** Changed stat to "Unlocks All: 6 Modules" with a lock icon.
- **Severity:** HIGH — misinforms users about assessment mechanics

### BUG-007: Locked module shows wrong "Complete Module X first" message
- **File:** `apps/web/app/(employee)/employee/lms/page.tsx` line 136
- **Issue:** Locked modules displayed "Complete Module X first" implying sequential unlock. Business rule is all modules unlock simultaneously after assessment. Message would confuse users trying to unlock Module 3 by completing Module 2 (impossible — only assessment unlocks modules).
- **Fix:** Changed to "Complete the Readiness Assessment to unlock".
- **Severity:** HIGH — wrong UX guidance contradicts actual unlock mechanism

### BUG-008: Admin LMS progress page — wrong response key for user detail
- **File:** `apps/web/app/(global-admin)/admin/lms/progress/page.tsx` line 246
- **Issue:** `handleOpenUser` did `res.user` to get user detail. The backend `_get_user_progress` returns the data flat: `{ userId, moduleProgress, videoProgress, latestAssessment, certificate }`. Result: clicking any user row showed empty detail modal.
- **Fix:** Typed response as `UserProgressDetail` directly (no `.user` wrapper). Updated `UserProgressDetail` interface to match actual backend fields (`moduleProgress`, `videoProgress`, `latestAssessment`).
- **Severity:** CRITICAL — admin user detail modal was completely broken

### BUG-009: Admin LMS progress page — summary list has no email/firstName/name fields
- **File:** `apps/web/app/(global-admin)/admin/lms/progress/page.tsx`
- **Issue:** The summary list endpoint returns `{ userId, modulesUnlocked, modulesCompleted, latestModuleCompleted }`. Frontend assumed `email`, `firstName`, `lastName`, `assessmentPassed`, `modules` existed. Search threw error, user names showed blank.
- **Fix:** Rewrote `UserProgress` interface to match actual summary shape. Updated table rows to display `userId` when name/email not available. Fixed `passedCount` and `completedAllCount` calculations. Fixed search to work on `userId`.
- **Severity:** HIGH — admin progress table non-functional

### BUG-010: Admin LMS progress detail modal uses wrong field name for modules
- **File:** `apps/web/app/(global-admin)/admin/lms/progress/page.tsx` line 59 (original)
- **Issue:** `user.modules ?? user.weeks` but backend returns `moduleProgress`. Module-by-module grid in detail modal always showed empty.
- **Fix:** Changed to `user.moduleProgress ?? []`.
- **Severity:** HIGH — module detail grid in admin modal was always empty

### BUG-011: Admin LMS progress detail modal — video progress uses wrong field names
- **File:** `apps/web/app/(global-admin)/admin/lms/progress/page.tsx`
- **Issue:** Modal rendered `user.videos` (undefined) and accessed `v.progressPct` (backend returns `v.percent`). Video progress section never appeared.
- **Fix:** Changed to `user.videoProgress` and `v.percent ?? 0`. Added fallback `v.title ?? v.videoId`.
- **Severity:** MEDIUM — video progress panel in admin modal was hidden

### BUG-012: HR LMS progress page — lockStatus value 'completed' vs 'complete'
- **File:** `apps/web/app/(hr-admin)/hr/lms/progress/page.tsx`
- **Issue:** `moduleIcon()` checked `mod.lockStatus === 'completed'` but backend DynamoDB schema uses `'complete'` (no trailing 'd'). All completed modules showed 🔒 instead of ✅. The `modulesCompleted` stat also used the wrong string.
- **Fix:** Changed both checks to accept both `'complete'` and `'completed'` for safety.
- **Severity:** HIGH — completed modules wrongly showed as locked in HR dashboard

### BUG-013: HR LMS progress page — email access throws when undefined
- **File:** `apps/web/app/(hr-admin)/hr/lms/progress/page.tsx` line 242
- **Issue:** `u.email.toLowerCase()` in filter and `{user.email}` in table cell throw TypeError when email field is missing (summary endpoint does not return email).
- **Fix:** Added null coalescence: `(u.email ?? u.userId ?? '').toLowerCase()` and `{user.email ?? user.userId}`.
- **Severity:** MEDIUM — page could crash when filtering if email missing

### BUG-014: HR LMS progress page — missing React import for React.ElementType
- **File:** `apps/web/app/(hr-admin)/hr/lms/progress/page.tsx`
- **Issue:** `SummaryCard` component prop `icon: React.ElementType` requires `import React` per Next.js 15 JSX transform rules. Missing import causes TypeScript/build error.
- **Fix:** Added `React,` to the existing useState/useMemo import.
- **Severity:** HIGH — would cause Amplify build failure

---

*This log is maintained by the engineering team. Every issue must be recorded before the fix is merged.*
*Last updated: 2026-04-03 | Total issues: 37 (23 resolved + 14 new LMS QA fixes)*

---

## Phase 1 — QA Session Issues (2026-03-21)

### Issue #008
- **Date:** 2026-03-21
- **Phase:** 1 — Backend QA
- **Lambda:** endevo-uat-fn-hr
- **Error:** Audit log returns 0 entries after all HR actions
- **Root Cause:** `endevo-uat-audit` table has composite key (`tenantId` HASH + `sk` RANGE). Lambda `put_item` did not include `sk`. DynamoDB raised `ValidationException` but `except: pass` swallowed it silently.
- **Fix:** `hr/main.py` audit function now writes `sk = f"{now}#{audit_id}"`. Changed `except: pass` to `except Exception as e: print(f"AUDIT_WRITE_ERROR: {e}")`
- **Lesson:** NEVER use bare `except: pass`. Always log errors. DynamoDB composite-key tables MUST include ALL key attributes in every put_item.

---

### Issue #009
- **Date:** 2026-03-21
- **Phase:** 1 — Backend QA
- **Lambda:** endevo-uat-fn-employee
- **Error:** Assessment returns 20 questions (all tenants) instead of 5 (own tenant only)
- **Root Cause:** Questions scan only filtered `courseId = :c`. All 4 tenants had the same courseId, so all 4 × 5 = 20 questions returned.
- **Fix:** Changed scan filter to `tenantId = :t AND courseId = :c`
- **Lesson:** Every scan that should be tenant-scoped MUST include `tenantId` filter.

---

### Issue #010
- **Date:** 2026-03-21
- **Phase:** 1 — Backend QA
- **Lambda:** endevo-uat-fn-employee
- **Error:** `PROG_T.put_item` failing silently — video-progress table `ValidationException`
- **Root Cause:** `endevo-uat-video-progress` requires `userId` (HASH) + `videoId` (RANGE). Lambda was writing `courseId` but not `videoId`.
- **Fix:** Lambda now writes `videoId = course_id` alongside `courseId = course_id`
- **Lesson:** Check ACTUAL DynamoDB table key schema against Lambda code. Never assume schema without verifying.

---

### Issue #011
- **Date:** 2026-03-21
- **Phase:** 1 — Backend QA
- **Lambda:** endevo-uat-fn-employee
- **Error:** Dashboard `completed_courses` stays 0 after passing assessment
- **Root Cause:** Assessment submit endpoint issued certificate but did not write progress record with `completed = True`
- **Fix:** Added `PROG_T.put_item({..., completed: True, progressPct: 100})` inside `if passed:` block
- **Lesson:** When one action should update multiple state stores, do it atomically in the same Lambda invocation.

---

### Issue #012
- **Date:** 2026-03-21
- **Phase:** 1 — Frontend QA
- **Files:** All dashboard pages
- **Error:** All 3 dashboards showed hardcoded "—" values. No API calls made.
- **Root Cause:** Frontend was never connected to APIs. Only static placeholders existed.
- **Fix:** Built 15 new pages, shared `lib/api.ts`, 3 sidebar layouts with logout. Full API integration.
- **Lesson:** Phase 1 is not complete until frontend AND backend are connected end-to-end.

---

### Issue #013 (OPEN)
- **Date:** 2026-03-21
- **Phase:** 1 — Backend QA
- **Lambda:** endevo-uat-fn-admin
- **Error:** `PUT /api/admin/tenants/fake-id` returns 200 "Tenant updated" instead of 404
- **Root Cause:** DynamoDB `update_item` is an upsert — creates item if it doesn't exist
- **Fix Required:** Add `get_item` check before `update_item`. Return 404 if item not found.
- **Status:** OPEN — low priority, no data corruption risk

---

### Issue #003
- **Date:** 2026-03-20
- **Phase:** 0 — CDK Infrastructure
- **Run:** GitHub Actions Run #3
- **Stack:** EndevoUatAmplify
- **Error:**
  ```
  ChangeSetNotFound: ChangeSet [cdk-deploy-change-set] does not exist
  EndevoUatAmplify: REVIEW_IN_PROGRESS (stuck state)
  ```
- **Root Cause:** CDK attempted to deploy the Amplify stack while a previous partial deployment left it in `REVIEW_IN_PROGRESS` state. CloudFormation was waiting for a change set review that never completed, blocking all subsequent deployments.
- **Fix:** Manually deleted stuck `EndevoUatAmplify` CloudFormation stack via AWS CLI: `aws cloudformation delete-stack --stack-name EndevoUatAmplify`. Triggered Run #4 to redeploy cleanly.
- **Lesson:** When a CDK stack is stuck in `REVIEW_IN_PROGRESS`, `CREATE_FAILED`, or `ROLLBACK_FAILED`, it must be manually deleted before CDK can redeploy it. Add a pre-deploy cleanup step if this becomes recurring.
- **Status after fix:** 5/6 stacks CREATE_COMPLETE. Run #4 deploying EndevoUatAmplify.

---

### Issue #004
- **Date:** 2026-03-20
- **Phase:** 1 — Frontend Build
- **Build:** Amplify Job #3
- **Error:**
  ```
  ERR_PNPM_NO_LOCKFILE: Cannot install with "frozen-lockfile" because pnpm-lock.yaml is absent
  ```
- **Root Cause:** `--frozen-lockfile` requires a committed `pnpm-lock.yaml`. The lockfile was never generated and committed — the repo only has `package.json` files. Amplify has no way to generate it during build when frozen mode is active.
- **Fix:** Changed `pnpm install --frozen-lockfile` to `pnpm install --no-frozen-lockfile` in `amplify.yml`. This lets pnpm resolve and install packages freely. Next step: commit the generated lockfile after first successful build for reproducibility.
- **Lesson:** Always commit `pnpm-lock.yaml` to the repo. For a new project with no lockfile, use `--no-frozen-lockfile` for the first build, then commit the generated lockfile for future builds.

---

## Session 4 — TypeScript Build Failures (2026-03-28)

### Issue #014
- **Date:** 2026-03-28
- **Phase:** 4 — Dashboard Rebuild
- **Build:** Amplify Jobs #26, #27, #28 (3 consecutive failures)
- **File:** `apps/web/lib/api.ts`
- **Error:** `Type error: Argument of type 'Record<string, unknown>' is not assignable to parameter of type '{ name: string; plan?: string | undefined; maxSeats?: number | undefined; }'`
- **Root Cause:** `adminCreateTenant` was typed as `(body: { name: string; plan?: string; maxSeats?: number })` but the tenants page was passing additional fields (website, hrContact, hrEmail). TypeScript strict mode rejected the call even with `as Record<string,unknown>` cast at the call site.
- **Fix:** Changed `adminCreateTenant` body type to `Record<string, unknown>` in `api.ts`
- **Lesson:** Use `Record<string, unknown>` for body types when the API accepts arbitrary extra fields. Don't use narrow object types that will break when backend adds new accepted fields.
- **GitHub Issue:** #N/A (resolved before issue tracking was set up)

---

### Issue #015
- **Date:** 2026-03-28
- **Phase:** 4 — Dashboard Rebuild
- **Build:** Amplify Jobs #26, #27, #28
- **Files:** `admin/dashboard/page.tsx`, `employee/dashboard/page.tsx`, `admin/health/page.tsx`
- **Error:** `'React' refers to a UMD global, but the current file is a module. Consider adding an import instead.`
- **Root Cause:** All three dashboard files used `React.ElementType` as a prop type for icon components, but in Next.js 15 with the new JSX transform, `import React` is NOT auto-injected. Referencing `React.*` types without importing the namespace causes TypeScript to error.
- **Fix:** Added `import React,` to the existing `{ useEffect, useState, useCallback }` import line in all three files.
- **Lesson:** In Next.js 15, you don't need `import React` for JSX, but you DO need it when referencing `React.ElementType`, `React.FC`, `React.ReactNode` etc. as type annotations.
- **GitHub Issue:** #N/A (resolved before issue tracking was set up)

---

## Session 5 — Full QA + Security Audit (2026-03-28)

### Issue #016 — GitHub Issue #1
- **Date:** 2026-03-28
- **Phase:** QA
- **Lambda:** endevo-uat-fn-admin
- **Error:** `GET /api/admin/users?role=HR_ADMIN` returns count=0. HR Admins invisible in admin UI.
- **Root Cause:** HR_ADMIN users were seeded into Cognito only. Admin users list scans DynamoDB, which had 0 HR_ADMIN records.
- **Fix:** Backfilled 4 HR_ADMIN users into DynamoDB (hr@acme, hr@techvision, hr@globalhr, niki.hr@nikicorp). New invite flow (Lambda v2) correctly writes to both Cognito + DynamoDB.
- **Lesson:** Seed scripts must write to ALL data stores (Cognito + DynamoDB). Audit scripts should detect Cognito/DynamoDB divergence.

---

### Issue #017 — GitHub Issue #2
- **Date:** 2026-03-28
- **Phase:** QA / Security
- **Lambda:** endevo-uat-fn-admin + endevo-uat-fn-hr
- **Error:** Input `<script>alert(1)</script>` passed through sanitize() and created a tenant with name `>alert(1)</>` — XSS was neutralized but residual garbage was stored.
- **Root Cause:** `sanitize()` only stripped specific keyword substrings (`<script`, `</script`) leaving surrounding characters intact. No check on the raw input before sanitization.
- **Fix:** Changed sanitize() to strip ALL HTML tags via `re.sub(r'<[^>]*>', '', v)`. Added raw input pre-check: reject any input containing `<`, `>`, or `on*=` with 400 error before sanitizing.
- **Lesson:** Sanitization should strip tags completely (regex), not keyword-by-keyword. Always validate raw input for forbidden characters in addition to sanitizing.

---

### Issue #018 — GitHub Issue #3
- **Date:** 2026-03-28
- **Phase:** QA
- **Lambda:** endevo-uat-fn-admin
- **Error:** `GET /api/admin/tenants?search=acme` returns count=0. Tenant search completely broken.
- **Root Cause:** DynamoDB `Attr("name").contains(search)` is case-sensitive. "acme" does not match "Acme Corporation".
- **Fix:** Removed DynamoDB-level name contains filter. Added Python-side case-insensitive filter after scan: `if sl in t.get("name","").lower()`.
- **Lesson:** DynamoDB has no native case-insensitive string search. Always do case-insensitive filtering in application code.

---

### Issue #019 — GitHub Issue #4
- **Date:** 2026-03-28
- **Phase:** QA / Infrastructure
- **Lambda:** All 4 functions
- **Error:** After push to GitHub, all API calls returned 500. Amplify built fine, Lambda was still on old code.
- **Root Cause:** No CI/CD pipeline for Lambda deployment. Amplify only builds Next.js frontend. Lambda code must be manually zipped and deployed via `aws lambda update-function-code`.
- **Fix:** Manually deployed all 4 Lambdas. Identified gap.
- **Required Action:** GitHub Actions workflow to auto-deploy Lambdas on changes to `backend/functions/`.
- **Lesson:** Every deployable artifact needs its own CI/CD pipeline. Amplify ≠ Lambda deployment.

---

### Issue #020 — GitHub Issue #5
- **Date:** 2026-03-28
- **Phase:** QA / Infrastructure
- **Lambda:** endevo-uat-fn-admin
- **Error:** Health page showed `ses: error`. Overall system status showed degraded.
- **Root Cause:** Lambda IAM role had `ses:SendEmail` and `ses:SendRawEmail` but NOT `ses:GetSendQuota`. Health check calls `ses.get_send_quota()` which requires the missing permission.
- **Fix:** Added `ses:GetSendQuota` and `ses:GetAccountSendingEnabled` to `LambdaRoleDefaultPolicy75625A82` inline policy via AWS CLI.
- **Lesson:** When adding a new AWS API call to Lambda, always check if the IAM role has permission for that specific action. GetX permissions are separate from SendX permissions in SES.

---

## Session 6 — Full Bug Hunt + Enterprise Hardening (2026-03-29)

### Issue #021
- **Date:** 2026-03-29
- **Phase:** 1 — Admin Module
- **Lambda:** endevo-uat-fn-admin
- **Error:** ALL admin API routes returned 500 Internal Server Error immediately after login
- **Root Cause:** Python syntax error — `audit()` calls had `ip=ip, device=device` placed INSIDE `.get()` parentheses instead of as separate function arguments. This caused `Runtime.UserCodeSyntaxError` crashing the entire Lambda on cold start.
- **Example:** `audit(item.get("tenantId", "SYSTEM", ip=ip, device=device), ...)` — wrong
- **Fix:** Moved `ip=ip, device=device` outside `.get()` to correct `audit(item.get("tenantId","SYSTEM"), ..., ip=ip, device=device)` — fixed all 10 occurrences. Validated with `ast.parse()` before deploying.
- **Lesson:** Python keyword arguments placed inside a nested call crash the outer function. Always run `ast.parse()` on Lambda code before deploying. One syntax error kills ALL routes.

---

### Issue #022
- **Date:** 2026-03-29
- **Phase:** 1 — Admin Module (Frontend)
- **File:** `apps/web/app/(global-admin)/admin/tenants/page.tsx`, `admin/users/page.tsx`
- **Error:** "Application error: a client-side exception has occurred" — blank white screen on both pages
- **Root Cause:** `React.ReactNode` and `React.ElementType` used as TypeScript types in helper components, but `import React` was missing. Next.js 15 new JSX transform does not auto-inject React namespace for type references.
- **Fix:** Added `import React,` to both files.
- **Lesson:** In Next.js 15, `React.*` TYPE references (ReactNode, ElementType, Fragment, ChangeEvent) require explicit `import React` even though JSX does not.

---

### Issue #023
- **Date:** 2026-03-29
- **Phase:** 1 — Auth (Frontend)
- **File:** `apps/web/app/(auth)/login/page.tsx`
- **Error:** CAPTCHA error message never appeared when user entered wrong answer
- **Root Cause:** `refreshCaptcha()` was called immediately after `setCaptchaErr(true)`, and `refreshCaptcha()` also called `setCaptchaErr(false)` — resetting the error before React rendered it.
- **Fix:** Separated concerns — `refreshCaptcha()` only resets question/input. Error state managed independently.
- **Lesson:** Never reset error state inside a shared utility function. Keep error state changes isolated.

---

### Issue #024
- **Date:** 2026-03-29
- **Phase:** 1 — Auth (Frontend)
- **File:** `apps/web/app/(auth)/login/page.tsx`
- **Error:** MFA verification always failed with network error
- **Root Cause:** MFA submit called `/api/auth/mfa` (relative URL → Next.js server) instead of `${NEXT_PUBLIC_API_URL}/api/auth/mfa` (Lambda).
- **Fix:** Changed to `${process.env.NEXT_PUBLIC_API_URL}/api/auth/mfa`.
- **Lesson:** All backend calls must use `NEXT_PUBLIC_API_URL`. Relative `/api/` paths hit Next.js server-side routes, not Lambda.

---

### Issue #025
- **Date:** 2026-03-29
- **Phase:** 1 — Auth (Frontend)
- **File:** `apps/web/lib/auth/cognito.ts`
- **Error:** Sidebar showed wrong username, layout displayed "Admin" placeholder instead of real name
- **Root Cause:** `user_email` cookie was never set after login. Sidebar reads from this cookie.
- **Fix:** Added `Cookies.set('user_email', data.email || '', ...)` to `signIn()` function.
- **Lesson:** Every piece of data consumed by the UI (role, email, token) must be explicitly set in the cookie after login.

---

### Issue #026
- **Date:** 2026-03-29
- **Phase:** 1 — Admin Module (Frontend)
- **Files:** `admin/subscriptions/page.tsx`, `admin/tenants/page.tsx`, `admin/users/page.tsx`, `hr/employees/page.tsx`
- **Error:** Pages crashed with TypeError when DynamoDB returned records with missing `name`, `email`, or `firstName` fields
- **Root Cause:** Code accessed `t.name[0]`, `u.email[0]`, `t.name.toLowerCase()`, `u.email.toLowerCase()` without null guards. TypeScript types said these were `string` but DynamoDB can return `undefined` for any attribute.
- **Fix:** Added optional chaining and null coalescing everywhere: `(t.name?.[0] ?? '?').toUpperCase()`, `(t.name || '').toLowerCase()`, `(u.email || '').toLowerCase()`.
- **Lesson:** NEVER trust TypeScript types for DynamoDB data. All fields from external APIs must be treated as potentially undefined, regardless of the interface definition. Always use `?.` and `|| ''`.

---

### Issue #027
- **Date:** 2026-03-29
- **Phase:** 1 — All Modules (Frontend)
- **Files:** All route group pages
- **Error:** Any crash caused a blank white "Application error" screen with no recovery path
- **Root Cause:** No React Error Boundary existed at any level. Next.js shows a generic crash screen with no "Try Again" or navigation options.
- **Fix:** Added `error.tsx` to all 4 route groups: root, `(global-admin)`, `(hr-admin)`, `(employee)`. Each shows error message, "Try Again", and navigation back to dashboard.
- **Lesson:** Every Next.js route group MUST have `error.tsx`. This is the most important resilience pattern — it turns a total crash into a recoverable error state.

---

### Issue #028
- **Date:** 2026-03-29
- **Phase:** 1 — Auth (Middleware)
- **File:** `apps/web/middleware.ts`
- **Error:** `/signup` page redirected to `/login` when accessed directly
- **Root Cause:** `/signup` was not in the `PUBLIC_PATHS` array in middleware. Middleware intercepted the request and redirected unauthenticated users away.
- **Fix:** Added `/signup` to `PUBLIC_PATHS`.
- **Lesson:** Every public page (login, register, signup, forgot-password) must be explicitly listed in middleware PUBLIC_PATHS.

---

### Issue #029
- **Date:** 2026-03-29
- **Phase:** 1 — API Layer (Frontend)
- **File:** `apps/web/lib/api.ts`
- **Error:** Network failures showed raw `TypeError: Failed to fetch` with no user-friendly message
- **Root Cause:** `apiFetch` only handled HTTP error responses (`!res.ok`) but not network-level failures (offline, CORS, DNS). Also, `res.json()` could throw if server returned non-JSON response (e.g., 502 HTML error page from API Gateway).
- **Fix:** Wrapped `fetch()` in try/catch for network errors. Wrapped `res.json()` in try/catch for parse errors. Improved error message extraction.
- **Lesson:** Every API call has 3 failure modes: (1) network down, (2) server returns non-JSON, (3) server returns JSON error. All 3 must be handled separately.

---

## Session 7 — Enterprise Control Center + HR Parity (2026-03-29)

### Issue #030
- **Date:** 2026-03-29
- **Phase:** 4 — Admin Module
- **File:** `apps/web/app/(global-admin)/admin/settings/page.tsx`
- **Error:** `Type error: Argument of type 'PlatformCfg' is not assignable to parameter of type 'Record<string, unknown>'`
- **Root Cause:** `saveSection()` was typed as `(section: string, values: Record<string, unknown>)`. Passing `cfg.platform` (type `PlatformCfg`) failed TypeScript strict type checking — named interfaces are not assignable to index signatures.
- **Fix:** Changed param type to `unknown`, cast inside: `await api.adminUpdateConfig(section, values as Record<string, unknown>)`
- **Lesson:** When passing typed objects to generic API functions, use `unknown` param + internal cast rather than trying to make interfaces extend index signatures.

---

### Issue #031
- **Date:** 2026-03-29
- **Phase:** 4 — Tenant Module (Backend)
- **Lambda:** endevo-uat-fn-admin
- **Error:** `POST /api/admin/invite` with role=GLOBAL_ADMIN returned 500 — DynamoDB GSI rejected empty string for `tenantId` partition key
- **Root Cause:** GLOBAL_ADMIN users have no tenant. Invite code set `tenant_id = ""` then wrote it to the `tenantId-index` GSI which rejects empty string partition keys.
- **Fix:** Added `if user_role == "GLOBAL_ADMIN": tenant_id = "SYSTEM"` before DynamoDB write.
- **Lesson:** DynamoDB GSI partition keys cannot be empty strings. Always assign a sentinel value (`"SYSTEM"`) for records that logically have no tenant.

---

### Issue #032
- **Date:** 2026-03-29
- **Phase:** 4 — Tenant Module (Backend + Frontend)
- **Error:** Creating a new tenant stored HR admin email as metadata only — no Cognito account created, no login possible, no email sent
- **Root Cause:** `POST /api/admin/tenants` only created the tenant record. HR admin contact fields were stored as text strings, not user accounts.
- **Fix:** Rewrote tenant creation to: (1) validate hrEmail as mandatory, (2) create Cognito user for HR admin, (3) write DynamoDB user record, (4) send branded welcome email with temp password. Cognito rollback added if DynamoDB write fails.
- **Lesson:** Every time a tenant is created in a multi-tenant SaaS, the first HR admin must be auto-provisioned atomically. Never store contact info as metadata without backing accounts.

---

### Issue #033
- **Date:** 2026-03-29
- **Phase:** 4 — Auth (Backend + Frontend)
- **File:** `backend/functions/auth/main.py`, `apps/web/app/(auth)/login/page.tsx`
- **Error:** OTP login — after entering correct 6-digit code, user was redirected back to login page instead of dashboard
- **Root Cause:** `api.verifyOtp()` returned JWT tokens but the login page never set cookies. `middleware.ts` checked for `access_token` cookie — which was missing — and bounced user to login.
- **Fix:** Added cookie-setting code in `onOtpSubmit()`: `Cookies.set('access_token', ...)`, `Cookies.set('user_role', ...)`, `Cookies.set('user_email', ...)`
- **Lesson:** Token verification and cookie persistence are separate steps. Every login path (password, OTP, MFA) must explicitly set all required cookies before redirecting.

---

### Issue #034
- **Date:** 2026-03-29
- **Phase:** 4 — Employee Module (Backend)
- **Lambda:** endevo-uat-fn-employee
- **Error:** Employee training page showed empty course list despite courses existing in DynamoDB
- **Root Cause:** Training table uses composite key `(tenantId PK, videoId SK)`. Code used `scan()` with a FilterExpression string — string-format filter expressions are not valid in boto3 resource API (only Attr() conditions are). Also progress map was keyed by `courseId` but table stores key as `videoId`.
- **Fix:** Replaced scan with `TRAIN_T.query(KeyConditionExpression=Key("tenantId").eq(tenant_id))`. Fixed progress map to index by both `videoId` and `courseId` for safety.
- **Lesson:** DynamoDB resource API (boto3) requires `Attr()` and `Key()` condition objects, never plain string FilterExpressions. Always use Query (not Scan) when the partition key is known.

---

### Issue #035
- **Date:** 2026-03-29
- **Phase:** 4 — HR Module (Backend)
- **Lambda:** endevo-uat-fn-hr
- **Error:** Invited employees could log in but saw blank org name in sidebar (shown as empty string)
- **Root Cause:** HR invite created Cognito user without setting `custom:tenantName` attribute. Employee Lambda reads `custom:tenantName` from JWT to display org name.
- **Fix:** Added tenant name lookup from DynamoDB before Cognito user creation. Set `custom:tenantName` in `UserAttributes` list.
- **Lesson:** All Cognito custom attributes must be set at user creation. They cannot be read from DynamoDB at runtime without an extra API call — store in JWT attributes for efficiency.

---

### Issue #036
- **Date:** 2026-03-29
- **Phase:** 4 — HR Module (Backend)
- **Lambda:** endevo-uat-fn-hr
- **Error:** Deactivating an employee from HR dashboard only changed DynamoDB status — employee could still login via Cognito
- **Root Cause:** `DELETE /api/hr/employees/{id}` only wrote `status: inactive` to DynamoDB. Cognito account remained enabled.
- **Fix:** Added `cognito.admin_disable_user()` call before DynamoDB update. Added `admin_enable_user()` in new reactivate endpoint.
- **Lesson:** User deactivation in a Cognito-backed system requires TWO operations: (1) disable in Cognito (blocks login), (2) update status in DynamoDB (blocks API). Missing either one leaves a security gap.

---

### Issue #037
- **Date:** 2026-03-29
- **Phase:** 4 — Build
- **File:** `apps/web/app/(global-admin)/admin/subscriptions/page.tsx`
- **Error:** `Type error: Cannot find name 'Download'` — Amplify build #52 failed
- **Root Cause:** Added `Download` icon usage (`exportCsv` button) but forgot to add it to the lucide-react import line.
- **Fix:** Added `Download` to the import: `CreditCard, ..., Settings, Download`
- **Lesson:** After adding any new Lucide icon, always verify it appears in the import statement. TypeScript only catches this at build time, not during local dev if tsconfig is loose.

---
