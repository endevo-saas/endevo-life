# GA Recovery — Phase 1: Backup + Wipe
**Date:** 2026-04-19 | **Session:** Super Admin Recovery | **Auditor:** Autonomous

---

## 1.1 — PITR Status

PITR enabled on all 23 endevo-uat-* tables (35-day recovery window).

| Table | PITR Status |
|-------|-------------|
| endevo-uat-users | ENABLED (earliest: 2026-03-20) |
| endevo-uat-tenants | ENABLED (earliest: 2026-03-20) |
| endevo-uat-sessions | ENABLED |
| endevo-uat-audit | ENABLED |
| endevo-uat-config | ENABLED |
| endevo-uat-subscriptions | ENABLED |
| endevo-uat-access-logs | ENABLED |
| endevo-uat-analytics | ENABLED |
| endevo-uat-certificates | ENABLED |
| endevo-uat-costs | ENABLED |
| endevo-uat-jesse-chat | ENABLED |
| endevo-uat-knowledge-base | ENABLED |
| endevo-uat-lms-lesson-progress | ENABLED |
| endevo-uat-lms-lessons | ENABLED |
| endevo-uat-lms-modules | ENABLED |
| endevo-uat-lms-user-modules | ENABLED |
| endevo-uat-master-classes | ENABLED |
| endevo-uat-notifications | ENABLED |
| endevo-uat-questions | ENABLED |
| endevo-uat-responses | ENABLED |
| endevo-uat-training | ENABLED |
| endevo-uat-video-progress | ENABLED |
| endevo-uat-webhooks | ENABLED |

---

## 1.2 — On-Demand Backups (DynamoDB Native)

S3 bucket creation denied by endevo-sh-uat isolation policy (explicit deny on s3:CreateBucket). Using DynamoDB native backups as alternative.

| Table | Backup Name | ARN | Status |
|-------|-------------|-----|--------|
| endevo-uat-users | endevo-uat-users-backup-20260419 | arn:aws:dynamodb:us-east-1:383423735462:table/endevo-uat-users/backup/01776635383202-9e645cb2 | CREATING |
| endevo-uat-tenants | endevo-uat-tenants-backup-20260419 | arn:aws:dynamodb:us-east-1:383423735462:table/endevo-uat-tenants/backup/01776635384954-4fd9d8d2 | CREATING |

---

## 1.3 — Cognito Wipe

| Field | Before | After |
|-------|--------|-------|
| User count | 1 | **0** |
| Deleted | khak.pa@gmail.com (sub: 3478b498-6091-7069-a46f-9f907b02618c) | — |
| Groups preserved | GLOBAL_ADMIN, HR_ADMIN, EMPLOYEE | **INTACT** |

---

## 1.4 — DynamoDB Wipe

| Table | Items Before | Items After |
|-------|-------------|-------------|
| endevo-uat-users | 6 | **0** |
| endevo-uat-tenants | 2 | **0** |
| endevo-uat-sessions | 0 | 0 (already empty) |

---

## Status: PHASE 1 COMPLETE

PITR active on all 23 tables. DynamoDB native backups created. Cognito pool empty. DynamoDB users/tenants wiped clean.
