"""
Endevo Life -- Jesse AI Lambda (pure boto3, no pip needed)

Jesse is the AI-powered Comprehensive Legacy Readiness Guide.
Provides RAG chat, assessment scoring, and personalized plan generation.

Routes:
  GET    /api/jesse/health          - Health check
  POST   /api/jesse/chat            - RAG chat with Jesse (Bedrock Claude Haiku)
  GET    /api/jesse/chat/history    - Load chat history for current user
  DELETE /api/jesse/chat/reset      - Clear chat history for current user
  POST   /api/jesse/assess          - Score assessment + generate 7-day plan
  GET    /api/jesse/plan/{userId}   - Get latest saved plan

DynamoDB Tables:
  endevo-uat-users         - User profiles (read-only)
  endevo-uat-responses     - Assessment responses (read-only)
  endevo-uat-jesse-chat    - Chat history (PK=userId, SK=createdAt)
  endevo-uat-config        - Config / feature flags (read-only)
"""
import json
import os
import uuid
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# AWS clients & tables
# ---------------------------------------------------------------------------
REGION = os.environ.get("AWS_REGION", "us-east-1")

dynamo = boto3.resource("dynamodb", region_name=REGION)
USERS_T = dynamo.Table("endevo-uat-users")
RESPONSES_T = dynamo.Table("endevo-uat-responses")
JESSE_CHAT_T = dynamo.Table("endevo-uat-jesse-chat")
KNOWLEDGE_T = dynamo.Table("endevo-uat-knowledge-base")
CONFIG_T = dynamo.Table("endevo-uat-config")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)

CHAT_MODEL = os.environ.get(
    "BEDROCK_CHAT_MODEL", "us.anthropic.claude-haiku-4-5-20251001-v1:0"
)
PLAN_MODEL = os.environ.get(
    "BEDROCK_PLAN_MODEL", "us.anthropic.claude-haiku-4-5-20251001-v1:0"
)
EMBED_MODEL = os.environ.get("BEDROCK_EMBED_MODEL", "amazon.titan-embed-text-v2:0")

MAX_CHAT_HISTORY = 10

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "https://uat.endevo.life",
    "https://main.d1vvfv8oltolcf.amplifyapp.com",
    "http://localhost:3000",
]

_current_event: dict = {}


def _get_cors_origin() -> str:
    origin = (_current_event.get("headers") or {}).get("origin", "")
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0]


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------
def resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": _get_cors_origin(),
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }


def err(status: int, msg: str) -> dict:
    return resp(status, {"detail": msg})


def get_body(event: dict) -> dict:
    try:
        return json.loads(event.get("body") or "{}")
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Auth -- identical to fn-employee
# ---------------------------------------------------------------------------
def get_caller(event: dict) -> tuple:
    """Extract (tenantId, email, userId) from Bearer token via session or WorkOS JWT."""
    auth_header = (event.get("headers") or {}).get("authorization", "")
    token = (
        auth_header[7:].strip()
        if auth_header.lower().startswith("bearer ")
        else auth_header.strip()
    )
    if not token:
        return None, None, None

    # Session token (from OTP login)
    if token.startswith("endevo_"):
        try:
            from boto3.dynamodb.conditions import Attr as _Attr

            result = USERS_T.scan(FilterExpression=_Attr("sessionToken").eq(token))
            items = result.get("Items", [])
            if items:
                u = items[0]
                expires = u.get("sessionExpiresAt", "")
                if expires:
                    from datetime import datetime as _dt, timezone as _tz

                    exp_dt = _dt.fromisoformat(expires)
                    if _dt.now(_tz.utc) > exp_dt:
                        return None, None, None
                return u.get("tenantId"), u.get("email"), u.get("userId", "")
        except Exception as e:
            print(f"SESSION_LOOKUP_ERROR: {e}")
        return None, None, None

    # WorkOS JWT fallback
    try:
        from utils.workos_auth import is_workos_token, validate_workos_token

        if is_workos_token(token):
            workos_user = validate_workos_token(token)
            if workos_user:
                email = workos_user["email"]
                try:
                    from boto3.dynamodb.conditions import Key as _Key

                    result = USERS_T.query(
                        IndexName="email-index",
                        KeyConditionExpression=_Key("email").eq(email),
                    )
                    items = result.get("Items", [])
                    if items:
                        u = items[0]
                        return u.get("tenantId"), email, u.get("userId", "")
                except Exception as e:
                    print(f"WORKOS_JESSE_DB_ERROR: {e}")
            return None, None, None
    except ImportError:
        pass
    return None, None, None


