# HEAL-401-02 — Admin Lambda Environment Variables

**Date:** 2026-04-19  
**Function:** `endevo-uat-fn-admin`  
**Region:** `us-east-1`

## Env Vars Present

| Variable | Value | Status |
|---|---|---|
| `COGNITO_USER_POOL_ID` | `us-east-1_mZ1axgz46` | CORRECT — new V2 pool |
| `COGNITO_CLIENT_ID` | `7g1ci43r35rg32t6t7mcegar04` | PRESENT |
| `COGNITO_JWKS_URL` | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_mZ1axgz46/.well-known/jwks.json` | CORRECT — matches pool ID |
| `ENVIRONMENT` | `uat` | OK |
| `REGION` | `us-east-1` | OK |

## Checks

- **Old pool `us-east-1_DVyEJqgFt`:** NOT referenced. All vars point to `us-east-1_mZ1axgz46`. PASS.
- **WORKOS_* variables:** NONE present. WorkOS fully removed. PASS.
- **COGNITO_JWKS_URL pool consistency:** URL contains `us-east-1_mZ1axgz46` — matches `COGNITO_USER_POOL_ID`. PASS.
- **All 3 required Cognito vars present:** COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_JWKS_URL — all set. PASS.

## Verdict

**Env vars are correct.** The 401 error is NOT caused by misconfigured environment variables.  
Root cause is the missing `cognito_auth` module in the deployment package (see HEAL-401-01).
