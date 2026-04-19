# CDK Deploy Pre-Flight Report

**Date:** 2026-04-18
**Branch:** feat/cognito-federation-migration
**Status:** READY — all pre-flight checks passed

---

## Task 1 — Environment Check

| Check | Result |
|-------|--------|
| Node.js version | v24.14.1 ✅ (>18) |
| CDK version | 2.130.0 (build bd6e5ee) ✅ |
| AWS account | 383423735462 ✅ |
| AWS identity | arn:aws:iam::383423735462:user/endevo-sh-uat ✅ |
| AWS profile | Default profile resolves to account 383423735462 / user endevo-sh-uat ✅ |

**Note:** `aws --profile endevo-sh-uat` fails (profile not found in ~/.aws/config), but default credentials resolve correctly. CDK uses the default profile successfully.

---

## Task 2 — Dependencies

- `node_modules` reinstalled — 26 packages, 0 audit issues
- `source-map-support` installed (required by `dist/bin/app.js`)
- TypeScript compilation (`npx tsc`) exits 0 — all stack files compiled cleanly to `dist/`

**Action required:** Add `source-map-support` to `package.json` devDependencies to avoid re-installing next session.

---

## Task 3 — CDK Stack List

`npx cdk list` exits 0. Both target stacks present:

```
EndevoUatCognitoTriggers   ✅
EndevoUatCognito           ✅
```

**Fix applied (cyclic dependency):** The original `CognitoStack` used `lambdaTriggers` (L2) + an explicit `addDependency(cognitoTriggers)`. This created a cycle:
- Chain A: explicit `addDependency` → CognitoStack depends on CognitoTriggersStack
- Chain B: `lambdaTriggers` auto-calls `fn.addPermission({ sourceArn: userPool.userPoolArn })` on Lambdas owned by CognitoTriggersStack → CDK creates a `Lambda::Permission` resource in CognitoTriggersStack that references CognitoStack's UserPool ARN → reverse dependency

**Resolution:**
1. Replaced `lambdaTriggers` with `CfnUserPool.lambdaConfig` (L1, accepts plain ARN strings — CDK still tracks the cross-stack export/import for correct ordering, but does NOT auto-add permissions)
2. Removed the `fn.addPermission()` loop from `CognitoStack`
3. Added wildcard-scoped `addPermission` in `CognitoTriggersStack` (`sourceArn: arn:aws:cognito-idp:us-east-1:383423735462:userpool/*`) — plain string, no cross-stack CDK Token
4. Removed `cognito.addDependency(cognitoTriggers)` from `bin/app.ts` (CfnImportValue already enforces the correct CloudFormation ordering)

---

## Task 4 — Synth: EndevoUatCognitoTriggers

`npx cdk synth EndevoUatCognitoTriggers` — **EXIT 0** ✅

Full template written to `docs/migration-logs/DEPLOY-synth-triggers.log`

---

## Task 5 — Synth: EndevoUatCognito

`npx cdk synth EndevoUatCognito` — **EXIT 0** ✅

Full template written to `docs/migration-logs/DEPLOY-synth-cognito.log`

---

## Task 6 — Diff: EndevoUatCognitoTriggers

`npx cdk diff EndevoUatCognitoTriggers` — **EXIT 0** ✅

Full diff written to `docs/migration-logs/DEPLOY-diff-triggers.log`

### Resources to create (all net-new `[+]`):

| Resource | Type |
|----------|------|
| `CognitoTriggerRole` | AWS::IAM::Role |
| `CognitoTriggerRole/DefaultPolicy` | AWS::IAM::Policy |
| `DefineChallengeFn` | AWS::Lambda::Function |
| `DefineChallengeFn/CognitoInvokeDefine` | AWS::Lambda::Permission |
| `CreateChallengeFn` | AWS::Lambda::Function |
| `CreateChallengeFn/CognitoInvokeCreate` | AWS::Lambda::Permission |
| `VerifyChallengeFn` | AWS::Lambda::Function |
| `VerifyChallengeFn/CognitoInvokeVerify` | AWS::Lambda::Permission |
| `PreTokenGenFn` | AWS::Lambda::Function |
| `PreTokenGenFn/CognitoInvokePreToken` | AWS::Lambda::Permission |
| `PostConfirmationFn` | AWS::Lambda::Function |
| `PostConfirmationFn/CognitoInvokePostConfirm` | AWS::Lambda::Permission |

**IAM granted:**
- DynamoDB: GetItem/PutItem/UpdateItem/DeleteItem/Query on `endevo-uat-users` + `endevo-uat-audit`
- SES: SendEmail/SendRawEmail on `*`
- Cognito: AdminListGroupsForUser on `userpool/*`
- Lambda::Permission: InvokeFunction scoped to `arn:aws:cognito-idp:us-east-1:383423735462:userpool/*`

