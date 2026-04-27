# GLOBAL_ADMIN Audit Report — 2026-04-19

## Routes (22 frontend pages)

| Page | Path |
|------|------|
| Dashboard | /admin/dashboard |
| Users | /admin/users |
| Tenants | /admin/tenants |
| Tenants Detail | /admin/tenants/[tenantId] |
| Subscriptions | /admin/subscriptions |
| Audit | /admin/audit |
| Archive | /admin/archive |
| Health | /admin/health |
| System | /admin/system |
| Features | /admin/features |
| Plan Config | /admin/plan-config |
| Import/Export | /admin/import-export |
| Knowledge | /admin/knowledge |
| Finops | /admin/finops |
| Certificates | /admin/certificates |
| Settings | /admin/settings |
| Developers | /admin/developers |
| Executive Brief | /admin/executive-brief |
| LMS Modules | /admin/lms/modules |
| LMS Module Detail | /admin/lms/modules/[moduleNum] |
| LMS Progress | /admin/lms/progress |
| LMS Questions | /admin/lms/questions |

## API Endpoints (GET endpoints tested)

| Endpoint | Method | HTTP | ms | Response Keys | Error |
|----------|--------|------|-----|---------------|-------|
| /api/admin/dashboard | GET | 200 | 366 | total_tenants, active_tenants, total_users, active_users | — |
| /api/admin/tenants | GET | 200 | 310 | tenants, count, next_token, has_more | — |
| /api/admin/users | GET | 200 | 150 | users, count, next_token, has_more | — |
| /api/admin/audit | GET | 200 | 270 | logs, count, next_token, has_more | — |
| /api/admin/health | GET | 200 | 199 | status, timestamp, services | — |
| /api/admin/subscriptions | GET | 200 | 169 | total_tenants, active_subscriptions, revenue | — |
| /api/admin/metrics/overview | GET | 200 | 262 | users, users_by_plan, activation_rate | — |
| /api/admin/tenants/export | GET | 200 | 160 | tenants, count, exportedAt | — |
| /api/admin/employees/export | GET | 200 | 185 | employees, count, exportedAt | — |
| /api/admin/features | GET | 200 | 164 | flags, source:"defaults" | P1: DB key mismatch |
| /api/admin/system/status | GET | 200 | 2752 | checkedAt, overall, dynamodb | P2: >2s |
| /api/admin/archive/users | GET | 200 | 161 | users, count | — |
| /api/admin/archive/tenants | GET | 200 | 178 | tenants, count | — |
| /api/admin/knowledge/files | GET | 200 | 299 | files, count | — |

## Broken Items — P0
_None found._

## Broken Items — P1

1. **`/api/admin/features` — always returns defaults, never persisted flags**
   - Root cause: `CONFIG_T.get_item(Key={"configKey": "FEATURE_FLAGS", "sk": "v1"})` — table `endevo-uat-config` is hash-only (no sort key)
   - Every call throws `ValidationException: The provided key element does not match the schema`
   - Fallback returns `{"source": "defaults"}` so HTTP is 200 but data is never saved/loaded
   - Fix: remove `"sk": "v1"` from GetItem key — [admin/main.py:2013](../../backend/functions/admin/main.py)

## Broken Items — P2

1. **`/api/admin/system/status` — 2752ms (>2s)**
2. **`endevo-uat-subscriptions` — 0 items** (endpoint works, just empty)
3. **`endevo-uat-config` — 0 items** (PLAN_CONFIG / FEATURE_FLAGS not seeded)
4. **`endevo-uat-sessions` — 0 items** (no 1:1 session records)

## Performance
| Endpoint | ms | Threshold |
|----------|----|-----------|
| /api/admin/system/status | 2752 | 2000 |

## Lambda Errors (last 10 min)
- `endevo-uat-fn-admin`: 2x `FEATURE_FLAGS_GET_ERROR: ValidationException` (P1 fix pending)
- `endevo-uat-fn-auth`: clean
- `endevo-uat-fn-jesse`: clean
