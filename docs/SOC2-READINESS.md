# SOC 2 Type II Readiness Audit — Endevo Life

**Audit Date:** 2026-04-09
**Auditor:** Automated codebase analysis (Claude Opus 4.6)
**Scope:** Endevo Life SaaS platform (Next.js 15 + Python Lambda + AWS CDK + DynamoDB)
**Environment:** UAT (`endevo-uat-*` resources, single region `us-east-1`)

---

## Overall Readiness Score: 38%

| Category | Status | Score |
|----------|--------|-------|
| Access Control (CC6.1-CC6.8) | PARTIAL | 55% |
| Encryption (CC6.1, CC6.7) | PARTIAL | 50% |
| Audit Logging (CC7.1-CC7.4) | PARTIAL | 45% |
| Availability (A1.1-A1.3) | FAIL | 20% |
| Data Privacy (P1-P8) | FAIL | 25% |
| Change Management (CC8.1) | PARTIAL | 55% |
| Testing & Quality (CC7.1) | FAIL | 5% |
| Incident Response (CC7.3-CC7.5) | FAIL | 10% |

---

## 1. Access Control (CC6.1-CC6.8) — PARTIAL (55%)

### What works

- **Role-based access control (RBAC):** Three-tier model enforced at every Lambda: `GLOBAL_ADMIN`, `HR_ADMIN`, `EMPLOYEE`. Each Lambda function checks role before processing.
- **Session-based auth:** All Lambdas (auth, admin, hr, employee, lms, jesse) use DynamoDB session tokens (`endevo_*` prefix). JWT path explicitly removed with security comment: "WorkOS JWTs lack RSA signature verification and can be forged."
- **Session expiry:** 24-hour TTL enforced on all session lookups, checked against `sessionExpiresAt` field.
- **Brute-force protection:** Auth Lambda tracks failed login attempts per IP. Lockout after 5 failures for 15 minutes. Fails CLOSED (blocks on error to prevent bypass).
- **OTP authentication:** 6-digit cryptographically secure OTP (`secrets.randbelow`), 5-minute TTL, single-use (consumed after verification). Dual-channel delivery (email + SMS).
- **Secrets management:** WorkOS API keys stored in AWS Secrets Manager (`endevo/workos/*`). Lambda IAM scoped to `secretsmanager:GetSecretValue` on those paths only.
- **Input sanitization:** `sanitize()` function strips HTML tags, blocks XSS patterns (`javascript:`, `onload=`, `eval(`, etc.), enforces length limits. Applied to all user-facing inputs.
- **Archived user blocking:** Session lookup rejects users with `status == "archived"` or `"inactive"`.
- **Hard delete prevention:** Both tenant and user DELETE endpoints return HTTP 405 with instructions to use archive/disable instead.
- **Email uniqueness:** Globally enforced — one email, one role. Checked on every create/invite operation.

### Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| No API Gateway authorizer | CRITICAL | All auth is done inside Lambda code. No API Gateway-level authorization (JWT authorizer or Lambda authorizer). Every request hits Lambda before auth check. |
| No WAF | CRITICAL | No AWS WAF in front of API Gateway. No rate limiting at the infrastructure level. Only application-level brute-force protection on auth endpoints. |
| No API throttling configured | HIGH | API Gateway HTTP API has no explicit throttle/rate limits configured in CDK (`05-api-stack.ts`). Default AWS limits apply but are not SOC 2 evidence. |
| `sessionToken-index` GSI missing from CDK | HIGH | Backend code queries `sessionToken-index` on the users table, but `02-dynamo-stack.ts` does not define this GSI. Likely created manually. Infrastructure drift risk. |
| Single shared Lambda role | MEDIUM | All 6 Lambda functions share one IAM role (`endevo-uat-lambda-role`). The auth Lambda has the same DynamoDB/S3/SES permissions as the admin Lambda. Violates least-privilege at function level. |
| SES resource: `*` | MEDIUM | IAM policy grants `ses:SendEmail` and `ses:SendRawEmail` on `*`. Should be scoped to verified identities. |
| SNS resource: `*` | MEDIUM | `sns:Publish` on `*` (required for phone numbers but should be documented as a compensating control). |
| CloudFront resource: `*` | LOW | CloudFront actions on `*` rather than specific distribution ARNs. |
| No MFA enforcement for Global Admins | HIGH | MFA toggle exists per-tenant but Global Admin accounts have no mandatory MFA. |
| No session invalidation on role change | MEDIUM | When a user's role is updated, existing session token remains valid until 24h expiry. |
| `localhost:3000` in CORS | LOW | Development origin in CORS allowlist. Acceptable for UAT but must be removed for production. |

