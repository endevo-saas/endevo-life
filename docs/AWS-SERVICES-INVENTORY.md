# AWS Services Inventory — Endevo Life

> Complete inventory of every AWS service in use, with capacity limits, multi-region support, scaling thresholds, and cost analysis.
> Last updated: 2026-04-05

---

## Summary

| Field | Value |
|-------|-------|
| **Region** | us-east-1 (N. Virginia) |
| **Account ID** | 383423735462 |
| **IAM User** | endevo-sh-uat |
| **Resource Prefix** | endevo-uat- |
| **Environment** | UAT (pre-production) |
| **Total Active Services** | 12 |
| **Total DynamoDB Tables** | 13 |
| **Total Lambda Functions** | 5 |
| **Total S3 Buckets** | 5 |
| **CloudWatch Alarms** | 32 |
| **Monthly Cost Estimate** | ~$40–60 (current 82 users) |

---

## Service Inventory — Master Table

| # | Service | Resource Name / ID | Purpose | Current Config | Multi-Region? | Min Capacity | Max Capacity | Cost (us-east-1) | Cost (2 regions) | Scalable? |
|---|---------|-------------------|---------|----------------|:---:|---|---|---|---|:---:|
| 1 | Cognito | us-east-1_DVyEJqgFt | User auth, JWT, MFA | 82 users, MFA optional | NO | 0 MAU | Unlimited | Free (<50K MAU) | N/A — no replication | YES |
| 2 | DynamoDB | 13 tables (endevo-uat-*) | All application data | PAY_PER_REQUEST, ~1K items | NO (can enable Global Tables) | 0 RCU/WCU | Unlimited | ~$2/mo (on-demand) | ~$5/mo (Global Tables) | YES |
| 3 | Lambda | 5 functions (fn-auth/admin/hr/employee/lms) | API business logic | Python 3.12, 256 MB, 30s | NO (deploy per region) | 0 invocations | 1K concurrent (default) | ~$0.50/mo | ~$1/mo | YES |
| 4 | API Gateway v2 | 4jms6sdzk9 | HTTP API routing | HTTP API, JWT authorizer | NO (deploy per region) | 0 requests | Unlimited | ~$1/mo | ~$2/mo | YES |
| 5 | S3 | 5 buckets | Frontend, assets, videos | Standard storage | YES (CRR available) | 0 GB | Unlimited | ~$1/mo | ~$2/mo (CRR) | YES |
| 6 | CloudFront | E2CH9N3L4W6WV, E121OSHNXKRE61 | CDN for frontend + LMS video | 2 distributions | GLOBAL | 0 requests | Unlimited | ~$5/mo | Same (global) | YES |
| 7 | Amplify | d1vvfv8oltolcf | CI/CD + hosting | GitHub deploy, Next.js 15 | NO (single region) | 0 builds | 100 builds/mo (free) | ~$5/mo | ~$10/mo | YES |
| 8 | SES | us-east-1 | Transactional email | Production access, 50K/day | NO (per region) | 0 emails | 50K/day (current limit) | ~$0.10/mo | ~$0.20/mo | YES |
| 9 | WAF v2 | endevo-uat-waf | API protection | 4 rules, rate limit 1000/IP | REGIONAL | 0 requests | Unlimited | ~$11/mo | ~$22/mo | YES |
| 10 | Route 53 | Z00556611RY5GCMKE4K5H | DNS for endevo.life | 1 hosted zone | GLOBAL | 1 zone | Unlimited | ~$0.50/mo | Same (global) | YES |
| 11 | ACM | endevo.life, uat.endevo.life | TLS certificates | 2 certs, ISSUED | GLOBAL (CloudFront) / REGIONAL | 0 certs | 2,500 certs | Free | Free | YES |
| 12 | CloudWatch | 32 alarms | Monitoring + alerting | Metrics, logs, alarms | NO (per region) | 0 alarms | Unlimited | ~$8/mo | ~$16/mo | YES |
| 13 | IAM | 3 users, 4 roles | Access management | endevo-sh-uat, deploy role | GLOBAL | 0 users | 5,000 users | Free | Free | N/A |

**Estimated Total (current):** ~$34–55/month

---

## Detailed Service Breakdown

---

### 1. Amazon Cognito — User Authentication

