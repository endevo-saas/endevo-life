# Audit: Domain 4 — AWS Services Inventory
**Date:** 2026-04-19 | **Auditor:** Autonomous audit session

---

## Service Health Matrix

| Service | Status | Notes |
|---------|--------|-------|
| Cognito | ✓ Active | 1 pool, 3 groups, 5 triggers |
| SES | ✓ Production | 50k/day capacity, 20 sent today |
| Lambda | ✓ Active | 6 functions, all Python 3.12 |
| S3 | ✓ Active | 10 buckets, all public-blocked |
| CloudWatch | ⚠ Warning | Alarms OK, but null retention on all log groups |
| Amplify | ✓ Active | 5 SUCCEED builds today (last: #135 at 15:12 EDT) |
| CloudFront | ✓ Active | 1 distribution |
| Bedrock | ✓ Active | 1 agent (PREPARED state) |
| API Gateway | ✓ Active | HTTP v2, 200 RPS / 500 burst |
| SNS | ⚠ Warning | $1/month SMS spend limit (very low for enterprise) |
| OpenSearch | ✗ None | No OpenSearch cluster — Bedrock uses native KB |
| CodeBuild | ✓ Active | endevo-deploy-lambda project; builds today SUCCEEDED |

---

## Cognito

| Item | Value |
|------|-------|
| Pool | uat-endevo-users-v2 |
| Users | 1 active (GLOBAL_ADMIN) |
| Groups | GLOBAL_ADMIN, HR_ADMIN, EMPLOYEE |
| Auth flow | Custom auth (passwordless OTP via SES) |
| Triggers | define-auth-challenge, create-auth-challenge, verify-auth-challenge, post-confirmation, pre-token-generation |
| JWT claims | `custom:role`, `custom:email` — **no `custom:tenantId`** (GLOBAL_ADMIN gap) |
| MFA | Not enforced |

---

## SES

| Item | Value |
|------|-------|
| Mode | Production (sandbox lifted) |
| Daily limit | 50,000 emails |
| Sent today | 20 |
| Identities | endevo.life domain verified |
| OTP template | Verified and active |

---

## Lambda

| Function | Memory | Timeout | Runtime | X-Ray | DLQ |
|----------|--------|---------|---------|-------|-----|
| endevo-uat-fn-admin | 256 MB | 30s | python3.12 | PassThrough | **None** |
| endevo-uat-fn-auth | 256 MB | 30s | python3.12 | PassThrough | **None** |
| endevo-uat-fn-employee | 256 MB | 30s | python3.12 | PassThrough | **None** |
| endevo-uat-fn-hr | 256 MB | 30s | python3.12 | PassThrough | **None** |
| endevo-uat-fn-jesse | 512 MB | 60s | python3.12 | PassThrough | **None** |
| endevo-uat-fn-lms | 256 MB | 30s | python3.12 | Active | **None** |

---

## S3

| Bucket | Purpose | Public Access |
|--------|---------|---------------|
| endevo-uat-assets | App assets | Blocked |
| endevo-uat-knowledge | Jesse knowledge base files | Blocked |
| endevo-uat-knowledge-v2 | Jesse KB v2 (active) | Blocked |
| endevo-uat-uploads | User uploads | Blocked |
| endevo-uat-exports | Bulk export staging | Blocked |
| endevo-uat-videos | LMS video content | Blocked |
| endevo-uat-certificates | Generated PDF certs | Blocked |
| endevo-frontend-prod | Legacy CloudFront origin | Blocked |
| endevo-uat-backups | DynamoDB backups | Blocked |
| endevo-uat-logs | Access logs | Blocked |

---

## CloudWatch

| Metric | Value |
|--------|-------|
| Alarms | All OK (no active alarms) |
| Log groups | All Lambda groups present |
| Log retention | **NULL on ALL groups** — logs accumulate indefinitely |
| Dashboard | No custom dashboards configured |

---

## Amplify

| Item | Value |
|------|-------|
| App ID | d1vvfv8oltolcf |
| Branch | main |
| Last build | #135, SUCCEED, 2026-04-19 15:12 EDT |
| Build history today | 5 × SUCCEED |
| Framework | Next.js (detected) |
| Custom domain | uat.endevo.life |

---

## CloudFront

| Item | Value |
|------|-------|
| Distribution ID | E2CH9N3L4W6WV |
| Origin | endevo-frontend-prod.s3.us-east-2.amazonaws.com |
| Status | Deployed |
| Note | May be legacy — Amplify serves uat.endevo.life directly |

---

## Bedrock

| Item | Value |
|------|-------|
| Agent ID | XR2QDIVFB6 |
| Agent name | endevo-jesse-agent |
| Status | PREPARED |
| Knowledge base | endevo-uat-knowledge-base (7,228 chunks) |
| Model | Anthropic Claude |
| OpenSearch | None — native Bedrock KB vector store |

---

## API Gateway

| Item | Value |
|------|-------|
| Type | HTTP v2 |
| Throttle (RPS) | 200 requests/second |
| Throttle (burst) | 500 |
| URL | https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com |

---

## Issues

| Severity | Issue |
|----------|-------|
| P1 | CloudWatch log retention NULL on all groups — logs accumulate forever, no cost control |
| P1 | No DLQ on any of 6 Lambda functions — failed async invocations silently lost |
| P2 | X-Ray PassThrough on 5/6 functions — distributed tracing not active |
| P2 | SNS SMS spend limit $1/month — insufficient for any real SMS volume |
| P2 | CloudFront distribution E2CH9N3L4W6WV origin may be stale (Amplify now serves traffic) |
| P2 | No custom CloudWatch dashboards — no operational observability at a glance |
| INFO | Bedrock agent in PREPARED state — functional but not published (by design for UAT) |
