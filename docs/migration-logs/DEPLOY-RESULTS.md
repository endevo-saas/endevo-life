# DEPLOY-RESULTS.md
Generated: 2026-04-18 21:47 UTC

---

## Summary

| Task | Stack | Status |
|------|-------|--------|
| Task 2 | EndevoUatCognitoTriggers | ✅ SUCCESS |
| Task 3 | EndevoUatCognito | ❌ FAILED — UPDATE_ROLLBACK_FAILED |

---

## Task 2 — EndevoUatCognitoTriggers

**Status: ✅ SUCCESS**
**Deployment time:** 64.96s (started ~21:44 UTC)
**Stack ARN:** `arn:aws:cloudformation:us-east-1:383423735462:stack/EndevoUatCognitoTriggers/433c5480-3b91-11f1-927e-0afff9f89bc5`
**Resources created:** 14/14

### Lambda Trigger ARNs (confirmed)

| Trigger | ARN |
|---------|-----|
| CreateChallenge | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-create-challenge` |
| DefineChallenge | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-define-challenge` |
| PostConfirmation | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-post-confirmation` |
| PreTokenGen | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-pre-token-gen` |
| VerifyChallenge | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-verify-challenge` |

---

## Task 3 — EndevoUatCognito

**Status: ❌ FAILED**
**Failure time:** ~21:46 UTC
**CloudFormation status: UPDATE_ROLLBACK_FAILED**

> ⚠️ WARNING: The stack is in UPDATE_ROLLBACK_FAILED state. CloudFormation attempted to roll back the failed update but the rollback ALSO failed. Manual intervention in the AWS Console is required before any re-deploy is possible.

### Failed Resource

- **Resource:** `AWS::Cognito::UserPool` (`UserPool6BA7E5F2`)
- **CloudFormation event:** `UPDATE_FAILED` → `UPDATE_ROLLBACK_FAILED`

### Error Message

```
Invalid AttributeDataType input, consider using the provided AttributeDataType enum.
Service: CognitoIdentityProvider
Status Code: 400
Request ID: 669425c0-0e22-4e31-bfd7-2defd962fca5
HandlerErrorCode: InvalidRequest
```

### Root Cause

A custom attribute in the CDK UserPool definition has an `AttributeDataType` value that does not match the Cognito API enum. This is a code/config error in `infrastructure/lib/01-cognito-stack.ts`. A UserPool custom attribute is defined with an incorrect data type string.

### What Happened

1. CloudFormation attempted to UPDATE the existing `EndevoUatCognito` stack
2. `UserPool6BA7E5F2` failed to update (invalid AttributeDataType — 400 InvalidRequest)
3. CloudFormation triggered automatic rollback
4. Rollback also failed on the same resource
5. Stack is now stuck in `UPDATE_ROLLBACK_FAILED`

---

## Env Vars — NOT AVAILABLE

These values could not be captured because `EndevoUatCognito` failed:

| Variable | Value |
|----------|-------|
| COGNITO_USER_POOL_ID | ❌ Deploy failed — not available |
| COGNITO_CLIENT_ID | ❌ Deploy failed — not available |
| COGNITO_JWKS_URL | ❌ Deploy failed — not available |
| UserPoolArn | ❌ Deploy failed — not available |

---

## Action Required — Waiting for Shahzad

Per non-negotiable deployment rules: **STOPPED. No retry. No fix attempted.**

### Shahzad must:

1. **AWS Console:** Go to CloudFormation → `EndevoUatCognito` → click "Continue Update Rollback". If it fails again, use "Skip resources" option and skip `UserPool6BA7E5F2` to get the stack back to a stable state.

2. **Fix code:** Inspect `infrastructure/lib/01-cognito-stack.ts` — find the custom attribute with invalid `AttributeDataType` and correct it to use a valid Cognito enum value: `String`, `Number`, `DateTime`, or `Boolean`.

3. **Re-run deploy** after the stack is out of `UPDATE_ROLLBACK_FAILED` and the code is fixed.

### Log Files

| File | Contents |
|------|----------|
| `docs/migration-logs/DEPLOY-exec-triggers.log` | Full CDK output for Triggers stack |
| `docs/migration-logs/DEPLOY-exec-cognito.log` | Full CDK output for Cognito stack (with error) |
