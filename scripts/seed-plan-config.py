#!/usr/bin/env python3
"""Seed plan configuration into endevo-uat-config table."""
import boto3
from datetime import datetime, timezone

dynamo = boto3.resource("dynamodb", region_name="us-east-1")
CONFIG_T = dynamo.Table("endevo-uat-config")

PLAN_CONFIG = {
    "configKey": "PLAN_CONFIG",
    "sk": "v1",
    "updatedAt": datetime.now(timezone.utc).isoformat(),
    "basic": {
        "planLabel": "Endevo Basic",
        "priceYearly": 299,
        "priceMonthly": "24.92",
        "sessionsTotal": 2,
        "features": [
            "Readiness Assessment",
            "6 Learning Modules",
            "2x 30-min 1:1 Sessions per year",
        ],
    },
    "premium": {
        "planLabel": "Endevo Premium",
        "priceYearly": 499,
        "priceMonthly": "41.58",
        "sessionsTotal": 6,
        "features": [
            "Readiness Assessment",
            "6 Learning Modules",
            "6x 30-min 1:1 Sessions per year",
            "AI Guide (Jesse)",
            "Priority scheduling",
            "Extended session recordings",
        ],
    },
    "premiumFeatures": [
        "Everything in Basic",
        "6x 30-min 1:1 Sessions per year",
        "AI Guide (Jesse)",
        "Priority scheduling",
        "Extended session recordings",
    ],
}


def main():
    print("Seeding plan config...")
    CONFIG_T.put_item(Item=PLAN_CONFIG)
    print("Done! Plan config seeded to endevo-uat-config")

    # Verify
    result = CONFIG_T.get_item(Key={"configKey": "PLAN_CONFIG"})
    item = result.get("Item", {})
    print(f"Verified: basic features = {len(item.get('basic', {}).get('features', []))}")
    print(f"Verified: premium features = {len(item.get('premium', {}).get('features', []))}")


if __name__ == "__main__":
    main()
