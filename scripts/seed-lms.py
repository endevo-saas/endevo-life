"""
Seed script for LMS assessment questions and module configs.

Usage:
    python scripts/seed-lms.py --tenant-id <id> [--region us-east-1] [--dry-run]
"""

import argparse
import sys
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key


QUESTIONS_TABLE = "endevo-uat-questions"
MODULES_TABLE = "endevo-uat-lms-modules"


def get_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_questions(tenant_id: str, now_iso: str) -> list[dict]:
    def q(question_id, domain, number, text, a, b, c, d):
        return {
            "tenantId": tenant_id,
            "questionId": question_id,
            "type": "assessment",
            "domain": domain,
            "number": number,
            "weight": 10,
            "text": text,
            "answers": [
                {"label": "A", "text": a, "score": 10},
                {"label": "B", "text": b, "score": 6},
                {"label": "C", "text": c, "score": 3},
                {"label": "D", "text": d, "score": 0},
            ],
            "correctLabel": "A",
            "createdAt": now_iso,
            "version": 1,
        }

    legal = "Legal Readiness"
    financial = "Financial Readiness"
    physical = "Physical Readiness"
    digital = "Digital Readiness"

    return [
        # --- Legal Readiness ---
        q(
            "l1_financial_poa", legal, 1,
            "Do you have a Durable Power of Attorney for financial decisions?",
            "Yes — signed, valid, and my agent knows they're named and where it is.",
            "Yes — but I'm not sure if it's durable or whether it's current.",
            "No — but I know I need one.",
            "No — I didn't know this was something I needed.",
        ),
        q(
            "l2_healthcare_poa", legal, 2,
            "Do you have a Healthcare Power of Attorney naming someone to make medical decisions if you can't?",
            "Yes — signed, and my proxy has a copy and knows their role.",
            "I have something but I'm not sure it's current or that my proxy has a copy.",
            "No — but I've thought about who I'd want.",
            "No — I haven't addressed this at all.",
        ),
        q(
            "l3_named_roles", legal, 3,
            "Have you formally named — and briefed — the people who will manage your estate and carry out your wishes?",
            "Yes — all roles are formally named, those people know, and they've been briefed.",
            "Named in documents, but we've never walked through the details together.",
            "I have people in mind but nothing is formally documented.",
            "No — I haven't thought through who these people would be.",
        ),
        q(
            "l4_valid_will", legal, 4,
            "Do you have a legally valid, signed will?",
            "Yes — signed, witnessed, and stored securely where my executor can find it.",
            "I have a draft but it's not finalized or signed.",
            "No — but I know I need one.",
            "No — and I'm not sure I need one.",
        ),
        q(
            "l5_will_reviewed", legal, 5,
            "When was your will last reviewed and updated?",
            "Within the last 3 years.",
            "3 to 7 years ago.",
            "More than 7 years ago, or after a major life change I didn't follow up on.",
            "I don't have a will, or I genuinely don't know when it was last updated.",
        ),
        q(
            "l6_guardian_named", legal, 6,
            "If you have minor children or dependents with disabilities, have you legally named their guardian?",
            "Yes — named in my will, and the guardian knows and has agreed.",
            "Verbally agreed with someone but it's not documented legally.",
            "I have someone in mind but nothing is documented.",
            "This doesn't apply to me — or I haven't addressed it.",
        ),
        q(
            "l7_trust", legal, 7,
            "Do you have — or have you determined whether you need — a trust?",
            "Yes — I have a trust that's funded and up to date.",
            "I have a trust but it's not fully funded or hasn't been reviewed recently.",
            "I've been told I might need one but haven't acted on it.",
            "I don't know if I need a trust or what it would do for me.",
        ),
        q(
            "l8_probate", legal, 8,
            "Do you understand what assets in your estate would go through probate — and have you taken steps to minimize it?",
            "Yes — I've mapped my estate and structured assets to minimize probate.",
            "I have some knowledge but haven't fully mapped everything.",
            "I've heard of probate but don't fully understand what it means for my estate.",
            "I didn't know probate was something I needed to think about.",
        ),
        q(
            "l9_letter_of_instruction", legal, 9,
            "Have you written a Letter of Instruction — the practical roadmap that tells your executor exactly what to do, who to call, and where everything is?",
            "Yes — complete, up to date, and stored where my executor can find it.",
            "I've started one but it's incomplete or out of date.",
            "I know what it is but haven't written one yet.",
            "I've never heard of a Letter of Instruction.",
        ),
        q(
            "l10_end_of_life_wishes", legal, 10,
            "Have you documented your wishes around end-of-life choices — including Medical Aid in Dying if legal in your state — and do the right people know your position?",
            "Yes — my wishes are documented and shared with my healthcare proxy and physician.",
            "I know my wishes but they're not formally documented anywhere.",
            "I'm not sure what's available in my state or what I'd want.",
            "I had no idea this was something to document.",
        ),
        # --- Financial Readiness ---
        q(
            "f1_executor_briefed", financial, 1,
            "Have you had a direct, detailed conversation with your executor about your financial wishes — where everything is and what to do first?",
            "Yes — fully briefed, they know where everything is and understand what to do first.",
            "They know they're named but we've never walked through the details.",
            "I've mentioned it casually — no real planning conversation has happened.",
            "I've named someone but we haven't talked about any of this.",
        ),
        q(
            "f2_pod_tod", financial, 2,
            "Do your bank and investment accounts have named POD or TOD beneficiary designations?",
            "Yes — all accounts have current designations and I've verified them recently.",
            "Some accounts are designated, but I haven't confirmed all of them.",
            "I'm aware of POD/TOD but haven't set them up yet.",
            "I had no idea this was something I needed to do.",
        ),
        q(
            "f3_account_access", financial, 3,
            "If you died tomorrow, could your loved ones locate all your accounts and access funds within days — not months?",
            "Yes — everything is documented, stored securely, and at least one trusted person knows exactly where.",
            "They could figure it out, but it would take time and involve a lot of searching.",
            "Probably not — I haven't set this up in a way they could navigate without me.",
            "No — this would be a costly, confusing scavenger hunt.",
        ),
        q(
            "f4_life_insurance", financial, 4,
            "Do you have sufficient life insurance or liquid assets to cover final expenses and provide immediate cash flow for your dependents?",
            "Yes — coverage and liquid assets are in place for all three scenarios.",
            "I have some coverage but I'm not sure it's adequate for all three scenarios.",
            "I have minimal or no life insurance and haven't planned for these scenarios.",
            "I haven't thought through how my family would be financially supported if something happened.",
        ),
        q(
            "f5_financial_inventory", financial, 5,
            "Do you have a written inventory of all your financial accounts — bank, investment, retirement, and insurance?",
            "Yes — complete, up to date, and stored where my trusted people can find it.",
            "I have a partial list but it's incomplete or hasn't been updated recently.",
            "It's all in my head — I haven't written it down.",
            "No — I haven't started and I'm not sure where to begin.",
        ),
        q(
            "f6_beneficiary_review", financial, 6,
            "When did you last review and confirm your beneficiary designations across all accounts?",
            "Within the last 12 months — I do this annually.",
            "Within the last 3 years — but not recently.",
            "More than 3 years ago, or after a major life change I didn't follow up on.",
            "I've never reviewed them — or I'm not sure who is currently named.",
        ),
        q(
            "f7_debts_documented", financial, 7,
            "Are your significant debts documented — mortgage, loans, credit cards — with clear guidance for your executor on how to handle each one?",
            "Yes — debts are fully documented and my executor has been briefed on each one.",
            "My major debts are known, but nothing is formally documented for my executor.",
            "Partially — I've documented some things but not all.",
            "No — my debts aren't documented and my executor doesn't know what to expect.",
        ),
        q(
            "f8_financial_advisors", financial, 8,
            "Do you have a financial advisor and insurance broker who are part of your end-of-life planning?",
            "Yes — I have both, they know my end-of-life wishes, and we review things regularly.",
            "I have one or both but we've never discussed end-of-life planning specifically.",
            "I don't have these professionals in place but I know I should.",
            "No — and I don't know where to start finding the right people.",
        ),
        q(
            "f9_document_storage", financial, 9,
            "Do you have a secure, organized storage system — physical and digital — where all your financial documents can be found?",
            "Yes — fireproof home safe and/or digital vault, organized, and my trusted people know how to access it.",
            "Documents exist but are scattered across different locations and hard to navigate.",
            "I use a safe deposit box — I wasn't aware of the access limitations after death.",
            "No organized system — documents are wherever they ended up.",
        ),
        q(
            "f10_estate_taxes", financial, 10,
            "Have you addressed the potential tax implications of your estate on your beneficiaries?",
            "Yes — I've worked with a professional to understand and minimize tax exposure.",
            "I know this exists but haven't formally reviewed my exposure with a professional.",
            "I'm aware it's a thing but don't know if it applies to my estate.",
            "I had no idea estate or inheritance taxes were something I needed to consider.",
        ),
        # --- Physical Readiness ---
        q(
            "p1_healthcare_proxy", physical, 1,
            "Have you named a healthcare proxy and had a real conversation with them about your wishes?",
            "Yes — named, documented, and we've had a detailed conversation about what I'd want.",
            "I've named someone but we've never really talked about what I'd actually want.",
            "I have someone in mind but haven't formally named or briefed them.",
            "No one is designated — I haven't done either.",
        ),
        q(
            "p2_advance_directive", physical, 2,
            "Do you have a completed Medical Advance Directive or Living Will?",
            "Yes — completed, notarized, and my healthcare proxy has a copy.",
            "Started but not completed or notarized.",
            "I know I need one but haven't started.",
            "I'm not sure what this is or whether I need one.",
        ),
        q(
            "p3_life_support_prefs", physical, 3,
            "Have you documented your quality vs. quantity of life preferences — ventilators, feeding tubes, CPR, life support?",
            "Yes — documented with specific language about what I do and don't want.",
            "I've thought about it and have general preferences but nothing is written down.",
            "I find this topic hard to engage with and have avoided it.",
            "I've never considered this and don't know where to start.",
        ),
        q(
            "p4_palliative_hospice", physical, 4,
            "Do you understand the difference between palliative care and hospice — and have you documented your preferences for each?",
            "Yes — I understand both, know when I'd want each, and it's documented.",
            "I have a general sense but haven't documented preferences for either.",
            "I've heard the terms but I'm fuzzy on the difference.",
            "I'm not familiar with these options at all.",
        ),
        q(
            "p5_care_preferences", physical, 5,
            "Do you have documented preferences for where and how you'd receive care if you could no longer fully care for yourself?",
            "Yes — preferences documented, family informed, and financial implications considered.",
            "I've thought about it but nothing is written down or discussed with family.",
            "I assume my family will figure it out — I haven't engaged with the specifics.",
            "I haven't considered this scenario at all.",
        ),
        q(
            "p6_care_provider_prefs", physical, 6,
            "Have you documented your preferences around who provides your care — family vs. professional — and what role technology plays?",
            "Yes — I've thought through both and documented my values clearly.",
            "I have preferences but they're not written down.",
            "I've never thought about it at this level of detail.",
            "No — I wouldn't know how to even start thinking about this.",
        ),
        q(
            "p7_final_disposition", physical, 7,
            "Have you decided how you want your body handled after death — and documented it?",
            "Yes — I've chosen my final disposition method, it's documented, and my people know.",
            "I've thought about it but haven't put it in writing anywhere.",
            "I have a vague preference but haven't made a real decision.",
            "I haven't thought about this at all.",
        ),
        q(
            "p8_funeral_preplanning", physical, 8,
            "Have you done any funeral pre-planning with a funeral home or disposition provider?",
            "Yes — pre-planned and pre-paid, with documents stored and family informed.",
            "I've had the conversation with a provider but haven't formalized or paid.",
            "I know I should but haven't taken any steps yet.",
            "I had no idea this was something I could do in advance.",
        ),
        q(
            "p9_remains_instructions", physical, 9,
            "Do you have documented instructions for what should happen to your remains after disposition?",
            "Yes — specific instructions are written down and at least one person knows where they are.",
            "I have preferences but they're not documented anywhere findable.",
            "I've mentioned it to someone but it's never been written down.",
            "No instructions exist — I haven't thought it through this far.",
        ),
        q(
            "p10_documents_accessible", physical, 10,
            "Does at least one trusted person know where all your physical planning documents are stored — and could they act on them today?",
            "Yes — organized, stored securely, and at least one person knows exactly where and how to access everything.",
            "Documents exist but I haven't told anyone where they are.",
            "Documents are scattered — I'm not sure I could find them all quickly myself.",
            "Nothing is organized or accessible — this has never been set up.",
        ),
        # --- Digital Readiness ---
        q(
            "a1_phone_access", digital, 1,
            "If you died tomorrow, could your loved ones access the data on your phone?",
            "Yes — I have Legacy Contacts set up with multiple people identified.",
            "Yes — I have one Legacy Contact set up.",
            "Maybe — they know my password but nothing is formally set up.",
            "No — no one knows my password and I use biometrics only.",
        ),
        q(
            "a2_login_count", digital, 2,
            "How many logins and passwords do you have across all your accounts?",
            "Under 25 — I keep things streamlined.",
            "Around 25–100 — a manageable mix.",
            "Over 100 — I've lost count.",
            "Way too many to count — it's genuinely overwhelming.",
        ),
        q(
            "a3_password_manager", digital, 3,
            "Do you currently use a password manager to store your logins and credentials?",
            "Yes — I use one consistently and it's up to date.",
            "Yes — but I don't use it consistently or it's out of date.",
            "No — I rely on my browser or memory.",
            "No — I've never used one and don't know where to start.",
        ),
        q(
            "a4_account_handover", digital, 4,
            "If you had to hand over access to all your digital accounts to a trusted person right now, how long would it take?",
            "Under an hour — everything is documented and ready to share securely.",
            "A few hours — I'd need to gather and organise things first.",
            "A full day or more — it would take serious effort.",
            "It would be nearly impossible — I don't know where to start.",
        ),
        q(
            "a5_email_access", digital, 5,
            "Does anyone you trust have access to your primary email account in case of emergency?",
            "Yes — credentials are securely shared and documented.",
            "Sort of — someone knows the password but it's not formalised.",
            "No — but I've been meaning to sort this.",
            "No — and I haven't thought about it.",
        ),
        q(
            "a6_financial_access", digital, 6,
            "Are your banking and investment account credentials accessible by someone you trust if needed?",
            "Yes — everything is documented and securely stored.",
            "Partially — some accounts are covered but not all.",
            "Not really — it's scattered and disorganised.",
            "No — no one has any financial access details.",
        ),
        q(
            "a7_password_manager_recovery", digital, 7,
            "If you use a password manager, is the master password or recovery key stored securely somewhere a trusted person can find?",
            "Yes — it's in a physical safe or secure document known to my executor.",
            "It exists but only I know where it is.",
            "I haven't set up a recovery key.",
            "I don't use a password manager.",
        ),
        q(
            "a8_device_inventory", digital, 8,
            "Do you have an up-to-date list of all your devices — phones, laptops, tablets — and how to access them?",
            "Yes — documented and accessible to someone I trust.",
            "Informally — someone knows roughly what I have.",
            "Not really — I'd need to create this from scratch.",
            "No list exists at all.",
        ),
        q(
            "a9_subscriptions", digital, 9,
            "Do you have a list of all your recurring subscriptions and memberships so they can be cancelled if needed?",
            "Yes — a complete list including payment methods.",
            "A partial list — I know the main ones.",
            "Not written down — I'd have to check my bank statements.",
            "No idea how many I even have.",
        ),
        q(
            "a10_emergency_protocol", digital, 10,
            "Is there a written emergency access protocol — a single document someone can follow step-by-step to access everything important?",
            "Yes — it's written, stored securely, and at least one person knows where it is.",
            "It's mostly there but incomplete or out of date.",
            "Nothing formal — they'd have to piece it together.",
            "Nothing like this exists.",
        ),
    ]


