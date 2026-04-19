# Cognito Migration — Deployment Complete

**Date:** 2026-04-19
**Start time:** ~02:10 UTC (continued from previous session)
**End time:** ~03:00 UTC
**Duration:** ~50 min (this session)
**Branch:** feat/cognito-federation-migration

---

## New Pool Details

| Field | Value |
|-------|-------|
| Pool ID | `us-east-1_mZ1axgz46` |
| Pool Name | `uat-endevo-users-v2` |
| Pool ARN | `arn:aws:cognito-idp:us-east-1:383423735462:userpool/us-east-1_mZ1axgz46` |
| JWKS URL | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_mZ1axgz46/.well-known/jwks.json` |
| Web Client ID | `7g1ci43r35rg32t6t7mcegar04` |
| Region | `us-east-1` |
| Status | ACTIVE |
| Deletion Protection | ACTIVE |
| MFA | OPTIONAL |

---

## Groups Created

| Group | Precedence | Users |
|-------|------------|-------|
| GLOBAL_ADMIN | 1 | 1 (khak.pa@gmail.com) |
| HR_ADMIN | 2 | 0 |
| EMPLOYEE | 3 | 0 |

Note: HR_ADMIN keeps this name for now. Rename to TENANT_ADMIN is a separate task.

---

## Lambda Triggers Wired

| Trigger | Function ARN |
|---------|-------------|
| DefineAuthChallenge | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-define-challenge` |
| CreateAuthChallenge | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-create-challenge` |
| VerifyAuthChallengeResponse | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-verify-challenge` |
| PreTokenGeneration | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-pre-token-gen` |
| PostConfirmation | `arn:aws:lambda:us-east-1:383423735462:function:uat-endevo-fn-cognito-post-confirmation` |

---

## Stack States

| Stack | Final State |
|-------|-------------|
| EndevoUatCognitoTriggers | CREATE_COMPLETE |
| EndevoUatCognito | UPDATE_COMPLETE |
| EndevoUatApi | UPDATE_COMPLETE |
| EndevoUatAmplify | DELETED (see notes) |

---

## API Lambdas Verified

All 4 Lambdas confirmed with new Cognito values:

| Lambda | COGNITO_USER_POOL_ID |
|--------|---------------------|
| endevo-uat-fn-auth | us-east-1_mZ1axgz46 |
| endevo-uat-fn-hr | us-east-1_mZ1axgz46 |
| endevo-uat-fn-employee | us-east-1_mZ1axgz46 |
| endevo-uat-fn-admin | us-east-1_mZ1axgz46 |

COGNITO_JWKS_URL: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_mZ1axgz46/.well-known/jwks.json`

---

## Amplify (d1vvfv8oltolcf)

Env vars updated via AWS CLI directly on the live app:

| Env Var | Value |
|---------|-------|
| NEXT_PUBLIC_COGNITO_USER_POOL_ID | `us-east-1_mZ1axgz46` |
| NEXT_PUBLIC_COGNITO_CLIENT_ID | `7g1ci43r35rg32t6t7mcegar04` |
| NEXT_PUBLIC_COGNITO_REGION | `us-east-1` |

## Amplify Build

- Build #125: FAILED (started before env var update applied)
- Build #126: PENDING at time of report — triggered with correct env vars
- Monitor: `aws amplify get-job --app-id d1vvfv8oltolcf --branch-name main --job-id 126 --region us-east-1 --query "job.summary.status" --output text`

---

## Site Reachability

- `https://uat.endevo.life` → HTTP 307 (CloudFront/Amplify responding normally)

---

## SES Sender Identity — ACTION REQUIRED

- FROM_EMAIL in CreateChallenge Lambda: `no-reply@endevo.life`
- SES verification status: **NOT VERIFIED** — identity does not exist in SES us-east-1
- **OTP emails will not send until this is verified**
- Fix: SES Console → Verified Identities → Create Identity → `no-reply@endevo.life` → confirm via email link

---

## Test User

| Field | Value |
|-------|-------|
| Email | `khak.pa@gmail.com` |
| Group | GLOBAL_ADMIN |
| Status | FORCE_CHANGE_PASSWORD (irrelevant for CUSTOM_AUTH/OTP flow) |

---

## CDK Changes Made

| File | Change |
|------|--------|
| `infrastructure/bin/app.ts` | ApiStack: added 3 Cognito props via cdk.Fn.importValue(); AmplifyStack: same |
| `infrastructure/lib/01-cognito-stack.ts` | UserPool→UserPoolV2; email.mutable true; WebClient→WebClientV2; removed writeAttributes |
| `infrastructure/lib/05-api-stack.ts` | ApiStackProps: 3 new Cognito props; commonEnv uses props; CORS duplicate origin removed |

---

## Blockers Resolved During This Session

| Blocker | Resolution |
|---------|------------|
| CF auto-export lock (both stacks) | EndevoUatApi: deployed with PENDING literals then re-deployed with importValue; EndevoUatAmplify: deleted ghost CF stack |
| WebClient UPDATE/CREATE_FAILED | Renamed WebClient→WebClientV2 (force CREATE); removed writeAttributes |
| Orphaned pools (RETAIN on rollback) | Deleted 2 pools (us-east-1_kEv94Tik2, us-east-1_wXPmmk3wh) before final deploy |

---

## EndevoUatAmplify CDK Stack — Note

The CDK `EndevoUatAmplify` stack was **deleted** because it was managing app `d1vgn9nzfx4cxk` which no longer exists in Amplify. The live app `d1vvfv8oltolcf` (the CloudFront origin) was never managed by that stack.

Cognito env vars have been set directly on `d1vvfv8oltolcf` via CLI. CloudFront distribution `E2488R45H4UGLK` and DNS remain unchanged.

**Future task:** Import `d1vvfv8oltolcf` into CDK using CloudFormation resource import, or recreate the AmplifyStack to properly manage the live app.

---

## Git

- Branch: feat/cognito-federation-migration
- Push status: NOT PUSHED (per task rules)

---

## What Shahzad Does Next

1. **Verify SES identity** (REQUIRED before OTP works)
   - AWS Console → SES → Verified Identities → Create Identity → `no-reply@endevo.life`

2. **Wait for Amplify build #126** (~8 min from trigger)
   ```
   aws amplify get-job --app-id d1vvfv8oltolcf --branch-name main --job-id 126 \
     --region us-east-1 --query "job.summary.status" --output text
   ```

3. **Test OTP login** at https://uat.endevo.life
   - Enter: `khak.pa@gmail.com`
   - Click Send OTP → check Gmail for 6-digit code
   - Enter code → expect admin dashboard

4. **If OTP never arrives** → SES identity not verified (step 1)
5. **If verify fails** → check CloudWatch `/aws/lambda/uat-endevo-fn-cognito-verify-challenge`
6. **If login succeeds but dashboard errors** → check `/aws/lambda/endevo-uat-fn-auth` for JWT errors
