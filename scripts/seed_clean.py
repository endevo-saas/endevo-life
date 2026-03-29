"""
Endevo Life — Clean Seed Script
Deletes all old seed data, creates 10 real tenants with consistent
tenant-00001 format + HR admins + 3 employees each.
Run: C:/Python314/python.exe seed_clean.py
"""
import boto3
import uuid
from datetime import datetime, timezone

REGION = "us-east-1"
dynamo = boto3.resource("dynamodb", region_name=REGION)

TENANTS_T = dynamo.Table("endevo-uat-tenants")
USERS_T   = dynamo.Table("endevo-uat-users")

NOW = datetime.now(timezone.utc).isoformat()

# ── Protect these — never delete ──────────────────────────────────────────────
PROTECTED_TENANTS = {"SYSTEM", "tenant-ind"}
PROTECTED_USERS   = {"shahzad-global-admin-001"}  # khak.pa@gmail.com

# ── Step 1: Delete old seed tenants ───────────────────────────────────────────
def delete_old_tenants():
    print("\n── Deleting old seed tenants...")
    result = TENANTS_T.scan()
    deleted = 0
    for item in result.get("Items", []):
        tid = item["tenantId"]
        if tid in PROTECTED_TENANTS:
            print(f"  SKIP (protected): {tid}")
            continue
        TENANTS_T.delete_item(Key={"tenantId": tid})
        print(f"  DELETED tenant: {tid} — {item.get('name','?')}")
        deleted += 1
    print(f"  Total deleted: {deleted}")

# ── Step 2: Delete old seed users ─────────────────────────────────────────────
def delete_old_users():
    print("\n── Deleting old seed users...")
    result = USERS_T.scan()
    deleted = 0
    for item in result.get("Items", []):
        uid = item["userId"]
        if uid in PROTECTED_USERS:
            print(f"  SKIP (protected): {uid} — {item.get('email','?')}")
            continue
        USERS_T.delete_item(Key={"userId": uid})
        print(f"  DELETED user: {item.get('email','?')} ({item.get('role','?')})")
        deleted += 1
    print(f"  Total deleted: {deleted}")

# ── Step 3: Create 10 real tenants ────────────────────────────────────────────
TENANTS = [
    # (seq, name, plan, seats, website, industry, hr_first, hr_last, hr_email, status)
    ( 1, "Maple Financial Group",    "enterprise-plus", 500, "https://maplefinancial.ca",  "Finance",     "Jennifer", "Clarke",  "hr@maplefinancial.ca",   "active"),
    ( 2, "TechNova Solutions",       "enterprise",      200, "https://technovasolutions.io","Technology",  "Rajan",    "Mehta",   "hr@technovasolutions.io",  "active"),
    ( 3, "Apex Healthcare",          "professional",    80,  "https://apexhealthcare.com", "Healthcare",  "Sarah",    "Mitchell","hr@apexhealthcare.com",   "active"),
    ( 4, "Horizon Logistics",        "professional",    60,  "https://horizonlogistics.co","Logistics",   "David",    "Park",    "hr@horizonlogistics.co",  "active"),
    ( 5, "GreenLeaf Energy",         "starter",         20,  "https://greenleafenergy.com","Energy",      "Natalie",  "Wong",    "hr@greenleafenergy.com",  "active"),
    ( 6, "Atlas Construction",       "starter",         18,  "https://atlasconstruction.ca","Construction","Marcus",  "Rivera",  "hr@atlasconstruction.ca", "active"),
    ( 7, "Pinnacle Law Partners",    "professional",    45,  "https://pinnaclelaw.com",    "Legal",       "Priya",    "Sharma",  "hr@pinnaclelaw.com",      "active"),
    ( 8, "BlueSky Retail Corp",      "enterprise",      150, "https://blueskyretail.com",  "Retail",      "Thomas",   "Bennett", "hr@blueskyretail.com",    "active"),
    ( 9, "Quantum AI Labs",          "trial",           8,   "https://quantumailabs.io",   "AI Research", "Zara",     "Hassan",  "hr@quantumailabs.io",    "trial"),
    (10, "Meridian Education Group", "enterprise-plus", 400, "https://meridianedu.ca",     "Education",   "Lisa",     "Nakamura","hr@meridianedu.ca",       "active"),
]

