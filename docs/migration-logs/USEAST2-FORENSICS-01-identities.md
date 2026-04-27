# Forensic Report 01 — IAM Identities
**Date:** 2026-04-19 | **Account:** 383423735462 | **Scope:** All IAM users + roles

---

## All IAM Users

| Username | Created | Last Console Login | Likely Actor |
|----------|---------|-------------------|--------------|
| endevo-dev | 2026-02-19 | 2026-04-17 | Shahzad — original dev user |
| endevo-qa | 2026-02-19 | 2026-02-20 | Shahzad — QA testing, inactive since Feb |
| endevo-sh-uat | 2026-03-17 | 2026-04-19 (today) | Shahzad — active UAT work user |
| aryan-ai-dev | 2026-03-12 | 2026-03-27 | Aryan — team member, inactive |
| BedrockAPIKey-9qwx | 2026-03-27 | Never | Service account — Bedrock API access |

---

## Policies on endevo-sh-uat

| Policy | ARN | Risk |
|--------|-----|------|
| AdministratorAccess | arn:aws:iam::aws:policy/AdministratorAccess | **P1 — full account on key leak** |
| endevo-sh-uat-isolation | arn:aws:iam::383423735462:policy/endevo-sh-uat-isolation | Custom scoping |
| IAMUserChangePassword | arn:aws:iam::aws:policy/IAMUserChangePassword | Low |

endevo-sh-uat is in no IAM groups.

---

## Access Keys

| User | Key ID | Created | Status | Notes |
|------|--------|---------|--------|-------|
| endevo-qa | AKIAVSROV42TNWFTVQG5 | 2026-03-19 | Active | Last console login 2026-02-20 — possibly stale |
| endevo-sh-uat | AKIAVSROV42TKT3WULU5 | (from CloudTrail) | Active | Used 2026-04-09 to stop Aurora clusters |
| endevo-dev | ASIA* session keys | Per CloudShell session | Rotated | No long-lived key visible |

> `list-access-keys --user-name endevo-sh-uat` returned a validation error. Key confirmed via CloudTrail events.

---

## IAM Roles (us-east-2 relevant)

| Role | Trust | Purpose |
|------|-------|---------|
| endevo-lambda-role | lambda.amazonaws.com | Shared execution role for endevo-billing-webhook + endevo-api |
| AWSServiceRoleForRDS | rds.amazonaws.com | AWS-managed; auto-allocated EIP 18.190.229.145 for RDS |

---

## Root Account

CloudTrail lookup for `Root` username in us-east-1 returned zero events in last 90 days. Root not actively used. ✓

---

## Identity Summary

Both `endevo-dev` and `endevo-sh-uat` resolve to the same physical actor (Shahzad):
- Shared Windows source IP **99.245.4.29** appears in both users' CloudTrail events
- All CloudShell operations (endevo-dev) originate from AWS IPs: 18.190.x.x, 18.222.x.x, 18.224.x.x, 3.144.x.x, 3.17.x.x
- No evidence of Aryan or any other actor touching us-east-2 resources
