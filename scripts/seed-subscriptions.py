"""
Seed script to update existing tenants/users with subscription fields
and create initial subscription records.

Usage:
    python scripts/seed-subscriptions.py              # dry run (default)
    python scripts/seed-subscriptions.py --execute    # actually write to DynamoDB
"""

import argparse
import sys
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr, Key


TENANTS_TABLE = "endevo-uat-tenants"
USERS_TABLE = "endevo-uat-users"
SUBSCRIPTIONS_TABLE = "endevo-uat-subscriptions"

PLAN_DEFAULTS = {
    "basic": {
        "sessionsPerEmployee": 2,
        "pricePerEmployee": 299,
    },
    "premium": {
        "sessionsPerEmployee": 6,
        "pricePerEmployee": 499,
    },
}

START_DATE = "2026-04-07"
END_DATE = "2027-04-07"


def get_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Scanning helpers
# ---------------------------------------------------------------------------

def scan_all(table: Any, **kwargs: Any) -> list[dict]:
    """Full table scan with pagination."""
    items: list[dict] = []
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key
    return items


def query_all(table: Any, **kwargs: Any) -> list[dict]:
    """Full query with pagination."""
    items: list[dict] = []
    while True:
        resp = table.query(**kwargs)
        items.extend(resp.get("Items", []))
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key
    return items


# ---------------------------------------------------------------------------
# Part 1: Update tenant records
# ---------------------------------------------------------------------------

def build_tenant_update_fields(now_iso: str) -> dict:
    """Return the default subscription fields for a tenant."""
    return {
        "plan": "basic",
        "accountType": "B2B",
        "defaultPlan": "basic",
        "implementationFee": Decimal("0"),
        "sessionsPerEmployee": Decimal("2"),
        "pricePerEmployee": Decimal("299"),
        "billingStatus": "active",
        "billingEmail": "",
        "updatedAt": now_iso,
    }


def update_tenants(
    tenants_table: Any,
    dry_run: bool,
) -> tuple[int, int, list[str]]:
    """Add subscription fields to tenants that are missing them.

    Returns (updated_count, skipped_count, error_messages).
    """
    now_iso = get_now_iso()
    defaults = build_tenant_update_fields(now_iso)

    tenants = scan_all(tenants_table)
    print(f"\n[Tenants] Found {len(tenants)} tenant(s)")

    updated = 0
    skipped = 0
    errors: list[str] = []

    for tenant in tenants:
        tenant_id = tenant.get("tenantId", "<unknown>")

        # Check idempotency — skip if all fields already present
        missing_fields = [k for k in defaults if k not in tenant or k == "updatedAt"]
        # If only updatedAt is "missing" (we always refresh it), check the rest
        non_timestamp = [k for k in missing_fields if k != "updatedAt"]
        if not non_timestamp:
            print(f"  [SKIP] {tenant_id} — subscription fields already present")
            skipped += 1
            continue

        if dry_run:
            print(f"  [DRY RUN] Would update {tenant_id} — adding: {', '.join(non_timestamp)}")
            updated += 1
            continue

        try:
            # Build update expression for missing fields only
            expr_parts: list[str] = []
            expr_names: dict[str, str] = {}
            expr_values: dict[str, Any] = {}

            for i, field in enumerate(missing_fields):
                alias_name = f"#f{i}"
                alias_val = f":v{i}"
                expr_parts.append(f"{alias_name} = {alias_val}")
                expr_names[alias_name] = field
                expr_values[alias_val] = defaults[field]

            tenants_table.update_item(
                Key={"tenantId": tenant_id},
                UpdateExpression="SET " + ", ".join(expr_parts),
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )
            print(f"  [UPDATED] {tenant_id} — added: {', '.join(non_timestamp)}")
            updated += 1
        except Exception as e:
            msg = f"  [ERROR] {tenant_id} — {e}"
            print(msg)
            errors.append(msg)

    return updated, skipped, errors


