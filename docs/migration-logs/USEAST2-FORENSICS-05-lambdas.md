# Forensic Report 05 — Lambda Functions
**Date:** 2026-04-19 | **Account:** 383423735462 | **Region:** us-east-2

---

## E1 — endevo-billing-webhook

| Field | Value |
|-------|-------|
| Runtime | nodejs22.x |
| Memory | 256 MB |
| Timeout | 30 s |
| Handler | index.handler |
| Code Size | **280 bytes** |
| Last Modified | 2026-02-28T19:33:49Z (unchanged ~50 days) |
| Role | arn:aws:iam::383423735462:role/endevo-lambda-role |
| Creator | endevo-dev via CloudShell, 2026-02-28, IP 3.144.136.244 |

### Environment Variables (keys only)

| Key | Notes |
|-----|-------|
| STRIPE_WEBHOOK_SECRET_SSM | SSM parameter path — secret not hardcoded |
| STRIPE_SECRET_KEY_SSM | SSM parameter path — secret not hardcoded |
| DB_SECRET_ARN | Secrets Manager ARN for endevo/production/db |
| NODE_ENV | production |

### Recent Logs

No CloudWatch log output in last 30 days — function has not been invoked.

### Assessment

- **280-byte code is a stub.** A real Stripe webhook handler cannot fit in 280 bytes — this is an empty scaffold or placeholder.
- No invocations in 30 days — Stripe webhook endpoint likely not wired to this Lambda URL.
- **Action:** Verify Stripe dashboard webhook configuration; redeploy with real handler code.

---

## E2 — endevo-api

| Field | Value |
|-------|-------|
| Runtime | nodejs22.x |
| Memory | 256 MB |
| Timeout | 30 s |
| Handler | dist/index.handler |
| Code Size | **4,800,192 bytes (~4.6 MB)** |
| Last Modified | **2026-04-18T14:59:07Z (updated yesterday)** |
| Role | arn:aws:iam::383423735462:role/endevo-lambda-role |
| CORS Origin | https://app.endevo.life |

### Environment Variables (keys only)

| Key | Notes |
|-----|-------|
| COGNITO_USER_POOL_ID | us-east-2_JpHp1vsdK |
| COGNITO_CLIENT_ID | 3ahgmd4tletmpm3f0nbn1b9230 |
| DB_SECRET_NAME | endevo/production/db |
| SES_FROM_EMAIL | hello@endevo.life |
| NODE_ENV | production |
| MIGRATION_SECRET | **Plain-text secret in env vars — P2 security concern** |
| CORS_ORIGIN | https://app.endevo.life |

### Recent Logs

Last CloudWatch entries from 2026-03-23:
- Requests to `/prod/heal*` (health/healing endpoint) and `/prod/admi*` (admin endpoint)
- Init duration ~519 ms, billed ~575–1248 ms, memory ~104–107 MB

### Assessment

- **Active production API** for app.endevo.life — 4.6 MB compiled TypeScript dist bundle.
- Updated **yesterday (2026-04-18)** — active development ongoing on this app.
- Connects to: Cognito us-east-2, PostgreSQL endevo-db-rds, SES for email.
- **MIGRATION_SECRET is a plain-text value in Lambda env** — visible to anyone with `lambda:GetFunctionConfiguration`. Should move to Secrets Manager.

---

## E3 — API Gateway (us-east-2)

| Type | Finding |
|------|---------|
| REST APIs | None |
| HTTP APIs | 1 HTTP API — routes traffic to endevo-api Lambda |

This HTTP API is the public entry point for app.endevo.life backend traffic.

---

## Security Issues Found

| Severity | Issue | Lambda |
|----------|-------|--------|
| P2 | MIGRATION_SECRET stored as plain-text Lambda env var | endevo-api |
| P2 | 280-byte stub code — Stripe billing events likely unhandled | endevo-billing-webhook |
| INFO | endevo-lambda-role shared between both Lambdas | both |

---

## Summary

| Lambda | Purpose | Invoked (30d)? | Last Modified |
|--------|---------|---------------|--------------|
| endevo-billing-webhook | Stripe webhook → DB | No | 2026-02-28 |
| endevo-api | Full backend API for app.endevo.life | Yes (DB activity 2026-04-14) | 2026-04-18 |