| Field | Value |
|-------|-------|
| **Resource** | User Pool `us-east-1_DVyEJqgFt` |
| **Pool Name** | endevo-uat-users |
| **Purpose** | User authentication, JWT token issuance, MFA, password management |
| **Current State** | 82 estimated users, 3 roles (GLOBAL_ADMIN, HR_ADMIN, EMPLOYEE) |
| **MFA** | OPTIONAL (TOTP available) |
| **Global/Regional** | Regional — single region only |
| **Multi-Region** | NO. Cognito does not support cross-region replication. This is a blocker for active-active architecture. |
| **Min Capacity** | 0 MAU (monthly active users) |
| **Max Capacity** | Unlimited MAU |
| **Free Tier** | 50,000 MAU (first 12 months), then permanent free tier of 50K MAU |
| **Cost at 82 users** | $0.00 (within free tier) |
| **Cost at 10K users** | $0.00 (within free tier) |
| **Cost at 100K users** | ~$275/mo ($0.0055/MAU above 50K) |
| **What breaks at scale** | No cross-region failover; 10 requests/second default throttle on admin APIs |
| **Scaling Notes** | Scales automatically for auth operations. Admin API has soft limits (request increase via support). |
| **Migration Plan** | Replace with custom DynamoDB-backed JWT auth at ~500 users to enable multi-region. Evaluate Amazon Verified Permissions for fine-grained authz. |

---

### 2. Amazon DynamoDB — Application Data Store

| Field | Value |
|-------|-------|
| **Tables** | 13 tables (all prefixed `endevo-uat-`) |
| **Billing Mode** | PAY_PER_REQUEST (on-demand) across all tables |
| **Purpose** | All application data — users, tenants, LMS, audit, certificates, config |
| **Global/Regional** | Regional (can enable Global Tables for multi-region) |
| **Multi-Region** | YES — via DynamoDB Global Tables (active-active replication) |

#### Table Inventory

| Table | Items | Size (bytes) | GSIs | Purpose |
|-------|------:|----------:|------|---------|
| endevo-uat-users | 47 | 11,927 | tenantId-index, inviteToken-index, email-index | User profiles and roles |
| endevo-uat-tenants | 15 | 4,202 | — | Tenant/company records |
| endevo-uat-audit | 169 | 72,876 | — | Audit trail for compliance |
| endevo-uat-responses | 6 | 22,360 | tenantId-index | Estate planning responses |
| endevo-uat-questions | 636 | 350,859 | — | Estate planning questionnaire |
| endevo-uat-lms-modules | 75 | 33,782 | status-index | LMS course modules |
| endevo-uat-lms-lessons | 15 | 6,789 | lessonId-index | Individual lessons within modules |
| endevo-uat-lms-lesson-progress | 21 | 6,906 | module-progress-index | User progress per lesson |
| endevo-uat-lms-user-modules | 12 | 1,584 | tenantId-index | Module enrollment/completion per user |
| endevo-uat-training | 28 | 8,448 | — | Training records |
| endevo-uat-certificates | 3 | 674 | — | Completion certificates |
| endevo-uat-config | 3 | 835 | — | System configuration |
| endevo-uat-video-progress | 2 | 477 | — | Video watch progress tracking |

**Total Items:** ~1,032 | **Total Size:** ~522 KB | **Total GSIs:** 8

| Cost Tier | Estimate |
|-----------|----------|
| Current (82 users, ~1K items) | ~$2/mo (on-demand, well within free tier) |
| 10K users (~100K items) | ~$15/mo |
| 100K users (~1M items) | ~$150/mo |
| **Free Tier** | 25 WCU + 25 RCU + 25 GB (always free) |

| Scale Threshold | Action Required |
|----------------|-----------------|
| 10K users | Enable Global Tables for multi-region |
| 100K users | Evaluate provisioned capacity with auto-scaling for cost optimization |
| 1M users | Partition key design review; consider DAX (DynamoDB Accelerator) for hot partitions |

---

### 3. AWS Lambda — Serverless Compute

| Field | Value |
|-------|-------|
| **Functions** | 5 |
| **Runtime** | Python 3.12 |
| **Memory** | 256 MB (all functions) |
| **Timeout** | 30 seconds (all functions) |
| **Global/Regional** | Regional |
| **Multi-Region** | NO — must deploy separately per region |

#### Function Inventory

| Function | Purpose | Invocations (est.) |
|----------|---------|-------------------|
| endevo-uat-fn-auth | Authentication, login, signup, token refresh | ~200/day |
| endevo-uat-fn-admin | Global admin operations, tenant management | ~50/day |
| endevo-uat-fn-hr | HR admin — employee management, reports | ~100/day |
| endevo-uat-fn-employee | Employee — estate planning, profile | ~150/day |
| endevo-uat-fn-lms | LMS — modules, lessons, progress, video | ~300/day |

