# Audit: Domain 7 — Security
**Date:** 2026-04-19 | **Auditor:** Autonomous audit session

---

## IAM

| Item | Finding | Severity |
|------|---------|----------|
| CI/CD user (`endevo-sh-uat`) | **AdministratorAccess** policy attached | P1 |
| Lambda execution roles | Scoped to DynamoDB + SES + Bedrock only | ✓ |
| CodeBuild role | Scoped to Lambda + S3 only | ✓ |
| Amplify service role | Scoped to Amplify + S3 | ✓ |
| Root account MFA | Not verified in audit | INFO |

**Risk:** `endevo-sh-uat` with `AdministratorAccess` means a leaked key = full account compromise. Should be replaced with a least-privilege policy scoped to Lambda deploy + S3 + CodeBuild.

---

## Secrets Manager

| Secret | Status | Action |
|--------|--------|--------|
| `endevo/cognito/user-pool-id` | Active, in use | ✓ Keep |
| `endevo/cognito/client-id` | Active, in use | ✓ Keep |
| `endevo/bedrock/agent-id` | Active, in use | ✓ Keep |
| `endevo/ses/from-address` | Active, in use | ✓ Keep |
| `endevo/workos/api-key` | **Stale** — WorkOS removed | Delete |
| `endevo/workos/client-id` | **Stale** — WorkOS removed | Delete |
| `lros/workos/api-key` | **Stale** — legacy | Delete |
| `lros/workos/client-id` | **Stale** — legacy | Delete |

---

## Hardcoded Secrets Scan

| Location | Finding |
|----------|---------|
| `apps/web/.env.production` | Only public URLs (`NEXT_PUBLIC_*`) — no secrets |
| `backend/functions/*/main.py` | All secrets read from `os.environ` / Secrets Manager |
| `infrastructure/` | No hardcoded ARNs or keys — all via CDK context |
| `buildspec.yml` | No secrets — uses CodeBuild environment variables |

**Result: ZERO hardcoded secrets in source code.** ✓

---

## S3 Public Access

| Check | Result |
|-------|--------|
| Block Public ACLs | Enabled on all 10 buckets |
| Block Public Policies | Enabled on all 10 buckets |
| Bucket ACLs | Private on all 10 buckets |
| Public objects | None found |

**Result: All S3 buckets fully private.** ✓

---

## CloudWatch Log Retention

| Log Group | Retention | Risk |
|-----------|-----------|------|
| `/aws/lambda/endevo-uat-fn-admin` | **NULL** (never expires) | Cost + compliance |
| `/aws/lambda/endevo-uat-fn-auth` | **NULL** | Cost + compliance |
| `/aws/lambda/endevo-uat-fn-employee` | **NULL** | Cost + compliance |
| `/aws/lambda/endevo-uat-fn-hr` | **NULL** | Cost + compliance |
| `/aws/lambda/endevo-uat-fn-jesse` | **NULL** | Cost + compliance |
| `/aws/lambda/endevo-uat-fn-lms` | **NULL** | Cost + compliance |

Recommended: Set retention to 30 days (UAT) or 90 days (production).

---

## API Security

| Check | Result |
|-------|--------|
| Auth on admin routes | Cognito JWT required (GLOBAL_ADMIN claim) |
| Auth on HR routes | Cognito JWT required (HR_ADMIN claim) |
| Auth on employee routes | Cognito JWT required (EMPLOYEE claim) |
| Auth on `/api/auth/*` | Open (by design — login flow) |
| CORS | Configured on API GW — origins restricted |
| Rate limiting | 200 RPS / 500 burst via API GW throttling |
| Input validation | Present in Lambda handlers |

---

## Frontend Security

| Check | Result |
|-------|--------|
| No WorkOS tokens in code | ✓ |
| No hardcoded API keys | ✓ |
| NEXT_PUBLIC vars | Only public URLs — safe to expose |
| Sentry DSN | Empty in `.env.production` — errors not reported |

---

## Issues

| Severity | Issue |
|----------|-------|
| P1 | `endevo-sh-uat` IAM user has `AdministratorAccess` — must scope to least privilege |
| P1 | CloudWatch log retention NULL on all Lambda groups — logs never expire |
| P2 | 4 stale WorkOS secrets in Secrets Manager — should be deleted |
| P2 | Sentry DSN empty — unhandled frontend errors invisible |
| P2 | No DLQ on Lambdas — async invocation failures silently lost |
| INFO | Root account MFA status not verified |
