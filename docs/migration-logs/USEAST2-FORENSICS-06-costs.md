# Forensic Report 06 — Cost Breakdown (us-east-2)
**Date:** 2026-04-19 | **Account:** 383423735462 | **Region:** us-east-2
**Period:** 2026-03-20 to 2026-04-19 (30 days)

---

## F1 — Cost by Service

Cost Explorer grouped by SERVICE, filtered to us-east-2. Output was truncated after the first several entries — full service list not retrieved.

| Service | Mar 20–Apr 1 | Apr 1–Apr 19 | Notes |
|---------|-------------|-------------|-------|
| AWS CloudShell | ~$0.000 | ~$0.000 | Negligible |
| AWS CloudTrail | $0 | $0 | Free tier |
| AWS Data Transfer | ~-$0.000004 | ~$0 | Rounding artifact |
| EC2 / VPC (NAT Gateway) | **Not captured — output truncated** | **Not captured** | See estimate below |
| RDS / Aurora | ~$0.000 | ~$0.000 | See F2 |
| Lambda | Not surfaced | Not surfaced | Free tier / minimal |

> **Retrieval note:** The Cost Explorer JSON was truncated at ~80 lines. EC2/VPC NAT Gateway costs — normally ~$0.045/hr + data — were not captured in the visible portion. Based on the NAT Gateway running since 2026-03-31 (~19 days), estimated gateway-hour cost alone is ~$20.

---

## F2 — RDS / Aurora Detail

Cost Explorer grouped by USAGE_TYPE, filtered to us-east-2 + RDS.

| Usage Type | Mar 20–Apr 1 | Apr 1–Apr 19 | Notes |
|-----------|-------------|-------------|-------|
| USE2-Aurora:ServerlessV2Usage | ~$0.000 | ~$0.000 | Both clusters stopped 2026-04-09 |
| USE2-Aurora:StorageIOUsage | $0 | $0 | |
| USE2-Aurora:StorageUsage | ~$0.000 | ~-$0.0000001 | 1 GB × 2 clusters ≈ $0.20/month |
| USE2-RDS:GP2-Storage | $0 | ~$0.000 | endevo-db-rds storage |
| USE2-RDS:Data-API-Usage | $0 | $0 | |

Aurora costs near-zero because both clusters were stopped on 2026-04-09 (only storage at ~$0.10/GB-month accrues when stopped). endevo-db-rds instance cost (running) would appear under `USE2-InstanceUsage:db.*` — not visible in truncated output.

---

## Cost Estimates (where CE output was truncated)

| Resource | Basis | Estimated Monthly Cost |
|----------|-------|----------------------|
| NAT Gateway (19 days running) | $0.045/hr × 24 × 30 | **~$32/month** |
| EIP 3.17.92.14 (attached to NAT) | Free while attached | $0 |
| EIP 18.190.229.145 (RDS-managed) | Free while attached | $0 |
| endevo-db-rds (running, class unknown) | Typical db.t3.micro | ~$15–25/month |
| Aurora database-1 (stopped, 1 GB) | $0.10/GB-month | ~$0.10/month |
| Aurora jesse-vector-db (stopped, 1 GB) | $0.10/GB-month | ~$0.10/month |
| endevo-api Lambda | Minimal invocations | ~$0 |
| endevo-billing-webhook Lambda | Zero invocations | $0 |
| Cognito (12 users) | Free tier (50k MAU free) | $0 |

**Estimated total us-east-2 monthly spend: ~$48–60/month**, dominated by the NAT Gateway and RDS instance.

---

## Savings Opportunities

| Action | Est. Monthly Savings | Risk |
|--------|---------------------|------|
| Delete Aurora database-1 (zero usage ever) | ~$0.10/month | Low — verify no app references endpoint |
| Delete Aurora jesse-vector-db (after Jesse V2 check) | ~$0.10/month | Low — verify Vercel backend first |
| Delete NAT Gateway (if endevo-api is not VPC-bound) | ~$32/month | **HIGH — would break endevo-api if Lambda is in VPC** |

> Verify whether endevo-api Lambda VPC configuration is set before touching the NAT Gateway. If the Lambda runs outside a VPC (common for simple Node APIs), the NAT Gateway is unused infrastructure.