| Cost Tier | Estimate |
|-----------|----------|
| Current (82 users) | ~$0.50/mo (well within free tier) |
| 10K users | ~$15/mo |
| 100K users | ~$150/mo (consider provisioned concurrency) |
| **Free Tier** | 1M requests + 400K GB-seconds/month (always free) |

| Scale Threshold | Action Required |
|----------------|-----------------|
| 1K concurrent | Request concurrency limit increase (default: 1,000 per region) |
| 10K users | Enable provisioned concurrency for auth function to eliminate cold starts |
| 100K users | Evaluate container-based deployment (ECS Fargate) for long-running operations |

---

### 4. Amazon API Gateway v2 — HTTP API

| Field | Value |
|-------|-------|
| **Resource** | `4jms6sdzk9` |
| **Name** | endevo-uat-api |
| **Endpoint** | `https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com` |
| **Type** | HTTP API (v2) — lower latency, lower cost than REST API |
| **Purpose** | Route all API requests to Lambda functions |
| **Global/Regional** | Regional |
| **Multi-Region** | NO — deploy per region, use Route 53 latency routing |
| **Min Capacity** | 0 requests |
| **Max Capacity** | 10K requests/second (default, soft limit) |
| **Free Tier** | 1M API calls/month for first 12 months |

| Cost Tier | Estimate |
|-----------|----------|
| Current (82 users) | ~$1/mo |
| 10K users | ~$10/mo |
| 100K users | ~$100/mo |

---

### 5. Amazon S3 — Object Storage

| Field | Value |
|-------|-------|
| **Buckets** | 5 |
| **Global/Regional** | Regional (bucket names are globally unique) |
| **Multi-Region** | YES — via Cross-Region Replication (CRR) or S3 Multi-Region Access Points |

#### Bucket Inventory

| Bucket | Created | Purpose |
|--------|---------|---------|
| endevo-frontend-prod | 2026-03-23 | Production frontend assets (legacy) |
| endevo-frontend-production | 2026-02-22 | Production frontend assets |
| endevo-uat-assets | 2026-03-20 | LMS static assets (images, PDFs) |
| endevo-uat-videos | 2026-03-20 | LMS video content (MP4, HLS) |
| jesse-endevo-knowledge | 2026-03-25 | Knowledge base / reference content |

| Cost Tier | Estimate |
|-----------|----------|
| Current (<1 GB total) | ~$1/mo |
| 10K users (50 GB video) | ~$5/mo |
| 100K users (500 GB video) | ~$15/mo |
| **Free Tier** | 5 GB Standard, 20K GET, 2K PUT (first 12 months) |

**Note:** Two frontend buckets exist (`endevo-frontend-prod` and `endevo-frontend-production`). Recommend consolidating to one.

---

### 6. Amazon CloudFront — Content Delivery Network

| Field | Value |
|-------|-------|
| **Distributions** | 2 |
| **Global/Regional** | GLOBAL (450+ edge locations worldwide) |
| **Multi-Region** | YES — inherently global |

#### Distribution Inventory

| Distribution ID | Domain | Aliases | Purpose |
|----------------|--------|---------|---------|
| E2CH9N3L4W6WV | d1mypniqejg9p0.cloudfront.net | app.endevo.life, endevo.life | Frontend web application |
| E121OSHNXKRE61 | dvbozfce3l21d.cloudfront.net | — | LMS video + asset delivery (signed URLs) |

| Cost Tier | Estimate |
|-----------|----------|
| Current (82 users) | ~$5/mo |
| 10K users | ~$50/mo |
| 100K users | ~$500/mo (video-heavy, evaluate CloudFront pricing classes) |
| **Free Tier** | 1 TB transfer out, 10M requests/month (always free) |

---

### 7. AWS Amplify — CI/CD and Hosting

| Field | Value |
|-------|-------|
| **App** | endevo-uat-lms (`d1vvfv8oltolcf`) |
| **Repo** | https://github.com/endevo-saas/endevo-life |
| **Framework** | Next.js 15 (SSR) |
| **Global/Regional** | Regional (Amplify Hosting) |
| **Multi-Region** | NO — single region deployment. Use CloudFront for global delivery. |
| **Min Capacity** | 0 builds |
| **Max Capacity** | Unlimited (charged per build minute and hosting bandwidth) |