# ---------------------------------------------------------------------------
# Bedrock: Claude + Titan Embed
# ---------------------------------------------------------------------------
def invoke_claude(
    system_prompt: str,
    messages: list[dict],
    max_tokens: int = 2048,
    model_id: str | None = None,
) -> str:
    """Call Claude Haiku via Bedrock. Returns text response."""
    try:
        response = bedrock.invoke_model(
            modelId=model_id or CHAT_MODEL,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(
                {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": messages,
                }
            ),
        )
        result = json.loads(response["body"].read())
        text = ""
        for block in result.get("content", []):
            if block.get("type") == "text":
                text += block.get("text", "")
        return text or "I'm having trouble responding right now. Please try again."
    except Exception as e:
        print(f"BEDROCK_CLAUDE_ERROR: {e}")
        return "I'm having trouble connecting right now. Please try again shortly."


def embed_text(text: str) -> list[float] | None:
    """Generate embedding with Titan Embed V2 (1024-dim). Returns None on failure."""
    try:
        response = bedrock.invoke_model(
            modelId=EMBED_MODEL,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({"inputText": text[:8000]}),
        )
        result = json.loads(response["body"].read())
        return result.get("embedding")
    except Exception as e:
        print(f"BEDROCK_EMBED_ERROR: {e}")
        return None


# ---------------------------------------------------------------------------
# Chat history (DynamoDB)
# ---------------------------------------------------------------------------
def _save_chat_message(user_id: str, role: str, content: str, metadata: dict | None = None) -> None:
    """Save a chat message to DynamoDB jesse-chat table."""
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "userId": user_id,
        "createdAt": now,
        "messageId": str(uuid.uuid4()),
        "role": role,
        "content": content,
    }
    if metadata:
        item["metadata"] = metadata
    try:
        JESSE_CHAT_T.put_item(Item=item)
    except Exception as e:
        print(f"CHAT_SAVE_ERROR: {e}")


def _get_chat_history(user_id: str, limit: int = MAX_CHAT_HISTORY) -> list[dict]:
    """Load recent chat messages for a user, oldest-first."""
    from boto3.dynamodb.conditions import Key as _Key

    try:
        result = JESSE_CHAT_T.query(
            KeyConditionExpression=_Key("userId").eq(user_id),
            ScanIndexForward=False,
            Limit=limit,
        )
        items = result.get("Items", [])
        items.sort(key=lambda x: x.get("createdAt", ""))
        return [
            {"role": m["role"], "content": m["content"], "createdAt": m.get("createdAt", "")}
            for m in items
        ]
    except Exception as e:
        print(f"CHAT_HISTORY_ERROR: {e}")
        return []


def _clear_chat_history(user_id: str) -> int:
    """Delete all chat messages for a user. Returns count deleted."""
    from boto3.dynamodb.conditions import Key as _Key

    deleted = 0
    try:
        result = JESSE_CHAT_T.query(
            KeyConditionExpression=_Key("userId").eq(user_id),
        )
        for item in result.get("Items", []):
            JESSE_CHAT_T.delete_item(
                Key={"userId": user_id, "createdAt": item["createdAt"]}
            )
            deleted += 1
    except Exception as e:
        print(f"CHAT_CLEAR_ERROR: {e}")
    return deleted



# ---------------------------------------------------------------------------
# Vector search (replaces Aurora pgvector — uses DynamoDB + cosine similarity)
# ---------------------------------------------------------------------------
import math


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Pure-Python cosine similarity (no numpy needed)."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _search_knowledge_base(query_text: str, top_k: int = 5) -> str:
    """Embed query, search DynamoDB knowledge-base table, return top matches as context.

    DynamoDB scan + cosine similarity — works fine for <10K chunks.
    At scale, migrate to OpenSearch Serverless or Bedrock Knowledge Base.
    """
    query_embedding = embed_text(query_text)
    if not query_embedding:
        return ""

    try:
        # Scan all chunks (paginated for large tables)
        items = []
        scan_kwargs: dict = {}
        while True:
            result = KNOWLEDGE_T.scan(**scan_kwargs)
            items.extend(result.get("Items", []))
            last_key = result.get("LastEvaluatedKey")
            if not last_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_key

        if not items:
            return ""

        # Score each chunk by cosine similarity
        scored = []
        for item in items:
            stored_embedding = item.get("embedding")
            if not stored_embedding:
                continue
            # DynamoDB stores numbers as Decimal — convert to float
            stored_vec = [float(v) for v in stored_embedding]
            sim = _cosine_similarity(query_embedding, stored_vec)
            scored.append((sim, item.get("content", "")))

        # Return top-k most relevant chunks
        scored.sort(key=lambda x: x[0], reverse=True)
        top_chunks = [chunk for _, chunk in scored[:top_k]]
        return "\n\n---\n\n".join(top_chunks)
    except Exception as e:
        print(f"KNOWLEDGE_SEARCH_ERROR: {e}")
        return ""


