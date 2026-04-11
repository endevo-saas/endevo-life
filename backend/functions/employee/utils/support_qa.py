"""
Support Q&A Module — Employee questions answered by Bedrock AI
Uses Amazon Nova Micro for fast responses (~407ms TTFT)
Self-healing: Confidence scoring + HR escalation for low-confidence answers
"""
import json
import boto3
from typing import Dict, List, Optional
from datetime import datetime

bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")


def _call_nova_micro(prompt: str, max_tokens: int = 500) -> str:
    """Call Amazon Nova Micro for fast Q&A response."""
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


SAMPLE_FAQ = [
    {
        "id": "faq_1",
        "question": "How many 1:1 sessions do I get?",
        "answer": "Basic plan includes 2 sessions per year. Premium plan includes 6 sessions per year.",
        "category": "sessions",
    },
    {
        "id": "faq_2",
        "question": "Can I change my plan?",
        "answer": "Yes, your employer can upgrade your plan anytime. Contact your HR administrator.",
        "category": "billing",
    },
    {
        "id": "faq_3",
        "question": "What is a legacy readiness assessment?",
        "answer": "It's a 40-question evaluation across 4 domains: Legal, Financial, Physical, and Digital asset planning.",
        "category": "assessment",
    },
    {
        "id": "faq_4",
        "question": "What should I do first after taking the assessment?",
        "answer": "Review your My Playbook to see your strengths and focus areas. Start with high-priority tasks.",
        "category": "playbook",
    },
    {
        "id": "faq_5",
        "question": "Are my responses confidential?",
        "answer": "Yes, your assessment responses are encrypted and only visible to you and authorized HR personnel.",
        "category": "privacy",
    },
]


def answer_question(user_question: str, user_name: str = "User") -> Dict:
    """
    Answer an employee question using Bedrock Nova Micro.
    Includes confidence scoring and escalation detection.

    Args:
        user_question: The employee's question
        user_name: Employee name for context

    Returns:
        {
            "questionId": "uuid",
            "question": "...",
            "answer": "...",
            "confidence": 0.85,  # 0-1 scale
            "shouldEscalate": False,
            "category": "general",
            "source": "ai" | "faq",
            "responseTime": "2026-04-11T10:30:00Z",
        }
    """

    # Build context from FAQ
    faq_context = "\n".join([
        f"- Q: {f['question']}\n  A: {f['answer']}"
        for f in SAMPLE_FAQ
    ])

    # Generate answer with confidence
    qa_prompt = f"""You are a helpful Endevo Life support assistant. Answer the following question clearly and concisely.

FAQ Reference:
{faq_context}

Employee Question: {user_question}

Provide ONLY a valid JSON response with NO markdown or extra text:
{{
    "answer": "Your direct answer (1-2 sentences)",
    "confidence": 0.85,
    "reasoning": "Why you're confident in this answer"
}}

Confidence scale:
- 0.9-1.0: Confident (exact match to FAQ or clear policy)
- 0.7-0.9: Somewhat confident (related to FAQ, logical inference)
- 0.5-0.7: Low confidence (requires HR input)
- <0.5: Very uncertain (must escalate)
"""

    qa_json = _call_nova_micro(qa_prompt, max_tokens=400)

    try:
        qa_data = json.loads(qa_json)
    except json.JSONDecodeError:
        # Fallback for malformed response
        qa_data = {
            "answer": "I'm not certain about this. Please contact your HR administrator for guidance.",
            "confidence": 0.3,
            "reasoning": "Unable to generate confident response",
        }

    answer = qa_data.get("answer", "")
    confidence = float(qa_data.get("confidence", 0.5))
    should_escalate = confidence < 0.6

    return {
        "question": user_question,
        "answer": answer,
        "confidence": round(confidence, 2),
        "shouldEscalate": should_escalate,
        "category": "general",
        "source": "ai",
        "responseTime": datetime.utcnow().isoformat(),
    }


def rate_answer(question_id: str, rating: int, feedback: str = "") -> Dict:
    """
    Record employee feedback on an answer.
    Low ratings trigger HR review.

    Args:
        question_id: ID of the question
        rating: 1-5 scale (1=unhelpful, 5=helpful)
        feedback: Optional comment

    Returns:
        {"success": True, "ratingId": "...", "escalatedToHR": False}
    """
    escalate_to_hr = rating <= 2

    return {
        "success": True,
        "rating": rating,
        "escalatedToHR": escalate_to_hr,
        "ratedAt": datetime.utcnow().isoformat(),
    }


def get_faq_by_search(search_term: str) -> List[Dict]:
    """
    Search FAQ by keyword.

    Returns:
        List of matching FAQ entries
    """
    search_lower = search_term.lower()
    matches = [
        f for f in SAMPLE_FAQ
        if search_lower in f["question"].lower() or search_lower in f["answer"].lower()
    ]
    return matches