def build_modules(tenant_id: str, now_iso: str) -> list[dict]:
    def m(module_num, title, description, domain, pdf_key, objectives):
        item = {
            "tenantId": tenant_id,
            "moduleNum": module_num,
            "title": title,
            "description": description,
            "pdfKey": pdf_key,
            "objectives": objectives,
            "isActive": True,
            "createdAt": now_iso,
            "version": 1,
        }
        if domain is not None:
            item["domain"] = domain
        return item

    return [
        m(
            "1",
            "Project Worth Developing",
            "Discover why building your digital legacy is one of the most important projects you'll ever take on. Meet Jesse and understand the foundation of estate planning.",
            None,
            "modules/module1/module1-draft.pdf",
            [
                "Understand why estate planning matters",
                "Meet your guide Jesse",
                "Set your intention for the 6-module journey",
            ],
        ),
        m(
            "2",
            "Legal Readiness",
            "Navigate the essential legal documents every adult needs — will, power of attorney, healthcare proxy, and more.",
            "Legal Readiness",
            "modules/module2/module2-draft.pdf",
            [
                "Understand durable power of attorney",
                "Create or review your will",
                "Name your healthcare proxy",
            ],
        ),
        m(
            "3",
            "Financial Readiness",
            "Organise your financial life so your loved ones can access everything they need without a scavenger hunt.",
            "Financial Readiness",
            "modules/module3/module3-draft.pdf",
            [
                "Document all financial accounts",
                "Set up beneficiary designations",
                "Brief your executor",
            ],
        ),
        m(
            "4",
            "Physical Readiness",
            "Make your end-of-life medical preferences known and documented so your wishes are honoured.",
            "Physical Readiness",
            "modules/module4/module4-draft.pdf",
            [
                "Complete your advance directive",
                "Choose your healthcare proxy",
                "Document disposition preferences",
            ],
        ),
        m(
            "5",
            "Digital Readiness",
            "Secure and organise your digital life so your digital legacy is protected and accessible.",
            "Digital Readiness",
            "modules/module5/module5-draft.pdf",
            [
                "Set up password manager",
                "Document all digital accounts",
                "Create emergency access protocol",
            ],
        ),
        m(
            "6",
            "Communicate Your Wishes",
            "Share your plans with the people who matter most. This final module ensures everyone who needs to know, knows.",
            None,
            "modules/module6/module6-draft.pdf",
            [
                "Have the legacy conversation",
                "Distribute your documents",
                "Celebrate — your legacy is protected",
            ],
        ),
    ]


