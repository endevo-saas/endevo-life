"""
Master Classes Management — Online learning events with recommendations
Uses Amazon Nova Micro for personalized class recommendations
"""
import json
import boto3
import uuid
from typing import Dict, List, Optional
from datetime import datetime, timezone

bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")


def _call_nova_micro(prompt: str, max_tokens: int = 300) -> str:
    """Call Amazon Nova Micro for quick recommendations."""
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


def get_recommended_classes(user_domains: List[str], all_classes: List[Dict]) -> List[Dict]:
    """
    Get AI-recommended master classes based on user's weak domains.

    Args:
        user_domains: List of user's weak domains (legal, financial, etc.)
        all_classes: All available master classes

    Returns:
        List of recommended classes (max 5)
    """
    if not user_domains or not all_classes:
        return all_classes[:5]

    class_context = "\n".join([
        f"- {c['title']} (Domain: {c['domain']})"
        for c in all_classes
    ])

    rec_prompt = f"""Recommend the 3-5 most relevant master classes for someone focusing on these areas:
Weak areas: {', '.join(user_domains)}

Available classes:
{class_context}

List the top 3-5 class titles that would help most, one per line."""

    recommendations = _call_nova_micro(rec_prompt, max_tokens=200)

    # Parse recommendations and match to classes
    recommended_titles = [line.strip("- ") for line in recommendations.split("\n") if line.strip()]
    recommended_classes = []

    for title in recommended_titles:
        for cls in all_classes:
            if title.lower() in cls["title"].lower() or cls["title"].lower() in title.lower():
                if cls not in recommended_classes:
                    recommended_classes.append(cls)
                    break

    # If no matches, return classes for weak domains
    if not recommended_classes:
        recommended_classes = [c for c in all_classes if c["domain"] in user_domains]

    return recommended_classes[:5]


def create_class(
    title: str,
    description: str,
    domain: str,
    instructor: str,
    scheduled_at: str,
    duration_minutes: int = 60,
    max_attendees: int = 100
) -> Dict:
    """
    Create a new master class.

    Args:
        title: Class title
        description: Class description
        domain: Domain (legal, financial, physical, digital)
        instructor: Instructor name
        scheduled_at: ISO timestamp
        duration_minutes: Class duration
        max_attendees: Max attendees allowed

    Returns:
        {
            "classId": "uuid",
            "title": "...",
            "description": "...",
            "domain": "...",
            "instructor": "...",
            "scheduledAt": "ISO",
            "durationMinutes": int,
            "maxAttendees": int,
            "registeredCount": 0,
            "status": "scheduled",
            "createdAt": "ISO"
        }
    """
    class_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    return {
        "classId": class_id,
        "title": title,
        "description": description,
        "domain": domain,
        "instructor": instructor,
        "scheduledAt": scheduled_at,
        "durationMinutes": duration_minutes,
        "maxAttendees": max_attendees,
        "registeredCount": 0,
        "status": "scheduled",
        "createdAt": now,
    }


def register_for_class(user_id: str, class_id: str, user_name: str = "User") -> Dict:
    """
    Register user for a master class.

    Args:
        user_id: User ID
        class_id: Class ID
        user_name: User's full name

    Returns:
        {
            "registrationId": "uuid",
            "userId": "...",
            "classId": "...",
            "registeredAt": "ISO",
            "status": "registered"
        }
    """
    registration_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    return {
        "registrationId": registration_id,
        "userId": user_id,
        "classId": class_id,
        "userName": user_name,
        "registeredAt": now,
        "status": "registered",
    }


def get_class_statistics(registrations: List[Dict]) -> Dict:
    """
    Calculate class statistics from registration data.

    Args:
        registrations: List of registration records

    Returns:
        {
            "totalClasses": int,
            "totalRegistrations": int,
            "uniqueInstructors": int,
            "domainBreakdown": {domain: count}
        }
    """
    domains = {}
    instructors = set()

    for reg in registrations:
        domain = reg.get("domain", "general")
        domains[domain] = domains.get(domain, 0) + 1

    return {
        "totalRegistrations": len(registrations),
        "domainBreakdown": domains,
    }


# Default master classes (HR can add more)
DEFAULT_MASTER_CLASSES = [
    {
        "classId": "mc_legal_001",
        "title": "Estate Planning Fundamentals",
        "description": "Learn the basics of wills, trusts, and estate planning strategies",
        "domain": "legal",
        "instructor": "Sarah Mitchell",
        "durationMinutes": 90,
        "maxAttendees": 100,
    },
    {
        "classId": "mc_financial_001",
        "title": "Investment Portfolio Management",
        "description": "Build and manage a diversified investment portfolio for long-term wealth",
        "domain": "financial",
        "instructor": "James Chen",
        "durationMinutes": 60,
        "maxAttendees": 80,
    },
    {
        "classId": "mc_physical_001",
        "title": "Health Records Organization",
        "description": "Organize medical records, insurance documents, and health directives",
        "domain": "physical",
        "instructor": "Dr. Patricia Williams",
        "durationMinutes": 45,
        "maxAttendees": 60,
    },
    {
        "classId": "mc_digital_001",
        "title": "Digital Asset Security",
        "description": "Secure your digital assets and create access plans for loved ones",
        "domain": "digital",
        "instructor": "Marcus Rodriguez",
        "durationMinutes": 75,
        "maxAttendees": 100,
    },
    {
        "classId": "mc_legal_002",
        "title": "Power of Attorney Explained",
        "description": "Understand healthcare and financial powers of attorney",
        "domain": "legal",
        "instructor": "Sarah Mitchell",
        "durationMinutes": 60,
        "maxAttendees": 80,
    },
]
