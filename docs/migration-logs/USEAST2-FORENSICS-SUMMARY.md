# us-east-2 Forensic Summary
**Date:** 2026-04-19 | **Account:** 383423735462 | **Auditor:** Autonomous forensic session
**Scope:** NAT Gateway, EIPs, RDS, Aurora, Cognito, Lambdas — us-east-2 region

---

## Key Finding: Two Separate Endevo Products

The us-east-2 resources are **not mystery**. They are a separate, older production deployment running alongside uat.endevo.life:

| App | Region | Stack | Auth | Database | Status |
|-----|--------|-------|------|----------|--------|
| **app.endevo.life** | us-east-2 | Node.js Lambda + PostgreSQL | Cognito us-east-2_JpHp1vsdK | endevo-db-rds | Active |
| **uat.endevo.life** | us-east-1 | Python Lambda + DynamoDB | Cognito us-east-1_mZ1axgz46 | DynamoDB | Active (UAT) |

Both run in account 383423735462. Both created by Shahzad.

---

## Identity Ownership of All Resources

| Resource | Creator | Created | Source | Likely Actor |
|----------|---------|---------|--------|--------------|
| NAT Gateway nat-0ba238efdb136be7c | endevo-dev | 2026-03-31 | CloudShell 18.190.158.56 | Shahzad |
| EIP 3.17.92.14 | endevo-dev | 2026-03-31 | CloudShell 18.190.158.56 | Shahzad |
| EIP 18.190.229.145 | AWSServiceRoleForRDS | 2026-03-27 | rds.amazonaws.com (automated) | AWS |
| RDS endevo-db-rds | endevo-dev | Before 2026-03-15 | Windows CLI 99.245.4.29 | Shahzad |
| Aurora database-1-instance-1 | endevo-dev | 2026-03-31 | CloudShell | Shahzad |
| Aurora jesse-vector-db-instance | endevo-dev | 2026-03-25 | CloudShell 18.224.183.123 | Shahzad |
| Cognito us-east-2_JpHp1vsdK | endevo-dev | 2026-02-22 | CloudShell 18.222.239.138 | Shahzad |
| Lambda endevo-billing-webhook | endevo-dev | 2026-02-28 | CloudShell 3.144.136.244 | Shahzad |
| Lambda endevo-api | endevo-dev | Unknown | CloudShell / CI | Shahzad |

No external actors. No Aryan involvement in us-east-2.

---

## Database Contents

| DB | Engine | Status | Last Connection | Purpose | Delete-Safe? |
|----|--------|--------|----------------|---------|-------------|
| endevo-db-rds | PostgreSQL 18 | Running | 2026-04-14 (252 events, max 5) | Production DB for app.endevo.life | **NO** |
| database-1 | Aurora PG 17.7 Serverless | Stopped 2026-04-09 | **Never** | Abandoned experiment | **YES** |
| jesse-vector-db | Aurora PG 15.8 Serverless | Stopped 2026-04-09 | 2026-04-08 (7 events) | Jesse V2 pgvector prototype | Conditional |

---

## Cognito Pool

| Field | Value |
|-------|-------|
| Pool ID | us-east-2_JpHp1vsdK |
| Name | endevo-user-pool |
| Created | 2026-02-21 by endevo-dev |
| Estimated Users | 12 |
| Used by | endevo-api Lambda — production auth for app.endevo.life |
| Delete-Safe? | **NO** |

---

## Lambda Purposes

| Lambda | Purpose | Code Size | Last Modified | Invoked (30d)? |
|--------|---------|-----------|--------------|----------------|
| endevo-billing-webhook | Stripe webhook → DB | 280 bytes (**stub**) | 2026-02-28 | No |
| endevo-api | Full backend API for app.endevo.life | 4.6 MB | 2026-04-18 (yesterday) | Yes |

---

## Actual Cost Breakdown (last 30 days)

| Resource | Estimated Monthly |
|----------|------------------|
| NAT Gateway (running since 2026-03-31) | ~$32/month |
| endevo-db-rds (running PostgreSQL) | ~$15–25/month |
| Aurora database-1 (stopped, 1 GB) | ~$0.10/month |
| Aurora jesse-vector-db (stopped, 1 GB) | ~$0.10/month |
| All Lambdas | ~$0 |
| Cognito (12 users) | $0 (free tier) |
| **Total us-east-2 estimated** | **~$48–60/month** |

> Cost Explorer output was truncated — NAT Gateway and RDS instance costs are estimates based on standard pricing.

---

## Recommendation Per Resource

| Resource | Action | Reason | Risk |
|----------|--------|--------|------|
| RDS endevo-db-rds | **Keep** | Active production DB, 252 connections Apr 14 | N/A |
| Aurora database-1 | **Delete** | Zero connections ever, abandoned experiment | Low |
| Aurora jesse-vector-db | **Archive/Delete** | Prototype, stopped, Bedrock replaces it | Low — verify Jesse V2 Vercel first |
| NAT Gateway + EIP 3.17.92.14 | **Investigate** | ~$32/month; needed only if endevo-api is VPC-bound | High if Lambda is VPC-bound |
| EIP 18.190.229.145 | **Keep** | AWS-managed for RDS | N/A |
| Cognito us-east-2_JpHp1vsdK | **Keep** | 12 active production users | N/A |
| endevo-api Lambda | **Keep** | Active production API, updated yesterday | N/A |
| endevo-billing-webhook Lambda | **Fix or delete** | 280-byte stub, Stripe unhandled for 50 days | Low |

---

## Security Issues Found

| Severity | Issue | Resource |
|----------|-------|---------|
| P1 | endevo-sh-uat has AdministratorAccess | IAM |
| P2 | MIGRATION_SECRET stored as plain-text Lambda env var | endevo-api Lambda |
| P2 | Aurora clusters have no encryption at rest | database-1, jesse-vector-db |
| P2 | endevo-billing-webhook is a 280-byte stub — Stripe billing events unhandled | endevo-billing-webhook |
| INFO | endevo-qa access key Active but console login last 2026-02-20 — possibly stale | IAM |

---

## Sub-Reports

| # | Domain | File |
|---|--------|------|
| 1 | IAM Identities | [USEAST2-FORENSICS-01-identities.md](USEAST2-FORENSICS-01-identities.md) |
| 2 | Resource Creators | [USEAST2-FORENSICS-02-creators.md](USEAST2-FORENSICS-02-creators.md) |
| 3 | Database Contents | [USEAST2-FORENSICS-03-databases.md](USEAST2-FORENSICS-03-databases.md) |
| 4 | Cognito Pool | [USEAST2-FORENSICS-04-cognito.md](USEAST2-FORENSICS-04-cognito.md) |
| 5 | Lambda Functions | [USEAST2-FORENSICS-05-lambdas.md](USEAST2-FORENSICS-05-lambdas.md) |
| 6 | Cost Breakdown | [USEAST2-FORENSICS-06-costs.md](USEAST2-FORENSICS-06-costs.md) |