def get_existing_question_ids(table, tenant_id: str) -> set[str]:
    """Return set of questionIds already seeded for this tenant."""
    existing = set()
    kwargs = {
        "KeyConditionExpression": Key("tenantId").eq(tenant_id),
        "FilterExpression": "attribute_exists(questionId)",
        "ProjectionExpression": "questionId",
    }
    while True:
        resp = table.query(**kwargs)
        for item in resp.get("Items", []):
            existing.add(item["questionId"])
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key
    return existing


def get_existing_module_nums(table, tenant_id: str) -> set[str]:
    """Return set of moduleNums already seeded for this tenant."""
    existing = set()
    kwargs = {
        "KeyConditionExpression": Key("tenantId").eq(tenant_id),
        "ProjectionExpression": "moduleNum",
    }
    while True:
        resp = table.query(**kwargs)
        for item in resp.get("Items", []):
            existing.add(item["moduleNum"])
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key
    return existing


def seed_questions(table, questions: list[dict], dry_run: bool) -> tuple[int, int]:
    """Seed questions; returns (written, skipped)."""
    existing = get_existing_question_ids(table, questions[0]["tenantId"])

    to_write = [q for q in questions if q["questionId"] not in existing]
    skipped = len(questions) - len(to_write)

    print(f"\n[Questions] {len(to_write)} to write, {skipped} already exist (skipping)")

    if dry_run:
        for q in to_write:
            print(f"  [DRY RUN] Would write: {q['questionId']} ({q['domain']} Q{q['number']})")
        return 0, skipped

    if to_write:
        with table.batch_writer() as batch:
            for q in to_write:
                batch.put_item(Item=q)
                print(f"  Written: {q['questionId']} ({q['domain']} Q{q['number']})")

    return len(to_write), skipped


