# Audit: Domain 5 — Infrastructure as Code (CDK)
**Date:** 2026-04-19 | **Auditor:** Autonomous audit session

---

## CDK Stack Inventory — 19 total

### Deployed (14)

| Stack Name | Purpose | Status |
|-----------|---------|--------|
| EndevoAuthStack | Cognito user pool, groups, triggers | DEPLOYED |
| EndevoApiGatewayStack | HTTP API v2, routes, throttling | DEPLOYED |
| EndevoLambdaAdminStack | fn-admin Lambda + IAM | DEPLOYED |
| EndevoLambdaAuthStack | fn-auth Lambda + IAM | DEPLOYED |
| EndevoLambdaEmployeeStack | fn-employee Lambda + IAM | DEPLOYED |
| EndevoLambdaHrStack | fn-hr Lambda + IAM | DEPLOYED |
| EndevoLambdaJesseStack | fn-jesse Lambda + IAM | DEPLOYED |
| EndevoLambdaLmsStack | fn-lms Lambda + IAM | DEPLOYED |
| EndevoDatabaseStack | All DynamoDB tables (endevo-uat-*) | DEPLOYED |
| EndevoS3Stack | All S3 buckets | DEPLOYED |
| EndevoSesStack | SES identities, sending config | DEPLOYED |
| EndevoBedrockStack | Bedrock agent, knowledge base | DEPLOYED |
| EndevoCodeBuildStack | CodeBuild project for Lambda deploy | DEPLOYED |
| EndevoMonitoringStack | CloudWatch alarms (basic) | DEPLOYED |

### Not Deployed (5)

| Stack Name | Purpose | Reason Not Deployed |
|-----------|---------|---------------------|
| EndevoAmplifyStack | Amplify app config as IaC | Amplify configured manually in console |
| EndevoFeaturesStack | Feature flags infrastructure | Merged into Database stack |
| EndevoCloudfrontApiStack | CloudFront in front of API GW | Not needed — API GW has its own URL |
| EndevoEmailQueueStack | SQS queue for email batching | Not yet implemented |
| EndevoObservabilityStack | X-Ray, advanced CloudWatch dashboards | Deferred — observability not prioritized |

---

## CDK File Structure

| Location | Contents |
|----------|----------|
| `infrastructure/lib/` | 19 stack construct `.ts` files |
| `infrastructure/bin/` | CDK app entry point |
| `infrastructure/cdk.out/` | Build artifacts (not deployed source) |

---

## Named CloudFormation Exports

All stacks use named exports (e.g., `EndevoUserPoolId`, `EndevoApiUrl`) for cross-stack references. Fixed in commit `0d035b5` — "fresh deploy - UserPoolV2, named CF exports, all stacks migrated".

---

## Issues

| Severity | Issue |
|----------|-------|
| P2 | EndevoObservabilityStack not deployed — no X-Ray active tracing, no dashboards |
| P2 | EndevoEmailQueueStack not deployed — no SQS buffer for OTP emails (SES called synchronously) |
| P2 | EndevoAmplifyStack not in IaC — Amplify config not reproducible from code alone |
| INFO | EndevoCloudfrontApiStack intentionally skipped — API GW URL used directly |
| INFO | EndevoFeaturesStack intentionally merged — feature flags live in endevo-uat-config table |
