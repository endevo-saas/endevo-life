# Forensic Report 03 — Database Contents
**Date:** 2026-04-19 | **Account:** 383423735462 | **Region:** us-east-2

---

## C1 — RDS endevo-db-rds

| Field | Value |
|-------|-------|
| Engine | PostgreSQL (postgres-18) |
| Class | Provisioned (default VPC subnet group) |
| Created | Before 2026-03-15 (earliest CloudTrail event is ModifyDBInstance on 2026-03-15) |
| VPC | vpc-0b856771e2262f334 |
| Publicly Accessible | No |
| Backup | Automated snapshots confirmed |
| Credentials | Secrets Manager: `endevo/production/db` |
| Connected by | endevo-api Lambda (env: `DB_SECRET_NAME=endevo/production/db`) |

### Connection Activity — Last 30 Days

| Date | Max Connections | Sum |
|------|----------------|-----|
| 2026-03-26 | 0 | 0 |
| 2026-04-02 | 0 | 0 |
| 2026-04-07 | 1 | 13 |
| 2026-04-09 | (present) | 6 |
| 2026-04-14 | **5** | **252** |

**Assessment: ACTIVE — 252 connection-events on 2026-04-14, max 5 concurrent. The endevo-api Lambda connects here. DO NOT DELETE.**

---

## C2 — Aurora database-1-instance-1 (cluster: database-1)

| Field | Value |
|-------|-------|
| Engine | aurora-postgresql 17.7 |
| Class | db.serverless (Serverless v2) |
| Storage | 1 GB |
| Created | 2026-03-31T08:48:48Z |
| Status | STOPPED (by endevo-sh-uat on 2026-04-09) |
| Encryption | None (storageEncrypted: false) |
| Deletion Protection | None |
| Master User | postgres |

### Connection Activity — Last 30 Days

| Date | Max Connections | Sum |
|------|----------------|-----|
| All measured days | 0 | 0 |

**Assessment: ZERO connections since creation on 2026-03-31. Abandoned experiment — created and never connected to. Safe to delete after confirming no app references the cluster endpoint.**

---

## C3 — Aurora jesse-vector-db-instance (cluster: jesse-vector-db)

| Field | Value |
|-------|-------|
| Engine | aurora-postgresql 15.8 |
| Class | db.serverless (Serverless v2) |
| Storage | 1 GB |
| Created | 2026-03-25T06:37:37Z |
| Status | STOPPED (by endevo-sh-uat on 2026-04-09) |
| Encryption | None |
| Deletion Protection | None |
| Purpose | Jesse V2 pgvector embeddings database |

### Connection Activity — Last 30 Days

| Date | Max Connections | Sum |
|------|----------------|-----|
| 2026-03-26 | 3 | 130 |
| 2026-04-01 | 0 | 0 |
| 2026-04-07 | 0 | 0 |
| 2026-04-08 | (small) | 7 |
| 2026-04-09+ | 0 | 0 (stopped) |

**Assessment: Was used briefly in late March 2026 for Jesse V2 prototype. Stopped 2026-04-09. Since Jesse V2 now uses the managed Bedrock knowledge base (endevo-uat-knowledge-v2), this DB is obsolete. Safe to archive after verifying Jesse V2 Vercel backend no longer references the endpoint.**

---

## Summary

| DB | Engine | Status | Last Connection | Delete-Safe? |
|----|--------|--------|----------------|--------------|
| endevo-db-rds | PostgreSQL 18 | Running | 2026-04-14 (252 events) | **NO — production data, active** |
| database-1 | Aurora PG 17.7 Serverless | Stopped | Never | **YES — zero usage** |
| jesse-vector-db | Aurora PG 15.8 Serverless | Stopped | 2026-04-08 | **Conditional — verify Jesse V2 Vercel first** |

Neither Aurora cluster has deletion protection or encryption enabled.
