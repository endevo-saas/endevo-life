"""
Email Generator — Personalized assessment emails with Bedrock
Uses Amazon Nova Lite for creative email copy generation
"""
import json
import boto3
from typing import Dict, Optional
from datetime import datetime

bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")
ses_client = boto3.client("ses", region_name="us-east-1")


def _call_nova_lite(prompt: str, max_tokens: int = 2000) -> str:
    """Call Amazon Nova Lite for creative email generation."""
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


def generate_email_content(
    user_name: str,
    overall_score: int,
    domain_scores: Dict[str, int],
    weak_domains: list,
    tasks: list
) -> Dict:
    """
    Generate personalized email content using Nova Lite.
    Returns subject, HTML body, and plain text.
    """

    weak_text = ", ".join([d.title() for d in weak_domains]) if weak_domains else "overall readiness"
    top_task = tasks[0]["title"] if tasks else "your legacy planning"

    prompt = f"""
    Generate a warm, professional, personalized email for {user_name} with their legacy readiness assessment results.

    Results:
    - Overall Score: {overall_score}%
    - Domain Breakdown: {json.dumps(domain_scores)}
    - Areas to Focus: {weak_text}
    - First Action: {top_task}

    Write a professional email (suitable for corporate HR) with:
    1. Personalized greeting mentioning their name
    2. Congratulations on completing the assessment
    3. Overall score positioned as progress (not judgment)
    4. Specific, encouraging commentary on their results
    5. Clear next steps (suggest booking a 1:1 session)
    6. Closing with warm professional tone

    Return ONLY valid JSON with NO markdown or extra text:
    {{
        "subject": "Your Legacy Readiness Assessment Complete — [name]'s Results",
        "htmlBody": "<html><body>...full HTML email...</body></html>",
        "plainTextBody": "Plain text version of the email"
    }}

    The HTML should:
    - Include their overall score prominently
    - Show domain scores in a table or visual format
    - Recommend their top 1-2 priority tasks
    - Include a clear "Book 1:1 Session" call-to-action
    - Be professional, branded with Endevo colors (blues/grays)
    - Use proper HTML structure
    """

    email_json = _call_nova_lite(prompt, max_tokens=2000)

    try:
        email_content = json.loads(email_json)
    except json.JSONDecodeError:
        email_content = {
            "subject": f"Your Legacy Readiness Assessment Complete — {user_name}'s Results",
            "htmlBody": f"""<html><body style="font-family: Arial, sans-serif; color: #333;">
                <h1>Your Legacy Readiness Assessment Results</h1>
                <p>Hi {user_name},</p>
                <p>Thank you for completing your Legacy Readiness Assessment! Your overall readiness score is <strong>{overall_score}%</strong>.</p>
                <p>Your domain scores:</p>
                <ul>
                {''.join(f'<li>{d.title()}: {s}%</li>' for d, s in domain_scores.items())}
                </ul>
                <p>We recommend starting with: <strong>{top_task}</strong></p>
                <p><a href="https://uat.endevo.life/employee/sessions" style="background: #1f77b4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Book Your 1:1 Session</a></p>
                <p>Best regards,<br/>The Endevo Team</p>
            </body></html>""",
            "plainTextBody": f"""Your Legacy Readiness Assessment Complete

Hi {user_name},

Thank you for completing your assessment. Your overall readiness score is {overall_score}%.

Domain scores:
{chr(10).join(f'- {d.title()}: {s}%' for d, s in domain_scores.items())}

Next step: {top_task}

Book a 1:1 session: https://uat.endevo.life/employee/sessions

Best regards,
The Endevo Team"""
        }

    return email_content


def send_assessment_email(
    recipient_email: str,
    recipient_name: str,
    overall_score: int,
    domain_scores: Dict[str, int],
    weak_domains: list,
    tasks: list,
    attachment_urls: Optional[Dict[str, str]] = None
) -> Dict:
    """
    Send personalized assessment email via SES.

    Args:
        recipient_email: Employee email
        recipient_name: Employee name
        overall_score: Overall readiness %
        domain_scores: Domain breakdown
        weak_domains: List of weak domains
        tasks: Task list
        attachment_urls: Optional dict of {"filename": "s3_url"} for attachments

    Returns:
        {"success": True/False, "messageId": "...", "error": "..."}
    """

    # Generate email content
    email_content = generate_email_content(
        recipient_name,
        overall_score,
        domain_scores,
        weak_domains,
        tasks
    )

    try:
        # Prepare SES message
        message = {
            "Subject": {
                "Data": email_content["subject"],
                "Charset": "UTF-8"
            },
            "Body": {
                "Html": {
                    "Data": email_content["htmlBody"],
                    "Charset": "UTF-8"
                },
                "Text": {
                    "Data": email_content["plainTextBody"],
                    "Charset": "UTF-8"
                }
            }
        }

        # Send email via SES
        response = ses_client.send_email(
            Source="noreply@endevo.life",  # Verified sender
            Destination={"ToAddresses": [recipient_email]},
            Message=message
        )

        return {
            "success": True,
            "messageId": response["MessageId"],
            "email": recipient_email,
            "subject": email_content["subject"],
            "sentAt": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        print(f"EMAIL_SEND_ERROR: {e}")
        return {
            "success": False,
            "error": str(e),
            "email": recipient_email,
        }


def generate_scorecard_html(
    user_name: str,
    overall_score: int,
    domain_scores: Dict[str, int],
    timestamp: str
) -> str:
    """
    Generate HTML scorecard for PDF export/email attachment.
    """
    domain_bars = ""
    for domain, score in domain_scores.items():
        color = "#1f77b4" if domain == "legal" else \
                "#ff7f0e" if domain == "financial" else \
                "#2ca02c" if domain == "physical" else "#d62728"
        domain_bars += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">{domain.title()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                <div style="background: #eee; height: 20px; border-radius: 4px; overflow: hidden;">
                    <div style="background: {color}; height: 100%; width: {score}%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
                        {score}%
                    </div>
                </div>
            </td>
        </tr>
        """

    return f"""<!DOCTYPE html>
    <html>
    <head>
        <title>Legacy Readiness Scorecard</title>
        <style>
            body {{ font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; background: #f5f5f5; }}
            .scorecard {{ background: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            h1 {{ color: #1f77b4; margin-bottom: 5px; }}
            .subtitle {{ color: #666; margin-bottom: 30px; font-size: 14px; }}
            .overall-score {{ background: linear-gradient(135deg, #1f77b4 0%, #4ba3d9 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }}
            .overall-score .number {{ font-size: 60px; font-weight: bold; }}
            .overall-score .label {{ font-size: 16px; margin-top: 10px; opacity: 0.9; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th {{ background: #f0f0f0; padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }}
        </style>
    </head>
    <body>
        <div class="scorecard">
            <h1>Endevo Life — Legacy Readiness Scorecard</h1>
            <p class="subtitle">Assessment completed on {timestamp}</p>

            <div class="overall-score">
                <div class="number">{overall_score}%</div>
                <div class="label">Overall Readiness</div>
            </div>

            <h2>Domain Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Domain</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    {domain_bars}
                </tbody>
            </table>

            <p style="margin-top: 30px; font-size: 12px; color: #999;">
                This scorecard represents your current readiness level across key legacy planning domains.
                Use your personalized playbook to improve in areas marked as focus areas.
            </p>
        </div>
    </body>
    </html>"""
