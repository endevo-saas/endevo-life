"""
Unit tests for personal contact update and OTP verification logic.

TDD — RED phase: these tests define the expected behaviour of
  personal_contact.py before that module exists.

Run with:
  pytest backend/functions/employee/tests/test_personal_contact.py -v
"""
import re
import pytest
from unittest.mock import MagicMock, patch, call
from typing import Any


# ---------------------------------------------------------------------------
# Helpers — test data factories
# ---------------------------------------------------------------------------

def make_user_item(
    user_id: str = "u-001",
    tenant_id: str = "t-001",
    email: str = "work@endevo.com",
    personal_email: str = "",
    personal_phone_number: str = "",
    personal_email_verified: bool = False,
    personal_phone_verified: bool = False,
) -> dict[str, Any]:
    return {
        "userId": user_id,
        "tenantId": tenant_id,
        "email": email,
        "firstName": "Test",
        "lastName": "User",
        "role": "EMPLOYEE",
        "status": "active",
        "personal_email": personal_email,
        "personal_phone_number": personal_phone_number,
        "personal_email_verified": personal_email_verified,
        "personal_phone_verified": personal_phone_verified,
    }


# ---------------------------------------------------------------------------
# Import under test — will fail (RED) until personal_contact.py is created
# ---------------------------------------------------------------------------

from employee.personal_contact import (  # type: ignore[import]
    validate_personal_email,
    validate_personal_phone,
    update_personal_contact,
    generate_otp,
    send_email_otp,
    send_phone_otp,
    verify_otp,
    PERSONAL_CONTACT_FIELDS,
)


# ---------------------------------------------------------------------------
# validate_personal_email
# ---------------------------------------------------------------------------

class TestValidatePersonalEmail:
    def test_valid_email_passes(self) -> None:
        assert validate_personal_email("personal@example.com") is True

    def test_valid_email_with_subdomain(self) -> None:
        assert validate_personal_email("user@mail.example.co.uk") is True

    def test_empty_string_passes(self) -> None:
        """Empty string means the employee is clearing the field — allowed."""
        assert validate_personal_email("") is True

    def test_none_passes(self) -> None:
        assert validate_personal_email(None) is True

    def test_missing_at_sign_fails(self) -> None:
        assert validate_personal_email("notanemail") is False

    def test_missing_domain_fails(self) -> None:
        assert validate_personal_email("user@") is False

    def test_missing_local_part_fails(self) -> None:
        assert validate_personal_email("@example.com") is False

    def test_spaces_fail(self) -> None:
        assert validate_personal_email("user @example.com") is False

    def test_very_long_email_fails(self) -> None:
        long_local = "a" * 255
        assert validate_personal_email(f"{long_local}@example.com") is False


# ---------------------------------------------------------------------------
# validate_personal_phone
# ---------------------------------------------------------------------------

class TestValidatePersonalPhone:
    def test_e164_format_passes(self) -> None:
        assert validate_personal_phone("+14155551234") is True

    def test_e164_with_country_code_uk(self) -> None:
        assert validate_personal_phone("+447911123456") is True

    def test_empty_string_passes(self) -> None:
        assert validate_personal_phone("") is True

    def test_none_passes(self) -> None:
        assert validate_personal_phone(None) is True

    def test_digits_only_fails(self) -> None:
        """Must start with + for E.164."""
        assert validate_personal_phone("14155551234") is False

    def test_letters_fail(self) -> None:
        assert validate_personal_phone("abc+123") is False

    def test_too_short_fails(self) -> None:
        assert validate_personal_phone("+1") is False

    def test_too_long_fails(self) -> None:
        assert validate_personal_phone("+1" + "9" * 16) is False


# ---------------------------------------------------------------------------
# update_personal_contact
# ---------------------------------------------------------------------------