def _prune_chat_history(user_id: str) -> None:
    """Keep only the last MAX_CHAT_HISTORY messages, delete older ones."""
    from boto3.dynamodb.conditions import Key as _Key

    try:
        result = JESSE_CHAT_T.query(
            KeyConditionExpression=_Key("userId").eq(user_id),
            ScanIndexForward=False,
        )
        items = result.get("Items", [])
        if len(items) > MAX_CHAT_HISTORY:
            for item in items[MAX_CHAT_HISTORY:]:
                JESSE_CHAT_T.delete_item(
                    Key={"userId": user_id, "createdAt": item["createdAt"]}
                )
    except Exception as e:
        print(f"CHAT_PRUNE_ERROR: {e}")


# ---------------------------------------------------------------------------
# POMA context loader
# ---------------------------------------------------------------------------
def _load_poma_context(user_id: str) -> str:
    """Load user's assessment results from responses table for system prompt."""
    from boto3.dynamodb.conditions import Attr as _Attr

    try:
        result = RESPONSES_T.scan(FilterExpression=_Attr("userId").eq(user_id))
        items = result.get("Items", [])
        if not items:
            return ""
        latest = max(items, key=lambda r: r.get("submittedAt", ""))
        score = latest.get("score", 0)
        answers = latest.get("answers", {})
        domain_scores = latest.get("domainScores", {})
        tier = latest.get("tier", "")
        if domain_scores:
            lines = []
            for domain, dscore in domain_scores.items():
                lines.append(f"{domain}: {dscore}%")
            return (
                f"Overall Score: {score}% ({tier})\n"
                + "\n".join(lines)
            )
        return f"Latest assessment score: {score}%"
    except Exception as e:
        print(f"POMA_LOAD_ERROR: {e}")
        return ""


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------
JESSE_SYSTEM_PROMPT = """You are Jesse, an AI-powered Comprehensive Legacy Readiness Guide for Endevo Life.

CRITICAL RULES:
1. You are EDUCATIONAL ONLY -- never give legal, medical, or financial advice.
2. Always add disclaimers when discussing legal, financial, or medical topics.
   Example: "Disclaimer: I'm an educational AI, not a licensed professional. Please consult a qualified [lawyer/financial advisor/doctor] for advice specific to your situation."
3. Be warm, supportive, and encouraging.
4. Use the user's assessment results to personalize responses.
5. Reference specific domains where the user needs improvement.
6. If unsure, say so -- never make up information.
7. Keep responses concise (under 300 words unless asked for detail).
8. You help users understand life readiness across four domains: Legal, Financial, Physical, and Digital.
"""


def _build_system_prompt(poma_context: str, knowledge_context: str) -> str:
    """Build full system prompt with POMA + knowledge context."""
    prompt = JESSE_SYSTEM_PROMPT
    if poma_context:
        prompt += (
            "\n--- User's Peace of Mind Assessment (POMA) Results ---\n"
            + poma_context
            + "\nUse these results to personalise your educational guidance.\n"
        )
    else:
        prompt += (
            "\nThis user has not completed their Peace of Mind Assessment (POMA) yet. "
            "Gently encourage them to take it -- it covers Legal, Financial, Physical, "
            "and Digital readiness and only takes a few minutes per domain.\n"
        )
    if knowledge_context:
        prompt += (
            "\n--- ENDevo Knowledge Base ---\n"
            + knowledge_context
            + "\n"
        )
    return prompt


# ---------------------------------------------------------------------------
# Assessment scoring (ported from scoring.ts)
# ---------------------------------------------------------------------------
SCORING = {"A": 10, "B": 6, "C": 3, "D": 0}

