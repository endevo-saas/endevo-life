"""
Checklist Management — Track task progress, personalization, and milestone celebrations
Uses Amazon Nova Micro for task guidance generation
"""
import json
import boto3
from typing import Dict, List
from datetime import datetime

bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")


def _call_nova_micro(prompt: str, max_tokens: int = 300) -> str:
    """Call Amazon Nova Micro for quick guidance."""
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


def generate_task_guidance(task_title: str, domain: str) -> str:
    """
    Generate AI guidance for a specific task.

    Args:
        task_title: Task name
        domain: Domain (legal, financial, physical, digital)

    Returns:
        Guidance text (1-2 paragraphs)
    """
    guidance_prompt = f"""Provide concise, actionable guidance for this legacy planning task:

Task: {task_title}
Domain: {domain}

Give practical, step-by-step guidance in 1-2 sentences. Be encouraging and specific."""

    return _call_nova_micro(guidance_prompt, max_tokens=200)


def generate_milestone_message(domain: str, progress_pct: int, user_name: str = "You") -> str:
    """
    Generate celebratory message for milestone completion.

    Args:
        domain: Completed domain
        progress_pct: Overall progress percentage
        user_name: User's name

    Returns:
        Celebratory message
    """
    milestone_prompt = f"""{user_name} just completed a task in {domain}!
Overall progress: {progress_pct}%

Generate a warm, encouraging 1-sentence celebration message."""

    return _call_nova_micro(milestone_prompt, max_tokens=100)


def calculate_domain_progress(tasks: List[Dict]) -> Dict[str, float]:
    """
    Calculate completion percentage per domain.

    Args:
        tasks: List of tasks with domain and status

    Returns:
        {"domain": percentage_complete, ...}
    """
    domain_stats = {}

    for task in tasks:
        domain = task.get("domain", "other")
        status = task.get("status", "pending")

        if domain not in domain_stats:
            domain_stats[domain] = {"total": 0, "completed": 0}

        domain_stats[domain]["total"] += 1
        if status == "completed":
            domain_stats[domain]["completed"] += 1

    domain_progress = {}
    for domain, stats in domain_stats.items():
        pct = (stats["completed"] / stats["total"] * 100) if stats["total"] > 0 else 0
        domain_progress[domain] = round(pct)

    return domain_progress


def generate_progress_email(
    user_name: str,
    tasks_completed: int,
    total_tasks: int,
    domain_progress: Dict[str, int],
    weak_domains: List[str]
) -> Dict:
    """
    Generate weekly progress summary email.

    Returns:
        {"subject": "...", "body": "..."}
    """
    progress_pct = round((tasks_completed / total_tasks * 100)) if total_tasks > 0 else 0
    next_focus = weak_domains[0] if weak_domains else "overall planning"

    email_prompt = f"""Generate a weekly progress email for {user_name}.

Progress:
- Tasks completed: {tasks_completed}/{total_tasks}
- Overall: {progress_pct}%
- Domain breakdown: {json.dumps(domain_progress)}
- Next focus: {next_focus}

Return ONLY valid JSON:
{{
    "subject": "Your Weekly Legacy Planning Progress",
    "body": "Personalized summary (2-3 sentences)"
}}"""

    try:
        email_json = _call_nova_micro(email_prompt, max_tokens=250)
        return json.loads(email_json)
    except json.JSONDecodeError:
        return {
            "subject": f"Your Weekly Progress — {progress_pct}% Complete",
            "body": f"You've completed {tasks_completed} of {total_tasks} tasks. Keep up the great work!"
        }