---

## 2. Encryption (CC6.1, CC6.7) — PARTIAL (50%)

### What works

- **KMS Customer Managed Key:** `14-kms-stack.ts` creates a CMK (`alias/endevo-uat-vault`) for envelope encryption of sensitive employee data.
  - Automatic annual key rotation enabled (`enableKeyRotation: true`).
  - 30-day pending deletion window.
  - Key policy scoped: only Lambda role can encrypt/decrypt, account root for administration.
  - Removal policy: RETAIN (survives stack deletion).
- **S3 encryption:** Both `endevo-uat-assets` and `endevo-uat-videos` buckets use `S3_MANAGED` encryption (SSE-S3). Block all public access enabled.
- **S3 versioning:** Assets bucket has versioning enabled.
- **Secrets Manager:** API keys stored encrypted at rest (Secrets Manager default behavior).

### Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| DynamoDB tables use AWS-owned keys (default) | CRITICAL | `02-dynamo-stack.ts` does not specify `encryption` property on any table. DynamoDB defaults to AWS-owned CMK, which does not provide customer-controlled key management or rotation evidence required for SOC 2. Should use the KMS CMK from `14-kms-stack.ts`. |
| S3 buckets use SSE-S3, not SSE-KMS | HIGH | S3 buckets use `BucketEncryption.S3_MANAGED` instead of KMS CMK. Acceptable but weaker evidence for SOC 2 than customer-managed keys. |
| No TLS enforcement evidence | HIGH | No explicit TLS policy in CDK. API Gateway HTTP API uses TLS 1.2 by default, but there is no CDK-level enforcement or minimum TLS version configuration. No HSTS headers. |
| Videos bucket not versioned | MEDIUM | `endevo-uat-videos` has `versioned: false`. If training videos are deleted, they are gone. |
| KMS key not used by any DynamoDB table | HIGH | The vault key exists but there is no evidence it is actually used by any table or any application-level encryption code. The key was created but integration appears incomplete. |
| No client-side encryption of PII | MEDIUM | Employee PII (name, email, phone) stored in plaintext in DynamoDB. The KMS key exists for vault encryption but no backend code references `kms:Encrypt`/`kms:Decrypt` operations. |
| Session tokens stored in plaintext | MEDIUM | `sessionToken` field in users table is stored as plaintext. Should be hashed. |

---

## 3. Audit Logging (CC7.1-CC7.4) — PARTIAL (45%)

### What works

