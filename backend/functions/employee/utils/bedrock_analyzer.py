"""
Bedrock AI Analyzer — Assessment Analysis + Playbook Generation
Uses Amazon Nova Lite for creative personalization, Nova Micro for fast analysis
Nova Micro: ~407ms TTFT, $0.035/$0.14 per 1M input/output tokens
Nova Lite: Multimodal, $0.06/$0.24 per 1M input/output tokens
"""
import json
import boto3
from typing import Dict, List
from datetime import datetime

bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")

# Domain definitions (4 domains: Legal, Financial, Physical, Digital)
DOMAINS = {
    "legal": {"label": "Legal & Compliance", "color": "#1f77b4", "icon": "⚖️"},
    "financial": {"label": "Financial Planning", "color": "#ff7f0e", "icon": "💰"},
    "physical": {"label": "Physical Health", "color": "#2ca02c", "icon": "❤️"},
    "digital": {"label": "Digital Assets", "color": "#d62728", "icon": "🔐"},
}

QUESTIONS_PER_DOMAIN = 10  # 40 total questions ÷ 4 domains


def _call_nova_micro(prompt: str, max_tokens: int = 1000) -> str:
    """Call Amazon Nova Micro (fastest, cheapest) for pattern analysis."""
    try:
        response = bedrock_runtime.invoke_model(
            modelId="amazon.nova-micro-v1:0",
            body=json.dumps({
                "schemaVersion": "messages-v1",
                "messages": [{"role": "user", "content": prompt}],
                "maxTokens": max_tokens,
            })
        )
        result = json.loads(response["body"].read())
        return result["output"]["message"]["content"][0]["text"]
    except Exception as e:
        print(f"BEDROCK_NOVA_MICRO_ERROR: {e}")
        return ""


def _call_nova_lite(prompt: str, max_tokens: int = 2000) -> str:
    """Call Amazon Nova Lite (balanced) for creative personalization."""
    try:
        response = bedrock_runtime.invoke_model(
            modelId="amazon.nova-lite-v1:0",
            body=json.dumps({
                "schemaVersion": "messages-v1",
                "messages": [{"role": "user", "content": prompt}],
                "maxTokens": max_tokens,
            })
        )
        result = json.loads(response["body"].read())
        return result["output"]["message"]["content"][0]["text"]
    except Exception as e:
        print(f"BEDROCK_NOVA_LITE_ERROR: {e}")
        return ""


def analyze_assessment(answers: Dict[str, str], questions: List[Dict]) -> Dict:
    """
    Analyze 40-question assessment answers by domain.
    Returns domain scores, weak areas, and overall readiness.

    Args:
        answers: Dict mapping questionId → selectedAnswer
        questions: List of question objects with questionId, domain, correctAnswer

    Returns:
        {
            "overallScore": 75,
            "domainScores": {"legal": 80, "financial": 70, ...},
            "weakDomains": ["financial", "digital"],
            "strengths": ["legal"],
            "analysis": "Based on your answers...",
            "recommendations": "Focus on financial planning...",
        }
    """
    # Score by domain
    domain_scores = {d: {"correct": 0, "total": 0} for d in DOMAINS.keys()}

    for q in questions:
        domain = q.get("domain", "").lower()
        if domain not in domain_scores:
            continue

        domain_scores[domain]["total"] += 1
        if answers.get(q.get("questionId")) == q.get("correctAnswer"):
            domain_scores[domain]["correct"] += 1

    # Calculate percentages
    domain_percentages = {}
    all_scores = []
    for domain, score in domain_scores.items():
        pct = (score["correct"] / score["total"] * 100) if score["total"] > 0 else 0
        domain_percentages[domain] = round(pct)
        all_scores.append(pct)

    overall_score = round(sum(all_scores) / len(all_scores)) if all_scores else 0

    # Identify weak/strong domains (< 70 is weak, >= 80 is strong)
    weak_domains = [d for d, s in domain_percentages.items() if s < 70]
    strong_domains = [d for d, s in domain_percentages.items() if s >= 80]

    # Use Haiku for quick pattern analysis
    analysis_prompt = f"""
    An employee completed a 40-question readiness assessment. Here are their scores by domain:
    - Legal: {domain_percentages.get('legal', 0)}%
    - Financial: {domain_percentages.get('financial', 0)}%
    - Physical: {domain_percentages.get('physical', 0)}%
    - Digital: {domain_percentages.get('digital', 0)}%

    Overall Score: {overall_score}%

    Weak areas (< 70%): {', '.join([DOMAINS[d]['label'] for d in weak_domains]) or 'None'}
    Strong areas (>= 80%): {', '.join([DOMAINS[d]['label'] for d in strong_domains]) or 'None'}

    Write a 2-sentence professional analysis of their readiness level. Be encouraging but honest.
    """

    analysis = _call_nova_micro(analysis_prompt, max_tokens=300)

    return {
        "overallScore": overall_score,
        "domainScores": domain_percentages,
        "weakDomains": weak_domains,
        "strongDomains": strong_domains,
        "analysis": analysis,
        "timestamp": datetime.utcnow().isoformat(),
    }


