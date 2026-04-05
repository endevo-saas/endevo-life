# Enterprise Resilience Playbook — 99.99% Availability

> **Date:** 2026-04-05
> **Target:** Four-nine availability (52 min downtime/year max)
> **Architecture:** Active-Active us-east-1 + us-west-2

---

## Current State: 95% Enterprise Ready

| Layer | us-east-1 | us-west-2 | Status |
|-------|:-:|:-:|---|
| Lambda (5 functions) | ACTIVE | ACTIVE | Deployed |
| DynamoDB (13 Global Tables) | ACTIVE | ACTIVE | Real-time sync |
| S3 (videos + assets) | ACTIVE | ACTIVE | CRR enabled |
| API Gateway | ACTIVE | ACTIVE | Same routes |
| KMS (4 CMKs) | ACTIVE | ACTIVE | Per-region keys |
| CloudFront | GLOBAL | GLOBAL | No change needed |
| Route 53 Failover | ACTIVE | ACTIVE | Health checks + auto-switch |
| CloudTrail | MULTI-REGION | MULTI-REGION | Immutable WORM |
| GuardDuty | ACTIVE | — | Enable in us-west-2 |
| WAF | ACTIVE | — | Create in us-west-2 |
| Auth (Cognito) | ACTIVE | BLOCKED | WorkOS migration in progress |

---

## 5 Enterprise Blindspots to Fix

### 1. Route 53 ARC (Application Recovery Controller)

**Problem:** Standard health checks verify "is the endpoint alive?" but NOT "can the secondary region handle full production load?"

**Readiness Drift Example:** us-west-2 Lambda concurrency limit is still at default 1000, but primary handles 5000 concurrent. Failover succeeds but immediately throttles.

**Fix:** Deploy Route 53 ARC with:
- Readiness Checks: continuously audit us-west-2 capacity vs us-east-1
- Routing Controls: prevent "split brain" or accidental all-region shutdown
- Safety Rules: block engineers from disabling both regions simultaneously

**Effort:** 4-6 hours CDK. **Priority:** P1 (before production).

---

### 2. Cellular Architecture (Read-Local/Write-Partitioned)

**Problem:** DynamoDB Global Tables use "Last Writer Wins" conflict resolution. If two regions write the same record simultaneously, one write is silently lost.

**Enterprise Standard:**
- Assign a "Home Region" per tenant
- Tenant's writes go to their home region ONLY
- Cross-region replication is read-only for DR
- Eliminates write conflicts entirely

**Implementation:**
```python
# In Lambda handler:
tenant_home_region = get_tenant_home_region(tenant_id)  # from config table
if current_region != tenant_home_region:
    # Read allowed (from local replica)
    # Write → proxy to home region API
    return proxy_write_to_home_region(event, tenant_home_region)
```

**Effort:** 2 weeks. **Priority:** P2 (before first enterprise client with >1000 users).

---

### 3. AWS Global Accelerator (Network-Layer Failover)

**Problem:** DNS failover depends on TTL propagation (60-300 seconds). Some ISPs cache longer. During that window, users hit a dead endpoint.

**Enterprise Fix:** Global Accelerator provides:
- 2 static Anycast IP addresses (never change)
- Traffic enters AWS private fiber at nearest edge
- Failover at NETWORK layer in <30 seconds (not DNS layer)
- Works even if user's DNS is stale

**Cost:** ~$18/month + $0.015/GB data processed

**Implementation:**
```bash
aws globalaccelerator create-accelerator --name endevo-uat \
  --ip-address-type IPV4 --enabled
# Add listener (port 443) → endpoint groups (east + west API GWs)
```

**Effort:** 4-6 hours. **Priority:** P1 (replaces current Route 53 failover for API traffic).

---

### 4. IAM Policy Parity (Atomic Deployments)

**Problem:** Manually tweaking a policy in us-west-2 to fix a bug → policy drift → failover fails because IAM is different.

**Enterprise Fix:**
- CloudFormation StackSets: deploy same IAM to both regions atomically
- CI/CD rule: deployment is "DONE" only when same Git hash is active in ALL regions
- CDK pipeline: `cdk deploy --all` targets both regions sequentially
- Weekly drift detection: `aws cloudformation detect-stack-drift`

**Effort:** 1 week (CDK pipeline redesign). **Priority:** P2.

---

### 5. Cross-Region Observability

**Problem:** CloudWatch dashboards show aggregate metrics. A regional brownout in us-west-2 is invisible until users complain.

**Enterprise Fix:**
- CloudWatch Cross-Region Dashboard: single pane showing both regions
- CloudWatch RUM (Real User Monitoring): track actual user experience by geography
- Regional error rate alarms: separate alarms per region, not aggregate
- X-Ray Service Map: visualize cross-region latency

**Effort:** 4-6 hours. **Priority:** P1.

---

## Pre-Production Checklist

| Area | Question | Status |
|------|----------|--------|
| Service Quotas | Lambda concurrency limit in us-west-2? | CHECK (may be default 1000) |
| Secrets | WorkOS API keys in Secrets Manager BOTH regions? | PENDING |
| Dependencies | Cognito is us-east-1 only — WorkOS migration in progress | IN PROGRESS |
| State | Any sessions in memory/disk? | NO (stateless Lambda) |
| Testing | Game Day — kill us-east-1 intentionally? | NOT YET |
| WAF | WAF deployed in us-west-2? | PENDING |
| GuardDuty | Enabled in us-west-2? | PENDING |
| Budget | Budget covers both regions? | YES (account-wide) |

---

## 2026 Target Architecture

```
                    Global Users
                         |
                AWS Global Accelerator
                (2 static Anycast IPs)
                (network-layer failover <30s)
                    |            |
             US-EAST-1      US-WEST-2
             =========      =========
             API Gateway     API Gateway
             5 Lambdas       5 Lambdas
             (WorkOS JWT)    (WorkOS JWT)
                |               |
             DynamoDB  <==>  DynamoDB
             Global Tables (cellular writes)
                |               |
             S3        <==>  S3
             (CRR bidirectional)
                |               |
             KMS (CMK)       KMS (CMK)

             Route 53 ARC: readiness checks + safety rules
             CloudWatch RUM: per-region user monitoring
             CloudTrail: immutable cross-region audit
             WAF: per-region rate limiting + OWASP rules
             GuardDuty: per-region threat detection
```

---

## Cost of Full Enterprise Resilience

| Component | Current (single) | Enterprise (2 regions) |
|-----------|:-:|:-:|
| Lambda | $5/mo | $10/mo |
| DynamoDB Global Tables | $10/mo | $25/mo |
| S3 + CRR | $20/mo | $40/mo |
| API Gateway | $3/mo | $6/mo |
| Global Accelerator | $0 | $18/mo |
| KMS (4 keys) | $4/mo | $4/mo |
| CloudTrail | $0 | $0 |
| GuardDuty | $4/mo | $8/mo |
| WAF (2 regions) | $6/mo | $12/mo |
| Route 53 ARC | $0 | $2.50/mo |
| CloudWatch RUM | $0 | $1/mo |
| **Total** | **~$52/mo** | **~$127/mo** |

Enterprise-grade active-active with 99.99% target: **~$127/month.**

---

## Game Day Protocol (Quarterly)

1. Schedule maintenance window (communicate to users)
2. Disable us-east-1 API Gateway health check endpoint
3. Verify Route 53/Global Accelerator routes to us-west-2
4. Run full test suite against us-west-2
5. Re-enable us-east-1
6. Document findings in RAID log
7. Fix any issues found

---

*Review quarterly. Update before each enterprise client onboarding.*
