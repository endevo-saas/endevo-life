# HEAL ROOT CAUSE — Amplify deploys OLD code despite local HEAD = 7913ebb

## 1. Hypothesis outcomes

| # | Hypothesis | Result |
|---|---|---|
| 1 | Amplify built an old commit on the right repo | PARTIAL — Amplify built HEAD of the **wrong repo** |
| 2 | Two login pages, Next.js routes to stale | **REJECTED** — `push-temp/` is outside build tree |
| 3 | amplify.yml mis-configured | REJECTED — paths fine for single-repo setup |
| 4 | next.config alias/tracing pulling stale file | REJECTED — no aliases, no custom tracing |
| 5 | **Amplify repo source != our push remote** | **CONFIRMED — true root cause** |
| 6 | Build cache serving a stale chunk | REJECTED — new chunk hash proves fresh compile; source input was stale |

## 2. Root cause (one line)

**Amplify clones `git@github.com:endevo-saas/endevo-life.git`, but we push only to CodeCommit `endevo-life`. GitHub `main` is 6 commits behind (last commit `bf8b5cd`, pre-Cognito); every Amplify build since the migration has compiled pre-migration source.**

## 3. Specific evidence

- **Amplify build log (job 131, line 2):**
  `# Cloning repository: git@github.com:endevo-saas/endevo-life.git`
- **Amplify app config:**
  `"repository": "https://github.com/endevo-saas/endevo-life"`
- **Local git remote:**
  `origin  codecommit::us-east-1://endevo-life  (push)`
- **GitHub `main` HEAD via `gh api`:** `bf8b5cd` — "fix: employee dashboard…"
  (5 commits before local HEAD `7913ebb`; missing entire Cognito migration)
- **Local working tree is correct:**
  `apps/web/app/(auth)/login/page.tsx:221` → `body: JSON.stringify({ email, session: otpSession, code: otpCode })`
- **Zero `otp_ref` occurrences** anywhere under `apps/`.
- **Amplify job 131 metadata** reports `commitId: "HEAD"` (literal string) — an Amplify-GitHub quirk when no SHA is recorded; confirms no precise pin.
- Chunk hash `9eecf321…` is new because `@endevo/web:build: cache miss` forced a fresh Next.js compile — but the input source was pre-migration GitHub `main`, so the minified output still contains `otp_ref`.

## 4. Fix (DO NOT APPLY YET — awaiting user direction)

Pick **one** of the following — they are equally correct:

**Option A — Push all missing commits to GitHub (fastest, preserves CodeCommit):**
```bash
cd C:/Projects2026/uat.endevo.life
git remote add github https://github.com/endevo-saas/endevo-life.git
git push github main:main
# Then Amplify webhook fires, or trigger:
# aws amplify start-job --app-id d1vvfv8oltolcf --branch-name main --job-type RELEASE
```

**Option B — Repoint Amplify to CodeCommit (change source of truth):**
Update Amplify app `repository` to `codecommit::us-east-1://endevo-life` via AWS console
(Amplify does not support changing `repository` via `update-app` CLI — requires a new
connection token in the console flow).

**Option C — Set up a mirror push (permanent bidi sync):**
In `.git/config` add a second pushurl so every `git push origin main` pushes to both:
```
[remote "origin"]
  url = codecommit::us-east-1://endevo-life
  pushurl = codecommit::us-east-1://endevo-life
  pushurl = https://github.com/endevo-saas/endevo-life.git
```

Recommendation: **Option A now** (unblocks UAT in minutes). Follow up with **Option C** to prevent recurrence.

## 5. Confidence

**99%.** The Amplify clone URL (GitHub) vs local push remote (CodeCommit) is observed directly in the build log and app config. GitHub HEAD `bf8b5cd` explicitly predates the Cognito migration commits. No speculation required.
