"""
1:1 Session Management — Booking, transcription, and summarization
Uses Amazon Nova Micro for fast transcription summarization
"""
import json
import boto3
import uuid
from typing import Dict, List, Optional
from datetime import datetime, timezone

bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")
transcribe_client = boto3.client("transcribe", region_name="us-east-1")


def _call_nova_micro(prompt: str, max_tokens: int = 500) -> str:
    """Call Amazon Nova Micro for quick summarization."""
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


def generate_session_summary(transcript: str, session_title: str) -> str:
    """
    Generate AI summary of 1:1 session transcript.

    Args:
        transcript: Full session transcript text
        session_title: Title/topic of the session

    Returns:
        Summary (2-3 bullet points)
    """
    summary_prompt = f"""Summarize this 1:1 session transcript concisely:

Session: {session_title}

Transcript:
{transcript[:2000]}...

Generate 2-3 key takeaways or action items."""

    return _call_nova_micro(summary_prompt, max_tokens=300)


def book_session(
    user_id: str,
    user_name: str,
    scheduled_at: str,
    coach_id: Optional[str] = None,
    notes: str = ""
) -> Dict:
    """
    Book a new 1:1 session.

    Args:
        user_id: Employee ID
        user_name: Employee name
        scheduled_at: ISO timestamp for session
        coach_id: Optional coach/advisor ID
        notes: Optional session notes

    Returns:
        {
            "sessionId": "uuid",
            "userId": "...",
            "userName": "...",
            "scheduledAt": "ISO",
            "status": "scheduled",
            "coachId": "...",
            "notes": "...",
            "createdAt": "ISO",
            "transcriptUrl": None,
            "summary": None
        }
    """
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    return {
        "sessionId": session_id,
        "userId": user_id,
        "userName": user_name,
        "scheduledAt": scheduled_at,
        "status": "scheduled",
        "coachId": coach_id,
        "notes": notes,
        "createdAt": now,
        "transcriptUrl": None,
        "summary": None,
    }


def complete_session(
    session_id: str,
    transcript_text: str,
    session_title: str = "Session"
) -> Dict:
    """
    Mark session as complete and generate summary.

    Args:
        session_id: Session ID
        transcript_text: Session transcript
        session_title: Session title for context

    Returns:
        {
            "sessionId": "...",
            "status": "completed",
            "summary": "AI-generated summary",
            "transcriptLength": int,
            "completedAt": "ISO"
        }
    """
    summary = generate_session_summary(transcript_text, session_title)
    now = datetime.now(timezone.utc).isoformat()

    return {
        "sessionId": session_id,
        "status": "completed",
        "summary": summary,
        "transcriptLength": len(transcript_text),
        "completedAt": now,
    }


def get_session_history(sessions: List[Dict]) -> Dict:
    """
    Calculate session statistics from history.

    Args:
        sessions: List of session records

    Returns:
        {
            "totalSessions": int,
            "completedSessions": int,
            "upcomingSessions": int,
            "averageSessionLength": float,
            "lastSession": Dict or None
        }
    """
    completed = [s for s in sessions if s.get("status") == "completed"]
    upcoming = [s for s in sessions if s.get("status") == "scheduled"]

    avg_length = 0.0
    if completed:
        total_length = sum(s.get("transcriptLength", 0) for s in completed)
        avg_length = total_length / len(completed)

    last_session = None
    if completed:
        last_session = max(completed, key=lambda s: s.get("completedAt", ""))

    return {
        "totalSessions": len(sessions),
        "completedSessions": len(completed),
        "upcomingSessions": len(upcoming),
        "averageSessionLength": round(avg_length),
        "lastSession": last_session,
    }


def validate_session_booking(scheduled_at: str, user_sessions: List[Dict]) -> tuple:
    """
    Validate session booking (no double-booking).

    Args:
        scheduled_at: Proposed session time (ISO)
        user_sessions: User's existing sessions

    Returns:
        (is_valid: bool, error_message: str or None)
    """
    try:
        proposed_time = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        return False, "Invalid datetime format"

    # Check for conflicts (same day)
    proposed_date = proposed_time.date()

    for session in user_sessions:
        if session.get("status") in ["scheduled", "in_progress"]:
            try:
                existing_time = datetime.fromisoformat(
                    session.get("scheduledAt", "").replace("Z", "+00:00")
                )
                if existing_time.date() == proposed_date:
                    # Allow 1-hour minimum gap between sessions
                    time_diff = abs((proposed_time - existing_time).total_seconds() / 3600)
                    if time_diff < 1.0:
                        return False, f"Conflict: Another session is scheduled within 1 hour"
            except ValueError:
                pass

    return True, None
