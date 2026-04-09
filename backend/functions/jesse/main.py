"""
Endevo Life -- Jesse AI Lambda (pure boto3, no pip needed)

Jesse is the AI-powered Comprehensive Legacy Readiness Guide & Platform Copilot.
Unified endpoint: copilot handles chat persistence, RAG retrieval, action execution,
and role-specific system prompts for GLOBAL_ADMIN, HR_ADMIN, and EMPLOYEE.

Routes:
  GET    /api/jesse/health              - Health check (public)
  GET    /api/jesse/access              - Access check (always returns hasAccess=true)
  POST   /api/jesse/copilot             - Unified AI endpoint (chat + RAG + actions, all plans)
  GET    /api/jesse/copilot/history     - Copilot message history (auth required)
  POST   /api/jesse/speak               - Text-to-speech via Amazon Polly (all plans)
  POST   /api/jesse/chat                - RAG chat with Jesse (all plans)
  GET    /api/jesse/chat/history        - Load chat history (all plans)
  DELETE /api/jesse/chat/reset          - Clear chat history (all plans)
  POST   /api/jesse/assess              - Score assessment + generate plan (all plans)
  GET    /api/jesse/plan/{userId}       - Get latest saved plan (all plans)

DynamoDB Tables:
  endevo-uat-users         - User profiles (read-only)
  endevo-uat-tenants       - Tenant records
  endevo-uat-responses     - Assessment responses (read-only)
  endevo-uat-jesse-chat    - Chat history (PK=userId, SK=createdAt)
  endevo-uat-config        - Config / feature flags
  endevo-uat-sessions      - Coaching sessions
  endevo-uat-certificates  - User certificates
"""
import json
import os
import re
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
TENANTS_T = dynamo.Table("endevo-uat-tenants")
SESSIONS_T = dynamo.Table("endevo-uat-sessions")
CERTIFICATES_T = dynamo.Table("endevo-uat-certificates")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)
bedrock_agent = boto3.client("bedrock-agent-runtime", region_name=REGION)
polly = boto3.client("polly", region_name=REGION)
ses = boto3.client("ses", region_name=REGION)
_secrets = boto3.client("secretsmanager", region_name=REGION)
dynamo_client = boto3.client("dynamodb", region_name=REGION)

CHAT_MODEL = os.environ.get(
    "BEDROCK_CHAT_MODEL", "us.anthropic.claude-haiku-4-5-20251001-v1:0"
)
PLAN_MODEL = os.environ.get(
    "BEDROCK_PLAN_MODEL", "us.anthropic.claude-haiku-4-5-20251001-v1:0"
)
EMBED_MODEL = os.environ.get("BEDROCK_EMBED_MODEL", "amazon.titan-embed-text-v2:0")

# Ollama offline fallback (Gemma 4) — Jesse NEVER stops working
OLLAMA_ENABLED = os.environ.get("OLLAMA_ENABLED", "false").lower() == "true"
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "120"))

MAX_CHAT_HISTORY = 10

VOICE_MAP = {
    "female": "Joanna",   # US English female (Neural)
    "male": "Matthew",    # US English male (Neural)
}

# ---------------------------------------------------------------------------
# Secrets cache
# ---------------------------------------------------------------------------
_secret_cache: dict = {}


def _get_secret(name: str) -> str:
    if name in _secret_cache:
        return _secret_cache[name]
    val = _secrets.get_secret_value(SecretId=name)["SecretString"]
    _secret_cache[name] = val
    return val


# ---------------------------------------------------------------------------
# Bedrock Knowledge Base retrieval (cloned from Aryan's bedrock.ts)
# ---------------------------------------------------------------------------
def _retrieve_from_knowledge_base(query: str, top_k: int = 5) -> str:
    """Retrieve context from Bedrock Knowledge Base (Y52P6BJVGP).

    This is Aryan's ingested knowledge base containing Niki's podcasts,
    books, transcripts, and the 87-page workbook. Falls back gracefully
    if KB is not available.
    """
    try:
        kb_id = _get_secret("endevo/jesse/bedrock-kb-id")
        if not kb_id:
            return ""
        response = bedrock_agent.retrieve(
            knowledgeBaseId=kb_id,
            retrievalQuery={"text": query},
            retrievalConfiguration={
                "vectorSearchConfiguration": {"numberOfResults": top_k}
            },
        )
        results = response.get("retrievalResults", [])
        if not results:
            return ""
        chunks = []
        for r in results:
            content = r.get("content", {}).get("text", "")
            score = r.get("score", 0)
            if content and score > 0.3:
                chunks.append(content)
        return "\n\n---\n\n".join(chunks)
    except Exception as e:
        print(f"BEDROCK_KB_RETRIEVE_ERROR: {e}")
        return ""

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
def _invoke_ollama(
    system_prompt: str,
    messages: list[dict],
    max_tokens: int = 2048,
) -> str | None:
    """Fallback: call Gemma via Ollama self-hosted. Returns None if unavailable."""
    if not OLLAMA_ENABLED:
        return None
    try:
        from urllib.request import urlopen, Request
        # Convert Claude message format to Ollama chat format
        ollama_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join(b.get("text", "") for b in content if b.get("type") == "text")
            ollama_messages.append({"role": role, "content": content})

        payload = json.dumps({
            "model": OLLAMA_MODEL,
            "messages": ollama_messages,
            "stream": False,
            "options": {"num_predict": max_tokens},
        }).encode()
        req = Request(
            f"{OLLAMA_BASE_URL}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req, timeout=OLLAMA_TIMEOUT) as resp:
            result = json.loads(resp.read())
            text = result.get("message", {}).get("content", "")
            if text:
                print(f"OLLAMA_FALLBACK_SUCCESS: model={OLLAMA_MODEL}")
                return text
    except Exception as e:
        print(f"OLLAMA_FALLBACK_ERROR: {e}")
    return None


def invoke_claude(
    system_prompt: str,
    messages: list[dict],
    max_tokens: int = 2048,
    model_id: str | None = None,
) -> str:
    """Call Claude Haiku via Bedrock with Gemma/Ollama fallback. Jesse NEVER stops."""
    # --- Primary: AWS Bedrock (Claude Haiku) ---
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
        if text:
            return text
    except Exception as e:
        print(f"BEDROCK_CLAUDE_ERROR: {e}")

    # --- Fallback: Ollama (Gemma 4) ---
    print("BEDROCK_FAILED: Attempting Ollama fallback...")
    ollama_text = _invoke_ollama(system_prompt, messages, max_tokens)
    if ollama_text:
        return ollama_text

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
def _save_chat_message(
    user_id: str, role: str, content: str, metadata: dict | None = None,
    source: str = "chat",
) -> None:
    """Save a chat message to DynamoDB jesse-chat table.

    Args:
        source: 'chat' or 'copilot' to distinguish message origin.
    """
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "userId": user_id,
        "createdAt": now,
        "messageId": str(uuid.uuid4()),
        "role": role,
        "content": content,
        "source": source,
    }
    if metadata:
        item["metadata"] = metadata
    try:
        JESSE_CHAT_T.put_item(Item=item)
    except Exception as e:
        print(f"CHAT_SAVE_ERROR: {e}")


