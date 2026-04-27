# HEAL CHECK 2 — Amplify Build Log (Job 131)

## Log URL
Retrieved via `aws amplify get-job --app-id d1vvfv8oltolcf --branch-name main --job-id 131 --query "job.steps[?stepName=='BUILD'].logUrl"`.
Downloaded to `.investigation/build131.log` (15,912 bytes).

## Smoking Gun — Clone line (line 2 of build log)

```
2026-04-19T17:06:06.418Z [INFO]: # Cloning repository: git@github.com:endevo-saas/endevo-life.git
2026-04-19T17:06:07.610Z [INFO]: Cloning into 'endevo-life'...
```

Amplify is cloning from **GitHub** `endevo-saas/endevo-life`, NOT from CodeCommit.

## No commit SHA in log

The log does **not** print `CODEBUILD_RESOLVED_SOURCE_VERSION` nor the checked-out SHA.
Amplify job metadata returns `commitId: "HEAD"` (literal string) for every job — a
known Amplify-GitHub integration quirk.

## Build phase commands (confirmed)

```
# Executing command: cd $CODEBUILD_SRC_DIR/endevo-life && npm install --legacy-peer-deps
# Executing command: cd $CODEBUILD_SRC_DIR/endevo-life && NEXT_PUBLIC_API_URL=... npx turbo run build --filter=@endevo/web
```

Build path is correct; source repository is wrong.

## GitHub main HEAD vs local

- `gh api repos/endevo-saas/endevo-life/commits/main` → **`bf8b5cd`** ("fix: employee dashboard complete with 7 features, Sentry…")
- Local `git rev-parse HEAD` → `7913ebb` ("fix(auth): resolve Verification failed bug — detail field + stale bundle")
- Local `git remote -v` → `origin codecommit::us-east-1://endevo-life`

Commits `0f9a3fa`, `0d035b5`, `7e30af6`, `4e54c7b`, `7913ebb` (the whole Cognito migration) live only on CodeCommit. GitHub `main` is ~5 commits stale.

## Conclusion
Amplify job 131 SUCCEEDED building GitHub `main` at `bf8b5cd` — which pre-dates the Cognito migration. The new chunk hash `9eecf321d163bd33` is cosmetic (Next.js rehashed due to cache miss / env vars), but the source inside is pre-migration (still uses `otp_ref`).
