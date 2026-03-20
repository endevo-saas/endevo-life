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
*No issues recorded yet — in progress*

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
*Last updated: 2026-03-20 | Total issues: 7 (2 active phase + 5 legacy)*