**Outputs (exported):**
- `cognito-trigger-define-challenge` — DefineChallengeFn ARN
- `cognito-trigger-create-challenge` — CreateChallengeFn ARN
- `cognito-trigger-verify-challenge` — VerifyChallengeFn ARN
- `cognito-trigger-pre-token-gen` — PreTokenGenFn ARN
- `cognito-trigger-post-confirmation` — PostConfirmationFn ARN

---

## Task 7 — Diff: EndevoUatCognito

`npx cdk diff EndevoUatCognito` — **EXIT 0** ✅

Full diff written to `docs/migration-logs/DEPLOY-diff-cognito.log`

### Resources changed:

| Resource | Change |
|----------|--------|
| `GroupGlobalAdmin` | `[+]` NEW — Cognito pool group, precedence 1 |
| `GroupHrAdmin` | `[+]` NEW — Cognito pool group, precedence 2 |
| `GroupEmployee` | `[+]` NEW — Cognito pool group, precedence 3 |
| `UserPool` | `[~]` UPDATE (no replacement) |
| `WebClient` | `[~]` UPDATE — **replacement required** (see note below) |

### UserPool changes:
- `DeletionProtection` → ACTIVE (added)
- `LambdaConfig` → all 5 trigger ARNs wired via `Fn::ImportValue`
- `PasswordPolicy.MinimumLength` → 32 (was 12)
- `PasswordPolicy.TemporaryPasswordValidityDays` → 1 (was 7)
- `Schema` → email Mutable changed to `false`; `given_name`/`family_name` required attrs removed; custom attrs (role, tenantId, tenantName) retained
- `UserPoolName` → `uat-endevo-users-v2` (was `endevo-uat-users`)
- `UserPoolTags` added

### WebClient replacement note:
`GenerateSecret: false` explicitly set triggers a CloudFormation **replacement** of the app client. A new `UserPoolClientId` will be issued. This requires updating:
- `NEXT_PUBLIC_COGNITO_CLIENT_ID` in Amplify environment variables
- `COGNITO_CLIENT_ID` in API Lambda environment variables (EndevoUatApi stack)

### Output changes:
- `JwksUrl` added — JWKS endpoint for Lambda JWT verification
- `UserPoolId` export renamed to `endevo-uat-cognito-pool-id-v2`
- `UserPoolClientId` export renamed to `endevo-uat-cognito-client-id-v2`
- `UserPoolArn` export renamed to `endevo-uat-cognito-pool-arn-v2`
- Old export `ExportsOutputFnGetAttUserPool6BA7E5F2Arn686ACC00` removed

---

## Important Observations

### 1. Pool update vs fresh pool
Architecture decision B specified "FRESH COGNITO POOL". The CDK logical ID (`UserPool6BA7E5F2`) is unchanged, so CloudFormation will **update** the existing `endevo-uat-users` pool in-place rather than create a new one. Existing users in the pool will remain. This is safe for UAT (the pool has only test accounts), but confirm this is acceptable before deploying.

### 2. WebClient replacement
The app client will be replaced (new client ID). Amplify and API stack env vars must be updated immediately after deploy. Stale client IDs will reject all auth attempts.

### 3. Export name changes
Other stacks that import `endevo-uat-cognito-pool-id` (old) or `endevo-uat-cognito-client-id` (old) will need updating. Check `EndevoUatAmplify` and `EndevoUatApi` stacks for these references.

---

## Task 8 — Deploy Command

**STOP — awaiting Shahzad approval.**

When approved, deploy in this order:

```bash
cd infrastructure

# Step 1 — Deploy triggers first (Lambdas + permissions)
npx cdk deploy EndevoUatCognitoTriggers --require-approval never

# Step 2 — Deploy user pool (wires trigger ARNs, creates groups, replaces app client)
npx cdk deploy EndevoUatCognito --require-approval never
```

**Post-deploy actions (required):**
1. Retrieve new `UserPoolClientId` from CloudFormation outputs
2. Update `COGNITO_CLIENT_ID` in `EndevoUatApi` stack env vars (or Lambda console)
3. Update `NEXT_PUBLIC_COGNITO_CLIENT_ID` in Amplify console / AmplifyStack
4. Retrieve `UserPoolId` and `JwksUrl` from outputs and confirm they match what's in API Lambda env vars
5. Test OTP flow: send-otp → verify-otp → JWT cookies → dashboard

---

## Cost Estimate

| Resource | Cost |
|----------|------|
| Cognito User Pool | $0 (Free tier: 50,000 MAU) |
| 5 Lambda triggers (128MB, 10s) | $0 (Free tier: 1M invocations/month) |
| IAM Role | $0 |
| **Total** | **$0/month at UAT scale** |

---

## File Inventory

| Log file | Contents |
|----------|----------|
| `DEPLOY-synth-triggers.log` | CloudFormation template for CognitoTriggersStack |
| `DEPLOY-synth-cognito.log` | CloudFormation template for CognitoStack |
| `DEPLOY-diff-triggers.log` | CDK diff for CognitoTriggersStack vs. deployed |
| `DEPLOY-diff-cognito.log` | CDK diff for CognitoStack vs. deployed |