- **Application-level audit trail:** Dedicated `endevo-uat-audit` DynamoDB table with TTL enabled. Records include: `tenantId`, `actor`, `action`, `details`, `ip_address`, `user_agent`, `severity`, `createdAt`.
- **Comprehensive action coverage in admin Lambda:** Audited actions include: `TENANT_CREATED`, `TENANT_UPDATED`, `TENANT_ARCHIVED`, `TENANT_ENABLED`, `TENANT_MFA_UPDATED`, `USER_CREATED`, `USER_UPDATED`, `USER_ARCHIVED`, `USER_RESTORED`, `PASSWORD_RESET`, `TENANTS_EXPORTED`, `INVITE_SENT`.
- **Auth Lambda security audit:** Audited actions include: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_BLOCKED`, `OTP_SENT`, `OTP_FAILED`, `OTP_EXPIRED`, `OTP_VERIFY_BLOCKED`, `ACCOUNT_ACTIVATED`, `ACTIVATE_INVALID_TOKEN`, `WORKOS_AUTH_FAILED`, `LOGIN_UNKNOWN_EMAIL`.
- **HR Lambda audit:** Actions include: `INVITE_SENT`, `EMPLOYEE_UPDATED`, `EMPLOYEE_ARCHIVED`, `EMPLOYEE_RESTORED`, `SESSION_BOOKED`, `TENANT_BRANDING_UPDATED`.
- **IP + User-Agent tracking:** Every audit entry captures source IP and device fingerprint.
- **Severity levels:** Events tagged with `INFO`, `WARN`, `WARNING` severity.
- **EventBridge event bus:** `12-eventbridge-stack.ts` creates a custom event bus (`endevo-uat-events`) with rules for 8 core platform events, all routed to CloudWatch Logs with 30-day retention and a dead letter queue.
- **Point-in-time recovery:** Enabled on all core DynamoDB tables (tenants, users, training, questions, responses, certificates, audit, video-progress, config).

### Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| No AWS CloudTrail stack | CRITICAL | No CloudTrail configuration in CDK. CloudTrail is the foundational AWS audit service required for SOC 2. No evidence of API-level logging for DynamoDB reads, S3 access, IAM changes, or Lambda invocations. |
| Audit write failures silently swallowed | HIGH | `AUDIT_WRITE_ERROR` is caught and printed to CloudWatch but the operation continues. If the audit table is unavailable, state-changing operations proceed without audit. SOC 2 requires fail-closed audit. |
| Employee Lambda has no audit trail | HIGH | `backend/functions/employee/main.py` does not contain an `audit()` function. Employee actions (profile updates, assessment submissions, video progress) are not audited. |
| No tamper protection on audit records | HIGH | Audit records in DynamoDB can be modified or deleted by anyone with the Lambda IAM role. No write-once/append-only mechanism. |
| No centralized log aggregation | HIGH | Lambda logs go to CloudWatch Logs (standard behavior) but there is no explicit log retention policy configured in CDK for Lambda log groups. Default is "never expire" which is good for retention but there are no alerts or SIEM integration. |
| Audit TTL may delete records prematurely | MEDIUM | The audit table has TTL enabled (`timeToLiveAttribute: 'ttl'`). The comment says "auto-delete old audit logs after 2 years" but the TTL is actually set per-record. OTP records use 5-minute TTL. If audit records are also given short TTLs, they may be deleted before the SOC 2 audit period. Need to verify TTL values on audit entries. |
| No read access logging | MEDIUM | Only write/mutation operations are audited. Data reads (tenant detail views, user listings, exports) are partially audited (export yes, list no). A SOC 2 auditor would want evidence that sensitive data access is logged. |

---

## 4. Availability (A1.1-A1.3) — FAIL (20%)

### What works

- **Serverless architecture:** Lambda + DynamoDB + API Gateway are inherently highly available within a single region. No servers to manage, auto-scaling built in.
- **Health check endpoint:** Auth Lambda exposes `GET /api/auth/health` for Route 53 health checks.
- **DynamoDB on-demand billing:** All tables use `PAY_PER_REQUEST`, so capacity scales automatically.
- **S3 durability:** 99.999999999% durability (11 nines) for stored objects.

### Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| Single region deployment | CRITICAL | Entire stack deployed to `us-east-1` only. No multi-region failover. If `us-east-1` has an outage, the platform is completely unavailable. SOC 2 A1.2 requires documented recovery plans. |
| No DynamoDB Global Tables | CRITICAL | All 18+ DynamoDB tables are single-region. No cross-region replication. README explicitly acknowledges this: "DynamoDB: Single region, Zero failover." |
| No S3 Cross-Region Replication | HIGH | S3 buckets are single-region. README acknowledges: "S3: Single region, Content unavailable if region fails." |
| No documented disaster recovery plan | CRITICAL | No DR runbook, no RTO/RPO targets documented, no recovery procedures. |
| No CloudWatch alarms (mostly) | HIGH | README notes alarms were added for `fn-lms` and `fn-jesse` only. No alarms for `fn-auth`, `fn-admin`, `fn-hr`, `fn-employee`. No DynamoDB throttle alarms. No error rate alarms. |
| No backup strategy beyond PITR | MEDIUM | Point-in-time recovery enabled on tables, which is good. But no periodic backup exports to S3, no cross-account backup, no AWS Backup integration. |
| Lambda concurrency not configured | MEDIUM | No reserved or provisioned concurrency configured in `05-api-stack.ts`. Default Lambda concurrency could be exhausted during traffic spikes. README acknowledges the 30s timeout limitation for Jesse. |

---

## 5. Data Privacy (P1-P8) — FAIL (25%)

### What works

- **Tenant isolation:** Data is partitioned by `tenantId` in DynamoDB. HR admins can only see their own tenant's data (enforced in Lambda code).
- **Invite-token stripping:** API responses explicitly strip `inviteToken` from user records before returning to clients.
- **Email masking:** OTP response masks the email address (e.g., `sha***@domain.com`).
- **Soft delete pattern:** Users and tenants are archived, never hard-deleted. Data preserved for compliance.
- **Temporary upload cleanup:** S3 lifecycle rule auto-deletes `temp/` prefix objects after 1 day.

### Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| No GDPR right-to-erasure implementation | CRITICAL | README and ARCHITECTURE.md reference a "right-to-delete Lambda" but no such Lambda exists in the codebase. Hard deletes are actively blocked (HTTP 405). There is no mechanism to permanently erase a user's PII upon request. |
| No data classification policy | HIGH | No documented classification of data fields (PII, sensitive, public). Employee names, emails, phones, IP addresses, and assessment responses are stored without formal classification. |
| No consent management | HIGH | Signup page mentions "Terms of Service and Privacy Policy" but there is no consent tracking mechanism. No `consentedAt` or `consentVersion` fields on user records. No evidence of consent before data processing. |
| PII stored in plaintext | HIGH | Employee PII (firstName, lastName, email, phone, department, jobTitle, IP addresses) stored as plaintext DynamoDB attributes. The KMS vault key exists but is not integrated. |
| No data retention policy enforced | HIGH | Audit table has TTL but no other tables have retention/expiration configured. User data, assessment responses, video progress, and certificates have no expiration. No documented retention schedule. |
| Temp password sent in email body | HIGH | When creating an HR admin account (`admin/main.py` line 548), the temporary password is embedded in the welcome email HTML. This password is visible in SES logs, potentially in email server logs, and in the recipient's mailbox indefinitely. |
| No data processing agreement (DPA) framework | MEDIUM | No code-level support for B2B data processing agreements. No mechanism for tenants to manage their data subjects' rights. |
| No data export capability for data subjects | MEDIUM | No "download my data" endpoint. GDPR Article 20 (data portability) requires this. Only admin-level export exists. |
| `print()` statements log sensitive data | MEDIUM | 26 `print()` statements in `admin/main.py` alone. Error messages may include email addresses, tenant IDs, and stack traces in CloudWatch Logs. No PII scrubbing. |

---

## 6. Change Management (CC8.1) — PARTIAL (55%)

### What works

- **Infrastructure as Code:** All AWS resources defined in CDK TypeScript stacks (14 stack files). Changes are version-controlled and reproducible.
- **CI/CD pipelines:** Three GitHub Actions workflows:
  - `deploy-infrastructure.yml` — CDK deploy on push to `main` (infrastructure changes only).
  - `deploy-lambda.yml` — Builds and deploys all 6 Lambda functions on push to `main` (backend changes only).
  - `deploy-app.yml` — Triggers Amplify build on push to `main` (frontend changes only).
- **Path-based triggers:** Each workflow only runs when relevant files change (infrastructure, backend, or apps).
- **Credential management:** AWS credentials via GitHub Secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_KEY_REF`, `AWS_REGION`, `AWS_ACCOUNT_ID`). No hardcoded keys in workflows.
- **Artifact capture:** Infrastructure deployment uploads `cdk-outputs.json` as a build artifact.
- **CDK Bootstrap:** Infrastructure workflow includes CDK bootstrap step for first-time setup.

### Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| No branch protection / PR requirement | CRITICAL | All three workflows deploy on direct push to `main`. No pull request requirement, no code review gate, no approval step before production deployment. |
| No staging environment | CRITICAL | Single `uat` environment deploys directly from `main`. No staging/pre-production environment for validation before deployment. |
| No automated tests in CI | CRITICAL | None of the three workflows run any tests (unit, integration, or E2E). Lambda code is deployed without any validation. Frontend is built by Amplify without test step. |
| No rollback procedure | HIGH | No documented or automated rollback mechanism. CDK deploy goes forward only. Lambda deployment overwrites the current version with no alias/version strategy. |
| No deployment approval gate | HIGH | `--require-approval never` flag used in CDK deploy. All infrastructure changes auto-approve, including IAM and security group modifications. |
| Infrastructure drift risk | HIGH | `sessionToken-index` GSI exists in running DynamoDB but not in CDK code. Some resources created manually outside CDK. No drift detection. |
| No change advisory board (CAB) | MEDIUM | No formal change management process documented. No change request templates, no risk assessment for deployments. |
| Long-lived AWS access keys | MEDIUM | GitHub Actions uses static `AWS_ACCESS_KEY_ID` + `AWS_SECRET_KEY_REF`. Should use OIDC federation with short-lived credentials. |

