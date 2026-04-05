# Resilience Debt Tracker

> Track hidden risks that kill 99.99% during real outages.
> Review quarterly. Update after each Game Day.

---

## Critical: Regional Autonomy (Zero Cross-Region Runtime Dependencies)

| Resource | us-east-1 | us-west-2 | Autonomous? |
|----------|:-:|:-:|:-:|
| Lambda code | Deployed | Deployed | YES |
| DynamoDB data | Global Table | Global Table | YES |
| S3 content | Source | CRR Replica | YES |
| KMS keys | CMK created | CMK created | YES |
| API Gateway | Active | Active | YES |
| Secrets Manager | NOT YET | NOT YET | NO — fix before production |
| IAM role | Global | Global | YES (global service) |
| CloudTrail | Multi-region | Multi-region | YES |
| GuardDuty | Active | Active | YES |
| WorkOS auth | SaaS (global) | SaaS (global) | YES (when migrated) |
| Cognito | us-east-1 ONLY | NONE | NO — the blocker |

## Hidden Risks

| Risk | Level | Description | Fix |
|------|-------|-------------|-----|
| Control Plane vs Data Plane | CRITICAL | During outage, AWS APIs fail first. If failover needs CLI commands, it fails too. | Static stability — failover must work without AWS API calls. Route 53 data plane is resilient. |
| Circular Dependencies | CRITICAL | Oregon Lambda can't pull code if Virginia is down (if ECR is in east). | Regional autonomy — each region has own code, keys, secrets. |
| Thundering Herd | MEDIUM | Failover dumps 100% traffic on cold region. | Circuit breakers + provisioned concurrency. |
| Poison Pill | MEDIUM | One malformed request crashes Lambda across all regions. | Shuffle sharding — tenant mapped to specific shards. |
| Deployment Skew | CRITICAL | Fix in one region forgotten in other. | Atomic IaC — single deploy updates all regions. |
| Human Factor | MEDIUM | 3 AM failover requires human = 20 min lost. | Fully automated Route 53/Global Accelerator failover. |
| DNS Cache Ghost | HIGH | ISPs cache DNS 30+ min during outage. | Global Accelerator (network-layer, not DNS-layer). |
| Lambda Concurrency | CRITICAL | Both regions at 10 (default). Requested 1000. | PENDING AWS approval. |

## Game Day Schedule

| Quarter | Date | Scenario | Status |
|---------|------|----------|--------|
| Q2 2026 | TBD | Kill us-east-1 API Gateway, verify auto-failover | NOT DONE |
| Q3 2026 | TBD | Simulate DynamoDB throttling, verify DAX cache | NOT DONE |
| Q4 2026 | TBD | Full region failure + WorkOS failover test | NOT DONE |

## References

- [AWS re:Invent: Multi-Region Fundamentals](https://www.youtube.com/watch?v=JpnzVNk3iHM)
- AWS Well-Architected Reliability Pillar
- Route 53 ARC documentation
- AWS Fault Injection Simulator guide