# 3 employees per tenant
EMPLOYEES = {
    1:  [("Liam","Foster","liam.foster@maplefinancial.ca","Senior Analyst","Finance"),
         ("Olivia","Chen","olivia.chen@maplefinancial.ca","Risk Manager","Finance"),
         ("Noah","Patel","noah.patel@maplefinancial.ca","Compliance Officer","Legal")],

    2:  [("Ethan","Brooks","ethan.brooks@technovasolutions.io","Software Engineer","Engineering"),
         ("Ava","Singh","ava.singh@technovasolutions.io","Product Manager","Engineering"),
         ("Mason","Kim","mason.kim@technovasolutions.io","DevOps Engineer","Engineering")],

    3:  [("Isabella","Murphy","isabella.murphy@apexhealthcare.com","Nurse Coordinator","Operations"),
         ("James","O'Brien","james.obrien@apexhealthcare.com","HR Specialist","HR"),
         ("Sophia","Liu","sophia.liu@apexhealthcare.com","Clinical Analyst","Operations")],

    4:  [("Benjamin","Turner","ben.turner@horizonlogistics.co","Fleet Manager","Operations"),
         ("Mia","Anderson","mia.anderson@horizonlogistics.co","Route Planner","Operations"),
         ("Lucas","Davis","lucas.davis@horizonlogistics.co","Warehouse Lead","Operations")],

    5:  [("Charlotte","Evans","charlotte.evans@greenleafenergy.com","Project Engineer","Engineering"),
         ("Henry","White","henry.white@greenleafenergy.com","Energy Analyst","Finance"),
         ("Amelia","Scott","amelia.scott@greenleafenergy.com","Sustainability Lead","Operations")],

    6:  [("Jack","Thompson","jack.thompson@atlasconstruction.ca","Site Manager","Operations"),
         ("Harper","Garcia","harper.garcia@atlasconstruction.ca","Safety Officer","Operations"),
         ("Elijah","Martinez","elijah.martinez@atlasconstruction.ca","Project Coordinator","Operations")],

    7:  [("Abigail","Wilson","abigail.wilson@pinnaclelaw.com","Associate Lawyer","Legal"),
         ("Michael","Taylor","michael.taylor@pinnaclelaw.com","Paralegal","Legal"),
         ("Emily","Moore","emily.moore@pinnaclelaw.com","Legal Secretary","Legal")],

    8:  [("Daniel","Jackson","daniel.jackson@blueskyretail.com","Store Manager","Operations"),
         ("Ella","Harris","ella.harris@blueskyretail.com","Merchandiser","Sales"),
         ("Alexander","Clark","alex.clark@blueskyretail.com","Analytics Lead","Finance")],

    9:  [("Grace","Lewis","grace.lewis@quantumailabs.io","ML Engineer","Engineering"),
         ("Owen","Robinson","owen.robinson@quantumailabs.io","Research Scientist","Engineering"),
         ("Chloe","Walker","chloe.walker@quantumailabs.io","Data Engineer","Engineering")],

    10: [("Samuel","Hall","samuel.hall@meridianedu.ca","Academic Director","Operations"),
         ("Victoria","Allen","victoria.allen@meridianedu.ca","Curriculum Designer","Operations"),
         ("Jonathan","Young","jon.young@meridianedu.ca","Student Affairs Lead","HR")],
}

def create_tenants_and_users():
    print("\n── Creating 10 tenants + HR admins + employees...")
    for seq, name, plan, seats, website, industry, hr_first, hr_last, hr_email, status in TENANTS:
        tenant_id = f"tenant-{seq:05d}"

        # Create tenant
        TENANTS_T.put_item(Item={
            "tenantId":    tenant_id,
            "tenantCode":  tenant_id,
            "name":        name,
            "plan":        plan,
            "status":      status,
            "website":     website,
            "industry":    industry,
            "hrContact":   f"{hr_first} {hr_last}",
            "hrEmail":     hr_email,
            "maxSeats":    seats,
            "employeeCount": 0,
            "createdAt":   NOW,
            "createdBy":   "seed-script-v2",
        })
        print(f"  OK Tenant: {tenant_id} | {name} | {plan} | {seats} seats")

        # Create HR admin
        hr_user_id = str(uuid.uuid4())
        USERS_T.put_item(Item={
            "userId":    hr_user_id,
            "tenantId":  tenant_id,
            "email":     hr_email,
            "firstName": hr_first,
            "lastName":  hr_last,
            "role":      "HR_ADMIN",
            "status":    "active",
            "jobTitle":  "HR Administrator",
            "department":"HR",
            "createdAt": NOW,
            "createdBy": "seed-script-v2",
        })
        print(f"    HR Admin: {hr_email}")

        # Create 3 employees
        for emp_first, emp_last, emp_email, job_title, dept in EMPLOYEES[seq]:
            emp_id = str(uuid.uuid4())
            USERS_T.put_item(Item={
                "userId":    emp_id,
                "tenantId":  tenant_id,
                "email":     emp_email,
                "firstName": emp_first,
                "lastName":  emp_last,
                "role":      "EMPLOYEE",
                "status":    "active",
                "jobTitle":  job_title,
                "department":dept,
                "createdAt": NOW,
                "createdBy": "seed-script-v2",
            })
            print(f"    Employee: {emp_email} — {job_title}")

# ── Step 4: Fix SYSTEM tenant name (emoji corruption) ─────────────────────────
def fix_system_tenant():
    print("\n── Fixing SYSTEM tenant...")
    TENANTS_T.update_item(
        Key={"tenantId": "SYSTEM"},
        UpdateExpression="SET #n = :n, #p = :p, website = :w",
        ExpressionAttributeNames={"#n": "name", "#p": "plan"},
        ExpressionAttributeValues={
            ":n": "Endevo Platform — System",
            ":p": "system",
            ":w": "https://endevo.life"
        }
    )
    print("  ✓ SYSTEM tenant fixed")

# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  Endevo Life — Clean Seed v2")
    print("=" * 60)
    fix_system_tenant()
    delete_old_tenants()
    delete_old_users()
    create_tenants_and_users()
    print("\n" + "=" * 60)
    print("  DONE — 10 tenants, 10 HR admins, 30 employees created")
    print("=" * 60)
