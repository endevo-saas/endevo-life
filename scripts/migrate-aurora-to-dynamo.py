#!/usr/bin/env python3
"""
migrate-aurora-to-dynamo.py
───────────────────────────
Migrates ALL knowledge base chunks from Aryan's Aurora PostgreSQL (us-east-2)
to our DynamoDB table (us-east-1).

Source: Aurora PostgreSQL (RDS Data API)
  - Resource ARN: arn:aws:rds:us-east-2:383423735462:cluster:jesse-vector-db
  - Secret ARN:   arn:aws:secretsmanager:us-east-2:383423735462:secret:jesse-vector-db-credentials-BVyXMK
  - Database:     postgres
  - Table:        knowledge_base (id, content, source_file, chunk_index, metadata, created_at)

Target: DynamoDB (us-east-1)
  - Table:  endevo-uat-knowledge-base
  - PK:     sourceFile (S)
  - SK:     chunkIndex (S) — format "CHUNK#0000"

Notes:
  - Embeddings (pgvector) are NOT migrated — RDS Data API does not support vector types.
    Embeddings will be regenerated via Bedrock Titan Embed V2 in a separate pass.
  - RDS Data API returns max 1000 records per call — uses OFFSET/LIMIT pagination.
  - DynamoDB batch_write_item handles max 25 items per batch with retry on unprocessed.

Usage:
  python scripts/migrate-aurora-to-dynamo.py
"""

import json
import sys
import time
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import ClientError

# ── Config ────────────────────────────────────────────────────────────────────

AURORA_RESOURCE_ARN = "arn:aws:rds:us-east-2:383423735462:cluster:jesse-vector-db"
AURORA_SECRET_ARN = "arn:aws:secretsmanager:us-east-2:383423735462:secret:jesse-vector-db-credentials-BVyXMK"
AURORA_DATABASE = "postgres"
AURORA_REGION = "us-east-2"

DYNAMO_TABLE = "endevo-uat-knowledge-base"
DYNAMO_REGION = "us-east-1"

PAGE_SIZE = 500        # Keep under 1MB RDS Data API response limit
BATCH_SIZE = 25        # DynamoDB batch_write_item max
MAX_RETRIES = 5        # Retry on unprocessed items or throttling
BASE_DELAY = 0.5       # Base delay for exponential backoff (seconds)

# ── AWS Clients ──────────────────────────────────────────────────────────────

rds_client = boto3.client("rds-data", region_name=AURORA_REGION)
dynamodb = boto3.resource("dynamodb", region_name=DYNAMO_REGION)
dynamo_table = dynamodb.Table(DYNAMO_TABLE)
dynamo_client = boto3.client("dynamodb", region_name=DYNAMO_REGION)


# ── Aurora Read ──────────────────────────────────────────────────────────────

def get_total_count() -> int:
    """Get total row count from Aurora knowledge_base table."""
    response = rds_client.execute_statement(
        resourceArn=AURORA_RESOURCE_ARN,
        secretArn=AURORA_SECRET_ARN,
        database=AURORA_DATABASE,
        sql="SELECT COUNT(*) FROM knowledge_base",
    )
    return response["records"][0][0]["longValue"]


def fetch_page(offset: int, limit: int) -> list[dict[str, Any]]:
    """Fetch a page of rows from Aurora via RDS Data API.

    Returns a list of dicts with keys: id, content, source_file, chunk_index,
    metadata, created_at.
    """
    sql = (
        "SELECT id, content, source_file, chunk_index, metadata::text, "
        "created_at::text "
        "FROM knowledge_base "
        "ORDER BY source_file, chunk_index "
        f"LIMIT {limit} OFFSET {offset}"
    )

    response = rds_client.execute_statement(
        resourceArn=AURORA_RESOURCE_ARN,
        secretArn=AURORA_SECRET_ARN,
        database=AURORA_DATABASE,
        sql=sql,
    )

    rows: list[dict[str, Any]] = []
    for record in response.get("records", []):
        row = {
            "id": _extract_value(record[0]),
            "content": _extract_value(record[1]),
            "source_file": _extract_value(record[2]),
            "chunk_index": _extract_value(record[3]),
            "metadata": _extract_value(record[4]),
            "created_at": _extract_value(record[5]),
        }
        rows.append(row)

    return rows


def _extract_value(field: dict) -> Any:
    """Extract the actual value from an RDS Data API field."""
    if "stringValue" in field:
        return field["stringValue"]
    if "longValue" in field:
        return field["longValue"]
    if "doubleValue" in field:
        return field["doubleValue"]
    if "booleanValue" in field:
        return field["booleanValue"]
    if "isNull" in field and field["isNull"]:
        return None
    if "blobValue" in field:
        return field["blobValue"]
    return None


# ── Transform ────────────────────────────────────────────────────────────────

