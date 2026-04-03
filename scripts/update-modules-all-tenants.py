"""Update Module 3 (AI/Aryan) and Module 4 (Stripe) for ALL active tenants."""
import boto3
import os
from datetime import datetime, timezone

dynamo = boto3.resource('dynamodb', region_name=os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'))
tenants_table = dynamo.Table('endevo-uat-tenants')
modules_table = dynamo.Table('endevo-uat-lms-modules')
now = datetime.now(timezone.utc).isoformat()

# Get all tenants
resp = tenants_table.scan(ProjectionExpression='tenantId')
tenants = [i['tenantId'] for i in resp.get('Items', [])]
print(f"Found {len(tenants)} tenants")

modules = [
    {
        "moduleNum": "3",
        "title": "AI-Powered Legacy Planning",
        "description": "Discover how AI transforms estate planning. Get personalised recommendations, smart document review, and AI-guided action plans tailored to your unique legacy situation.",
        "domain": "AI",
        "builtBy": "Aryan",
        "moduleType": "ai",
        "objectives": ["Understand how AI enhances estate planning accuracy", "Use AI tools to identify gaps in your legacy plan", "Generate your personalised AI action plan"],
        "pdfKey": "modules/module3/module3-draft.pdf",
        "isActive": True,
        "status": "active",
    },
    {
        "moduleNum": "4",
        "title": "Financial Accounts & Payment Planning",
        "description": "Organise your financial accounts, beneficiary designations, and payment methods for a seamless legacy transfer to the people you love.",
        "domain": "Financial Readiness",
        "moduleType": "stripe_financial",
        "objectives": ["Audit all financial accounts and payment methods", "Set up TOD/POD designations on key accounts", "Document your subscription and recurring payment inventory"],
        "pdfKey": "modules/module4/module4-draft.pdf",
        "isActive": True,
        "status": "active",
    },
]

for tenant in tenants:
    for mod in modules:
        modules_table.put_item(Item={"tenantId": tenant, "updatedAt": now, **mod})
    print(f"Updated M3+M4 for {tenant}")

print(f"\nDone. Updated {len(tenants)} tenants.")