| Cost Tier | Estimate |
|-----------|----------|
| Current | ~$5/mo (build minutes + hosting) |
| 10K users | ~$20/mo |
| 100K users | ~$100/mo (evaluate ECS Fargate or Vercel for better SSR scaling) |
| **Free Tier** | 1,000 build minutes, 15 GB served, 5 GB storage/month |

---

### 8. Amazon SES — Simple Email Service

| Field | Value |
|-------|-------|
| **Status** | Production access ENABLED |
| **Sending Quota** | 50,000 emails/day |
| **Max Send Rate** | 14 emails/second |
| **Sent Last 24h** | 6 emails |
| **Global/Regional** | Regional |
| **Multi-Region** | YES — can configure in multiple regions |

| Cost Tier | Estimate |
|-----------|----------|
| Current | ~$0.10/mo |
| 10K users (50K emails/mo) | ~$5/mo |
| 100K users (500K emails/mo) | ~$50/mo |
| **Pricing** | $0.10 per 1,000 emails |

| Scale Threshold | Action Required |
|----------------|-----------------|
| 50K emails/day | Request sending limit increase |
| Enterprise | Add dedicated IP, DKIM/DMARC/SPF verification for all sending domains |

---

### 9. AWS WAF v2 — Web Application Firewall

| Field | Value |
|-------|-------|
| **Resource** | endevo-uat-waf (`552240d6-9721-4dc0-bf59-e4ecec5830e9`) |
| **Scope** | REGIONAL (attached to API Gateway) |
| **Global/Regional** | Regional (separate WAF for CloudFront uses CLOUDFRONT scope) |
| **Multi-Region** | NO — deploy per region |

#### Active Rules

| Rule | Type | Purpose |
|------|------|---------|
| AWS-AWSManagedRulesCommonRuleSet | AWS Managed | OWASP Top 10 protection |
| AWS-AWSManagedRulesKnownBadInputsRuleSet | AWS Managed | Log4j, path traversal, bad inputs |
| AWS-AWSManagedRulesAmazonIpReputationList | AWS Managed | Block known malicious IPs |
| RateLimit1000PerIP | Custom | Rate limit: 1,000 requests/5min per IP |

| Cost Tier | Estimate |
|-----------|----------|
| Current | ~$11/mo ($5 ACL + $4 rules + ~$2 requests) |
| 10K users | ~$15/mo |
| 100K users | ~$25/mo |

---

### 10. Amazon Route 53 — DNS

| Field | Value |
|-------|-------|
| **Hosted Zone** | endevo.life (`Z00556611RY5GCMKE4K5H`) |
| **Global/Regional** | GLOBAL |
| **Multi-Region** | YES — supports latency-based, geolocation, and failover routing |

| Cost Tier | Estimate |
|-----------|----------|
| Current | ~$0.50/mo ($0.50/hosted zone + query charges) |
| Any scale | ~$0.50–2/mo (DNS queries are cheap) |
| **Multi-region routing** | Add ~$0.75/health check endpoint |

---

### 11. AWS Certificate Manager (ACM)

| Field | Value |
|-------|-------|
| **Certificates** | 2 |
| **Global/Regional** | Regional (must be us-east-1 for CloudFront) |
| **Multi-Region** | YES — request certs in each region |

#### Certificate Inventory

| Domain | Status |
|--------|--------|
| endevo.life (+ *.endevo.life) | ISSUED |
| uat.endevo.life | ISSUED |

| Cost | Free — ACM public certificates are free |
|------|------|

---

### 12. Amazon CloudWatch — Monitoring and Observability

| Field | Value |
|-------|-------|
| **Alarms** | 32 active metric alarms |
| **Purpose** | Lambda errors, API latency, DynamoDB throttles, 4xx/5xx rates |
| **Global/Regional** | Regional |
| **Multi-Region** | NO — deploy alarms per region |

| Cost Tier | Estimate |
|-----------|----------|
| Current (32 alarms) | ~$8/mo ($0.10/alarm + log ingestion) |
| 10K users | ~$15/mo (more log data) |
| 100K users | ~$50/mo (consider log retention policies, sampling) |
| **Free Tier** | 10 alarms, 10 custom metrics, 5 GB log ingestion |

---

### 13. AWS IAM — Identity and Access Management

