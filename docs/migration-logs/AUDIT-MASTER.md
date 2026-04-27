# Master Audit Report — uat.endevo.life
**Date:** 2026-04-19 | **Duration:** ~90 min | **Auditor:** Autonomous audit session
**Scope:** Full system — frontend, backend, database, AWS services, IaC, code quality, security, Jesse V2

---

## Executive Summary

The system is **functionally operational** for the GLOBAL_ADMIN role. All 14 admin API endpoints return HTTP 200. The Cognito passwordless auth migration (WorkOS → Cognito) is complete with zero functional WorkOS remnants. The Next.js frontend has 55 pages across 4 role groups and deploys cleanly via Amplify.

Three categories of work remain:

1. **P1 blockers** (5 issues): GLOBAL_ADMIN 401 on HR/employee/LMS, IAM over-permission, CloudWatch log retention null, no DLQ, config table empty
2. **P2 data gaps** (5 tables empty): sessions, subscriptions, certificates, master-classes, costs need seeding
3. **P2 observability/ops**: no DLQ, no X-Ray, no Sentry — failures are invisible across the full stack

---

## Domain Reports

| # | Domain | File | P1 | P2 |
|---|--------|------|----|----|
| 1 | Frontend UI | [AUDIT-01-frontend.md](AUDIT-01-frontend.md) | 0 | 4 |
| 2 | Backend API | [AUDIT-02-backend.md](AUDIT-02-backend.md) | 1 | 4 |
| 3 | Database | [AUDIT-03-database.md](AUDIT-03-database.md) | 1 | 5 |
| 4 | AWS Services | [AUDIT-04-aws-services.md](AUDIT-04-aws-services.md) | 2 | 4 |
| 5 | Infrastructure (IaC) | [AUDIT-05-infrastructure.md](AUDIT-05-infrastructure.md) | 0 | 3 |
| 6 | Code Quality | [AUDIT-06-code-quality.md](AUDIT-06-code-quality.md) | 0 | 5 |
| 7 | Security | [AUDIT-07-security.md](AUDIT-07-security.md) | 2 | 3 |
| 8 | Jesse V2 | [AUDIT-08-jesse-v2.md](AUDIT-08-jesse-v2.md) | 0 | 3 |

---

## Priority Action Items

### P1 — Must Fix

| # | Issue | Domain | Fix |
|---|-------|--------|-----|
| 1 | GLOBAL_ADMIN gets 401 on `/api/hr/*`, `/api/employee/*`, `/api/lms/*` | Backend | Apply `stash@{0}: wip-global-admin-bypass` |
| 2 | `endevo-sh-uat` IAM user has `AdministratorAccess` | Security | Replace with least-privilege policy |
| 3 | CloudWatch log retention NULL on all 6 Lambda log groups | Security/Ops | Set 30-day retention via CDK or console |
| 4 | No DLQ on any of 6 Lambda functions | Backend/Ops | Add SQS DLQ in CDK Lambda stacks |
| 5 | `endevo-uat-config` empty — FEATURE_FLAGS not seeded | Database | Seed FEATURE_FLAGS and PLAN_CONFIG items |

### P2 — Should Fix

| # | Issue | Domain |
|---|-------|--------|
| 1 | fn-admin (2,630 lines) and fn-jesse (2,629 lines) over file-size limit | Code Quality |
| 2 | X-Ray PassThrough on 5/6 Lambdas — no distributed tracing | AWS Services |
| 3 | Sentry DSN empty — frontend errors invisible | Frontend / Security |
| 4 | 4 stale WorkOS secrets in Secrets Manager | Security |
| 5 | `endevo-uat-subscriptions`, `sessions`, `certificates`, `master-classes`, `costs` all empty | Database |
| 6 | `CopilotWidget.tsx` orphan status unclear — verify or remove | Frontend |
| 7 | SNS SMS spend limit $1/month — insufficient for production SMS | AWS Services |
| 8 | EndevoObservabilityStack not deployed — no dashboards | IaC |
| 9 | Amplify app not in IaC — config not reproducible from code | IaC |
| 10 | Jesse V2 two-backend divergence risk (fn-jesse vs Vercel Node) | Jesse V2 |

---

## System Snapshot

| Metric | Value |
|--------|-------|
| Frontend pages | 55 (auth:3, admin:22, HR:10, employee:19, status:1) |
| Frontend components | 15 |
| Lambda functions | 6 (Python 3.12) |
| API routes | ~71 total (admin:47, auth:7, LMS:17) |
| DynamoDB tables | 38 (endevo-uat-*: 23, lros-*: 15) |
| DynamoDB total items | ~8,000+ (knowledge-base: 7,228 alone) |
| S3 buckets | 10 (all private) |
| CDK stacks | 19 defined / 14 deployed |
| Cognito users | 1 active |
| Amplify builds today | 5 × SUCCEED |
| WorkOS remnants (functional) | ZERO |
| Hardcoded secrets | ZERO |

---

## Prior Session Fixes (2026-04-19)

| Commit | Fix |
|--------|-----|
| `55f6c28` | Bundle `cryptography` into Lambda ZIPs via pip install |
| `37580d0` | Vendor `cognito_auth.py` into all 6 Lambda folders |
| `7913ebb` | Fix Verification failed — `detail` field extraction in login page |
| `991a398` | Remove `sk` from features DynamoDB key (P1 ValidationException fix) |

---

## Audit Log

See [AUDIT-STATUS.md](AUDIT-STATUS.md) for the 5-minute progress log captured during this session.
