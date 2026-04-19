"""
Cognito VerifyAuthChallengeResponse trigger.

Looks up the OTP stored in endevo-uat-audit by otp_ref (from privateChallengeParameters),
compares it to the user's answer, and returns answerCorrect.
"""
import os
from datetime import datetime, timedelta, timezone

import boto3

REGION      = os.environ.get("REGION", "us-east-1")
AUDIT_TABLE = os.environ.get("AUDIT_TABLE", "endevo-uat-audit")
OTP_TTL_MIN = 5

dynamo  = boto3.resource("dynamodb", region_name=REGION)
audit_t = dynamo.Table(AUDIT_TABLE)


def handler(event: dict, context: object) -> dict:
    private_params = event["request"].get("privateChallengeParameters", {})
    otp_ref        = private_params.get("otp_ref", "")
    email          = private_params.get("email", "")
    user_answer    = (event["request"].get("challengeAnswer") or "").strip()

    record = _get_otp_record(otp_ref, email)

    if record and record.get("otp_code") == user_answer:
        event["response"]["answerCorrect"] = True
        # Consume the OTP so it cannot be reused.
        _delete_otp_record(otp_ref, email)
    else:
        event["response"]["answerCorrect"] = False

    return event


def _get_otp_record(otp_ref: str, email: str) -> dict | None:
    if not otp_ref or not email:
        return None
    result = audit_t.get_item(Key={
        "tenantId": "OTP_STORE",
        "sk":       f"{otp_ref}#{email}",
    })
    item = result.get("Item")
    if not item or item.get("action") != "OTP_PENDING":
        return None
    # Manual TTL check — DynamoDB TTL deletion is not instant.
    created = datetime.fromisoformat(item.get("createdAt", "2000-01-01T00:00:00+00:00"))
    if (datetime.now(timezone.utc) - created).total_seconds() > OTP_TTL_MIN * 60:
        return None
    return item


def _delete_otp_record(otp_ref: str, email: str) -> None:
    try:
        audit_t.delete_item(Key={
            "tenantId": "OTP_STORE",
            "sk":       f"{otp_ref}#{email}",
        })
    except Exception as exc:
        print(f"OTP_DELETE_ERROR: {exc}")
