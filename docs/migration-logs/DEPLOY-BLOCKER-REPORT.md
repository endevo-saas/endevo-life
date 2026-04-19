# BLOCKER REPORT — Cognito Fresh Deploy
Generated: 2026-04-19 ~02:10 UTC
Rule triggered: Rule 9 — Fatal error blocking all subsequent tasks. Stopped. No creative workaround attempted.

---

## Progress Before Blocker

| Task | Status | Notes |
|------|--------|-------|
| T1: Verify environment | ✅ DONE | Account 383423735462 / endevo-sh-uat confirmed |
| T2: Capture pool state | ✅ DONE | Saved to DEPLOY-pool-before-delete.json, DEPLOY-users-before-delete.json |
| T3: Unstick CloudFormation | ✅ DONE | Stack reached UPDATE_ROLLBACK_COMPLETE |
| T4: Delete old pool | ✅ DONE | us-east-1_DVyEJqgFt deleted, UserPools:[] confirmed |
| T5: Modify CDK (UserPoolV2) | ✅ DONE | Construct ID renamed, email.mutable false→true |
| T6: Pre-deploy validation | ✅ DONE | synth EXIT:0, diff shows [+] UserPoolV2 CREATE |
| T7: Deploy EndevoUatCognito | ❌ BLOCKED | Cross-stack export dependency (see below) |
| T8–T13 | ⏸ NOT STARTED | Blocked by T7 |

---

## The Blocker

**CloudFormation error (10:08:20 UTC):**
```
Delete canceled. Cannot delete export
EndevoUatCognito:ExportsOutputRefUserPool6BA7E5F296FD7236
as it is in use by EndevoUatAmplify and EndevoUatApi.
```

### Root Cause

Renaming the CDK construct from `UserPool` → `UserPoolV2` changes the CloudFormation logical ID from `UserPool6BA7E5F2` to `UserPoolV2AAED3EE9`. CDK auto-generates cross-stack export names that embed the logical ID. So:

- **Old auto-export:** `ExportsOutputRefUserPool6BA7E5F296FD7236` (tied to `UserPool6BA7E5F2`)
- **New auto-export:** `ExportsOutputRefUserPoolV2...` (tied to `UserPoolV2AAED3EE9`)

CloudFormation refuses to delete the old export because `EndevoUatAmplify` and `EndevoUatApi` still import it via `Fn::ImportValue`.

### Exports Blocking Deletion

| Export Name | Current Value | Consumed By |
|-------------|---------------|-------------|
| `EndevoUatCognito:ExportsOutputRefUserPool6BA7E5F296FD7236` | `us-east-1_DVyEJqgFt` (deleted pool) | EndevoUatAmplify, EndevoUatApi |
| `EndevoUatCognito:ExportsOutputFnGetAttUserPool6BA7E5F2Arn686ACC00` | pool ARN (deleted pool) | EndevoUatAmplify, EndevoUatApi |

### How the Dependency Was Created

In `infrastructure/bin/app.ts` lines 79–80, CDK tokens cross stack boundaries:
```typescript
cognitoUserPoolId: cognito.userPoolId,       // → auto CF Fn::ImportValue
cognitoClientId:   cognito.userPoolClientId, // → auto CF Fn::ImportValue
```
CDK auto-generates CloudFormation exports when tokens cross stack boundaries. Those export names embed `UserPool6BA7E5F2`. Renaming the construct orphans the old exports while the consuming stacks still hold references.

### Current Stack States

| Stack | Status |
|-------|--------|
| EndevoUatCognito | UPDATE_ROLLBACK_COMPLETE — stable, old template, points to deleted pool |
| EndevoUatCognitoTriggers | CREATE_COMPLETE — healthy, untouched |
| EndevoUatAmplify | Running — importing old UserPool export |
| EndevoUatApi | Running — importing old UserPool export |

---

## Resolution for Shahzad

### Recommended Path — Two-Pass Deploy

**Pass 1:** In `infrastructure/bin/app.ts` lines 79–80, switch from CDK token refs to named `Fn.importValue` calls pointing to the v2 named exports (already defined in `01-cognito-stack.ts`):

```typescript
// Break the CDK auto-export dependency
cognitoUserPoolId: cdk.Fn.importValue('endevo-uat-cognito-pool-id-v2'),
cognitoClientId:   cdk.Fn.importValue('endevo-uat-cognito-client-id-v2'),
```

**Pass 2 — deploy sequence:**
```bash
cd infrastructure
npx cdk deploy EndevoUatCognito  --require-approval never   # creates new pool, drops old auto-exports
npx cdk deploy EndevoUatApi      --require-approval never   # updates to new named imports
npx cdk deploy EndevoUatAmplify  --require-approval never   # updates to new named imports
```

Note: `endevo-uat-cognito-pool-id-v2` and `endevo-uat-cognito-client-id-v2` are the named `exportName` values already present in `01-cognito-stack.ts` lines 141 and 145. They will exist once the new pool is created.

### Why This Was Not Attempted Autonomously

Rule 5: "NO modifying stacks other than EndevoUatCognito and EndevoUatCognitoTriggers." Modifying `bin/app.ts` changes how EndevoUatAmplify and EndevoUatApi are wired and would trigger re-deploys of those stacks. Shahzad must authorize this.

---

## Code Changes Made in This Session (Keep These)

| File | Change | Status |
|------|--------|--------|
| `infrastructure/lib/01-cognito-stack.ts` line 26 | `'UserPool'` → `'UserPoolV2'` | ✅ Keep |
| `infrastructure/lib/01-cognito-stack.ts` line 48 | `email.mutable: false` → `true` | ✅ Keep |

These changes are correct. The fix needed is in `bin/app.ts` (cross-stack wiring), not in `01-cognito-stack.ts`.