| Field | Value |
|-------|-------|
| **IAM Users** | 3: `endevo-sh-uat`, `endevo-dev`, `endevo-qa` |
| **IAM Roles** | 4: `endevo-github-actions-deploy`, `endevo-lambda-role`, `endevo-uat-amplify-role`, `endevo-uat-lambda-role` |
| **Global/Regional** | GLOBAL |
| **Multi-Region** | YES — IAM is inherently global |
| **Cost** | Free |

| Security Note | Status |
|---------------|--------|
| MFA on IAM users | VERIFY — ensure MFA is enabled on all human users |
| Access key rotation | VERIFY — rotate keys every 90 days |
| Least privilege | Roles scoped to specific services |

---

## Services NOT YET DEPLOYED — Planned

### Priority: NEED NOW

| # | Service | Purpose | Est. Cost | Action |
|---|---------|---------|-----------|--------|
| 1 | **AWS Secrets Manager** | Store API keys, DB credentials, third-party tokens | ~$2/mo (4 secrets) | Replace .env hardcoding with Secrets Manager |
| 2 | **AWS CloudTrail** | API call audit logging for compliance | ~$2/mo (management events free, S3 storage) | Enable for SOC 2 readiness |
| 3 | **Amazon SNS** | Push notifications, alarm routing to Slack/email | ~$0.50/mo | Connect CloudWatch alarms to SNS topics |
| 4 | **AWS Budgets** | Cost alerting and spend tracking | Free (first 2 budgets) | Set $100/mo alert immediately |

### Priority: NEED BEFORE PRODUCTION

| # | Service | Purpose | Est. Cost | Action |
|---|---------|---------|-----------|--------|
| 5 | **Amazon GuardDuty** | Threat detection, anomaly monitoring | ~$5/mo (30-day free trial) | Enable for all accounts |
| 6 | **AWS KMS** | Encryption key management for DynamoDB, S3, SES | ~$3/mo (1 key + requests) | Encrypt all data at rest with CMK |
| 7 | **AWS X-Ray** | Distributed tracing for Lambda + API Gateway | ~$2/mo (100K traces free) | Enable on all Lambda functions |
| 8 | **AWS Backup** | Automated DynamoDB + S3 backup with retention | ~$3/mo | Daily backups, 30-day retention |
| 9 | **AWS Config** | Resource compliance monitoring | ~$2/mo | Track configuration drift |

### Priority: FUTURE (Phase 4+)

| # | Service | Purpose | Est. Cost | Target Phase |
|---|---------|---------|-----------|-------------|
| 10 | **Amazon Transcribe** | Video subtitle generation for LMS | ~$0.50/hr of video | Phase 4 |
| 11 | **Amazon SQS** | Async job queue (email, PDF generation, video processing) | ~$0.50/mo | Phase 5 |
| 12 | **Amazon EventBridge** | Event-driven architecture, cron jobs | ~$1/mo | Phase 5 |
| 13 | **Amazon ElastiCache (Redis)** | Session cache, hot data cache | ~$15/mo (t4g.micro) | 10K+ users |
| 14 | **Amazon ECS Fargate** | Container workloads for heavy processing | ~$30/mo (per task) | 100K+ users |

---

## Scaling Roadmap

| Users | Monthly Cost | Architecture | Key Changes Required |
|------:|------------:|:-------------|:--------------------|
| **82 (now)** | ~$40–55 | Single region, Cognito auth, on-demand DynamoDB | None — current state |
| **500** | ~$80–120 | Single region, custom JWT auth | Replace Cognito with DynamoDB-backed auth; add Secrets Manager, CloudTrail |
| **2,000** | ~$200–350 | Active-active 2 regions | DynamoDB Global Tables; deploy Lambda/API GW to 2nd region; Route 53 failover routing |
| **10,000** | ~$1,500–2,500 | Active-active + caching + provisioned concurrency | Add ElastiCache Redis; Lambda provisioned concurrency; S3 Cross-Region Replication; WAF in both regions |
| **50,000** | ~$5,000–8,000 | Multi-region + async processing | Add SQS, EventBridge; batch processing via Step Functions; dedicated IPs for SES |
| **100,000** | ~$12,000–18,000 | Multi-region + containers + CDN optimization | Evaluate ECS Fargate for compute; CloudFront pricing class optimization; DynamoDB DAX for hot data |

---

## Multi-Region Readiness Assessment

