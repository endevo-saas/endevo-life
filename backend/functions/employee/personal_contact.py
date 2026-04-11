"""
personal_contact.py — Personal contact update and OTP verification helpers.

Handles:
  - Validation of personal email / phone fields
  - DynamoDB update for personal_email, personal_phone_number, and their
    associated verified flags
  - OTP generation, delivery (SES email / SNS SMS), and verification
"""
import re
import secrets
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PERSONAL_CONTACT_FIELDS: frozenset[str] = frozenset(
    {
        "personal_email",
        "personal_phone_number",
        "personal_email_verified",
        "personal_phone_verified",
    }
)

_EMAIL_PATTERN: re.Pattern[str] = re.compile(
    r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]+$"
)

# E.164: +<1-3 digit country code><4-14 digits> → total 8–15 chars after +
_PHONE_PATTERN: re.Pattern[str] = re.compile(r"^\+[1-9]\d{6,14}$")

OTP_TTL_SECONDS: int = 600  # 10 minutes


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def validate_personal_email(value: str | None) -> bool:
    """Return True when value is a valid email, an empty string, or None."""
    if value is None or value == "":
        return True
    if len(value) > 254:
        return False
    return bool(_EMAIL_PATTERN.match(value))


def validate_personal_phone(value: str | None) -> bool:
    """Return True when value is a valid E.164 phone, an empty string, or None."""
    if value is None or value == "":
        return True
    return bool(_PHONE_PATTERN.match(value))


# ---------------------------------------------------------------------------
# DynamoDB update
# ---------------------------------------------------------------------------

def update_personal_contact(
    *,
    users_table: Any,
    user_id: str,
    tenant_id: str,
    personal_email: str | None,
    personal_phone_number: str | None,
) -> None:
    """
    Write personal contact fields to DynamoDB for the given user.

    Resets the corresponding verified flag to False whenever the contact
    value changes (including when it is cleared to "").

    Raises:
        ValueError: if no fields are provided, or if validation fails.
    """
    if personal_email is None and personal_phone_number is None:
        raise ValueError("Nothing to update")

    if personal_email is not None and not validate_personal_email(personal_email):
        raise ValueError("Invalid personal email format")

    if personal_phone_number is not None and not validate_personal_phone(
        personal_phone_number
    ):
        raise ValueError("Invalid personal phone format (expected E.164)")

    # Build the update expression immutably
    set_parts: list[str] = []
    names: dict[str, str] = {}
    vals: dict[str, Any] = {}

    if personal_email is not None:
        set_parts.append("#personal_email = :personal_email")
        set_parts.append(
            "#personal_email_verified = :personal_email_verified"
        )
        names["#personal_email"] = "personal_email"
        names["#personal_email_verified"] = "personal_email_verified"
        vals[":personal_email"] = personal_email
        vals[":personal_email_verified"] = False

    if personal_phone_number is not None:
        set_parts.append("#personal_phone_number = :personal_phone_number")
        set_parts.append(
            "#personal_phone_verified = :personal_phone_verified"
        )
        names["#personal_phone_number"] = "personal_phone_number"
        names["#personal_phone_verified"] = "personal_phone_verified"
        vals[":personal_phone_number"] = personal_phone_number
        vals[":personal_phone_verified"] = False

    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET " + ", ".join(set_parts),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=vals,
    )


# ---------------------------------------------------------------------------
# OTP generation
# ---------------------------------------------------------------------------

def generate_otp() -> str:
    """Return a zero-padded 6-digit OTP string."""
    return str(secrets.randbelow(1_000_000)).zfill(6)


# ---------------------------------------------------------------------------
# OTP delivery
# ---------------------------------------------------------------------------

def send_email_otp(
    *,
    ses_client: Any,
    recipient_email: str,
    otp_code: str,
    from_address: str,
) -> dict[str, Any]:
    """
    Send an OTP to the employee's personal email via Amazon SES.

    Returns a dict with success (bool), message_id (str), or error (str).
    """
    subject = "Endevo Life — Verify your personal email"
    body = (
        f"Your Endevo Life verification code is: {otp_code}\n\n"
        "This code expires in 10 minutes. Do not share it with anyone."
    )

    try:
        response = ses_client.send_email(
            Source=from_address,
            Destination={"ToAddresses": [recipient_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": body, "Charset": "UTF-8"},
                },
            },
        )
        return {"success": True, "message_id": response["MessageId"]}
    except ClientError as exc:
        return {
            "success": False,
            "error": exc.response["Error"]["Message"],
        }


def send_phone_otp(
    *,
    sns_client: Any,
    phone_number: str,
    otp_code: str,
) -> dict[str, Any]:
    """
    Send an OTP to the employee's personal phone via Amazon SNS.

    Returns a dict with success (bool), message_id (str), or error (str).
    """
    message = (
        f"Endevo Life verification code: {otp_code}. "
        "Valid for 10 minutes. Do not share."
    )

    try:
        response = sns_client.publish(
            PhoneNumber=phone_number,
            Message=message,
            MessageAttributes={
                "AWS.SNS.SMS.SMSType": {
                    "DataType": "String",
                    "StringValue": "Transactional",
                }
            },
        )
        return {"success": True, "message_id": response["MessageId"]}
    except ClientError as exc:
        return {
            "success": False,
            "error": exc.response["Error"]["Message"],
        }


# ---------------------------------------------------------------------------
# OTP verification
# ---------------------------------------------------------------------------

def verify_otp(
    *,
    otp_store: Any,
    user_id: str,
    channel: str,
    otp_id: str,
    code: str,
) -> dict[str, Any]:
    """
    Verify an OTP code against a record in the OTP DynamoDB store.

    Args:
        otp_store: DynamoDB Table resource for OTP records.
        user_id:   The calling user's ID (prevents cross-user replay).
        channel:   "email" or "phone".
        otp_id:    The primary key of the OTP record.
        code:      The 6-digit code submitted by the user.

    Returns:
        {"verified": True} on success, or
        {"verified": False, "reason": "<explanation>"}
    """
    response = otp_store.get_item(Key={"otpId": otp_id, "userId": user_id})
    item = response.get("Item")

    if not item:
        return {"verified": False, "reason": "OTP not found"}

    if item.get("userId") != user_id:
        return {"verified": False, "reason": "Invalid OTP"}

    if item.get("used"):
        return {"verified": False, "reason": "OTP already used"}

    # Check expiry
    expires_at_str: str = item.get("expiresAt", "")
    try:
        expires_at = datetime.fromisoformat(expires_at_str)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(tz=timezone.utc) > expires_at:
            return {"verified": False, "reason": "OTP has expired"}
    except (ValueError, TypeError):
        return {"verified": False, "reason": "Invalid OTP record"}

    if item.get("code") != code:
        return {"verified": False, "reason": "Invalid OTP code"}

    # Mark as used (immutable update — new write, not mutating item in place)
    otp_store.update_item(
        Key={"otpId": otp_id, "userId": user_id},
        UpdateExpression="SET #used = :used",
        ExpressionAttributeNames={"#used": "used"},
        ExpressionAttributeValues={":used": True},
    )

    return {"verified": True}