# ---------------------------------------------------------------------------
# Part 2: Update user records (EMPLOYEE role only)
# ---------------------------------------------------------------------------

def build_user_update_fields(now_iso: str) -> dict:
    """Return the default subscription fields for an employee user."""
    return {
        "plan": "basic",
        "sessionsAllocated": Decimal("2"),
        "sessionsUsed": Decimal("0"),
        "subscriptionStatus": "active",
        "updatedAt": now_iso,
    }


def update_users(
    users_table: Any,
    dry_run: bool,
) -> tuple[int, int, list[str]]:
    """Add subscription fields to employee users that are missing them.

    Returns (updated_count, skipped_count, error_messages).
    """
    now_iso = get_now_iso()
    defaults = build_user_update_fields(now_iso)

    # Scan for users with role=EMPLOYEE
    users = scan_all(users_table, FilterExpression=Attr("role").eq("EMPLOYEE"))
    print(f"\n[Users] Found {len(users)} employee user(s)")

    updated = 0
    skipped = 0
    errors: list[str] = []

    for user in users:
        tenant_id = user.get("tenantId", "<unknown>")
        sk = user.get("sk", "<unknown>")
        user_label = f"{tenant_id}/{sk}"

        # Check idempotency
        non_timestamp = [k for k in defaults if k not in user and k != "updatedAt"]
        if not non_timestamp:
            print(f"  [SKIP] {user_label} — subscription fields already present")
            skipped += 1
            continue

        missing_fields = [k for k in defaults if k not in user or k == "updatedAt"]

        if dry_run:
            print(f"  [DRY RUN] Would update {user_label} — adding: {', '.join(non_timestamp)}")
            updated += 1
            continue

        try:
            expr_parts: list[str] = []
            expr_names: dict[str, str] = {}
            expr_values: dict[str, Any] = {}

            for i, field in enumerate(missing_fields):
                alias_name = f"#f{i}"
                alias_val = f":v{i}"
                expr_parts.append(f"{alias_name} = {alias_val}")
                expr_names[alias_name] = field
                expr_values[alias_val] = defaults[field]

            users_table.update_item(
                Key={"tenantId": tenant_id, "sk": sk},
                UpdateExpression="SET " + ", ".join(expr_parts),
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )
            print(f"  [UPDATED] {user_label} — added: {', '.join(non_timestamp)}")
            updated += 1
        except Exception as e:
            msg = f"  [ERROR] {user_label} — {e}"
            print(msg)
            errors.append(msg)

    return updated, skipped, errors


# ---------------------------------------------------------------------------
# Part 3: Create initial subscription records
# ---------------------------------------------------------------------------

def get_existing_sub_tenant_ids(subs_table: Any) -> set[str]:
    """Return set of tenantIds that already have a subscription record."""
    items = scan_all(subs_table, ProjectionExpression="tenantId")
    return {item["tenantId"] for item in items if "tenantId" in item}


