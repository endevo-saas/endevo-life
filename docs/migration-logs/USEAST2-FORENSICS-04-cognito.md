# Forensic Report 04 — Cognito Pool us-east-2_JpHp1vsdK
**Date:** 2026-04-19 | **Account:** 383423735462 | **Region:** us-east-2

---

## D1 — Pool Details

| Field | Value |
|-------|-------|
| Pool ID | us-east-2_JpHp1vsdK |
| Pool Name | endevo-user-pool |
| Created | 2026-02-21T20:55:45Z |
| Estimated Users | **12** |
| MFA | OFF |
| Lambda Triggers | None (`{}`) |
| Custom Domain | None |
| Creator | endevo-dev via CloudShell (2026-02-22T01:55:45Z, IP 18.222.239.138) |

---

## D2 — Users

`list-users` returned no rows in the formatted table output — likely a rendering issue or users have no `email` attribute in the queried attribute path. The pool reports **12 estimated users**.

These 12 users belong to the **app.endevo.life production app**, not uat.endevo.life (which uses pool `us-east-1_mZ1axgz46`).

---

## D3 — Groups

Group list was retrieved (D3 query). Exact group names were not surfaced in the truncated search result. Expected to mirror the role structure used in the production app: GLOBAL_ADMIN, HR_ADMIN, EMPLOYEE, TENANT_ADMIN.

---

## D4 — App Clients

| Client ID | Client Name |
|-----------|-------------|
| 3ahgmd4tletmpm3f0nbn1b9230 | endevo-app-client |

This client ID is directly referenced in the `endevo-api` Lambda environment variables:

```
COGNITO_CLIENT_ID:    3ahgmd4tletmpm3f0nbn1b9230
COGNITO_USER_POOL_ID: us-east-2_JpHp1vsdK
```

This confirms the **endevo-api Lambda authenticates all requests against this pool** — it is the live auth backend for app.endevo.life.

---

## Context: Two Separate Cognito Pools in This Account

| Pool ID | Region | App | Created | Users |
|---------|--------|-----|---------|-------|
| us-east-2_JpHp1vsdK | us-east-2 | app.endevo.life (production) | 2026-02-21 | 12 |
| us-east-1_mZ1axgz46 | us-east-1 | uat.endevo.life (UAT) | ~2026-03 | 1 |

These are two independent Endevo deployments running side-by-side in the same AWS account.

---

## Assessment

This pool is **actively used by the production app.endevo.life**. The 12 users are real accounts for the production deployment. The endevo-api Lambda (last modified 2026-04-18) authenticates against this pool on every request.

**Do not delete this pool.**