def generate_playbook(user_name: str, domain_scores: Dict[str, int], weak_domains: List[str]) -> Dict:
    """
    Generate a personalized My Playbook with AI-driven recommendations.
    Uses Sonnet 4.6 for creative, personalized text.

    Returns:
        {
            "title": "Your Personal Legacy Playbook",
            "subtitle": "Based on your assessment results...",
            "overview": "Personalized text...",
            "tasks": [
                {
                    "rank": 1,
                    "domain": "financial",
                    "title": "Create Estate Inventory",
                    "description": "List all assets...",
                    "priority": "high",
                    "estimatedHours": 2,
                }
            ],
            "nextSteps": "Here's what we recommend...",
        }
    """

    weak_areas = ", ".join([DOMAINS[d]["label"] for d in weak_domains]) or "general readiness"
    strong_areas = ", ".join([d for d in domain_scores if domain_scores[d] >= 80])

    playbook_prompt = f"""
    Generate a personalized "My Playbook" (action plan) for {user_name}.

    Assessment Results:
    - Overall Score: {sum(domain_scores.values()) // len(domain_scores)}%
    - Domain Scores: {json.dumps(domain_scores)}
    - Weak Areas: {weak_areas}
    - Strong Areas: {strong_areas or "Still developing"}

    Create a JSON response with EXACTLY this structure (no markdown, pure JSON):
    {{
        "title": "Your Personal Legacy Playbook",
        "subtitle": "Customized for [name]",
        "overview": "A 2-3 sentence personalized overview of their playbook",
        "nextSteps": "2-3 sentence recommendation on immediate next steps"
    }}

    Make it:
    - Personal (use their name, reference their specific weak areas)
    - Encouraging (acknowledge strengths, frame weaknesses as opportunities)
    - Actionable (focus on concrete next steps)
    - Professional (suitable for an employee in a corporate environment)

    Return ONLY valid JSON, no extra text.
    """

    playbook_json = _call_nova_lite(playbook_prompt, max_tokens=500)

    try:
        playbook = json.loads(playbook_json)
    except json.JSONDecodeError:
        # Fallback if Sonnet returns non-JSON
        playbook = {
            "title": "Your Personal Legacy Playbook",
            "subtitle": f"Customized for {user_name}",
            "overview": "Complete your personalized action plan based on your assessment results.",
            "nextSteps": "Start with the tasks highlighted as 'High Priority' in your checklist."
        }

    # Generate task list (prioritized by domain weakness)
    tasks = _generate_task_list(weak_domains, domain_scores)

    return {
        **playbook,
        "tasks": tasks,
        "generatedAt": datetime.utcnow().isoformat(),
    }