---

## 7. Testing & Quality (CC7.1) — FAIL (5%)

### Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| Zero test files | CRITICAL | No unit tests, integration tests, or E2E tests exist in the codebase. No `test_*.py`, no `*.test.ts`, no `*.spec.ts` files outside of `node_modules`. |
| No test framework configured | CRITICAL | No pytest, jest, vitest, or playwright configuration files found. |
| No code coverage measurement | CRITICAL | No coverage tooling configured. |
| No linting in CI | HIGH | No linting step (ruff, eslint, pylint) in any CI workflow. |
| No static analysis | HIGH | No security scanning (bandit, semgrep, snyk) in CI. |

---

## 8. Incident Response (CC7.3-CC7.5) — FAIL (10%)

### What works

- **Error logging:** Lambda errors are printed to CloudWatch Logs with descriptive prefixes (`AUDIT_WRITE_ERROR`, `WORKOS_AUTH_ERROR`, `SESSION_LOOKUP_ERROR`, etc.).
- **EventBridge DLQ:** Failed event deliveries go to an SQS dead letter queue with 14-day retention.

### Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| No incident response plan | CRITICAL | No documented IRP (Incident Response Plan). No runbooks for security breaches, data exposure, or system outages. |
| No alerting | HIGH | No SNS topics for operational alerts. No PagerDuty/Opsgenie integration. No CloudWatch alarm actions configured beyond the two recently added for LMS/Jesse. |
| No security incident detection | HIGH | No GuardDuty, no Security Hub, no anomaly detection. Brute-force protection exists at the app layer but no AWS-native threat detection. |
| No on-call rotation | MEDIUM | Team of 2-3 developers with no documented on-call schedule. |

---

## Priority Remediation Actions

### P0 — Must Fix Before Any SOC 2 Engagement (Blockers)

1. **Enable AWS CloudTrail** — Create a CDK stack for CloudTrail with S3 log delivery and log file validation. This is the single most important control for SOC 2.
2. **Add automated tests + CI test gate** — At minimum: unit tests for auth/session validation, authorization checks, and input sanitization. Block deployment on test failure.
3. **Require PR reviews before merge to main** — Enable GitHub branch protection on `main`: require 1 reviewer, require status checks to pass, disable direct push.
4. **Enable DynamoDB encryption with CMK** — Add `encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED` with the existing KMS vault key to all tables.
5. **Implement GDPR data deletion** — Create a Lambda endpoint that permanently erases a user's PII across all tables when requested. The archive-only pattern is insufficient for GDPR Article 17.
6. **Create incident response plan** — Document procedures for: security breach, data exposure, system outage, credential compromise.

### P1 — Must Fix Before SOC 2 Type II Audit Period Begins