class TestUpdatePersonalContact:
    def _make_users_table(self, existing_item: dict[str, Any]) -> MagicMock:
        table = MagicMock()
        table.query.return_value = {"Items": [existing_item]}
        return table

    def test_updates_personal_email_in_dynamo(self) -> None:
        user = make_user_item()
        table = self._make_users_table(user)

        update_personal_contact(
            users_table=table,
            user_id="u-001",
            tenant_id="t-001",
            personal_email="personal@example.com",
            personal_phone_number=None,
        )

        table.update_item.assert_called_once()
        call_kwargs = table.update_item.call_args.kwargs
        assert call_kwargs["Key"] == {"userId": "u-001"}
        # personal_email_verified must be reset to False when email changes
        assert ":personal_email_verified" in call_kwargs["ExpressionAttributeValues"]
        assert call_kwargs["ExpressionAttributeValues"][":personal_email_verified"] is False

    def test_updates_personal_phone_in_dynamo(self) -> None:
        user = make_user_item()
        table = self._make_users_table(user)

        update_personal_contact(
            users_table=table,
            user_id="u-001",
            tenant_id="t-001",
            personal_email=None,
            personal_phone_number="+14155551234",
        )

        table.update_item.assert_called_once()
        call_kwargs = table.update_item.call_args.kwargs
        assert ":personal_phone_verified" in call_kwargs["ExpressionAttributeValues"]
        assert call_kwargs["ExpressionAttributeValues"][":personal_phone_verified"] is False

    def test_updates_both_fields_together(self) -> None:
        user = make_user_item()
        table = self._make_users_table(user)

        update_personal_contact(
            users_table=table,
            user_id="u-001",
            tenant_id="t-001",
            personal_email="personal@example.com",
            personal_phone_number="+14155551234",
        )

        table.update_item.assert_called_once()
        vals = table.update_item.call_args.kwargs["ExpressionAttributeValues"]
        assert ":personal_email" in vals
        assert ":personal_phone_number" in vals

    def test_no_fields_raises_value_error(self) -> None:
        table = MagicMock()
        with pytest.raises(ValueError, match="Nothing to update"):
            update_personal_contact(
                users_table=table,
                user_id="u-001",
                tenant_id="t-001",
                personal_email=None,
                personal_phone_number=None,
            )

    def test_invalid_email_raises_value_error(self) -> None:
        table = MagicMock()
        with pytest.raises(ValueError, match="Invalid personal email"):
            update_personal_contact(
                users_table=table,
                user_id="u-001",
                tenant_id="t-001",
                personal_email="not-an-email",
                personal_phone_number=None,
            )

    def test_invalid_phone_raises_value_error(self) -> None:
        table = MagicMock()
        with pytest.raises(ValueError, match="Invalid personal phone"):
            update_personal_contact(
                users_table=table,
                user_id="u-001",
                tenant_id="t-001",
                personal_email=None,
                personal_phone_number="bad-phone",
            )

    def test_clears_email_sets_verified_false(self) -> None:
        """Clearing personal_email (empty string) must reset verified flag."""
        user = make_user_item(
            personal_email="old@example.com", personal_email_verified=True
        )
        table = self._make_users_table(user)

        update_personal_contact(
            users_table=table,
            user_id="u-001",
            tenant_id="t-001",
            personal_email="",
            personal_phone_number=None,
        )

        vals = table.update_item.call_args.kwargs["ExpressionAttributeValues"]
        assert vals[":personal_email"] == ""
        assert vals[":personal_email_verified"] is False

    def test_immutability_original_dict_not_mutated(self) -> None:
        """update_personal_contact must not mutate the caller's dict."""
        original = {"personal_email": "old@example.com"}
        snapshot = dict(original)
        table = MagicMock()
        table.query.return_value = {"Items": [make_user_item()]}
        update_personal_contact(
            users_table=table,
            user_id="u-001",
            tenant_id="t-001",
            personal_email="new@example.com",
            personal_phone_number=None,
        )
        assert original == snapshot


# ---------------------------------------------------------------------------
# generate_otp
# ---------------------------------------------------------------------------

class TestGenerateOtp:
    def test_generates_six_digit_string(self) -> None:
        otp = generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()

    def test_generates_different_values(self) -> None:
        otps = {generate_otp() for _ in range(20)}
        # With 10^6 combinations, 20 iterations should almost never be all the same
        assert len(otps) > 1

    def test_otp_is_zero_padded(self) -> None:
        """OTP must always be exactly 6 chars (zero-padded)."""
        with patch("employee.personal_contact.secrets.randbelow", return_value=7):
            otp = generate_otp()
        assert otp == "000007"


# ---------------------------------------------------------------------------
# send_email_otp
# ---------------------------------------------------------------------------

