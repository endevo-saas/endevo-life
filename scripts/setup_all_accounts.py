"""
Endevo Life — Full Setup Automation Script
Creates WorkOS accounts for ALL seed users + seeds training + questions for all tenants.
Run: C:/Python314/python.exe setup_all_accounts.py
"""
import boto3, json, sys, io, urllib.request, urllib.error
from datetime import datetime, timezone
from botocore.exceptions import ClientError

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

REGION = "us-east-1"

dynamo  = boto3.resource("dynamodb", region_name=REGION)
USERS_T = dynamo.Table("endevo-uat-users")
TRAIN_T = dynamo.Table("endevo-uat-training")
QUEST_T = dynamo.Table("endevo-uat-questions")
NOW     = datetime.now(timezone.utc).isoformat()

WORKOS_API_BASE = "https://api.workos.com"

# ── All seed tenants ───────────────────────────────────────────────────────────
TENANTS = {
    "tenant-00001": "Maple Financial Group",
    "tenant-00002": "TechNova Solutions",
    "tenant-00003": "Apex Healthcare",
    "tenant-00004": "Horizon Logistics",
    "tenant-00005": "GreenLeaf Energy",
    "tenant-00006": "Atlas Construction",
    "tenant-00007": "Pinnacle Law Partners",
    "tenant-00008": "BlueSky Retail Corp",
    "tenant-00009": "Quantum AI Labs",
    "tenant-00010": "Meridian Education Group",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_workos_api_key() -> str:
    """Retrieve WorkOS API key from AWS Secrets Manager."""
    sm = boto3.client("secretsmanager", region_name=REGION)
    resp = sm.get_secret_value(SecretId="endevo-uat-workos-api-key")
    secret = resp.get("SecretString", "")
    # Support both plain string and JSON {"api_key": "..."} formats
    try:
        parsed = json.loads(secret)
        return parsed.get("api_key", parsed.get("apiKey", secret))
    except (json.JSONDecodeError, TypeError):
        return secret


def _workos_create_user(
    api_key: str,
    email: str,
    first_name: str,
    last_name: str,
) -> dict:
    """Create a user via WorkOS User Management API. Returns the created user dict."""
    url = f"{WORKOS_API_BASE}/user_management/users"
    payload = json.dumps({
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "email_verified": True,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ── Step 1: Create WorkOS account for every user in DynamoDB ─────────────────

def create_all_workos_accounts() -> None:
    print("\n[1] Creating WorkOS accounts for all seed users...")

    api_key = _get_workos_api_key()
    if not api_key:
        print("  ERROR: Could not retrieve WorkOS API key from Secrets Manager")
        return

    result = USERS_T.scan()
    users = result.get("Items", [])
    created = skipped = failed = 0

    for u in users:
        email = u.get("email", "")
        role  = u.get("role", "EMPLOYEE")
        tid   = u.get("tenantId", "")
        tname = TENANTS.get(tid, tid)
        first = u.get("firstName", "User")
        last  = u.get("lastName", "")

        if not email or role == "GLOBAL_ADMIN":
            skipped += 1
            continue

        # Skip users that already have a WorkOS ID
        if u.get("workosId"):
            print(f"  SKIP (workosId exists): {email}")
            skipped += 1
            continue

        try:
            workos_user = _workos_create_user(api_key, email, first, last)
            workos_id = workos_user.get("id", "")

            # Update DynamoDB record with WorkOS ID and auth provider
            USERS_T.update_item(
                Key={"tenantId": tid, "email": email},
                UpdateExpression="SET workosId = :wid, authProvider = :ap",
                ExpressionAttributeValues={
                    ":wid": workos_id,
                    ":ap": "workos",
                },
            )

            print(f"  OK [{role}]: {email} | {tname} | workosId={workos_id}")
            created += 1

        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            # 409 = user already exists in WorkOS
            if e.code == 409:
                print(f"  SKIP (exists in WorkOS): {email}")
                skipped += 1
            else:
                print(f"  FAIL: {email} — HTTP {e.code}: {body}")
                failed += 1

        except Exception as e:
            print(f"  FAIL: {email} — {e}")
            failed += 1

    print(f"  Done: {created} created, {skipped} skipped, {failed} failed")

# ── Step 2: Seed 2 courses per tenant with 5 questions each ───────────────────
COURSE_TEMPLATES = [
    {
        "videoId":     "course-digital-legacy-101",
        "title":       "Digital Legacy Fundamentals",
        "description": "Understanding digital assets, estate planning basics, and protecting your online presence.",
        "duration":    "45 minutes",
        "order":       1,
        "questions": [
            {"q": "What is a digital legacy?",
             "opts": ["A collection of digital assets and accounts left after death", "A type of social media account", "A software program", "A cloud storage service"],
             "ans": "A collection of digital assets and accounts left after death"},
            {"q": "Which of the following is considered a digital asset?",
             "opts": ["Cryptocurrency wallets", "Physical property", "Bank vault", "Paper documents"],
             "ans": "Cryptocurrency wallets"},
            {"q": "What should an estate plan include for digital accounts?",
             "opts": ["A list of accounts with access credentials stored securely", "Nothing — they expire automatically", "Only email accounts", "Social media followers"],
             "ans": "A list of accounts with access credentials stored securely"},
            {"q": "What is a digital executor?",
             "opts": ["A person designated to manage digital assets after death", "A computer program", "A type of virus", "An online bank"],
             "ans": "A person designated to manage digital assets after death"},
            {"q": "How often should you review your digital estate plan?",
             "opts": ["Annually or after major life changes", "Never", "Only once", "Every 10 years"],
             "ans": "Annually or after major life changes"},
        ]
    },
    {
        "videoId":     "course-online-security-201",
        "title":       "Online Security & Privacy",
        "description": "Best practices for protecting your digital identity, passwords, and sensitive information.",
        "duration":    "30 minutes",
        "order":       2,
        "questions": [
            {"q": "What is the strongest type of password?",
             "opts": ["A long random mix of letters, numbers, and symbols", "Your birthday", "Your pet's name", "123456"],
             "ans": "A long random mix of letters, numbers, and symbols"},
            {"q": "What is two-factor authentication (2FA)?",
             "opts": ["A second verification step beyond your password", "Two passwords", "Two usernames", "A double firewall"],
             "ans": "A second verification step beyond your password"},
            {"q": "What should you do if you receive a suspicious email asking for your password?",
             "opts": ["Delete it and report it as phishing", "Reply with your password", "Click all links", "Forward to friends"],
             "ans": "Delete it and report it as phishing"},
            {"q": "How should you store sensitive passwords?",
             "opts": ["In a reputable password manager", "In a text file on your desktop", "Written on sticky notes", "In an email to yourself"],
             "ans": "In a reputable password manager"},
            {"q": "What does HTTPS in a website URL indicate?",
             "opts": ["The connection is encrypted and more secure", "The site is fast", "The site is free", "You are logged in"],
             "ans": "The connection is encrypted and more secure"},
        ]
    },
]

def seed_training_data():
    print("\n[2] Seeding training courses and questions for all 10 tenants...")
    courses_created = 0
    questions_created = 0

    for tenant_id, tenant_name in TENANTS.items():
        print(f"\n  Tenant: {tenant_name} ({tenant_id})")
        for tmpl in COURSE_TEMPLATES:
            vid = tmpl["videoId"]

            # Check if course already exists
            existing = TRAIN_T.get_item(Key={"tenantId": tenant_id, "videoId": vid}).get("Item")
            if existing:
                print(f"    SKIP course (exists): {tmpl['title']}")
            else:
                TRAIN_T.put_item(Item={
                    "tenantId":    tenant_id,
                    "videoId":     vid,
                    "courseId":    vid,
                    "title":       tmpl["title"],
                    "description": tmpl["description"],
                    "duration":    tmpl["duration"],
                    "order":       tmpl["order"],
                    "createdAt":   NOW,
                    "createdBy":   "seed-script-v2",
                })
                print(f"    OK course: {tmpl['title']}")
                courses_created += 1

            # Seed questions for this course+tenant
            for i, qdata in enumerate(tmpl["questions"]):
                qid = f"{tenant_id}#{vid}#q{i+1}"
                existing_q = QUEST_T.get_item(Key={"tenantId": tenant_id, "questionId": qid}).get("Item")
                if not existing_q:
                    QUEST_T.put_item(Item={
                        "tenantId":     tenant_id,
                        "questionId":   qid,
                        "courseId":     vid,
                        "question":     qdata["q"],
                        "options":      qdata["opts"],
                        "correctAnswer": qdata["ans"],
                        "createdAt":    NOW,
                    })
                    questions_created += 1

    print(f"\n  Done: {courses_created} courses created, {questions_created} questions created")

# ── Step 3: Verify SES sender ─────────────────────────────────────────────────
def check_ses():
    print("\n[3] Checking SES verified identities...")
    ses = boto3.client("sesv2", region_name=REGION)
    try:
        result = ses.list_email_identities()
        for identity in result.get("EmailIdentities", []):
            name   = identity.get("IdentityName", "")
            status = identity.get("VerificationStatus", "")
            print(f"  {status:10} {name}")
    except Exception as e:
        print(f"  Could not check SES: {e}")

# ── Run all ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 65)
    print("  Endevo Life — Full Account & Data Setup (WorkOS)")
    print("=" * 65)
    create_all_workos_accounts()
    seed_training_data()
    check_ses()
    print("\n" + "=" * 65)
    print("  COMPLETE — all accounts ready, training seeded")
    print("  Login URL: https://uat.endevo.life/login")
    print("=" * 65)
