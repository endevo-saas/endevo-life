"""
Endevo Readiness Engine
Calculates domain scores, readiness tiers, and AI-powered module recommendations
from a user's 40-question assessment answers.

This is not a pass/fail test — it is a life diagnostic.
The score tells users WHERE to focus, not WHETHER they can proceed.
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Domain → Module mapping
# Each life-readiness domain maps to the module where users do the deep work.
DOMAIN_MODULE_MAP: dict[str, str] = {
    "Legal Readiness": "2",
    "Financial Readiness": "3",
    "Physical Readiness": "4",
    "Digital Readiness": "5",
}

DOMAIN_KEYS = list(DOMAIN_MODULE_MAP.keys())

# Readiness tiers (score is percentage 0-100)
# These tiers are motivational, not judgmental — everyone starts somewhere.
TIERS = [
    {"key": "champion", "min": 85, "label": "Peace Champion",  "emoji": "🏆", "color": "#22c55e",
     "message": "You're genuinely ahead of most people. Let's make sure it stays that way."},
    {"key": "onway",    "min": 60, "label": "On Your Way",      "emoji": "✅", "color": "#3b82f6",
     "message": "You've started — now let's close the gaps before they become problems."},
    {"key": "clarity",  "min": 35, "label": "Getting Clarity",  "emoji": "💡", "color": "#f59e0b",
     "message": "You're more aware than most. A few focused steps will change everything."},
    {"key": "fresh",    "min": 0,  "label": "Starting Fresh",   "emoji": "🌱", "color": "#ef4444",
     "message": "This is exactly the right place to start. Your modules will guide you through each step."},
]

# Urgency levels drive which modules are highlighted as most important.
# Low score = high urgency = loved ones face greater risk today.
URGENCY_LEVELS = {
    "critical": {"label": "URGENT",    "color": "#ef4444", "min": 0,  "max": 34},
    "high":     {"label": "HIGH",      "color": "#f97316", "min": 35, "max": 59},
    "moderate": {"label": "MODERATE",  "color": "#f59e0b", "min": 60, "max": 84},
    "strong":   {"label": "STRONG",    "color": "#22c55e", "min": 85, "max": 100},
}


def get_tier(percentage: int) -> dict:
    """Return the readiness tier for a given percentage score (0-100)."""
    for tier in TIERS:
        if percentage >= tier["min"]:
            return tier
    return TIERS[-1]


def get_urgency(percentage: int) -> dict:
    """Return the urgency level for a given percentage score (0-100)."""
    for key, level in URGENCY_LEVELS.items():
        if level["min"] <= percentage <= level["max"]:
            return {"key": key, **level}
    return {"key": "strong", **URGENCY_LEVELS["strong"]}


def calculate_scorecard(
    submitted_answers: list[dict],   # [{questionId, selectedLabel}]
    all_questions: list[dict],        # full question objects from DynamoDB
    attempt_number: int = 1,
) -> dict:
    """
    Core readiness engine.

    Returns a rich scorecard with:
    - Per-domain scores and tiers
    - Identified gaps (specific questions scored 0 or 3)
    - AI-recommended module priority order
    - Emotional narrative message
    - Progress-friendly structure for retake comparison
    """
    # Build answer lookup: questionId → {selectedLabel, score}
    # Scores are sourced from DynamoDB question definitions — never from the client.
    answer_map: dict[str, dict] = {}
    for ans in submitted_answers:
        qid = ans["questionId"]
        label = ans["selectedLabel"]
        # Find the score for this answer from the question definition
        question = next((q for q in all_questions if q["questionId"] == qid), None)
        if question:
            score = next(
                (a["score"] for a in question.get("answers", []) if a["label"] == label),
                0
            )
            answer_map[qid] = {"selectedLabel": label, "score": score}

    # Calculate per-domain scores
    domain_results: dict[str, dict] = {}
    for domain in DOMAIN_KEYS:
        domain_questions = [q for q in all_questions if q.get("domain") == domain and q.get("type") == "assessment"]
        if not domain_questions:
            continue

        max_possible = len(domain_questions) * 10
        actual_score = sum(answer_map.get(q["questionId"], {}).get("score", 0) for q in domain_questions)
        percentage = round(actual_score / max_possible * 100) if max_possible > 0 else 0

        # Identify specific gaps: questions scored 0 (not started) or 3 (barely started).
        # These are the exact actions users need to take to protect their family.
        gaps = []
        for q in domain_questions:
            ans = answer_map.get(q["questionId"], {})
            score = ans.get("score", 0)
            if score <= 3:
                gaps.append({
                    "questionId": q["questionId"],
                    "text": q["text"],
                    "selectedLabel": ans.get("selectedLabel"),
                    "score": score,
                    "maxScore": 10,
                    "gapSeverity": "critical" if score == 0 else "high",
                })

        tier = get_tier(percentage)
        urgency = get_urgency(percentage)
        module_num = DOMAIN_MODULE_MAP[domain]

        domain_results[domain] = {
            "domain": domain,
            "moduleNum": module_num,
            "score": actual_score,
            "maxScore": max_possible,
            "percentage": percentage,
            "tier": tier,
            "urgency": urgency,
            "gaps": gaps,
            "gapCount": len(gaps),
            "questionsAnswered": len([q for q in domain_questions if q["questionId"] in answer_map]),
            "questionsTotal": len(domain_questions),
        }

    # Overall score = average of domain percentages.
    # This gives equal weight to each life domain regardless of question count.
    if domain_results:
        overall_pct = round(sum(d["percentage"] for d in domain_results.values()) / len(domain_results))
    else:
        overall_pct = 0

    overall_tier = get_tier(overall_pct)

    # Build recommended module order.
    # Sort domains by score ascending (weakest first = most urgent).
    # This surfaces the biggest protection gaps at the top of the user's journey.
    sorted_domains = sorted(domain_results.values(), key=lambda d: d["percentage"])

    # Module 1 = Foundation (always first — understand the why)
    # Modules 2-5 = ordered by domain urgency (weakest first)
    # Module 6 = Communicate (always last — share the plan with loved ones)
    recommended_order = ["1"] + [d["moduleNum"] for d in sorted_domains] + ["6"]

    # Generate per-module recommendation cards with personalised action messages
    module_recommendations = []
    for d in sorted_domains:
        urgency_key = d["urgency"]["key"]
        pct = d["percentage"]
        domain_short = d["domain"].replace(" Readiness", "").lower()

        if urgency_key == "critical":
            action_message = (
                f"Your {domain_short} situation is critical. "
                f"Without action, your loved ones could face serious challenges if something happened to you today."
            )
        elif urgency_key == "high":
            action_message = (
                f"You've thought about {domain_short} planning, "
                f"but {d['gapCount']} key areas need attention. Small actions here create enormous protection."
            )
        elif urgency_key == "moderate":
            action_message = (
                f"Your {domain_short} planning is progressing well. "
                f"This module will close the remaining gaps and give you true peace of mind."
            )
        else:
            action_message = (
                f"You're ahead of most people in {domain_short}. "
                f"This module will help you maintain and refine your protection."
            )

        module_recommendations.append({
            "moduleNum": d["moduleNum"],
            "domain": d["domain"],
            "percentage": pct,
            "urgency": d["urgency"],
            "tier": d["tier"],
            "actionMessage": action_message,
            "gapCount": d["gapCount"],
        })

    # Bookend the domain modules with Module 1 (Foundation) and Module 6 (Communicate).
    # These are always present regardless of domain scores.
    module_recommendations = (
        [{
            "moduleNum": "1",
            "domain": "Foundation",
            "urgency": {"key": "foundation", "label": "FOUNDATION", "color": "#2BBFC5"},
            "actionMessage": "Start here to understand why your legacy matters and what this journey will do for the people you love.",
        }]
        + module_recommendations
        + [{
            "moduleNum": "6",
            "domain": "Communicate Your Wishes",
            "urgency": {"key": "final", "label": "FINAL STEP", "color": "#8b5cf6"},
            "actionMessage": "The final and most important act — sharing your plan with the people who will need it.",
        }]
    )

    # Generate a personalised narrative message for this specific user's situation.
    # This is the emotional core of the scorecard — it must feel human, not algorithmic.
    critical_domains = [d for d in sorted_domains if d["urgency"]["key"] == "critical"]
    strengths = [d for d in sorted_domains if d["urgency"]["key"] in ("moderate", "strong")]

    if attempt_number == 1:
        opening = "You've taken the hardest step — looking honestly at what isn't done yet. Most people never do this."
    else:
        opening = f"You're back. That matters. Each time you return, your legacy gets stronger."

    if critical_domains:
        critical_names = " and ".join(d["domain"].replace(" Readiness", "").lower() for d in critical_domains[:2])
        urgency_note = f"Your most urgent focus is {critical_names} — where your loved ones face the greatest risk today."
    elif strengths:
        strength_names = " and ".join(d["domain"].replace(" Readiness", "").lower() for d in strengths[:2])
        urgency_note = f"You have real strength in {strength_names}. Now let's build the rest of your protection."
    else:
        urgency_note = "Every domain has room to grow. Your recommended path below will guide you step by step."

    personalised_narrative = f"{opening} {urgency_note}"

    # Summarise strengths and weaknesses for easy frontend rendering
    strengths_list = [d["domain"] for d in sorted_domains if d["percentage"] >= 60]
    weaknesses_list = [d["domain"] for d in sorted_domains if d["percentage"] < 60]
    critical_list = [d["domain"] for d in sorted_domains if d["percentage"] < 35]

    return {
        "overallScore": overall_pct,
        "overallTier": overall_tier,
        "totalQuestions": len(all_questions),
        "totalAnswered": len(answer_map),
        "attemptNumber": attempt_number,
        "domainScores": domain_results,
        "recommendedOrder": recommended_order,
        "moduleRecommendations": module_recommendations,
        "strengths": strengths_list,
        "weaknesses": weaknesses_list,
        "criticalGaps": critical_list,
        "personalisedNarrative": personalised_narrative,
        "answeredScores": answer_map,  # stored for progress tracking and retake comparison
    }
