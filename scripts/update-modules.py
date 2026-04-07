"""Update LMS module configs — run once to update Module 3 (AI) and Module 4 (Stripe)."""
import boto3
import os
from datetime import datetime, timezone

# NEVER hardcode credentials — use AWS CLI profile or environment variables
# Run: aws configure --profile endevo-uat
# Then: AWS_PROFILE=endevo-uat python scripts/update-modules.py
os.environ.setdefault('AWS_DEFAULT_REGION', 'us-east-1')

dynamo = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamo.Table('endevo-uat-lms-modules')
now = datetime.now(timezone.utc).isoformat()

modules = [
    {
        "moduleNum": "3",
        "title": "AI-Powered Legacy Planning",
        "description": (
            "Discover how AI transforms estate planning. Get personalised recommendations, "
            "smart document review, and AI-guided action plans tailored to your unique legacy situation."
        ),
        "domain": "AI",
        "builtBy": "Aryan",
        "moduleType": "ai",
        "objectives": [
            "Understand how AI enhances estate planning accuracy",
            "Use AI tools to identify gaps in your legacy plan",
            "Generate your personalised AI action plan",
        ],
        "pdfKey": "modules/module3/module3-draft.pdf",
        "isActive": True,
        "status": "active",
    },
    {
        "moduleNum": "4",
        "title": "Financial Accounts & Payment Planning",
        "description": (
            "Organise your financial accounts, beneficiary designations, and payment methods "
            "for a seamless and stress-free legacy transfer to the people you love."
        ),
        "domain": "Financial Readiness",
        "moduleType": "stripe_financial",
        "objectives": [
            "Audit all financial accounts and payment methods",
            "Set up TOD/POD designations on key accounts",
            "Document your subscription and recurring payment inventory",
        ],
        "pdfKey": "modules/module4/module4-draft.pdf",
        "isActive": True,
        "status": "active",
    },
]

for tenant in ["SYSTEM", "tenant-ind"]:
    for mod in modules:
        item = {"tenantId": tenant, "updatedAt": now, **mod}
        table.put_item(Item=item)
        print(f"OK: {tenant} - Module {mod['moduleNum']}: {mod['title']}")

print("\nAll modules updated.")