def create_subscriptions(
    tenants_table: Any,
    subs_table: Any,
    dry_run: bool,
) -> tuple[int, int, list[str]]:
    """Create SUB# records for active tenants that don't have one yet.

    Returns (created_count, skipped_count, error_messages).
    """
    now_iso = get_now_iso()

    tenants = scan_all(tenants_table, FilterExpression=Attr("status").eq("active"))
    existing_sub_ids = get_existing_sub_tenant_ids(subs_table)

    print(f"\n[Subscriptions] Found {len(tenants)} active tenant(s), "
          f"{len(existing_sub_ids)} already have subscription records")

    created = 0
    skipped = 0
    errors: list[str] = []

    for tenant in tenants:
        tenant_id = tenant.get("tenantId", "<unknown>")

        if tenant_id in existing_sub_ids:
            print(f"  [SKIP] {tenant_id} — subscription record already exists")
            skipped += 1
            continue

        seats = tenant.get("usedSeats", Decimal("0"))
        if isinstance(seats, int):
            seats = Decimal(str(seats))
        price_per_seat = Decimal("299")
        total_amount = seats * price_per_seat

        sub_item = {
            "tenantId": tenant_id,
            "sk": f"SUB#{now_iso}",
            "plan": "basic",
            "seats": seats,
            "pricePerSeat": price_per_seat,
            "totalAmount": total_amount,
            "startDate": START_DATE,
            "endDate": END_DATE,
            "status": "active",
            "accountType": "B2B",
            "createdAt": now_iso,
            "updatedAt": now_iso,
        }

        if dry_run:
            print(f"  [DRY RUN] Would create subscription for {tenant_id} "
                  f"— {seats} seats, ${total_amount} total")
            created += 1
            continue

        try:
            subs_table.put_item(Item=sub_item)
            print(f"  [CREATED] Subscription for {tenant_id} "
                  f"— {seats} seats, ${total_amount} total")
            created += 1
        except Exception as e:
            msg = f"  [ERROR] {tenant_id} — {e}"
            print(msg)
            errors.append(msg)

    return created, skipped, errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed subscription fields into existing tenants, users, "
                    "and create initial subscription records."
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually write to DynamoDB (default is dry-run)",
    )
    parser.add_argument(
        "--region",
        default="us-east-1",
        help="AWS region (default: us-east-1)",
    )
    args = parser.parse_args()

    dry_run = not args.execute
    region: str = args.region

    if dry_run:
        print("\n*** DRY RUN MODE — no data will be written ***")
        print("    Use --execute to apply changes.\n")
    else:
        print("\n*** EXECUTE MODE — changes will be written to DynamoDB ***\n")

    dynamodb = boto3.resource("dynamodb", region_name=region)
    tenants_table = dynamodb.Table(TENANTS_TABLE)
    users_table = dynamodb.Table(USERS_TABLE)
    subs_table = dynamodb.Table(SUBSCRIPTIONS_TABLE)

    all_errors: list[str] = []

    # Part 1: Tenants
    print("=" * 60)
    print("PART 1: Update Tenant Records with Subscription Fields")
    print("=" * 60)
    t_updated, t_skipped, t_errors = update_tenants(tenants_table, dry_run)
    all_errors.extend(t_errors)

    # Part 2: Users
    print("\n" + "=" * 60)
    print("PART 2: Update Employee Users with Subscription Fields")
    print("=" * 60)
    u_updated, u_skipped, u_errors = update_users(users_table, dry_run)
    all_errors.extend(u_errors)

    # Part 3: Subscriptions
    print("\n" + "=" * 60)
    print("PART 3: Create Initial Subscription Records")
    print("=" * 60)
    s_created, s_skipped, s_errors = create_subscriptions(
        tenants_table, subs_table, dry_run,
    )
    all_errors.extend(s_errors)

    # Summary
    print("\n" + "=" * 60)
    print("SEED SUMMARY")
    print("=" * 60)
    mode = "[DRY RUN]" if dry_run else "[EXECUTED]"
    print(f"  Mode              : {mode}")
    print(f"  Tenants updated   : {t_updated}")
    print(f"  Tenants skipped   : {t_skipped} (already had fields)")
    print(f"  Users updated     : {u_updated}")
    print(f"  Users skipped     : {u_skipped} (already had fields)")
    print(f"  Subscriptions created : {s_created}")
    print(f"  Subscriptions skipped : {s_skipped} (already existed)")

    if all_errors:
        print(f"\n  ERRORS ({len(all_errors)}):")
        for err in all_errors:
            print(f"    {err}")
    else:
        print(f"\n  Errors            : 0")

    print("=" * 60)

    if dry_run:
        print("\nDry run complete. No data was written.")
        print("Run with --execute to apply changes.")
    elif all_errors:
        print(f"\nSeed complete with {len(all_errors)} error(s).")
        sys.exit(1)
    else:
        print("\nSeed complete. All updates applied successfully.")


if __name__ == "__main__":
    main()