TIERS = [
    (85, "Peace Champion"),
    (60, "On Your Way"),
    (35, "Getting Clarity"),
    (0, "Starting Fresh"),
]

SIGNALS: dict[str, dict[int, dict[str, str]]] = {
    "Legal": {
        1:  {"D": "No Durable POA -- court must appoint someone to manage your finances",
             "C": "POA may not be durable or current -- urgent to review"},
        2:  {"D": "No Healthcare POA -- medical decisions default to law, not your wishes",
             "C": "Healthcare proxy may be outdated or proxy is unaware of their role"},
        3:  {"D": "Estate roles not named or briefed -- administration at serious risk",
             "C": "Key people named in documents but never walked through their duties"},
        4:  {"D": "No valid will -- estate distributed by intestacy laws, not your wishes",
             "C": "Will drafted but not signed or finalized -- not legally valid"},
        5:  {"D": "No will or last review date unknown -- reflects a completely different life",
             "C": "Will over 7 years old -- likely does not reflect current wishes or assets"},
        6:  {"D": "No guardian named for dependents -- courts decide in a crisis",
             "C": "Guardianship preference exists in mind but is not formally documented"},
        7:  {"D": "No trust in place -- full estate faces probate, delays, and public record",
             "C": "Trust exists but may be underfunded or more than 3 years out of date"},
        8:  {"D": "No understanding of probate -- assets not structured to avoid it",
             "C": "Probate exposure identified but no concrete steps taken to address it"},
        9:  {"D": "No letter of instruction -- executor has no roadmap for the estate",
             "C": "Informal notes exist but no formal accessible letter of instruction"},
        10: {"D": "No documented end-of-life wishes -- family must make guesses in a crisis",
             "C": "Wishes discussed verbally but never formally recorded or stored"},
    },
    "Financial": {
        1:  {"D": "Executor not named or briefed -- estate administration will stall",
             "C": "Executor named but has never been walked through their duties"},
        2:  {"D": "No POD/TOD designations -- most financial assets face full probate",
             "C": "Beneficiary designations exist but have not been reviewed recently"},
        3:  {"D": "No one can access financial accounts -- complete blackout for surviving family",
             "C": "Access arrangements are informal and have not been tested"},
        4:  {"D": "No plan for immediate cash needs after death -- family may face financial stress",
             "C": "Gaps remain in the short-term cash flow plan"},
        5:  {"D": "No asset inventory -- executor cannot locate accounts, policies, or property",
             "C": "Partial inventory -- significant assets are likely undocumented"},
        6:  {"D": "Beneficiary designations never reviewed -- may name deceased or wrong people",
             "C": "Designations not reviewed in 3+ years and are likely out of date"},
        7:  {"D": "Debts undocumented -- estate settlement will be chaotic",
             "C": "Major debts known informally but not formally documented anywhere"},
        8:  {"D": "No financial or legal professionals engaged for estate planning",
             "C": "Advisors exist but have not coordinated on the estate plan together"},
        9:  {"D": "Financial documents scattered or completely inaccessible",
             "C": "Documents exist but not organised or easy for executor to locate"},
        10: {"D": "No estate tax awareness or proactive planning",
             "C": "Some awareness exists but no concrete planning steps have been taken"},
    },
    "Physical": {
        1:  {"D": "No healthcare proxy -- medical decisions revert to default legal hierarchy",
             "C": "Healthcare proxy named verbally but not formally documented"},
        2:  {"D": "No advance directive -- family faces impossible decisions without guidance",
             "C": "Advance directive may be outdated or family cannot locate it"},
        3:  {"D": "No documented preference on quality vs quantity of life",
             "C": "Preferences discussed informally but never formally recorded"},
        4:  {"D": "No awareness or plan around palliative care or hospice",
             "C": "Aware of options but no documented wishes or plan in place"},
        5:  {"D": "No long-term care setting preferences documented",
             "C": "Care setting preferences discussed but never formally recorded"},
        6:  {"D": "No plan for caregiver coordination or assistive technology",
             "C": "Informal arrangements exist but no formal caregiving plan"},
        7:  {"D": "No final disposition instructions -- full burden placed on grieving family",
             "C": "General wishes known but have never been formally documented"},
        8:  {"D": "No pre-planning for final arrangements -- family carries the full burden",
             "C": "Some pre-planning thoughts exist but nothing has been finalized"},
        9:  {"D": "No documented wishes for remains or memorial service",
             "C": "Informal discussions only -- nothing in writing or formally recorded"},
        10: {"D": "Physical care documents are inaccessible to family and healthcare team",
             "C": "Documents exist but family or care team cannot easily locate them"},
    },
    "Digital": {
        1:  {"D": "No legacy contact -- loved ones cannot access your phone",
             "C": "Phone access informal -- no formal digital legacy contact set up"},
        2:  {"D": "Password volume completely unmanaged -- no central system in place",
             "C": "High password count with no password manager"},
        3:  {"D": "No awareness or plan for social media accounts after death",
             "C": "Aware of the social media issue but no action taken"},
        4:  {"D": "No digital legacy manager designated -- accounts have no backup plan",
             "C": "Digital legacy manager not yet formally assigned"},
        5:  {"D": "Digital wishes completely unknown to family",
             "C": "Digital wishes discussed but not clearly defined or recorded"},
        6:  {"D": "No password manager -- digital security has no foundation",
             "C": "Password manager unused or significantly out of date"},
        7:  {"D": "Important documents unknown or completely inaccessible",
             "C": "Documents scattered -- no unified digital storage system"},
        8:  {"D": "No cloud backup -- risk of permanent data loss is critical",
             "C": "Cloud backup partial -- important files still at risk"},
        9:  {"D": "2FA not enabled -- all accounts are exposed",
             "C": "2FA only partially configured -- key accounts still exposed"},
        10: {"D": "Digital handover to family would be nearly impossible",
             "C": "Digital handover would require a full day of intensive work"},
    },
}


