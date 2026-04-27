# HEAL CHECK 6 — Amplify branch + repo source

## Branch (main)

```json
{
  "stage": "PRODUCTION",
  "framework": "Next.js - SSR",
  "activeJobId": "0000000131",
  "enableAutoBuild": true,
  "sourceBranch": null,
  "backend": {}
}
```

## App

```json
{
  "repository": "https://github.com/endevo-saas/endevo-life",
  "platform": "WEB_COMPUTE",
  "defaultDomain": "d1vvfv8oltolcf.amplifyapp.com",
  "enableBranchAutoBuild": false
}
```

## Expected vs actual

| Field | Expected | Actual |
|---|---|---|
| repository | `codecommit://endevo-life` | **`https://github.com/endevo-saas/endevo-life`** |

## Local git remote (where we push)

```
origin  codecommit::us-east-1://endevo-life  (fetch)
origin  codecommit::us-east-1://endevo-life  (push)
```

## Mismatch confirmed
Our `git push origin main` lands in **CodeCommit `endevo-life`**.
Amplify webhook/builder clones from **GitHub `endevo-saas/endevo-life`**.
Two different repositories. Nothing syncs them today.

## Evidence the GitHub repo is stale

`gh api repos/endevo-saas/endevo-life/commits/main`
→ sha: `bf8b5cd` — "fix: employee dashboard complete with 7 features, Sentry, and Next.js CVE patches"

Local `git log --oneline`:
```
7913ebb fix(auth): resolve Verification failed bug — detail field + stale bundle
4e54c7b merge: Cognito migration - WorkOS removed, passwordless auth, stateless JWT, 42 files
7e30af6 fix(auth): pass Cognito session token from send-otp to verify-otp
0d035b5 feat(cognito): fresh deploy - UserPoolV2, named CF exports, all stacks migrated
0f9a3fa feat(auth): replace WorkOS with Cognito passwordless (M1-M15) - full migration
2abc1e6 ci: add CodeBuild buildspec for Lambda deployment
bf8b5cd fix: employee dashboard complete with 7 features, Sentry, and Next.js CVE patches  ← GitHub HEAD
```

GitHub `main` is missing **6 commits** — the entire Cognito migration.