def transform_row(row: dict[str, Any]) -> dict[str, Any]:
    """Transform an Aurora row into a DynamoDB item.

    DynamoDB schema:
      PK: sourceFile (S)
      SK: chunkIndex (S) — format "CHUNK#0000"
    """
    chunk_idx = row["chunk_index"]
    if chunk_idx is None:
        chunk_idx = 0

    sk = f"CHUNK#{int(chunk_idx):04d}"

    # Parse metadata — it comes as a JSON string from Aurora
    metadata_str = row["metadata"]
    if metadata_str:
        try:
            metadata_parsed = json.loads(metadata_str)
        except (json.JSONDecodeError, TypeError):
            metadata_parsed = {"raw": str(metadata_str)}
    else:
        metadata_parsed = {}

    # Add migration provenance to metadata
    metadata_parsed["migratedFrom"] = "aurora-jesse-vector-db"
    metadata_parsed["auroraId"] = row["id"]

    item: dict[str, Any] = {
        "sourceFile": row["source_file"] or "unknown",
        "chunkIndex": sk,
        "content": row["content"] or "",
        "metadata": json.dumps(metadata_parsed),
        "createdAt": row["created_at"] or datetime.now(timezone.utc).isoformat(),
        "migratedAt": datetime.now(timezone.utc).isoformat(),
    }

    return item


# ── DynamoDB Write ───────────────────────────────────────────────────────────

def write_batch(items: list[dict[str, Any]]) -> int:
    """Write a batch of items to DynamoDB using batch_write_item.

    Returns the number of items successfully written.
    Retries unprocessed items with exponential backoff.
    """
    if not items:
        return 0

    put_requests = [{"PutRequest": {"Item": item}} for item in items]

    written = 0
    remaining = put_requests

    for attempt in range(MAX_RETRIES):
        try:
            response = dynamo_table.meta.client.batch_write_item(
                RequestItems={DYNAMO_TABLE: remaining}
            )
        except ClientError as err:
            error_code = err.response["Error"]["Code"]
            if error_code in (
                "ProvisionedThroughputExceededException",
                "ThrottlingException",
            ):
                delay = BASE_DELAY * (2 ** attempt)
                print(f"    [THROTTLE] Retry in {delay:.1f}s (attempt {attempt + 1})")
                time.sleep(delay)
                continue
            raise

        unprocessed = response.get("UnprocessedItems", {}).get(DYNAMO_TABLE, [])
        written += len(remaining) - len(unprocessed)

        if not unprocessed:
            return written

        remaining = unprocessed
        delay = BASE_DELAY * (2 ** attempt)
        time.sleep(delay)

    # If we still have unprocessed items after all retries, count what we got
    print(f"    [WARN] {len(remaining)} items still unprocessed after {MAX_RETRIES} retries")
    return written


# ── Main Migration ───────────────────────────────────────────────────────────

def run_migration() -> None:
    print("=" * 70)
    print("  Aurora PostgreSQL -> DynamoDB Migration")
    print("=" * 70)
    print(f"  Source : {AURORA_RESOURCE_ARN}")
    print(f"  Target : {DYNAMO_TABLE} ({DYNAMO_REGION})")
    print(f"  Page   : {PAGE_SIZE} rows per RDS call")
    print(f"  Batch  : {BATCH_SIZE} items per DynamoDB write")
    print("=" * 70)
    print()

    # Step 1: Get total count
    total = get_total_count()
    print(f"  Total rows in Aurora: {total:,}")
    print()

    if total == 0:
        print("  Nothing to migrate. Exiting.")
        return

    # Step 2: Paginate through Aurora and write to DynamoDB
    total_written = 0
    total_skipped = 0
    offset = 0
    page_num = 0
    start_time = time.time()

    while offset < total:
        page_num += 1
        print(f"  Page {page_num}: fetching rows {offset:,} - {min(offset + PAGE_SIZE, total):,} ...", end=" ")
        sys.stdout.flush()

        rows = fetch_page(offset, PAGE_SIZE)
        if not rows:
            print("empty page — done.")
            break

        # Transform rows
        items = []
        skipped_in_page = 0
        for row in rows:
            try:
                item = transform_row(row)
                items.append(item)
            except Exception as err:
                print(f"\n    [ERROR] Transform failed for row {row.get('id', '?')}: {err}")
                skipped_in_page += 1

        # Write in sub-batches of 25
        page_written = 0
        for i in range(0, len(items), BATCH_SIZE):
            batch = items[i : i + BATCH_SIZE]
            count = write_batch(batch)
            page_written += count

        total_written += page_written
        total_skipped += skipped_in_page

        elapsed = time.time() - start_time
        rate = total_written / elapsed if elapsed > 0 else 0
        print(f"wrote {page_written}/{len(rows)} ({total_written:,} total, {rate:.0f} items/s)")

        offset += PAGE_SIZE

    # Summary
    elapsed = time.time() - start_time
    print()
    print("=" * 70)
    print("  MIGRATION COMPLETE")
    print(f"    Aurora rows read   : {total:,}")
    print(f"    DynamoDB items put : {total_written:,}")
    print(f"    Skipped/errors     : {total_skipped}")
    print(f"    Duration           : {elapsed:.1f}s")
    print(f"    Throughput         : {total_written / elapsed:.0f} items/s")
    print("=" * 70)
    print()
    print("  Next step: run embedding generation pass via Bedrock Titan Embed V2")
    print("  to populate the 'embedding' field for each chunk.")
    print()


if __name__ == "__main__":
    run_migration()