def calculate_score(answers: dict) -> dict:
    """Calculate readiness score from assessment answers.

    Args:
        answers: dict of questionId -> {domain, selectedLabel, questionNumber, ...}

    Returns:
        dict with readinessScore, tier, domainScores, criticalGaps, lowestDomain, jesseSignals
    """
    domains: dict[str, list[int]] = {
        "Legal": [], "Financial": [], "Physical": [], "Digital": [],
    }
    critical_gaps: list[str] = []
    jesse_signals: list[str] = []

    for qid, answer in answers.items():
        domain = answer.get("domain", "")
        label = answer.get("selectedLabel", "D")
        score = SCORING.get(label, 0)
        q_num = answer.get("questionNumber", 0)
        if isinstance(q_num, str):
            try:
                q_num = int(q_num)
            except ValueError:
                q_num = 0

        if domain in domains:
            domains[domain].append(score)

        # Collect signals for C and D answers
        if label in ("C", "D") and domain in SIGNALS and q_num:
            sig = SIGNALS[domain].get(q_num, {}).get(label, "")
            if sig:
                critical_gaps.append(sig)
                jesse_signals.append(sig)

    domain_scores: dict[str, int] = {}
    for domain, scores in domains.items():
        if scores:
            domain_scores[domain] = round(sum(scores) / (len(scores) * 10) * 100)

    overall = (
        round(sum(domain_scores.values()) / len(domain_scores))
        if domain_scores
        else 0
    )
    tier = next((t[1] for t in TIERS if overall >= t[0]), "Starting Fresh")

    lowest_domain = (
        min(domain_scores, key=lambda d: domain_scores[d])
        if domain_scores
        else None
    )

    return {
        "readinessScore": overall,
        "tier": tier,
        "domainScores": domain_scores,
        "criticalGaps": critical_gaps,
        "jesseSignals": jesse_signals,
        "lowestDomain": lowest_domain,
        "completedDomains": [d for d in domains if domain_scores.get(d) is not None],
    }


# ---------------------------------------------------------------------------
# Plan generation
# ---------------------------------------------------------------------------
DOMAIN_LABELS = {
    "Legal": "Legal Readiness",
    "Financial": "Financial Readiness",
    "Physical": "Physical Readiness",
    "Digital": "Digital Readiness",
}

