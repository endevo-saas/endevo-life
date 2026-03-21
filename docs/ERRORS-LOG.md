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

*This log is maintained by the engineering team. Every issue must be recorded before the fix is merged.*
*Last updated: 2026-03-21 | Total issues: 13 (8 active phase + 5 legacy)*

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