def _generate_task_list(weak_domains: List[str], domain_scores: Dict[str, int]) -> List[Dict]:
    """
    Generate a prioritized task list based on weak domains.
    Weak domains first, then build on strengths.
    """
    TASK_TEMPLATES = {
        "legal": [
            {"title": "Create or Update Your Will", "estimatedHours": 3, "resources": "Attorney consultation or online legal service"},
            {"title": "Document Executor/Guardian Information", "estimatedHours": 1, "resources": "Create a document with roles and contacts"},
            {"title": "Review Beneficiary Designations", "estimatedHours": 2, "resources": "Contact financial institutions"},
        ],
        "financial": [
            {"title": "Inventory All Financial Accounts", "estimatedHours": 2, "resources": "Bank statements, investment accounts"},
            {"title": "Document Passwords & Access Methods", "estimatedHours": 1, "resources": "Password manager or secure vault"},
            {"title": "Review Insurance Coverage", "estimatedHours": 2, "resources": "Insurance policies and statements"},
        ],
        "physical": [
            {"title": "Complete Health & Medical Directives", "estimatedHours": 2, "resources": "Healthcare provider consultation"},
            {"title": "Document Medical History", "estimatedHours": 1, "resources": "Medical records and healthcare providers"},
            {"title": "Review Emergency Contacts", "estimatedHours": 1, "resources": "Update family and healthcare providers"},
        ],
        "digital": [
            {"title": "Audit Your Digital Assets", "estimatedHours": 2, "resources": "Email, social media, subscriptions"},
            {"title": "Document Digital Access Instructions", "estimatedHours": 1, "resources": "Password manager, secure notes"},
            {"title": "Plan for Digital Legacy", "estimatedHours": 1, "resources": "Review digital asset management services"},
        ],
    }

    tasks = []
    rank = 1

    # First, add tasks from weak domains
    for domain in weak_domains:
        templates = TASK_TEMPLATES.get(domain, [])
        for template in templates[:2]:  # Top 2 tasks per weak domain
            tasks.append({
                "rank": rank,
                "domain": domain,
                "domainLabel": DOMAINS[domain]["label"],
                "title": template["title"],
                "description": f"Complete your {DOMAINS[domain]['label']} planning. {template.get('resources', '')}",
                "priority": "high",
                "estimatedHours": template["estimatedHours"],
                "status": "pending",
            })
            rank += 1

    # Then add tasks from other domains (to build comprehensive plan)
    for domain in DOMAINS.keys():
        if domain not in weak_domains:
            templates = TASK_TEMPLATES.get(domain, [])
            task = templates[0] if templates else {"title": f"Complete {DOMAINS[domain]['label']}", "estimatedHours": 2, "resources": ""}
            tasks.append({
                "rank": rank,
                "domain": domain,
                "domainLabel": DOMAINS[domain]["label"],
                "title": task["title"],
                "description": f"Strengthen your {DOMAINS[domain]['label']} plan. {task.get('resources', '')}",
                "priority": "medium",
                "estimatedHours": task["estimatedHours"],
                "status": "pending",
            })
            rank += 1

    return tasks[:10]  # Limit to 10 top-priority tasks


def generate_email_content(user_name: str, overall_score: int, domain_scores: Dict[str, int], tasks: List[Dict]) -> Dict:
    """
    Generate personalized email content with subject, body, and recommendations.
    Used by the email feature (Feature 2).
    """

    weak_areas = [DOMAINS[d]["label"] for d in domain_scores if domain_scores[d] < 70]

    email_prompt = f"""
    Generate a professional, personalized email for {user_name} with their assessment results.

    Results:
    - Overall Score: {overall_score}%
    - Weak Areas: {', '.join(weak_areas) or 'All areas solid'}
    - Top Task: {tasks[0]['title'] if tasks else 'Start planning'}

    Return ONLY valid JSON with NO extra text:
    {{
        "subject": "Your Legacy Readiness Assessment Results",
        "greeting": "Hi [name]",
        "body": "2-3 paragraphs of personalized feedback",
        "recommendation": "What to do next (1 paragraph)"
    }}

    Make it:
    - Warm and encouraging
    - Specific to their scores
    - Action-oriented
    - Professional corporate tone
    """

    email_json = _call_nova_lite(email_prompt, max_tokens=800)

    try:
        email_content = json.loads(email_json)
    except json.JSONDecodeError:
        email_content = {
            "subject": "Your Legacy Readiness Assessment Results",
            "greeting": f"Hi {user_name}",
            "body": f"Thank you for completing your readiness assessment. Your overall score of {overall_score}% shows you're making progress toward full legacy readiness. Review your domain scores to identify areas for focus.",
            "recommendation": "Start with the high-priority tasks in your personalized playbook."
        }

    return email_content
