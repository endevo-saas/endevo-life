#!/usr/bin/env python3
"""
embed-knowledge.py
──────────────────
Generate Bedrock Titan Embed V2 embeddings for all DynamoDB knowledge base
items that are missing the `embedding` attribute.

Target table: endevo-uat-knowledge-base (us-east-1)
  PK: sourceFile (S), SK: chunkIndex (S)

Usage:
  # Dry run — count items needing embeddings
  python scripts/embed-knowledge.py --dry-run

  # Execute — generate and store embeddings
  python scripts/embed-knowledge.py --execute
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import boto3
from botocore.exceptions import ClientError

# ── Config ────────────────────────────────────────────────────────────────────

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
KNOWLEDGE_TABLE = os.environ.get("KNOWLEDGE_TABLE", "endevo-uat-knowledge-base")
EMBED_MODEL = os.environ.get("BEDROCK_EMBED_MODEL", "amazon.titan-embed-text-v2:0")
EMBED_DIMENSIONS = 1024

# Rate limiting — Bedrock Titan Embed ~20 TPS
SLEEP_BETWEEN_CALLS = 0.05  # 50ms between each call
BATCH_PAUSE_SIZE = 20       # pause after every N calls
BATCH_PAUSE_SLEEP = 1.0     # seconds to pause at batch boundary

# Content truncation — Titan Embed V2 max input ~8192 tokens
MAX_CONTENT_CHARS = 8000

# Retry config for throttling
MAX_RETRIES = 5
BASE_DELAY = 1.0

# Progress reporting
PROGRESS_INTERVAL = 100


# ── AWS Clients ──────────────────────────────────────────────────────────────

def get_dynamodb_table():
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return dynamodb.Table(KNOWLEDGE_TABLE)


def get_bedrock_client():
    return boto3.client("bedrock-runtime", region_name=AWS_REGION)


# ── Scan for items missing embeddings ────────────────────────────────────────

def scan_items_missing_embeddings(table) -> list[dict]:
    """Scan DynamoDB for items where embedding attribute does not exist."""
    items: list[dict] = []
    scan_kwargs = {
        "FilterExpression": "attribute_not_exists(embedding)",
        "ProjectionExpression": "sourceFile, chunkIndex, content",
    }

    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))

        # Handle pagination
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key

        # Progress during scan
        if len(items) % 1000 == 0:
            print(f"  Scanned {len(items)} items so far...")

    return items


# ── Embedding ────────────────────────────────────────────────────────────────

def embed_text(bedrock_client, text: str) -> Optional[list[float]]:
    """Generate embedding via Bedrock Titan Embed V2 (1024-dim).

    Includes retry with exponential backoff for throttling.
    """
    truncated = text[:MAX_CONTENT_CHARS]

    body = json.dumps({
        "inputText": truncated,
        "dimensions": EMBED_DIMENSIONS,
        "normalize": True,
    })

    for attempt in range(MAX_RETRIES):
        try:
            response = bedrock_client.invoke_model(
                modelId=EMBED_MODEL,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
            result = json.loads(response["body"].read())
            embedding = result.get("embedding", [])
            if len(embedding) != EMBED_DIMENSIONS:
                print(f"  [WARN] Expected {EMBED_DIMENSIONS} dims, got {len(embedding)}")
            return embedding

        except ClientError as err:
            error_code = err.response["Error"]["Code"]
            if error_code == "ThrottlingException" and attempt < MAX_RETRIES - 1:
                delay = BASE_DELAY * (2 ** attempt)
                print(f"  [THROTTLE] Retrying in {delay:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                time.sleep(delay)
                continue
            print(f"  [ERROR] Bedrock embed failed: {err}")
            return None
        except Exception as err:
            print(f"  [ERROR] Bedrock embed failed: {err}")
            return None

    return None


# ── DynamoDB Update ──────────────────────────────────────────────────────────

def update_item_embedding(
    table,
    source_file: str,
    chunk_index: str,
    embedding: list[float],
) -> bool:
    """Update existing DynamoDB item with the embedding vector.

    Converts floats to Decimal (DynamoDB does not support float).
    """
    decimal_embedding = [Decimal(str(round(v, 8))) for v in embedding]

    try:
        table.update_item(
            Key={"sourceFile": source_file, "chunkIndex": chunk_index},
            UpdateExpression="SET embedding = :e, embeddedAt = :t",
            ExpressionAttributeValues={
                ":e": decimal_embedding,
                ":t": datetime.now(timezone.utc).isoformat(),
            },
        )
        return True
    except ClientError as err:
        print(f"  [ERROR] DynamoDB update failed for {source_file}/{chunk_index}: {err}")
        return False


# ── Main ─────────────────────────────────────────────────────────────────────

def run(dry_run: bool) -> None:
    print("=" * 70)
    print("  Endevo Knowledge Base — Embedding Generator")
    print("=" * 70)
    print(f"  Table       : {KNOWLEDGE_TABLE}")
    print(f"  Region      : {AWS_REGION}")
    print(f"  Model       : {EMBED_MODEL} ({EMBED_DIMENSIONS}-dim)")
    print(f"  Max content : {MAX_CONTENT_CHARS} chars")
    print(f"  Rate limit  : {SLEEP_BETWEEN_CALLS}s between calls, "
          f"pause {BATCH_PAUSE_SLEEP}s every {BATCH_PAUSE_SIZE} calls")
    print(f"  Mode        : {'DRY RUN' if dry_run else 'EXECUTE'}")
    print("=" * 70)
    print()

    table = get_dynamodb_table()

    # Step 1: Scan for items missing embeddings
    print("[1/2] Scanning for items missing embeddings...")
    start_scan = time.time()
    items = scan_items_missing_embeddings(table)
    scan_duration = time.time() - start_scan
    print(f"  Found {len(items)} items missing embeddings "
          f"(scan took {scan_duration:.1f}s)")
    print()

    if not items:
        print("  Nothing to do — all items already have embeddings.")
        return

    if dry_run:
        print("  ** DRY RUN — no embeddings will be generated **")
        print(f"  Would process {len(items)} items.")
        print()
        # Show sample
        print("  Sample items:")
        for item in items[:5]:
            sf = item.get("sourceFile", "?")
            ci = item.get("chunkIndex", "?")
            content = item.get("content", "")
            print(f"    {sf} / {ci}  ({len(content)} chars)")
        if len(items) > 5:
            print(f"    ... and {len(items) - 5} more")
        print()
        print("  Re-run with --execute to generate embeddings.")
        return

    # Step 2: Generate embeddings
    print(f"[2/2] Generating embeddings for {len(items)} items...")
    print(f"  Estimated time: ~{len(items) * SLEEP_BETWEEN_CALLS / 60:.1f} minutes")
    print()

    bedrock_client = get_bedrock_client()

    total_success = 0
    total_failed = 0
    total_skipped = 0
    failed_items: list[str] = []
    start_time = time.time()

    for i, item in enumerate(items):
        source_file = item.get("sourceFile", "")
        chunk_index = item.get("chunkIndex", "")
        content = item.get("content", "")

        # Skip items with no content
        if not content or not content.strip():
            total_skipped += 1
            continue

        # Generate embedding
        embedding = embed_text(bedrock_client, content)

        if embedding is None:
            total_failed += 1
            failed_items.append(f"{source_file}/{chunk_index}")
            continue

        # Update DynamoDB
        success = update_item_embedding(table, source_file, chunk_index, embedding)
        if success:
            total_success += 1
        else:
            total_failed += 1
            failed_items.append(f"{source_file}/{chunk_index}")

        # Rate limiting
        time.sleep(SLEEP_BETWEEN_CALLS)

        # Batch pause every N calls
        if (i + 1) % BATCH_PAUSE_SIZE == 0:
            time.sleep(BATCH_PAUSE_SLEEP)

        # Progress reporting
        if (i + 1) % PROGRESS_INTERVAL == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(items) - i - 1) / rate if rate > 0 else 0
            print(f"  Progress: {i + 1}/{len(items)} "
                  f"({total_success} ok, {total_failed} failed) "
                  f"[{elapsed:.0f}s elapsed, ~{remaining:.0f}s remaining]")

    elapsed = time.time() - start_time

    # Summary
    print()
    print("=" * 70)
    print("  SUMMARY")
    print(f"    Items processed : {len(items)}")
    print(f"    Embeddings OK   : {total_success}")
    print(f"    Failed          : {total_failed}")
    print(f"    Skipped (empty) : {total_skipped}")
    print(f"    Duration        : {elapsed:.1f}s ({elapsed / 60:.1f} min)")
    if total_success > 0:
        print(f"    Avg rate        : {total_success / elapsed:.1f} items/s")
    print("=" * 70)

    if failed_items:
        print()
        print(f"  Failed items ({len(failed_items)}):")
        for fi in failed_items[:20]:
            print(f"    - {fi}")
        if len(failed_items) > 20:
            print(f"    ... and {len(failed_items) - 20} more")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Bedrock Titan Embed V2 embeddings for knowledge base items",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Show items needing embeddings without generating any",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Actually generate embeddings and update DynamoDB",
    )

    args = parser.parse_args()

    if not args.execute and not args.dry_run:
        print("[INFO] No mode specified. Defaulting to --dry-run.")
        print("       Use --execute to generate embeddings.\n")
        args.dry_run = True

    run(dry_run=not args.execute)


if __name__ == "__main__":
    main()