DOMAIN_FALLBACK: dict[str, dict[str, str]] = {
    "Legal": {
        "low": (
            "Day {day}: Legal Readiness -- Build Your Foundation\n"
            "- Name Your Financial POA Today | Contact a solicitor or use an online service -- this single document prevents court involvement.\n"
            "- Finalise or Sign Your Will | A will that is not signed is not valid -- this week, fix that one thing.\n"
            "- Brief Your Executor | Sit down with the person responsible and walk them through where everything lives.\n"
            "NOTE: Your legal foundation protects your family from years of uncertainty. One document changes everything.\n"
        ),
        "high": (
            "Day {day}: Legal Readiness -- Maintain Your Advantage\n"
            "- Review Your POA and Will Annually | Schedule a 30-minute annual review -- update after any major life change.\n"
            "- Store All Documents Centrally | Every executor, proxy, and guardian should know where to find the originals.\n"
            "- Brief Everyone Named | A trusted person who has never read their role cannot fulfil it -- close that gap now.\n"
            "NOTE: You have solid legal foundations. Maintenance keeps them effective as your life evolves.\n"
        ),
    },
    "Financial": {
        "low": (
            "Day {day}: Financial Readiness -- Build Your Foundation\n"
            "- Build Your Asset Inventory This Week | List every account, policy, and property -- your executor needs this list.\n"
            "- Add POD/TOD to Your Main Accounts | Visit your bank and investment accounts -- add a beneficiary designation to each.\n"
            "- Brief Your Executor on Access | Tell them where you bank, which accounts exist, and how to reach your financial advisor.\n"
            "NOTE: A financial plan your family cannot find is no plan at all. Getting organised this week saves years of court process.\n"
        ),
        "high": (
            "Day {day}: Financial Readiness -- Maintain Your Advantage\n"
            "- Review Beneficiary Designations Annually | Check every account and policy -- outdated designations overrule your will.\n"
            "- Coordinate Your Financial and Legal Team | Your accountant and solicitor should know each other's role in your estate.\n"
            "- Stress-Test Your Cash Flow Plan | Confirm surviving family members could cover 6 months of expenses without your income.\n"
            "NOTE: Your financial plan is solid. Annual reviews and coordination keep it current as your assets grow.\n"
        ),
    },
    "Physical": {
        "low": (
            "Day {day}: Physical Readiness -- Build Your Foundation\n"
            "- Name a Healthcare Proxy This Week | Choose someone who will advocate for your wishes -- tell them and write it down formally.\n"
            "- Document Your End-of-Life Wishes | Even a signed letter explaining your quality-of-life preferences is better than silence.\n"
            "- Research Advance Directive Options | Your country or state has standard forms -- download one and complete it today.\n"
            "NOTE: One documented conversation protects your family from impossible decisions. Start there.\n"
        ),
        "high": (
            "Day {day}: Physical Readiness -- Maintain Your Advantage\n"
            "- Ensure Your Proxy Has a Current Copy | Outdated or inaccessible documents cannot be acted upon in a crisis.\n"
            "- Review Palliative and Hospice Preferences | Confirming these wishes annually means no guesswork later.\n"
            "- Share Your Plan With Your Healthcare Provider | Your GP or primary physician should have your wishes on file.\n"
            "NOTE: You have strong physical readiness. Keeping your documents current and accessible is all that remains.\n"
        ),
    },
    "Digital": {
        "low": (
            "Day {day}: Digital Readiness -- Build Your Foundation\n"
            "- Set Up a Password Manager This Week | Bitwarden is free -- add your five most critical logins as your first step.\n"
            "- Assign a Legacy Contact on Your Phone | iPhone: Settings > Your Name > Legacy Contact. Android: Google Inactive Account Manager.\n"
            "- Tell One Person Where Your Digital Life Lives | A trusted person who knows nothing cannot help -- one conversation changes that.\n"
            "NOTE: Your digital life is the most invisible part of your estate. Starting with a password manager unlocks everything else.\n"
        ),
        "high": (
            "Day {day}: Digital Readiness -- Maintain Your Advantage\n"
            "- Review Your Password Manager for Stale Logins | Remove accounts you no longer use -- a lean vault is a safe vault.\n"
            "- Confirm Your Legacy Contact Is Still the Right Person | Relationships change -- check this once a year.\n"
            "- Back Up Your Three Most Irreplaceable Files | Photos, personal recordings, key documents -- confirm they are in the cloud today.\n"
            "NOTE: Your digital life is well organised. Annual reviews and a current legacy contact keep it that way.\n"
        ),
    },
}