class TestSendEmailOtp:
    def test_sends_via_ses(self) -> None:
        ses_client = MagicMock()
        ses_client.send_email.return_value = {"MessageId": "msg-001"}

        result = send_email_otp(
            ses_client=ses_client,
            recipient_email="personal@example.com",
            otp_code="123456",
            from_address="noreply@endevo.com",
        )

        ses_client.send_email.assert_called_once()
        call_kwargs = ses_client.send_email.call_args.kwargs
        assert call_kwargs["Destination"]["ToAddresses"] == ["personal@example.com"]
        assert "123456" in call_kwargs["Message"]["Body"]["Text"]["Data"]
        assert result["success"] is True
        assert result["message_id"] == "msg-001"

    def test_ses_failure_returns_error(self) -> None:
        from botocore.exceptions import ClientError
        ses_client = MagicMock()
        ses_client.send_email.side_effect = ClientError(
            {"Error": {"Code": "MessageRejected", "Message": "Email blocked"}},
            "SendEmail",
        )

        result = send_email_otp(
            ses_client=ses_client,
            recipient_email="personal@example.com",
            otp_code="123456",
            from_address="noreply@endevo.com",
        )

        assert result["success"] is False
        assert "error" in result

    def test_subject_contains_branding(self) -> None:
        ses_client = MagicMock()
        ses_client.send_email.return_value = {"MessageId": "msg-002"}

        send_email_otp(
            ses_client=ses_client,
            recipient_email="personal@example.com",
            otp_code="654321",
            from_address="noreply@endevo.com",
        )

        subject = ses_client.send_email.call_args.kwargs["Message"]["Subject"]["Data"]
        assert "Endevo" in subject or "endevo" in subject.lower()


# ---------------------------------------------------------------------------
# send_phone_otp
# ---------------------------------------------------------------------------

class TestSendPhoneOtp:
    def test_sends_via_sns(self) -> None:
        sns_client = MagicMock()
        sns_client.publish.return_value = {"MessageId": "sms-001"}

        result = send_phone_otp(
            sns_client=sns_client,
            phone_number="+14155551234",
            otp_code="123456",
        )

        sns_client.publish.assert_called_once()
        call_kwargs = sns_client.publish.call_args.kwargs
        assert call_kwargs["PhoneNumber"] == "+14155551234"
        assert "123456" in call_kwargs["Message"]
        assert result["success"] is True
        assert result["message_id"] == "sms-001"

    def test_sns_failure_returns_error(self) -> None:
        from botocore.exceptions import ClientError
        sns_client = MagicMock()
        sns_client.publish.side_effect = ClientError(
            {"Error": {"Code": "InvalidParameter", "Message": "Bad phone"}},
            "Publish",
        )

        result = send_phone_otp(
            sns_client=sns_client,
            phone_number="+14155551234",
            otp_code="123456",
        )

        assert result["success"] is False
        assert "error" in result

    def test_message_contains_brand_name(self) -> None:
        sns_client = MagicMock()
        sns_client.publish.return_value = {"MessageId": "sms-002"}

        send_phone_otp(
            sns_client=sns_client,
            phone_number="+14155551234",
            otp_code="654321",
        )

        message = sns_client.publish.call_args.kwargs["Message"]
        assert "Endevo" in message or "endevo" in message.lower()


# ---------------------------------------------------------------------------
# verify_otp
# ---------------------------------------------------------------------------

