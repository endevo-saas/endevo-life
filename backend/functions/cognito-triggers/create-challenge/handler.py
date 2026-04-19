"""
Cognito CreateAuthChallenge trigger.

Generates a 6-digit OTP, stores it in endevo-uat-audit (partition OTP_STORE, TTL 5 min),
and sends it to the user via SES.  The OTP ref key is the Cognito username (email).
"""
import json
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import boto3

REGION      = os.environ.get("REGION", "us-east-1")
AUDIT_TABLE = os.environ.get("AUDIT_TABLE", "endevo-uat-audit")
FROM_EMAIL  = os.environ.get("FROM_EMAIL", "no-reply@endevo.life")
OTP_TTL_MIN = 5

dynamo  = boto3.resource("dynamodb", region_name=REGION)
audit_t = dynamo.Table(AUDIT_TABLE)
ses     = boto3.client("ses", region_name=REGION)


def handler(event: dict, context: object) -> dict:
    email     = event["request"]["userAttributes"].get("email", "")
    otp_code  = _generate_otp()
    otp_ref   = str(uuid.uuid4())

    _store_otp(otp_ref, email, otp_code)
    _send_otp_email(email, otp_code)

    # Pass otp_ref back in the private challenge metadata so VerifyChallenge can look it up.
    event["response"]["publicChallengeParameters"] = {
        "email": email[:3] + "***" + email[email.index("@"):] if "@" in email else email,
        "expires_in": str(OTP_TTL_MIN * 60),
    }
    event["response"]["privateChallengeParameters"] = {
        "otp_ref": otp_ref,
        "email":   email,
    }
    event["response"]["challengeMetadata"] = f"OTP_SENT:{otp_ref}"

    return event


def _generate_otp() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(6))


def _store_otp(otp_ref: str, email: str, otp_code: str) -> None:
    now = datetime.now(timezone.utc)
    ttl = int((now + timedelta(minutes=OTP_TTL_MIN)).timestamp())
    audit_t.put_item(Item={
        "tenantId":  "OTP_STORE",
        "sk":        f"{otp_ref}#{email}",
        "auditId":   str(uuid.uuid4()),
        "actor":     email,
        "action":    "OTP_PENDING",
        "otp_code":  otp_code,
        "otp_ref":   otp_ref,
        "details":   f"Cognito OTP for {email}",
        "severity":  "INFO",
        "createdAt": now.isoformat(),
        "ttl":       ttl,
    })


def _send_otp_email(email: str, otp_code: str) -> None:
    try:
        ses.send_email(
            Source=FROM_EMAIL,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": "Endevo Life — Your Login Code"},
                "Body": {"Html": {"Data": f"""
                    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;
                                background:#0f172a;color:#e2e8f0;border-radius:12px">
                      <h1 style="color:#818cf8;font-size:24px;margin:0 0 8px">Endevo Life</h1>
                      <p style="color:#94a3b8">Your one-time login code is:</p>
                      <div style="text-align:center;margin:24px 0;padding:24px;
                                  background:#1e293b;border-radius:12px;border:1px solid #334155">
                        <div style="font-size:42px;font-weight:900;letter-spacing:12px;
                                    color:#818cf8;font-family:monospace">{otp_code}</div>
                        <p style="color:#64748b;font-size:12px;margin:8px 0 0">
                          Expires in {OTP_TTL_MIN} minutes · Single use
                        </p>
                      </div>
                      <p style="color:#475569;font-size:11px">
                        Never share this code. If you did not request it,
                        contact <a href="mailto:support@endevo.life" style="color:#818cf8">
                        support@endevo.life</a>.
                      </p>
                    </div>"""
                }},
            },
        )
    except Exception as exc:
        # Log but do not raise — Cognito will still present the challenge.
        # The user will see "code not received" and can request a new one.
        print(f"OTP_EMAIL_ERROR: {exc}")