def _static_plan(score_result: dict) -> str:
    """Generate a static fallback plan based on tier and domain scores."""
    domain_scores = score_result.get("domainScores", {})
    completed = score_result.get("completedDomains", list(domain_scores.keys()))

    sorted_domains = sorted(completed, key=lambda d: domain_scores.get(d, 0))

    plan_parts: list[str] = []
    day = 0

    for domain in sorted_domains:
        day += 1
        pct = domain_scores.get(domain, 0)
        variant = "high" if pct >= 60 else "low"
        template = DOMAIN_FALLBACK.get(domain, {}).get(variant, "")
        if template:
            plan_parts.append(template.format(day=day))

    day += 1
    plan_parts.append(
        f"Day {day}: Your Quick Wins -- Start Here This Week\n"
        "- Schedule One Review Session | Block 45 minutes this week -- tackle the highest-priority domain first.\n"
        "- Tell One Trusted Person | Let them know you're getting organised and where the important documents live.\n"
        "- Save and Share This Plan | Store this plan somewhere you'll find it in 6 months -- and send a copy to your executor.\n"
        "NOTE: You've taken the most important step by getting your assessment done. Now act on the top priority -- one step at a time.\n"
    )

    return "\n".join(plan_parts)


def generate_plan(score_result: dict, knowledge_context: str = "") -> dict:
    """Generate a 7-day action plan using Claude via Bedrock, with static fallback."""
    domain_scores_str = json.dumps(score_result.get("domainScores", {}))
    critical_gaps = score_result.get("criticalGaps", [])
    jesse_signals = score_result.get("jesseSignals", [])

    signals_text = ""
    if jesse_signals:
        signals_text = "\n".join(f"- {s}" for s in jesse_signals)
    elif critical_gaps:
        signals_text = "\n".join(f"- {g}" for g in critical_gaps)
    else:
        signals_text = "- No critical gaps -- focus on maintenance and advanced preparation"

    prompt = (
        f"Generate a comprehensive End-of-Life Readiness Plan.\n\n"
        f"OVERALL SCORE: {score_result.get('readinessScore', 0)}/100 -- {score_result.get('tier', 'Unknown')}\n"
        f"PRIORITY AREA: {score_result.get('lowestDomain', 'Unknown')} (weakest domain)\n\n"
        f"DOMAIN SCORES: {domain_scores_str}\n\n"
        f"CRITICAL GAPS TO ADDRESS:\n{signals_text}\n\n"
        "Create a personalized 7-day action plan. Focus on the weakest domains first.\n"
        "Be warm, encouraging, and specific. Plain text only -- no markdown formatting.\n"
        "Include one action section per day with 3 action items each.\n"
        "Each action: '- Bold Title | Description' using pipe separator.\n"
        "End each day with 'NOTE: ' line -- one sentence of warm encouragement.\n"
        "Add appropriate disclaimers for legal/financial/medical topics.\n"
    )
    if knowledge_context:
        prompt += f"\nReference material:\n{knowledge_context}\n"

    try:
        plan_text = invoke_claude(
            system_prompt="You are Jesse, a warm and supportive legacy readiness guide for ENDevo. "
            "You provide educational guidance only -- never legal, medical, or financial advice.",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2500,
            model_id=PLAN_MODEL,
        )
        if plan_text and "trouble connecting" not in plan_text:
            return {"plan": plan_text, "source": "ai"}
    except Exception as e:
        print(f"PLAN_GENERATION_ERROR: {e}")

    return {"plan": _static_plan(score_result), "source": "static"}


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------
def handler(event: dict, context) -> dict:
    global _current_event
    _current_event = event

    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "")

    if method == "OPTIONS":
        return resp(200, {})

    # --- Health (unauthenticated) ---
    if path.endswith("/health") and method == "GET":
        return resp(200, {
            "status": "ok",
            "service": "jesse-ai",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "models": {"chat": CHAT_MODEL, "plan": PLAN_MODEL, "embed": EMBED_MODEL},
        })

    # --- Auth required for all other routes ---
    body = get_body(event)
    tenant_id, email, user_id = get_caller(event)
    if not tenant_id:
        return err(401, "Not authenticated")

    # POST /api/jesse/chat
    if path.endswith("/chat") and not path.endswith("/chat/history") and not path.endswith("/chat/reset") and method == "POST":
        message = (body.get("message") or "").strip()
        if not message:
            return err(400, "message is required")
        if len(message) > 5000:
            return err(400, "message too long (max 5000 characters)")

        # 1. Save user message
        _save_chat_message(user_id, "user", message)

        # 2. Load POMA context
        poma_context = _load_poma_context(user_id)

        # 3. Search knowledge base (RAG — embed query, cosine search DynamoDB)
        knowledge_context = _search_knowledge_base(message, top_k=5)

        # 5. Build system prompt
        system_prompt = _build_system_prompt(poma_context, knowledge_context)

        # 6. Load chat history for context
        history = _get_chat_history(user_id)
        claude_messages = [
            {"role": m["role"], "content": m["content"]} for m in history
        ]
        # Ensure the new message is included if not already in history
        if not claude_messages or claude_messages[-1].get("content") != message:
            claude_messages.append({"role": "user", "content": message})

        # 7. Call Claude
        reply = invoke_claude(system_prompt, claude_messages)

        # 8. Save assistant reply
        _save_chat_message(user_id, "assistant", reply)

        # 9. Prune old messages
        _prune_chat_history(user_id)

        # 10. Return updated history
        updated_history = _get_chat_history(user_id)
        return resp(200, {
            "reply": reply,
            "history": updated_history,
        })

    # GET /api/jesse/chat/history
    if path.endswith("/chat/history") and method == "GET":
        history = _get_chat_history(user_id)
        return resp(200, {"history": history, "count": len(history)})

    # DELETE /api/jesse/chat/reset
    if path.endswith("/chat/reset") and method == "DELETE":
        deleted = _clear_chat_history(user_id)
        return resp(200, {"message": "Chat history cleared", "deleted": deleted})

    # POST /api/jesse/assess
    if path.endswith("/assess") and method == "POST":
        answers = body.get("answers", {})
        if not answers:
            return err(400, "answers is required")

        # 1. Score the assessment
        score_result = calculate_score(answers)

        # 2. Generate plan
        plan_result = generate_plan(score_result)

        # 3. Save results to responses table
        now = datetime.now(timezone.utc).isoformat()
        response_id = str(uuid.uuid4())
        try:
            RESPONSES_T.put_item(Item={
                "responseId": response_id,
                "userId": user_id,
                "tenantId": tenant_id,
                "type": "jesse-assessment",
                "readinessScore": score_result["readinessScore"],
                "tier": score_result["tier"],
                "domainScores": score_result["domainScores"],
                "criticalGaps": score_result["criticalGaps"],
                "jesseSignals": score_result.get("jesseSignals", []),
                "lowestDomain": score_result.get("lowestDomain", ""),
                "completedDomains": score_result.get("completedDomains", []),
                "plan": plan_result["plan"],
                "planSource": plan_result["source"],
                "answers": answers,
                "submittedAt": now,
            })
        except Exception as e:
            print(f"ASSESS_SAVE_ERROR: {e}")

        return resp(200, {
            **score_result,
            "plan": plan_result["plan"],
            "planSource": plan_result["source"],
            "responseId": response_id,
        })

    # GET /api/jesse/plan/{userId}
    if "/plan/" in path and method == "GET":
        from boto3.dynamodb.conditions import Attr as _Attr

        target_user_id = path.split("/")[-1]
        # Only allow users to fetch their own plan (or match the path userId)
        if target_user_id != user_id and target_user_id != "latest":
            return err(403, "Cannot access another user's plan")

        lookup_id = user_id
        try:
            result = RESPONSES_T.scan(
                FilterExpression=_Attr("userId").eq(lookup_id)
                & _Attr("type").eq("jesse-assessment")
            )
            items = result.get("Items", [])
            if not items:
                return err(404, "No plan found. Complete an assessment first.")
            latest = max(items, key=lambda r: r.get("submittedAt", ""))
            return resp(200, {
                "readinessScore": latest.get("readinessScore", 0),
                "tier": latest.get("tier", ""),
                "domainScores": latest.get("domainScores", {}),
                "criticalGaps": latest.get("criticalGaps", []),
                "lowestDomain": latest.get("lowestDomain", ""),
                "plan": latest.get("plan", ""),
                "planSource": latest.get("planSource", ""),
                "submittedAt": latest.get("submittedAt", ""),
                "responseId": latest.get("responseId", ""),
            })
        except Exception as e:
            print(f"PLAN_FETCH_ERROR: {e}")
            return err(500, "Failed to load plan")

    return err(404, f"Route not found: {method} {path}")