| Service | Multi-Region Ready? | Effort to Enable | Blocker? |
|---------|:---:|---|:---:|
| DynamoDB | YES (Global Tables) | Low — enable per table | NO |
| Lambda | YES (deploy per region) | Medium — CI/CD pipeline update | NO |
| API Gateway | YES (deploy per region) | Medium — CI/CD pipeline update | NO |
| S3 | YES (CRR) | Low — enable replication | NO |
| CloudFront | ALREADY GLOBAL | None | NO |
| Route 53 | ALREADY GLOBAL | Low — add latency routing | NO |
| IAM | ALREADY GLOBAL | None | NO |
| ACM | YES (request per region) | Low | NO |
| **Cognito** | **NO** | **HIGH — replace entirely** | **YES** |
| WAF | YES (deploy per region) | Medium | NO |
| SES | YES (configure per region) | Low | NO |
| CloudWatch | YES (deploy per region) | Medium | NO |
| Amplify | Partial | Medium — deploy to 2nd region | NO |

**Primary Blocker:** Amazon Cognito does not support cross-region replication. Migration to custom auth is required before multi-region deployment.

---

## Cost Breakdown by Category

| Category | Services | Current Cost | % of Total |
|----------|----------|------------:|:---:|
| **Compute** | Lambda (5 functions) | ~$0.50/mo | 1% |
| **Database** | DynamoDB (13 tables) | ~$2/mo | 5% |
| **Networking** | API Gateway, CloudFront, Route 53 | ~$7/mo | 17% |
| **Security** | WAF, Cognito, ACM, IAM | ~$11/mo | 27% |
| **Hosting** | Amplify, S3 | ~$6/mo | 15% |
| **Monitoring** | CloudWatch (32 alarms) | ~$8/mo | 20% |
| **Email** | SES | ~$0.10/mo | <1% |
| **Total** | | **~$35–55/mo** | 100% |

---

## Security Posture Summary

| Control | Status | Notes |
|---------|--------|-------|
| WAF with OWASP rules | ACTIVE | 4 rules including rate limiting |
| TLS everywhere | ACTIVE | ACM certs on all endpoints |
| MFA on user pool | OPTIONAL | Consider enforcing for GLOBAL_ADMIN |
| JWT token auth | ACTIVE | Cognito-issued, verified on API Gateway |
| DynamoDB encryption | DEFAULT | AWS-managed keys (upgrade to CMK with KMS) |
| S3 encryption | DEFAULT | AWS-managed keys (upgrade to CMK with KMS) |
| CloudTrail | NOT ENABLED | CRITICAL — enable immediately |
| GuardDuty | NOT ENABLED | Enable before production |
| Secrets Manager | NOT USED | Secrets in environment variables — migrate |
| IAM MFA | UNVERIFIED | Audit all human IAM users |

---

## Compliance Readiness

| Requirement | Status | Gap |
|-------------|--------|-----|
| SOC 2 Type II | NOT READY | Need CloudTrail, Config, GuardDuty |
| HIPAA | NOT READY | Need KMS CMK, audit logging, BAA |
| GDPR | PARTIAL | Data in single region (US), need data processing agreement |
| PCI DSS | NOT APPLICABLE | No payment processing (yet) |

---

## Action Items — Immediate

| Priority | Action | Service | Est. Time | Est. Cost |
|----------|--------|---------|-----------|-----------|
| P0 | Enable CloudTrail | CloudTrail | 30 min | ~$2/mo |
| P0 | Create AWS Budget alert ($100/mo) | Budgets | 15 min | Free |
| P0 | Migrate secrets to Secrets Manager | Secrets Manager | 2 hours | ~$2/mo |
| P1 | Enable GuardDuty | GuardDuty | 15 min | ~$5/mo |
| P1 | Enable KMS CMK for DynamoDB + S3 | KMS | 1 hour | ~$3/mo |
| P1 | Set up SNS for alarm notifications | SNS | 30 min | ~$0.50/mo |
| P1 | Enable X-Ray on all Lambda functions | X-Ray | 30 min | ~$2/mo |
| P2 | Configure AWS Backup for DynamoDB | Backup | 1 hour | ~$3/mo |
| P2 | Enable AWS Config rules | Config | 1 hour | ~$2/mo |
| P2 | Consolidate duplicate S3 frontend buckets | S3 | 30 min | Saves ~$0.50/mo |

---

*Document generated from live AWS CLI queries on 2026-04-05. All resource IDs, item counts, and configurations reflect the actual state of AWS account 383423735462.*
