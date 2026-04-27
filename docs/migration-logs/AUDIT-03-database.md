# Audit: Domain 3 — DynamoDB Database Inventory
**Date:** 2026-04-19 | **Auditor:** Autonomous audit session

---

## Table Inventory — 38 total

### endevo-uat-* Tables (23)

| Table | Item Count | Notes |
|-------|-----------|-------|
| endevo-uat-knowledge-base | 7,228 | Largest table — Jesse AI knowledge chunks |
| endevo-uat-lms-modules | 75 | Active LMS content |
| endevo-uat-lms-questions | 97 | Question bank (40-question assessment pool) |
| endevo-uat-users | ~50 | Active users |
| endevo-uat-tenants | ~10 | Active tenants |
| endevo-uat-audit-logs | ~500 | Audit trail entries |
| endevo-uat-invites | ~20 | Pending/accepted invites |
| endevo-uat-playbooks | ~30 | AI-generated playbooks |
| endevo-uat-checklists | ~20 | Employee checklists |
| endevo-uat-training | ~15 | Training records |
| endevo-uat-lms-progress | ~40 | Per-user LMS progress |
| endevo-uat-lms-completions | ~25 | Lesson completion records |
| endevo-uat-config | 0 | **EMPTY** — PLAN_CONFIG + FEATURE_FLAGS not seeded |
| endevo-uat-sessions | 0 | **EMPTY** — no session records |
| endevo-uat-subscriptions | 0 | **EMPTY** — no subscription records |
| endevo-uat-certificates | 0 | **EMPTY** — no certificate records |
| endevo-uat-master-classes | 0 | **EMPTY** — master classes catalog not seeded |
| endevo-uat-costs | 0 | **EMPTY** — FinOps cost data not seeded |
| endevo-uat-jesse-chat | ~100 | Jesse chat message history |
| endevo-uat-notifications | ~5 | Notification records |
| endevo-uat-archive-users | ~5 | Archived user records |
| endevo-uat-archive-tenants | ~2 | Archived tenant records |
| endevo-uat-feature-flags | — | Merged into endevo-uat-config (configKey=FEATURE_FLAGS) |

### lros-* Tables (15)

| Table | Item Count | Notes |
|-------|-----------|-------|
| lros-users | ~30 | Legacy LROS user records |
| lros-tenants | ~8 | Legacy LROS tenant records |
| lros-audit-logs | ~200 | Legacy audit trail |
| lros-invites | ~10 | Legacy invites |
| lros-playbooks | ~15 | Legacy playbooks |
| lros-checklists | ~10 | Legacy checklists |
| lros-training | ~8 | Legacy training |
| lros-knowledge-base | ~500 | Legacy knowledge (smaller than endevo-uat) |
| lros-config | ~2 | Legacy config |
| lros-sessions | ~5 | Legacy sessions |
| lros-jesse-chat | ~50 | Legacy Jesse chat |
| lros-certificates | 0 | Empty |
| lros-subscriptions | 0 | Empty |
| lros-costs | 0 | Empty |
| lros-notifications | ~3 | Legacy notifications |

---

## Key Schema Notes

### endevo-uat-config
- **Key schema:** `configKey` (hash only) — NO sort key
- **Critical:** Previous code passed `{"configKey": "FEATURE_FLAGS", "sk": "v1"}` — the extra `sk` field caused ValidationException
- **Fix:** Commit `991a398` removed `sk` from GetItem and PutItem calls
- **Current state:** 0 items — `PLAN_CONFIG` and `FEATURE_FLAGS` records need seeding

### endevo-uat-knowledge-base
- 7,228 chunks — primary RAG source for Jesse AI
- Hash key: `chunkId` (UUID); GSI on `domain` for filtered queries

### endevo-uat-lms-modules / lms-questions
- 75 modules + 97 questions; 40-question assessment draws from the question pool
- Questions grouped by domain for the ScorecardDisplay component

---

## Billing Mode

All tables: **PAY_PER_REQUEST** (on-demand). No provisioned capacity waste.

---

## Issues

| Severity | Issue |
|----------|-------|
| P1 | `endevo-uat-config` empty — FEATURE_FLAGS and PLAN_CONFIG not seeded; feature flags API returns empty flags object |
| P2 | `endevo-uat-subscriptions` empty — subscription pages show no data |
| P2 | `endevo-uat-sessions` empty — sessions/1:1 page shows no data |
| P2 | `endevo-uat-certificates` empty — certificate pages show no data |
| P2 | `endevo-uat-master-classes` empty — master classes page shows no content |
| P2 | `endevo-uat-costs` empty — FinOps dashboard shows no data |
| INFO | lros-* tables contain legacy data; no active code paths write to them |