def seed_modules(table, modules: list[dict], dry_run: bool) -> tuple[int, int]:
    """Seed modules; returns (written, skipped)."""
    existing = get_existing_module_nums(table, modules[0]["tenantId"])

    to_write = [m for m in modules if m["moduleNum"] not in existing]
    skipped = len(modules) - len(to_write)

    print(f"\n[Modules] {len(to_write)} to write, {skipped} already exist (skipping)")

    if dry_run:
        for m in to_write:
            print(f"  [DRY RUN] Would write: Module {m['moduleNum']} — {m['title']}")
        return 0, skipped

    if to_write:
        with table.batch_writer() as batch:
            for m in to_write:
                batch.put_item(Item=m)
                print(f"  Written: Module {m['moduleNum']} — {m['title']}")

    return len(to_write), skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed LMS data into DynamoDB")
    parser.add_argument("--tenant-id", required=True, help="Tenant ID to seed data for")
    parser.add_argument("--region", default="us-east-1", help="AWS region (default: us-east-1)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be seeded without writing")
    args = parser.parse_args()

    tenant_id: str = args.tenant_id
    region: str = args.region
    dry_run: bool = args.dry_run

    if dry_run:
        print(f"\n*** DRY RUN MODE — no data will be written ***")

    print(f"\nTenant ID : {tenant_id}")
    print(f"Region    : {region}")
    print(f"Tables    : {QUESTIONS_TABLE}, {MODULES_TABLE}")

    dynamodb = boto3.resource("dynamodb", region_name=region)
    questions_table = dynamodb.Table(QUESTIONS_TABLE)
    modules_table = dynamodb.Table(MODULES_TABLE)

    now_iso = get_now_iso()
    questions = build_questions(tenant_id, now_iso)
    modules = build_modules(tenant_id, now_iso)

    print(f"\nPrepared {len(questions)} questions and {len(modules)} modules")

    q_written, q_skipped = seed_questions(questions_table, questions, dry_run)
    m_written, m_skipped = seed_modules(modules_table, modules, dry_run)

    print("\n" + "=" * 50)
    print("SEED SUMMARY")
    print("=" * 50)
    if dry_run:
        print(f"  [DRY RUN] Questions : {len(questions) - q_skipped} would be written, {q_skipped} skipped")
        print(f"  [DRY RUN] Modules   : {len(modules) - m_skipped} would be written, {m_skipped} skipped")
    else:
        print(f"  Questions written : {q_written}")
        print(f"  Questions skipped : {q_skipped} (already existed)")
        print(f"  Modules written   : {m_written}")
        print(f"  Modules skipped   : {m_skipped} (already existed)")
    print("=" * 50)

    if not dry_run and (q_written > 0 or m_written > 0):
        print("\nSeed complete.")
    elif dry_run:
        print("\nDry run complete. No data was written.")
    else:
        print("\nNothing new to seed — all items already exist.")


if __name__ == "__main__":
    main()