class TestVerifyOtp:
    def _make_otp_store(self) -> MagicMock:
        """Simulate a DynamoDB table used as transient OTP store."""
        store = MagicMock()
        return store

    def test_valid_otp_returns_verified_true(self) -> None:
        store = self._make_otp_store()
        store.get_item.return_value = {
            "Item": {
                "otpId": "otp-001",
                "userId": "u-001",
                "channel": "email",
                "code": "123456",
                "expiresAt": "9999-01-01T00:00:00+00:00",
                "used": False,
            }
        }

        result = verify_otp(
            otp_store=store,
            user_id="u-001",
            channel="email",
            otp_id="otp-001",
            code="123456",
        )

        assert result["verified"] is True

    def test_wrong_code_returns_verified_false(self) -> None:
        store = self._make_otp_store()
        store.get_item.return_value = {
            "Item": {
                "otpId": "otp-001",
                "userId": "u-001",
                "channel": "email",
                "code": "999999",
                "expiresAt": "9999-01-01T00:00:00+00:00",
                "used": False,
            }
        }

        result = verify_otp(
            otp_store=store,
            user_id="u-001",
            channel="email",
            otp_id="otp-001",
            code="123456",
        )

        assert result["verified"] is False
        assert "Invalid" in result.get("reason", "")

    def test_expired_otp_returns_verified_false(self) -> None:
        store = self._make_otp_store()
        store.get_item.return_value = {
            "Item": {
                "otpId": "otp-001",
                "userId": "u-001",
                "channel": "email",
                "code": "123456",
                "expiresAt": "2000-01-01T00:00:00+00:00",  # past
                "used": False,
            }
        }

        result = verify_otp(
            otp_store=store,
            user_id="u-001",
            channel="email",
            otp_id="otp-001",
            code="123456",
        )

        assert result["verified"] is False
        assert "expired" in result.get("reason", "").lower()

    def test_already_used_otp_returns_verified_false(self) -> None:
        store = self._make_otp_store()
        store.get_item.return_value = {
            "Item": {
                "otpId": "otp-001",
                "userId": "u-001",
                "channel": "email",
                "code": "123456",
                "expiresAt": "9999-01-01T00:00:00+00:00",
                "used": True,
            }
        }

        result = verify_otp(
            otp_store=store,
            user_id="u-001",
            channel="email",
            otp_id="otp-001",
            code="123456",
        )

        assert result["verified"] is False
        assert "used" in result.get("reason", "").lower()

    def test_missing_otp_returns_verified_false(self) -> None:
        store = self._make_otp_store()
        store.get_item.return_value = {}  # no Item key

        result = verify_otp(
            otp_store=store,
            user_id="u-001",
            channel="email",
            otp_id="nonexistent",
            code="123456",
        )

        assert result["verified"] is False

    def test_user_id_mismatch_returns_verified_false(self) -> None:
        """OTP belonging to a different user must not verify."""
        store = self._make_otp_store()
        store.get_item.return_value = {
            "Item": {
                "otpId": "otp-001",
                "userId": "different-user",
                "channel": "email",
                "code": "123456",
                "expiresAt": "9999-01-01T00:00:00+00:00",
                "used": False,
            }
        }

        result = verify_otp(
            otp_store=store,
            user_id="u-001",
            channel="email",
            otp_id="otp-001",
            code="123456",
        )

        assert result["verified"] is False

    def test_timezone_naive_expires_at_is_treated_as_utc(self) -> None:
        """expiresAt without timezone info must still be compared correctly."""
        store = self._make_otp_store()
        store.get_item.return_value = {
            "Item": {
                "otpId": "otp-tz",
                "userId": "u-001",
                "channel": "email",
                "code": "123456",
                "expiresAt": "9999-01-01T00:00:00",  # no +00:00
                "used": False,
            }
        }
        result = verify_otp(
            otp_store=store,
            user_id="u-001",
            channel="email",
            otp_id="otp-tz",
            code="123456",
        )
        assert result["verified"] is True

    def test_malformed_expires_at_returns_verified_false(self) -> None:
        store = self._make_otp_store()
        store.get_item.return_value = {
            "Item": {
                "otpId": "otp-bad",
                "userId": "u-001",
                "channel": "email",
                "code": "123456",
                "expiresAt": "not-a-date",
                "used": False,
            }
        }
        result = verify_otp(
            otp_store=store,
            user_id="u-001",
            channel="email",
            otp_id="otp-bad",
            code="123456",
        )
        assert result["verified"] is False

    def test_verified_otp_is_marked_used(self) -> None:
        """After successful verification the OTP record must be marked used."""
        store = self._make_otp_store()
        store.get_item.return_value = {
            "Item": {
                "otpId": "otp-001",
                "userId": "u-001",
                "channel": "phone",
                "code": "654321",
                "expiresAt": "9999-01-01T00:00:00+00:00",
                "used": False,
            }
        }

        verify_otp(
            otp_store=store,
            user_id="u-001",
            channel="phone",
            otp_id="otp-001",
            code="654321",
        )

        store.update_item.assert_called_once()
        vals = store.update_item.call_args.kwargs["ExpressionAttributeValues"]
        assert vals.get(":used") is True


# ---------------------------------------------------------------------------
# PERSONAL_CONTACT_FIELDS constant
# ---------------------------------------------------------------------------

class TestPersonalContactFieldsConstant:
    def test_contains_all_four_fields(self) -> None:
        assert "personal_email" in PERSONAL_CONTACT_FIELDS
        assert "personal_phone_number" in PERSONAL_CONTACT_FIELDS
        assert "personal_email_verified" in PERSONAL_CONTACT_FIELDS
        assert "personal_phone_verified" in PERSONAL_CONTACT_FIELDS

    def test_is_frozenset_or_tuple(self) -> None:
        """Must be immutable so callers cannot accidentally mutate it."""
        assert isinstance(PERSONAL_CONTACT_FIELDS, (frozenset, tuple))