7. **Deploy WAF on API Gateway** — Add AWS WAF with rate limiting, SQL injection, and XSS rule sets.
8. **Add CloudWatch alarms** — Error rate, throttle, and latency alarms for all 6 Lambda functions. DynamoDB throttle alarms. Alarm actions to SNS topic.
9. **Implement per-Lambda IAM roles** — Separate the single shared role into 6 function-specific roles with minimum required permissions.
10. **Enable DynamoDB Global Tables** — Add at least one replica region (us-west-2) for disaster recovery.
11. **Document DR plan with RTO/RPO** — Define recovery time and point objectives. Test failover procedures.
12. **Add security headers** — HSTS, X-Content-Type-Options, X-Frame-Options, Content-Security-Policy at API Gateway or CloudFront level.
13. **Add audit for employee Lambda** — Employee-initiated actions (assessment submission, profile update, certificate download) must be logged.
14. **Make audit logging fail-closed** — If audit write fails, the operation should fail too (or at minimum, queue for retry).
15. **Switch to OIDC for GitHub Actions** — Replace long-lived AWS access keys with GitHub OIDC federation.
16. **Implement consent tracking** — Add `consentedAt`, `consentVersion`, `privacyPolicyVersion` fields to user records.

### P2 — Should Fix During SOC 2 Observation Period

17. **Create data classification document** — Classify all data fields by sensitivity (PII, sensitive, internal, public).
18. **Add data retention policy** — Configure TTL or lifecycle rules for assessment responses, video progress, and certificates. Document retention periods.
19. **Hash session tokens at rest** — Store SHA-256 hash of session token in DynamoDB instead of plaintext.
20. **Remove `localhost:3000` from CORS** — Strip development origins from production configuration.
21. **Eliminate temp password in email** — Use OTP-only flow for HR admin onboarding (already supported).
22. **Add PII scrubbing to logs** — Replace `print()` with structured logging that redacts email addresses and other PII.
23. **Configure Lambda log retention** — Set explicit CloudWatch log group retention periods (e.g., 1 year) via CDK.
24. **Add deployment versioning** — Use Lambda aliases and versions for blue/green deployment and rollback capability.

---

## Evidence Inventory (What Already Exists)

| SOC 2 Requirement | Evidence Available | Location |
|-------------------|--------------------|----------|
| Access control | RBAC in Lambda code | `backend/functions/*/main.py` |
| Secrets management | Secrets Manager integration | IAM policy in `04-iam-stack.ts` |
| Encryption at rest (KMS) | KMS key created | `14-kms-stack.ts` |
| S3 encryption | SSE-S3 enabled | `03-s3-stack.ts` |
| S3 public access blocked | BLOCK_ALL | `03-s3-stack.ts` |
| Audit logging | DynamoDB audit table | `02-dynamo-stack.ts` + all Lambda handlers |
| Event bus | EventBridge with CloudWatch | `12-eventbridge-stack.ts` |
| Infrastructure as Code | CDK stacks | `infrastructure/lib/*.ts` |
| CI/CD pipelines | GitHub Actions | `.github/workflows/*.yml` |
| Point-in-time recovery | Enabled on all core tables | `02-dynamo-stack.ts` |
| Brute-force protection | IP-based lockout | `backend/functions/auth/main.py` |
| Input validation | Sanitization functions | `backend/functions/admin/main.py` |

---

## Summary

The platform has solid application-level security foundations (RBAC, OTP auth, input sanitization, audit trails, brute-force protection). However, it is missing critical infrastructure-level controls required for SOC 2: no CloudTrail, no WAF, no multi-region DR, no automated testing, no branch protection, and no incident response plan.

The KMS encryption infrastructure was built but never integrated with DynamoDB tables. The GDPR right-to-erasure capability was planned but never implemented.

**Estimated effort to reach SOC 2 readiness:** 4-6 weeks of focused infrastructure and security work for P0+P1 items, followed by a 3-6 month observation period before a Type II audit.

**Recommendation:** Do not engage a SOC 2 auditor until at least all P0 items are complete and P1 items are in progress. An auditor arriving now would flag 15+ critical findings and the engagement would be wasted.
