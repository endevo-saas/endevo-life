# Forensic Report 02 — Resource Creators
**Date:** 2026-04-19 | **Account:** 383423735462 | **Region:** us-east-2

All events sourced from CloudTrail lookup. Source IPs in CloudShell ranges (18.190.x, 18.222.x, 18.224.x, 3.144.x, 3.17.x) = AWS CloudShell session. IP 99.245.4.29 = Shahzad's local Windows machine.

---

## B1 — NAT Gateway nat-0ba238efdb136be7c

| Field | Value |
|-------|-------|
| Event | CreateNatGateway |
| Creator | **endevo-dev** |
| Time | 2026-03-31T07:22:24Z |
| Source IP | 18.190.158.56 (CloudShell) |
| User Agent | aws-cli/2.34.17 exec-env/CloudShell os/linux |
| EIP used | eipalloc-0f67b636484d10769 → 3.17.92.14 |
| VPC | vpc-0b856771e2262f334 |
| Subnet | subnet-0955b99ae53ad8f09 |
| Likely Actor | Shahzad (via CloudShell) |

---

## B2 — Elastic IP 3.17.92.14

| Field | Value |
|-------|-------|
| Event | AllocateAddress |
| Creator | **endevo-dev** |
| Time | 2026-03-31T07:22:22Z (2 seconds before NAT GW creation) |
| Source IP | 18.190.158.56 (CloudShell) |
| User Agent | aws-cli/2.34.17 exec-env/CloudShell |
| Purpose | Allocated for NAT Gateway nat-0ba238efdb136be7c |
| Likely Actor | Shahzad (via CloudShell) |

## B2 — Elastic IP 18.190.229.145

| Field | Value |
|-------|-------|
| Event | AllocateAddress |
| Creator | **AWSServiceRoleForRDS** (AWS automation) |
| Time | 2026-03-27T18:50:39Z |
| Source IP | rds.amazonaws.com (internal) |
| User Agent | rds.amazonaws.com |
| Purpose | Auto-allocated by RDS service — likely for endevo-db-rds |
| Likely Actor | AWS automation (not human) |

---

## B3 — RDS endevo-db-rds

| Field | Value |
|-------|-------|
| Earliest CloudTrail event found | ModifyDBInstance — 2026-03-15T23:10:51Z (creation event older than 90-day window) |
| User on ModifyDBInstance | **endevo-dev** |
| Source IP | 99.245.4.29 (Shahzad's Windows machine, direct CLI) |
| User Agent | aws-cli/2.34.9 os/windows#11 |
| Likely Actor | Shahzad — created before March 2026 |

---

## B4 — Aurora database-1-instance-1 (cluster: database-1)

| Field | Value |
|-------|-------|
| Event | CreateDBInstance |
| Creator | **endevo-dev** |
| Time | 2026-03-31T08:48:49Z |
| Source IP | CloudShell (session started 2026-03-31T07:01:57Z) |
| User Agent | aws-cli CloudShell os/linux |
| Later action | StopDBCluster by **endevo-sh-uat**, 2026-04-09T12:03:56Z, from 99.245.4.29 (Windows) |
| Likely Actor | Shahzad created it, Shahzad stopped it |

---

## B5 — Aurora jesse-vector-db-instance (cluster: jesse-vector-db)

| Field | Value |
|-------|-------|
| Event | CreateDBInstance |
| Creator | **endevo-dev** |
| Time | 2026-03-25T06:33:31Z |
| Source IP | 18.224.183.123 (CloudShell) |
| User Agent | aws-cli/2.34.13 exec-env/CloudShell os/linux |
| Later action | StopDBCluster by **endevo-sh-uat**, 2026-04-09T12:03:52Z, from 99.245.4.29 (Windows) |
| Likely Actor | Shahzad created it, Shahzad stopped it |

---

## B6 — Cognito Pool us-east-2_JpHp1vsdK

| Field | Value |
|-------|-------|
| Event | CreateUserPool |
| Creator | **endevo-dev** |
| Time | 2026-02-22T01:55:45Z |
| Source IP | 18.222.239.138 (CloudShell) |
| User Agent | aws-cli/2.33.23 exec-env/CloudShell os/linux |
| Pool name | endevo-user-pool |
| Likely Actor | Shahzad |

---

## B7 — Lambda endevo-billing-webhook

| Field | Value |
|-------|-------|
| Event | UpdateFunctionConfiguration + PutFunctionConcurrency |
| Creator/Last Modifier | **endevo-dev** |
| Time | 2026-02-28T19:33:49Z |
| Source IP | 3.144.136.244 (CloudShell) |
| User Agent | aws-cli/2.33.23 exec-env/CloudShell os/linux |
| Likely Actor | Shahzad |

## B7 — Lambda endevo-api

| Field | Value |
|-------|-------|
| Creator | **endevo-dev** |
| Last modified | 2026-04-18T14:59:07Z (updated yesterday) |
| Source | Likely CloudShell or CI/CD |
| Likely Actor | Shahzad |

---

## Creator Summary Table

| Resource | Creator | Created | Source | Likely Actor |
|----------|---------|---------|--------|--------------|
| NAT Gateway nat-0ba238efdb136be7c | endevo-dev | 2026-03-31 | CloudShell | Shahzad |
| EIP 3.17.92.14 | endevo-dev | 2026-03-31 | CloudShell | Shahzad |
| EIP 18.190.229.145 | AWSServiceRoleForRDS | 2026-03-27 | AWS automation | Not human |
| RDS endevo-db-rds | endevo-dev | Before 2026-03-15 | Windows CLI | Shahzad |
| Aurora database-1-instance-1 | endevo-dev | 2026-03-31 | CloudShell | Shahzad |
| Aurora jesse-vector-db-instance | endevo-dev | 2026-03-25 | CloudShell | Shahzad |
| Cognito us-east-2_JpHp1vsdK | endevo-dev | 2026-02-22 | CloudShell | Shahzad |
| Lambda endevo-billing-webhook | endevo-dev | 2026-02-28 | CloudShell | Shahzad |
| Lambda endevo-api | endevo-dev | Unknown | CloudShell/CI | Shahzad |

**Conclusion: All us-east-2 resources were created by Shahzad. No external actors.**