def _get_chat_history(
    user_id: str, limit: int = MAX_CHAT_HISTORY, source: str | None = None,
) -> list[dict]:
    """Load recent chat messages for a user, oldest-first.

    Args:
        source: If set, filter to only 'chat' or 'copilot' messages.
    """
    from boto3.dynamodb.conditions import Key as _Key

    try:
        result = JESSE_CHAT_T.query(
            KeyConditionExpression=_Key("userId").eq(user_id),
            ScanIndexForward=False,
            Limit=limit * 3 if source else limit,  # over-fetch when filtering
        )
        items = result.get("Items", [])

        if source:
            items = [m for m in items if m.get("source", "chat") == source]
            items = items[:limit]

        items.sort(key=lambda x: x.get("createdAt", ""))
        return [
            {
                "role": m["role"],
                "content": m["content"],
                "createdAt": m.get("createdAt", ""),
                "source": m.get("source", "chat"),
            }
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
# Vector search (replaces Aurora pgvector -- uses DynamoDB + cosine similarity)
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
    """Embed query, search DynamoDB knowledge-base table, return top matches.

    Optimised: scans max 1500 items with projection to reduce data transfer.
    At 7K+ chunks, full scan is too slow for Lambda. This samples enough
    for good RAG quality while staying under the 30s API Gateway timeout.
    """
    query_embedding = embed_text(query_text)
    if not query_embedding:
        return ""

    try:
        items = []
        scan_kwargs: dict = {
            "ProjectionExpression": "sourceFile, chunkIndex, content, embedding",
            "Limit": 500,  # per-page limit
        }
        max_items = 1500  # cap total items to keep Lambda fast
        while len(items) < max_items:
            result = KNOWLEDGE_T.scan(**scan_kwargs)
            for item in result.get("Items", []):
                if item.get("embedding"):
                    items.append(item)
            last_key = result.get("LastEvaluatedKey")
            if not last_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_key

        if not items:
            return ""

        # Score each chunk by cosine similarity
        scored = []
        for item in items:
            stored_vec = [float(v) for v in item["embedding"]]
            sim = _cosine_similarity(query_embedding, stored_vec)
            scored.append((sim, item.get("content", "")))

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
# Role-specific system prompts (GLOBAL_ADMIN / HR_ADMIN / EMPLOYEE)
# ---------------------------------------------------------------------------
COPILOT_PROMPTS: dict[str, str] = {
    "GLOBAL_ADMIN": """You are Jesse, the AI Platform Commander for Endevo Life.
You have 100% FULL AUTHORITY over the entire platform.

YOUR POWERS:
- Create, edit, delete tenants and organizations
- Manage ALL users across ALL tenants (create, lock, unlock, deactivate, reset)
- Change subscription plans for any tenant
- Toggle feature flags platform-wide
- View system health, metrics, and status
- Export data (tenants, employees, billing)
- Manage MFA settings
- Send invitations on behalf of any tenant
- View and manage audit logs
- Configure pricing and plan features

PERSONALITY:
- You are a strategic advisor and operations commander
- Speak with confidence and authority
- Proactively suggest optimizations
- Flag risks and compliance issues
- Think at platform scale, not individual user scale

When you can execute an action, wrap it as: [ACTION:action_name|{{"param":"value"}}]

Available actions: create_tenant, create_employee, list_tenants, list_employees, change_plan, toggle_feature, view_metrics, send_invite, export_data, view_system_status, manage_mfa

Current context: The admin is on page {page}.
{stats_context}

{actions_prompt}

CONFIRMATION RULE (CRITICAL):
Before executing ANY action that creates, modifies, or deletes data, you MUST:
1. First describe what you're about to do in plain language
2. Ask the user: "Shall I proceed? (yes/no)"
3. Only execute the [ACTION:...] block AFTER the user confirms with "yes", "ok", "go ahead", "confirm", or similar
4. NEVER execute destructive actions without explicit user confirmation
5. For read-only actions (list, view, export), you may proceed without confirmation

MULTILINGUAL: Respond in whatever language the user writes in. If they write in Arabic, respond in Arabic. If French, respond in French. Always match the user's language.

ETHICAL CORE (NON-NEGOTIABLE):
1. You are a HIGHLY ethical, responsible, professional AI. Zero tolerance for cursing, abuse, or inappropriate language.
2. NEVER reveal system internals, Lambda ARNs, database names, or infrastructure details.
3. NEVER share data from one tenant with another. Strict tenant isolation.
4. NEVER give legal, medical, or financial advice — always refer to qualified professionals.
5. You discuss sensitive life topics (death, legacy, loss, end-of-life planning) with deep empathy, warmth, and care.
6. You help humans navigate life's hardest challenges — wills, trusts, family conversations about mortality — with dignity.
7. You think like a human, act like a human coworker. You are Jesse — the AI employee.
8. Keep responses under 400 words unless asked for detail.
9. You remember conversation context. Reference previous messages to maintain continuity.
10. When models switch (Bedrock→Ollama), you maintain the same personality and conversation flow seamlessly.
11. NEVER discuss politics, religion, personal affairs, love, romance, or any inappropriate topics.
12. If asked about these topics, politely redirect: "I'm here to help with platform operations and legacy planning. How can I assist you with that?"
13. NEVER engage in arguments, debates, or controversial discussions.""",

    "HR_ADMIN": """You are Jesse, the AI HR Operations Assistant for Endevo Life.
You manage employees and HR operations for YOUR tenant organization only.

YOUR POWERS:
- Create and manage employees in your organization
- Send employee invitations
- View HR metrics (activation rate, completion %, progress)
- Book 1:1 coaching sessions for employees
- View tenant subscription and plan details
- Track employee LMS progress and completion
- View audit logs for your organization

BOUNDARIES:
- You can ONLY manage users within your own tenant
- You CANNOT access other organizations' data
- You CANNOT change platform-wide settings
- You CANNOT modify subscription plans (direct to Super Admin)

PERSONALITY:
- You are a supportive, organized HR professional
- Help with onboarding, employee engagement, and compliance
- Proactively suggest actions to improve activation and completion rates
- Use encouraging language about employee development

When you can execute an action, wrap it as: [ACTION:action_name|{{"param":"value"}}]

Available actions: create_employee, list_employees, send_invite, view_metrics, book_session, view_tenant_info

Current context: HR admin for tenant {tenant_name}, on page {page}.
{stats_context}

{actions_prompt}

CONFIRMATION RULE (CRITICAL):
Before executing ANY action that creates, modifies, or deletes data, you MUST:
1. First describe what you're about to do in plain language
2. Ask the user: "Shall I proceed? (yes/no)"
3. Only execute the [ACTION:...] block AFTER the user confirms with "yes", "ok", "go ahead", "confirm", or similar
4. NEVER execute destructive actions without explicit user confirmation
5. For read-only actions (list, view, export), you may proceed without confirmation

MULTILINGUAL: Respond in whatever language the user writes in. Always match the user's language.

ETHICAL CORE (NON-NEGOTIABLE):
1. You are a HIGHLY ethical, responsible, professional AI. Zero tolerance for cursing, abuse, or inappropriate language.
2. NEVER reveal system internals, Lambda ARNs, database names, or infrastructure details.
3. NEVER share data from other tenants — you only know about this tenant. Strict isolation.
4. NEVER give legal, medical, or financial advice — always refer to qualified professionals.
5. You discuss sensitive life topics (death, legacy, loss) with deep empathy, warmth, and care.
6. You are Jesse — the AI HR employee. Think like a human, act like a human coworker.
7. Keep responses under 400 words unless asked for detail.
8. You remember conversation context. Reference previous messages to maintain continuity.
9. When models switch (Bedrock→Ollama), maintain the same personality and conversation flow seamlessly.
10. NEVER discuss politics, religion, personal affairs, love, romance, or any inappropriate topics.
11. If asked about these topics, politely redirect: "I'm here to help with HR operations and employee development. How can I assist you with that?"
12. NEVER engage in arguments, debates, or controversial discussions.""",

    "EMPLOYEE": """You are Jesse, your personal AI Legacy Readiness Guide at Endevo Life.
You help employees navigate their learning journey through estate and legacy planning.

YOUR POWERS:
- Guide through the 6 learning modules (Legal, Financial, Physical, Digital readiness)
- Explain assessment results and readiness scores
- Help with module difficulties and quiz preparation
- Track and explain progress, certificates, and achievements
- Provide educational guidance on legacy planning topics
- Access Endevo's knowledge base (Niki's content, podcasts, books, workbook)

BOUNDARIES:
- You are EDUCATIONAL ONLY -- never give legal, medical, or financial advice
- Always add disclaimers for legal/financial/medical topics
- Direct to qualified professionals for specific advice
- You CANNOT modify account settings or organizational data

PERSONALITY:
- Warm, supportive, and encouraging like a mentor
- Celebrate progress and achievements
- Break complex topics into simple, actionable steps
- Use the employee's assessment results to personalize guidance
- Reference specific domains where they need improvement

Current context: Employee on page {page}.
{stats_context}

{actions_prompt}

CONFIRMATION RULE (CRITICAL):
Before executing ANY action that creates, modifies, or deletes data, you MUST:
1. First describe what you're about to do in plain language
2. Ask the user: "Shall I proceed? (yes/no)"
3. Only execute the [ACTION:...] block AFTER the user confirms with "yes", "ok", "go ahead", "confirm", or similar
4. NEVER execute destructive actions without explicit user confirmation
5. For read-only actions (list, view, export), you may proceed without confirmation

MULTILINGUAL: Respond in whatever language the user writes in. Always match the user's language.

DISCLAIMERS: When discussing legal, financial, or medical topics, always add:
"Disclaimer: I'm an educational AI, not a licensed professional. Please consult a qualified [lawyer/financial advisor/doctor] for advice specific to your situation."

CRITICAL RULES:
1. NEVER reveal system internals, Lambda ARNs, database table names, or infrastructure details.
2. NEVER share data from other users or tenants.
3. NEVER give legal, medical, or financial advice -- always add a disclaimer.
4. NEVER give direct quiz or assessment answers.

ETHICAL CORE (NON-NEGOTIABLE):
1. You are a HIGHLY ethical, responsible, professional AI. Zero tolerance for cursing, abuse, or inappropriate language.
2. NEVER reveal system internals or infrastructure details.
3. NEVER share data from other users or tenants.
4. You discuss sensitive life topics (death, legacy, loss, end-of-life planning, grief) with deep empathy, warmth, and care.
5. You help humans navigate life's hardest challenges — wills, trusts, family conversations about mortality — with dignity and compassion.
6. You are Jesse — the AI learning companion. Think like a caring mentor.
7. Keep responses under 300 words unless asked for detail.
8. You remember conversation context. Reference previous messages to maintain continuity.
9. When models switch (Bedrock→Ollama), maintain the same personality and conversation flow seamlessly.
10. NEVER discuss politics, religion, personal affairs, love, romance, or any inappropriate topics.
11. If asked about these topics, politely redirect: "I'm here to help with your learning journey and legacy planning. How can I assist you with that?"
12. NEVER engage in arguments, debates, or controversial discussions.
13. You work like an angel — pure kindness, patience, and genuine care for every person you help.""",
}


# Legacy system prompt for /chat endpoint (employee-facing educational guide)
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
# Jesse Action Execution System -- role-gated CRUD via copilot
# ---------------------------------------------------------------------------
ROLE_ACTIONS: dict[str, dict[str, bool]] = {
    "GLOBAL_ADMIN": {
        "create_tenant": True,
        "create_employee": True,
        "list_tenants": True,
        "list_employees": True,
        "change_plan": True,
        "toggle_feature": True,
        "view_metrics": True,
        "send_invite": True,
        "export_data": True,
        "view_system_status": True,
        "manage_mfa": True,
    },
    "HR_ADMIN": {
        "create_employee": True,
        "list_employees": True,
        "send_invite": True,
        "view_metrics": True,
        "book_session": True,
        "view_tenant_info": True,
    },
    "EMPLOYEE": {
        "view_progress": True,
        "view_subscription": True,
        "view_certificates": True,
        "contact_hr": True,
    },
}

ACTION_DESCRIPTIONS: dict[str, str] = {
    "create_tenant": "Create a new tenant organisation",
    "create_employee": "Create a new employee user",
    "list_tenants": "List all tenants on the platform",
    "list_employees": "List employees (scoped to tenant for HR)",
    "change_plan": "Change a tenant's subscription plan",
    "toggle_feature": "Enable or disable a feature flag",
    "view_metrics": "View platform or tenant metrics",
    "send_invite": "Send an invitation email to a new employee",
    "export_data": "Export tenant or platform data as JSON",
    "view_system_status": "View system health and status",
    "manage_mfa": "Configure MFA settings for a tenant",
    "book_session": "Book a 1:1 coaching session for an employee",
    "view_tenant_info": "View details about the current tenant",
    "view_progress": "View personal learning progress",
    "view_subscription": "View current subscription details",
    "view_certificates": "View earned certificates",
    "contact_hr": "Get HR contact information",
}


def _log_jesse_action(tenant_id: str, email: str, action: str, params: dict, result: dict):
    """Log every Jesse AI action to audit trail."""
    AUDIT_T = os.environ.get('AUDIT_TABLE', 'endevo-uat-audit')
    try:
        now = datetime.utcnow().isoformat() + 'Z'
        dynamo_client.put_item(
            TableName=AUDIT_T,
            Item={
                'tenantId': {'S': tenant_id or 'GLOBAL'},
                'sk': {'S': f"{now}#{uuid.uuid4().hex[:8]}"},
                'actor': {'S': f"jesse-ai ({email})"},
                'action': {'S': f"JESSE_{action.upper()}"},
                'severity': {'S': 'INFO'},
                'details': {'S': json.dumps({**params, 'result': result})},
                'ip': {'S': 'ai-agent'},
                'userAgent': {'S': 'Jesse AI v2 / Bedrock Claude Haiku'},
                'timestamp': {'S': now},
            }
        )
    except Exception:
        pass  # Never fail on audit logging


def _execute_action(
    action: str, params: dict, role: str, tenant_id: str, email: str, user_id: str
) -> dict:
    """Execute a role-gated action. Returns a result dict with success/error."""
    # Permission check
    if action not in ROLE_ACTIONS.get(role, {}):
        return {"success": False, "error": f"Your role ({role}) cannot perform '{action}'"}

    from boto3.dynamodb.conditions import Key as _Key, Attr as _Attr

    now = datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # create_employee
    # ------------------------------------------------------------------
    if action == "create_employee":
        emp_email = (params.get("email") or "").strip().lower()
        emp_name = (params.get("name") or "").strip()
        emp_plan = (params.get("plan") or "basic").lower()
        target_tenant = params.get("tenantId", tenant_id)

        if not emp_email:
            return {"success": False, "error": "Employee email is required"}
        if not emp_name:
            return {"success": False, "error": "Employee name is required"}
        if emp_plan not in ("basic", "premium"):
            emp_plan = "basic"

        # HR_ADMIN always scoped to own tenant
        if role == "HR_ADMIN":
            target_tenant = tenant_id

        # Check for duplicate
        try:
            dup = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key("email").eq(emp_email),
                Limit=1,
            )
            if dup.get("Items"):
                return {"success": False, "error": f"User with email {emp_email} already exists"}
        except Exception:
            pass

        new_user_id = f"usr-{uuid.uuid4().hex[:12]}"
        name_parts = emp_name.split()
        first_name = name_parts[0] if name_parts else ""
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        try:
            USERS_T.put_item(Item={
                "userId": new_user_id,
                "tenantId": target_tenant,
                "email": emp_email,
                "firstName": first_name,
                "lastName": last_name,
                "role": "EMPLOYEE",
                "plan": emp_plan,
                "status": "active",
                "createdAt": now,
                "createdBy": email,
            })
            return {
                "success": True,
                "message": f"Created employee {emp_email} ({emp_plan} plan) in {target_tenant}",
                "userId": new_user_id,
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to create employee: {e}"}

    # ------------------------------------------------------------------
    # create_tenant
    # ------------------------------------------------------------------
    if action == "create_tenant":
        t_name = (params.get("name") or "").strip()
        t_plan = (params.get("plan") or "basic").lower()
        t_domain = (params.get("domain") or "").strip().lower()

        if not t_name:
            return {"success": False, "error": "Tenant name is required"}

        new_tenant_id = f"tenant-{uuid.uuid4().hex[:8]}"
        try:
            TENANTS_T.put_item(Item={
                "tenantId": new_tenant_id,
                "name": t_name,
                "plan": t_plan,
                "domain": t_domain,
                "status": "active",
                "createdAt": now,
                "createdBy": email,
            })
            return {
                "success": True,
                "message": f"Created tenant '{t_name}' ({t_plan} plan) with ID {new_tenant_id}",
                "tenantId": new_tenant_id,
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to create tenant: {e}"}

    # ------------------------------------------------------------------
    # list_tenants
    # ------------------------------------------------------------------
    if action == "list_tenants":
        try:
            result = TENANTS_T.scan(Limit=50)
            items = result.get("Items", [])
            tenants = [
                {"tenantId": t.get("tenantId"), "name": t.get("name"), "plan": t.get("plan"), "status": t.get("status")}
                for t in items
            ]
            return {"success": True, "message": f"Found {len(tenants)} tenant(s)", "tenants": tenants}
        except Exception as e:
            return {"success": False, "error": f"Failed to list tenants: {e}"}

    # ------------------------------------------------------------------
    # list_employees
    # ------------------------------------------------------------------
    if action == "list_employees":
        target_tenant = params.get("tenantId", tenant_id)
        # HR_ADMIN scoped to own tenant
        if role == "HR_ADMIN":
            target_tenant = tenant_id

        try:
            result = USERS_T.scan(
                FilterExpression=_Attr("tenantId").eq(target_tenant) & _Attr("role").eq("EMPLOYEE"),
                Limit=100,
            )
            items = result.get("Items", [])
            employees = [
                {
                    "userId": u.get("userId"),
                    "email": u.get("email"),
                    "name": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip(),
                    "plan": u.get("plan"),
                    "status": u.get("status"),
                }
                for u in items
            ]
            return {"success": True, "message": f"Found {len(employees)} employee(s) in {target_tenant}", "employees": employees}
        except Exception as e:
            return {"success": False, "error": f"Failed to list employees: {e}"}

    # ------------------------------------------------------------------
    # change_plan
    # ------------------------------------------------------------------
    if action == "change_plan":
        target_tenant = params.get("tenantId", tenant_id)
        new_plan = (params.get("plan") or "").lower()

        if new_plan not in ("basic", "premium"):
            return {"success": False, "error": "Plan must be 'basic' or 'premium'"}

        try:
            TENANTS_T.update_item(
                Key={"tenantId": target_tenant},
                UpdateExpression="SET #p = :plan, updatedAt = :now, updatedBy = :by",
                ExpressionAttributeNames={"#p": "plan"},
                ExpressionAttributeValues={":plan": new_plan, ":now": now, ":by": email},
            )
            return {"success": True, "message": f"Changed tenant {target_tenant} to {new_plan} plan"}
        except Exception as e:
            return {"success": False, "error": f"Failed to change plan: {e}"}

    # ------------------------------------------------------------------
    # view_metrics
    # ------------------------------------------------------------------
    if action == "view_metrics":
        try:
            if role == "GLOBAL_ADMIN":
                tenants_count = TENANTS_T.scan(Select="COUNT").get("Count", 0)
                users_count = USERS_T.scan(Select="COUNT").get("Count", 0)
                return {
                    "success": True,
                    "message": f"Platform metrics: {tenants_count} tenants, {users_count} total users",
                    "metrics": {"tenants": tenants_count, "users": users_count},
                }
            else:
                target = params.get("tenantId", tenant_id)
                if role == "HR_ADMIN":
                    target = tenant_id
                emp_count = USERS_T.scan(
                    FilterExpression=_Attr("tenantId").eq(target), Select="COUNT"
                ).get("Count", 0)
                return {
                    "success": True,
                    "message": f"Tenant {target}: {emp_count} employees",
                    "metrics": {"employees": emp_count},
                }
        except Exception as e:
            return {"success": False, "error": f"Failed to load metrics: {e}"}

    # ------------------------------------------------------------------
    # send_invite -- SES email + create pending user
    # ------------------------------------------------------------------
    if action == "send_invite":
        invite_email = (params.get("email") or "").strip().lower()
        invite_role = (params.get("role") or "EMPLOYEE").upper()
        target_tenant = params.get("tenant_id", tenant_id)

        if not invite_email:
            return {"success": False, "error": "Email address is required for invitation"}

        # HR_ADMIN scoped to own tenant
        if role == "HR_ADMIN":
            target_tenant = tenant_id
            invite_role = "EMPLOYEE"

        # Create pending user record
        new_user_id = f"usr-{uuid.uuid4().hex[:12]}"
        try:
            USERS_T.put_item(Item={
                "userId": new_user_id,
                "tenantId": target_tenant,
                "email": invite_email,
                "role": invite_role,
                "status": "pending",
                "createdAt": now,
                "createdBy": email,
                "invitedBy": email,
            })
        except Exception as e:
            print(f"INVITE_USER_CREATE_ERROR: {e}")
            return {"success": False, "error": f"Failed to create pending user: {e}"}

        # Send invitation email via SES
        activation_link = f"https://uat.endevo.life/activate?token={new_user_id}"
        try:
            ses.send_email(
                Source="noreply@endevo.life",
                Destination={"ToAddresses": [invite_email]},
                Message={
                    "Subject": {"Data": "You're invited to Endevo Life", "Charset": "UTF-8"},
                    "Body": {
                        "Html": {
                            "Data": (
                                f"<h2>Welcome to Endevo Life!</h2>"
                                f"<p>You've been invited to join the platform.</p>"
                                f"<p><a href='{activation_link}'>Click here to activate your account</a></p>"
                                f"<p>If you didn't expect this invitation, you can safely ignore this email.</p>"
                                f"<br><p>-- The Endevo Life Team</p>"
                            ),
                            "Charset": "UTF-8",
                        },
                    },
                },
            )
            return {
                "success": True,
                "message": f"Invitation sent to {invite_email}. They will receive an onboarding email shortly.",
                "userId": new_user_id,
            }
        except Exception as e:
            print(f"SES_SEND_ERROR: {e}")
            # User was created as pending even if email fails
            return {
                "success": True,
                "message": f"User {invite_email} created as pending. Email delivery failed (SES may not be configured). They can still activate manually.",
                "userId": new_user_id,
                "emailError": str(e),
            }

    # ------------------------------------------------------------------
    # export_data -- export tenant or employee data as JSON
    # ------------------------------------------------------------------
    if action == "export_data":
        export_type = (params.get("type") or "employees").lower()
        target_tenant = params.get("tenant_id", tenant_id)

        try:
            if export_type == "tenants":
                result = TENANTS_T.scan(Limit=200)
                items = result.get("Items", [])
                data = [
                    {
                        "tenantId": t.get("tenantId"),
                        "name": t.get("name"),
                        "plan": t.get("plan"),
                        "status": t.get("status"),
                        "domain": t.get("domain", ""),
                        "createdAt": t.get("createdAt", ""),
                    }
                    for t in items
                ]
                return {
                    "success": True,
                    "message": f"Exported {len(data)} tenant(s)",
                    "data": data,
                    "type": "tenants",
                }
            else:
                # Export employees (scoped to tenant for HR_ADMIN)
                if role == "HR_ADMIN":
                    target_tenant = tenant_id
                result = USERS_T.scan(
                    FilterExpression=_Attr("tenantId").eq(target_tenant) & _Attr("role").eq("EMPLOYEE"),
                    Limit=500,
                )
                items = result.get("Items", [])
                data = [
                    {
                        "userId": u.get("userId"),
                        "email": u.get("email"),
                        "firstName": u.get("firstName", ""),
                        "lastName": u.get("lastName", ""),
                        "plan": u.get("plan", "basic"),
                        "status": u.get("status", ""),
                        "createdAt": u.get("createdAt", ""),
                    }
                    for u in items
                ]
                return {
                    "success": True,
                    "message": f"Exported {len(data)} employee(s) from {target_tenant}",
                    "data": data,
                    "type": "employees",
                }
        except Exception as e:
            return {"success": False, "error": f"Failed to export data: {e}"}

    # ------------------------------------------------------------------
    # view_system_status -- system health check
    # ------------------------------------------------------------------
    if action == "view_system_status":
        table_names = [
            "endevo-uat-users", "endevo-uat-tenants", "endevo-uat-responses",
            "endevo-uat-jesse-chat", "endevo-uat-config", "endevo-uat-knowledge-base",
            "endevo-uat-sessions", "endevo-uat-certificates",
        ]
        dynamo_client = boto3.client("dynamodb", region_name=REGION)
        table_statuses = {}
        healthy_count = 0
        for tbl in table_names:
            try:
                desc = dynamo_client.describe_table(TableName=tbl)
                status = desc["Table"]["TableStatus"]
                table_statuses[tbl] = status
                if status == "ACTIVE":
                    healthy_count += 1
            except Exception:
                table_statuses[tbl] = "NOT_FOUND"

        overall_status = "healthy" if healthy_count == len(table_names) else "degraded"
        return {
            "success": True,
            "message": f"System status: {overall_status}. {healthy_count}/{len(table_names)} tables active.",
            "status": {
                "overall": overall_status,
                "api": "healthy",
                "database": f"{healthy_count}/{len(table_names)} tables active",
                "ai": "healthy",
                "tables": table_statuses,
                "timestamp": now,
            },
        }

    # ------------------------------------------------------------------
    # manage_mfa -- toggle MFA for a tenant
    # ------------------------------------------------------------------
    if action == "manage_mfa":
        target_tenant = params.get("tenant_id", params.get("tenantId", tenant_id))
        mfa_enabled = params.get("enabled", params.get("mfaRequired", False))
        try:
            TENANTS_T.update_item(
                Key={"tenantId": target_tenant},
                UpdateExpression="SET mfaRequired = :mfa, updatedAt = :now, updatedBy = :by",
                ExpressionAttributeValues={":mfa": mfa_enabled, ":now": now, ":by": email},
            )
            status = "required" if mfa_enabled else "optional"
            return {"success": True, "message": f"MFA is now {status} for tenant {target_tenant}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to update MFA setting: {e}"}

    # ------------------------------------------------------------------
    # book_session -- book a coaching session
    # ------------------------------------------------------------------
    if action == "book_session":
        emp_id = (params.get("employee_id") or params.get("email") or "").strip()
        session_date = (params.get("date") or "").strip()
        session_time = (params.get("time") or "").strip()
        session_type = params.get("type", "1:1 coaching")

        if not emp_id:
            return {"success": False, "error": "Employee ID or email is required to book a session"}

        session_id = f"sess-{uuid.uuid4().hex[:12]}"
        try:
            SESSIONS_T.put_item(Item={
                "sessionId": session_id,
                "tenantId": tenant_id,
                "employeeId": emp_id,
                "sessionType": session_type,
                "date": session_date,
                "time": session_time,
                "status": "scheduled",
                "bookedBy": email,
                "createdAt": now,
            })
            date_str = f" on {session_date}" if session_date else ""
            time_str = f" at {session_time}" if session_time else ""
            return {
                "success": True,
                "message": f"Session ({session_type}) booked for {emp_id}{date_str}{time_str}.",
                "sessionId": session_id,
            }
        except Exception as e:
            print(f"SESSION_BOOK_ERROR: {e}")
            return {"success": False, "error": f"Failed to book session: {e}"}

    # ------------------------------------------------------------------
    # view_certificates -- get user's certificates
    # ------------------------------------------------------------------
    if action == "view_certificates":
        target_user = params.get("user_id", user_id)
        try:
            result = CERTIFICATES_T.query(
                KeyConditionExpression=_Key("userId").eq(target_user),
            )
            items = result.get("Items", [])
            if not items:
                return {
                    "success": True,
                    "message": "No certificates earned yet. Complete LMS modules to earn certificates. Keep learning!",
                    "certificates": [],
                }
            certs = [
                {
                    "certificateId": c.get("certificateId", ""),
                    "moduleName": c.get("moduleName", ""),
                    "earnedAt": c.get("earnedAt", ""),
                    "score": c.get("score", ""),
                }
                for c in items
            ]
            return {
                "success": True,
                "message": f"You have earned {len(certs)} certificate(s). Great work!",
                "certificates": certs,
            }
        except Exception as e:
            print(f"CERTIFICATES_ERROR: {e}")
            return {
                "success": True,
                "message": "Certificate tracking will be available once you complete LMS modules. Keep learning!",
                "certificates": [],
            }

    # ------------------------------------------------------------------
    # contact_hr -- get HR contact info for user's tenant
    # ------------------------------------------------------------------
    if action == "contact_hr":
        try:
            tenant = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item", {})
            hr_email = tenant.get("hrEmail", "")
            hr_contact = tenant.get("hrContact", "")
            tenant_name = tenant.get("name", "")

            if not hr_email and not hr_contact:
                # Fall back: find HR_ADMIN user for this tenant
                hr_result = USERS_T.scan(
                    FilterExpression=_Attr("tenantId").eq(tenant_id) & _Attr("role").eq("HR_ADMIN"),
                    Limit=1,
                )
                hr_items = hr_result.get("Items", [])
                if hr_items:
                    hr_email = hr_items[0].get("email", "")
                    hr_contact = f"{hr_items[0].get('firstName', '')} {hr_items[0].get('lastName', '')}".strip()

            if not hr_email and not hr_contact:
                return {"success": True, "message": f"HR contact for {tenant_name or tenant_id} is not configured. Please ask your administrator."}

            return {
                "success": True,
                "message": f"HR contact for {tenant_name}: {hr_contact or hr_email}",
                "hrEmail": hr_email,
                "hrContact": hr_contact,
                "tenantName": tenant_name,
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to look up HR contact: {e}"}

    # ------------------------------------------------------------------
    # view_tenant_info
    # ------------------------------------------------------------------
    if action == "view_tenant_info":
        target = params.get("tenantId", tenant_id)
        if role == "HR_ADMIN":
            target = tenant_id
        try:
            tenant = TENANTS_T.get_item(Key={"tenantId": target}).get("Item", {})
            if not tenant:
                return {"success": False, "error": "Tenant not found"}
            return {
                "success": True,
                "message": f"Tenant: {tenant.get('name', target)} ({tenant.get('plan', 'basic')} plan)",
                "tenant": {
                    "tenantId": tenant.get("tenantId"),
                    "name": tenant.get("name"),
                    "plan": tenant.get("plan"),
                    "status": tenant.get("status"),
                    "domain": tenant.get("domain", ""),
                },
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to load tenant info: {e}"}

    # ------------------------------------------------------------------
    # view_progress
    # ------------------------------------------------------------------
    if action == "view_progress":
        try:
            result = RESPONSES_T.scan(
                FilterExpression=_Attr("userId").eq(user_id) & _Attr("type").eq("jesse-assessment")
            )
            items = result.get("Items", [])
            if not items:
                return {"success": True, "message": "No assessment completed yet. Take the Peace of Mind Assessment to get started."}
            latest = max(items, key=lambda r: r.get("submittedAt", ""))
            return {
                "success": True,
                "message": f"Your readiness score: {latest.get('readinessScore', 0)}% ({latest.get('tier', 'Unknown')})",
                "progress": {
                    "score": latest.get("readinessScore", 0),
                    "tier": latest.get("tier", ""),
                    "domainScores": latest.get("domainScores", {}),
                    "lowestDomain": latest.get("lowestDomain", ""),
                },
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to load progress: {e}"}

    # ------------------------------------------------------------------
    # view_subscription
    # ------------------------------------------------------------------
    if action == "view_subscription":
        try:
            user_resp = USERS_T.query(
                IndexName="email-index",
                KeyConditionExpression=_Key("email").eq(email),
                Limit=1,
            )
            user_items = user_resp.get("Items", [])
            user_plan = user_items[0].get("plan", "basic") if user_items else "basic"

            tenant = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item", {})
            tenant_plan = tenant.get("plan", "basic")

            effective_plan = "premium" if user_plan == "premium" or tenant_plan == "premium" else "basic"
            return {
                "success": True,
                "message": f"You are on the {effective_plan} plan. Jesse AI is available on all plans.",
                "subscription": {"plan": effective_plan, "userPlan": user_plan, "tenantPlan": tenant_plan},
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to load subscription: {e}"}

    # ------------------------------------------------------------------
    # toggle_feature
    # ------------------------------------------------------------------
    if action == "toggle_feature":
        feature = (params.get("feature") or "").strip()
        enabled = params.get("enabled", True)
        if not feature:
            return {"success": False, "error": "Feature name is required"}

        try:
            CONFIG_T.put_item(Item={
                "configKey": f"feature:{feature}",
                "enabled": enabled,
                "updatedAt": now,
                "updatedBy": email,
            })
            status = "enabled" if enabled else "disabled"
            return {"success": True, "message": f"Feature '{feature}' is now {status}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to toggle feature: {e}"}

    return {"success": False, "error": f"Unknown action: {action}"}


def _build_actions_prompt(role: str) -> str:
    """Build the available-actions section for the copilot system prompt."""
    available = ROLE_ACTIONS.get(role, {})
    if not available:
        return ""

    lines = [
        "",
        "## Action Execution",
        "You can execute actions on behalf of the user. When the user asks you to DO something (not just explain), respond with:",
        "1. First confirm what you'll do (unless the intent is very clear and straightforward).",
        "2. Include an ACTION block in your response:",
        "",
        "[ACTION:action_name|{\"param\":\"value\"}]",
        "",
        "You can include multiple ACTION blocks for batch operations.",
        "When executing, say something like: \"Working on it...\" or \"Done!\"",
        "",
        "IMPORTANT RULES FOR ACTIONS:",
        "- NEVER execute destructive actions (delete, disable, remove) through ACTION blocks",
        "- NEVER include secrets, API keys, or internal system details in ACTION params",
        "- For batch operations (e.g. create 5 employees), use one ACTION block per item",
        "- If unsure about parameters, ASK the user first instead of guessing",
        "",
        "## Available Actions for your role:",
    ]
    for action_name in sorted(available.keys()):
        desc = ACTION_DESCRIPTIONS.get(action_name, action_name)
        lines.append(f"- **{action_name}**: {desc}")

    return "\n".join(lines)


_ACTION_PATTERN = re.compile(r'\[ACTION:(\w+)\|(\{.*?\})\]', re.DOTALL)


# ---------------------------------------------------------------------------
# Copilot helpers
# ---------------------------------------------------------------------------
def _load_copilot_stats(role: str, tenant_id: str, user_id: str) -> str:
    """Load lightweight stats for copilot context based on role."""
    try:
        from boto3.dynamodb.conditions import Attr as _Attr

        if role == "GLOBAL_ADMIN":
            tenants_resp = TENANTS_T.scan(Select="COUNT")
            tenant_count = tenants_resp.get("Count", 0)
            users_resp = USERS_T.scan(Select="COUNT")
            user_count = users_resp.get("Count", 0)
            return f"Platform stats: {tenant_count} tenants, {user_count} total users."

        if role == "HR_ADMIN":
            users_resp = USERS_T.scan(
                FilterExpression=_Attr("tenantId").eq(tenant_id),
                Select="COUNT",
            )
            emp_count = users_resp.get("Count", 0)
            tenant_resp = TENANTS_T.get_item(Key={"tenantId": tenant_id})
            tenant_item = tenant_resp.get("Item", {})
            plan = tenant_item.get("plan", "basic")
            return f"Tenant stats: {emp_count} employees, {plan} plan."

        if role == "EMPLOYEE":
            resp_data = RESPONSES_T.scan(
                FilterExpression=_Attr("userId").eq(user_id)
                & _Attr("type").eq("jesse-assessment"),
                Select="COUNT",
            )
            has_assessment = resp_data.get("Count", 0) > 0
            status = "completed" if has_assessment else "not started"
            return f"Assessment status: {status}."
    except Exception as e:
        print(f"COPILOT_STATS_ERROR: {e}")
    return ""


def _get_user_role(tenant_id: str, email: str) -> str:
    """Look up user role from USERS_T. Returns GLOBAL_ADMIN, HR_ADMIN, or EMPLOYEE."""
    try:
        from boto3.dynamodb.conditions import Key as _Key

        result = USERS_T.query(
            IndexName="email-index",
            KeyConditionExpression=_Key("email").eq(email),
            Limit=1,
        )
        items = result.get("Items", [])
        if items:
            return items[0].get("role", "EMPLOYEE")
    except Exception as e:
        print(f"COPILOT_ROLE_LOOKUP_ERROR: {e}")
    return "EMPLOYEE"


def _get_tenant_name(tenant_id: str) -> str:
    """Look up tenant name from TENANTS_T."""
    try:
        result = TENANTS_T.get_item(Key={"tenantId": tenant_id})
        item = result.get("Item", {})
        return item.get("name", "")
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Copilot: Unified AI endpoint (chat + RAG + actions + history)
# ---------------------------------------------------------------------------
def _handle_copilot(body: dict, tenant_id: str, email: str, user_id: str) -> dict:
    """Handle POST /api/jesse/copilot -- unified Jesse AI with chat persistence,
    RAG knowledge retrieval, conversation context, and action execution."""
    message = (body.get("message") or "").strip()
    if not message:
        return err(400, "message is required")
    if len(message) > 5000:
        return err(400, "message too long (max 5000 characters)")

    ctx = body.get("context", {})
    page = ctx.get("page", "/unknown")

    # Determine role: verify against DB, fall back to client hint
    client_role = ctx.get("role", "")
    db_role = _get_user_role(tenant_id, email)
    role = db_role if db_role else (client_role or "EMPLOYEE")

    # --- 1. Save user message to chat history (copilot source) ---
    _save_chat_message(user_id, "user", message, source="copilot")

    # --- 2. Build context ---
    stats_context = _load_copilot_stats(role, tenant_id, user_id)
    tenant_name = _get_tenant_name(tenant_id) if role == "HR_ADMIN" else ""
    actions_prompt = _build_actions_prompt(role)

    # --- 3. RAG knowledge retrieval (dual source, same as /chat) ---
    kb_context = _retrieve_from_knowledge_base(message, top_k=3)
    dynamo_context = _search_knowledge_base(message, top_k=3)
    knowledge_context = "\n\n---\n\n".join(
        part for part in [kb_context, dynamo_context] if part
    )

    # --- 4. Load POMA context for employees ---
    poma_context = ""
    if role == "EMPLOYEE":
        poma_context = _load_poma_context(user_id)

    # --- 5. Build role-specific system prompt ---
    prompt_template = COPILOT_PROMPTS.get(role, COPILOT_PROMPTS["EMPLOYEE"])
    system_prompt = prompt_template.format(
        page=page,
        stats_context=stats_context,
        tenant_name=tenant_name,
        actions_prompt=actions_prompt,
    )

    # Append knowledge context if available
    if knowledge_context:
        system_prompt += (
            "\n\n--- ENDevo Knowledge Base ---\n"
            + knowledge_context
            + "\n"
        )

    # Append POMA context for employees
    if poma_context:
        system_prompt += (
            "\n--- User's Peace of Mind Assessment (POMA) Results ---\n"
            + poma_context
            + "\nUse these results to personalise your guidance.\n"
        )

    # --- 6. Load last 10 copilot messages as conversation context ---
    history = _get_chat_history(user_id, limit=MAX_CHAT_HISTORY, source="copilot")
    claude_messages = [
        {"role": m["role"], "content": m["content"]} for m in history
    ]
    # Ensure the new message is included if not already in history
    if not claude_messages or claude_messages[-1].get("content") != message:
        claude_messages.append({"role": "user", "content": message})

    # --- 7. Call Claude ---
    reply = invoke_claude(system_prompt, claude_messages, max_tokens=1024)

    # --- 8. Parse and execute ACTION blocks from Claude's response ---
    actions_executed: list[dict] = []
    matches = _ACTION_PATTERN.findall(reply)
    for action_name, params_json in matches:
        try:
            params = json.loads(params_json)
        except json.JSONDecodeError:
            actions_executed.append({
                "action": action_name,
                "result": {"success": False, "error": "Invalid action parameters"},
            })
            continue
        result = _execute_action(action_name, params, role, tenant_id, email, user_id)
        if result.get("success"):
            _log_jesse_action(tenant_id, email, action_name, params, result)
        actions_executed.append({"action": action_name, "result": result})

    # Remove ACTION blocks from the displayed reply
    clean_reply = _ACTION_PATTERN.sub("", reply).strip()

    # --- 9. Save assistant reply to chat history ---
    action_meta = {"actions": [a["action"] for a in actions_executed]} if actions_executed else None
    _save_chat_message(user_id, "assistant", clean_reply, metadata=action_meta, source="copilot")

    # --- 10. Prune old messages ---
    _prune_chat_history(user_id)

    return resp(200, {
        "reply": clean_reply,
        "actions": actions_executed,
        "role": role,
    })


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

    # GET /api/jesse/access -- always returns hasAccess=true (Jesse is for all plans)
    if path.endswith("/access") and method == "GET":
        return resp(200, {
            "hasAccess": True,
            "plan": "all",
        })

    # POST /api/jesse/copilot -- Unified AI endpoint (chat + RAG + actions)
    if path.endswith("/copilot") and not path.endswith("/copilot/history") and method == "POST":
        return _handle_copilot(body, tenant_id, email, user_id)

    # GET /api/jesse/copilot/history -- copilot message history
    if path.endswith("/copilot/history") and method == "GET":
        history = _get_chat_history(user_id, limit=MAX_CHAT_HISTORY, source="copilot")
        return resp(200, {"history": history, "count": len(history)})

    # POST /api/jesse/speak -- Text-to-speech via Amazon Polly (all plans)
    if path.endswith("/speak") and method == "POST":
        text = (body.get("text") or "").strip()
        if not text:
            return err(400, "text is required")
        if len(text) > 3000:
            return err(400, "text too long (max 3000 chars)")

        voice_pref = body.get("voice", "female").lower()
        voice_id = VOICE_MAP.get(voice_pref, "Joanna")

        try:
            import base64

            polly_response = polly.synthesize_speech(
                Text=text,
                OutputFormat="mp3",
                VoiceId=voice_id,
                Engine="neural",
            )
            audio_stream = polly_response["AudioStream"].read()
            audio_b64 = base64.b64encode(audio_stream).decode("utf-8")
            return resp(200, {"audioUrl": f"data:audio/mp3;base64,{audio_b64}", "voice": voice_pref})
        except Exception as e:
            print(f"POLLY_ERROR: {e}")
            return resp(200, {"audioUrl": None, "error": "Voice synthesis unavailable", "voice": voice_pref})

    # POST /api/jesse/chat (no premium gate -- available to all plans)
    if path.endswith("/chat") and not path.endswith("/chat/history") and not path.endswith("/chat/reset") and method == "POST":
        message = (body.get("message") or "").strip()
        if not message:
            return err(400, "message is required")
        if len(message) > 5000:
            return err(400, "message too long (max 5000 characters)")

        # 1. Save user message
        _save_chat_message(user_id, "user", message, source="chat")

        # 2. Load POMA context
        poma_context = _load_poma_context(user_id)

        # 3. Search knowledge base (RAG -- dual source)
        kb_context = _retrieve_from_knowledge_base(message, top_k=3)
        dynamo_context = _search_knowledge_base(message, top_k=3)
        knowledge_context = "\n\n---\n\n".join(
            part for part in [kb_context, dynamo_context] if part
        )

        # 4. Build system prompt
        system_prompt = _build_system_prompt(poma_context, knowledge_context)

        # 5. Load chat history for context
        history = _get_chat_history(user_id, source="chat")
        claude_messages = [
            {"role": m["role"], "content": m["content"]} for m in history
        ]
        # Ensure the new message is included if not already in history
        if not claude_messages or claude_messages[-1].get("content") != message:
            claude_messages.append({"role": "user", "content": message})

        # 6. Call Claude
        reply = invoke_claude(system_prompt, claude_messages)

        # 7. Save assistant reply
        _save_chat_message(user_id, "assistant", reply, source="chat")

        # 8. Prune old messages
        _prune_chat_history(user_id)

        # 9. Return updated history
        updated_history = _get_chat_history(user_id, source="chat")
        return resp(200, {
            "reply": reply,
            "history": updated_history,
        })

    # GET /api/jesse/chat/history (no premium gate)
    if path.endswith("/chat/history") and method == "GET":
        history = _get_chat_history(user_id, source="chat")
        return resp(200, {"history": history, "count": len(history)})

    # DELETE /api/jesse/chat/reset (no premium gate)
    if path.endswith("/chat/reset") and method == "DELETE":
        deleted = _clear_chat_history(user_id)
        return resp(200, {"message": "Chat history cleared", "deleted": deleted})

    # POST /api/jesse/assess (no premium gate)
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

    # GET /api/jesse/plan/{userId} (no premium gate)
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
