#!/usr/bin/env python3
"""
ingest-knowledge.py
───────────────────
Reads text-based source files from Aryan's jesse-endevo-v2 repo and ingests
them into the DynamoDB knowledge base table for Jesse AI.

Target table: endevo-uat-knowledge-base (us-east-1)
  PK: sourceFile (S)
  SK: chunkIndex (S)  — format "CHUNK#0000"

Usage:
  # Dry run — shows what would be ingested
  python scripts/ingest-knowledge.py --dry-run

  # Actually ingest
  python scripts/ingest-knowledge.py --execute
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import ClientError

# ── Config ────────────────────────────────────────────────────────────────────

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
KNOWLEDGE_TABLE = os.environ.get("KNOWLEDGE_TABLE", "endevo-uat-knowledge-base")
EMBED_MODEL = os.environ.get("BEDROCK_EMBED_MODEL", "amazon.titan-embed-text-v2:0")
EMBED_DIMENSIONS = 1024

# Chunking config — matches Aryan's approach: 800 chars, 150 overlap
CHUNK_SIZE_CHARS = 800
OVERLAP_CHARS = 150
MIN_CHUNK_CHARS = 100

# Bedrock throttle retry
MAX_RETRIES = 5
BASE_DELAY = 1.0

# ── Source files to ingest ───────────────────────────────────────────────────

BASE_DIR = Path(r"C:\Projects 2026\SH 2026 MVP\jesse-endevo-v2")

SOURCE_FILES = [
    # Architecture & integration docs
    ("README.md",                              "readme",      "Jesse v2 product overview — domains, scoring, API, tech stack"),
    ("docs/AI-RAG-PIPELINE.md",                "architecture","RAG pipeline architecture — embeddings, vector search, chat flow, ingestion"),
    ("docs/SAAS_INTEGRATION_SPEC.md",          "integration", "SaaS integration spec — 40 questions, scoring, tiers, module framework, DB schema"),
    ("docs/DEVELOPER-NOTES.md",                "developer",   "Developer integration notes — component wiring, transitions, scoring, brand"),
    # Assessment JSX files (contain questions, Jesse responses, scoring context)
    ("docs/financial-assessment-v2.jsx",        "assessment",  "Financial domain assessment — 10 questions with Jesse coaching responses"),
    ("docs/legal-assessment-v2.jsx",            "assessment",  "Legal domain assessment — 10 questions with Jesse coaching responses"),
    ("docs/physical-assessment-v2.jsx",         "assessment",  "Physical domain assessment — 10 questions with Jesse coaching responses"),
    # Backend scoring logic (signals for all 40 questions)
    ("backend/services/scoring.ts",            "scoring",     "Scoring engine — point values, tier thresholds, signal map for all 40 questions"),
    # Frontend question definitions (the actual 40 questions + readiness tiers)
    ("frontend/src/data/questions.ts",         "questions",    "All 40 assessment questions across 4 domains with answer options and readiness tiers"),
]


# ── AWS Clients ──────────────────────────────────────────────────────────────

def get_dynamodb_table():
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return dynamodb.Table(KNOWLEDGE_TABLE)


def get_bedrock_client():
    return boto3.client("bedrock-runtime", region_name=AWS_REGION)


# ── Text Extraction ─────────────────────────────────────────────────────────

def read_file(file_path: Path) -> Optional[str]:
    """Read a text file and return its contents."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except (OSError, IOError) as err:
        print(f"  [ERROR] Cannot read {file_path}: {err}")
        return None


# ── Chunking ────────────────────────────────────────────────────────────────

def chunk_text(text: str) -> list[str]:
    """Split text into ~800-char chunks with 150-char overlap.

    Matches Aryan's character-based sliding window approach from
    ingest-folder.ts (800 chars, 150 overlap, min 100 chars).
    """
    # Normalise whitespace
    clean = text.replace("\r\n", "\n")
    # Collapse excessive blank lines
    while "\n\n\n" in clean:
        clean = clean.replace("\n\n\n", "\n\n")

    if len(clean) < MIN_CHUNK_CHARS:
        return []

    chunks: list[str] = []
    start = 0
    text_len = len(clean)

    while start < text_len:
        end = min(start + CHUNK_SIZE_CHARS, text_len)
        chunk = clean[start:end].strip()

        if len(chunk) >= MIN_CHUNK_CHARS:
            chunks.append(chunk)

        if end >= text_len:
            break
        start = end - OVERLAP_CHARS

    return chunks


# ── Embeddings ──────────────────────────────────────────────────────────────

def embed_text(bedrock_client, text: str) -> Optional[list[float]]:
    """Generate embedding via Bedrock Titan Embed V2 (1024-dim).

    Includes retry with exponential backoff for throttling.
    """
    # Titan Embed V2 has 8192 token input limit; truncate chars to be safe
    truncated = text[:8192]

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


# ── DynamoDB Operations ─────────────────────────────────────────────────────

def store_chunk(
    table,
    source_file: str,
    chunk_index: int,
    content: str,
    embedding: list[float],
    metadata: dict,
) -> None:
    """Store a single chunk + embedding in DynamoDB.

    Embeddings are stored as a list of Decimal values (DynamoDB
    does not support float -- Decimal is required).
    """
    sk = f"CHUNK#{chunk_index:04d}"

    # Convert float embedding to Decimal for DynamoDB
    decimal_embedding = [Decimal(str(round(v, 8))) for v in embedding]

    item = {
        "sourceFile": source_file,
        "chunkIndex": sk,
        "content": content,
        "embedding": decimal_embedding,
        "metadata": json.dumps(metadata),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    table.put_item(Item=item)


# ── Main Ingestion ──────────────────────────────────────────────────────────

def run_ingestion(dry_run: bool) -> None:
    print("=" * 64)
    print("  Jesse Knowledge Base — Aryan Repo Ingestion")
    print("=" * 64)
    print(f"  Table    : {KNOWLEDGE_TABLE}")
    print(f"  Region   : {AWS_REGION}")
    print(f"  Model    : {EMBED_MODEL} ({EMBED_DIMENSIONS}-dim)")
    print(f"  Chunking : {CHUNK_SIZE_CHARS} chars, {OVERLAP_CHARS} overlap, min {MIN_CHUNK_CHARS}")
    print(f"  Sources  : {len(SOURCE_FILES)} files")
    print(f"  Mode     : {'DRY RUN' if dry_run else 'EXECUTE'}")
    print("=" * 64)
    print()

    if not dry_run:
        table = get_dynamodb_table()
        bedrock_client = get_bedrock_client()
    else:
        table = None
        bedrock_client = None

    total_chunks = 0
    total_chars = 0
    total_files_ok = 0
    total_chunks_failed = 0

    for rel_path, category, description in SOURCE_FILES:
        file_path = BASE_DIR / rel_path
        # Use the relative path from the repo root as the sourceFile key
        source_key = f"jesse-v2/{rel_path}"

        print(f"  [{category.upper():12s}] {rel_path}")

        # Read file
        text = read_file(file_path)
        if not text:
            print(f"    -> SKIP (unreadable)")
            continue

        # Chunk
        chunks = chunk_text(text)
        if not chunks:
            print(f"    -> SKIP (too short: {len(text)} chars)")
            continue

        total_chars += len(text)
        print(f"    -> {len(text):,} chars -> {len(chunks)} chunks")

        if dry_run:
            total_chunks += len(chunks)
            total_files_ok += 1
            continue

        # Embed + store each chunk
        file_ok = 0
        for i, chunk_content in enumerate(chunks):
            embedding = embed_text(bedrock_client, chunk_content)
            if not embedding:
                print(f"    chunk {i}: embed FAILED")
                total_chunks_failed += 1
                continue

            metadata = {
                "category": category,
                "description": description,
                "fileType": Path(rel_path).suffix.lower(),
                "charCount": len(chunk_content),
                "totalChunks": len(chunks),
                "sourceRepo": "jesse-endevo-v2",
            }

            store_chunk(
                table=table,
                source_file=source_key,
                chunk_index=i,
                content=chunk_content,
                embedding=embedding,
                metadata=metadata,
            )
            file_ok += 1

        total_chunks += file_ok
        total_files_ok += 1
        print(f"    -> {file_ok}/{len(chunks)} chunks stored")

    # Summary
    print()
    print("=" * 64)
    print("  SUMMARY")
    print(f"    Files processed    : {total_files_ok}/{len(SOURCE_FILES)}")
    print(f"    Total chars read   : {total_chars:,}")
    print(f"    Chunks created     : {total_chunks}")
    print(f"    Chunks failed      : {total_chunks_failed}")
    if dry_run:
        print()
        print("  ** DRY RUN -- no data was written **")
        print("  Re-run with --execute to ingest for real.")
    print("=" * 64)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest Aryan's jesse-endevo-v2 content into DynamoDB knowledge base",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Show what would be ingested without writing anything",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Actually write chunks + embeddings to DynamoDB",
    )

    args = parser.parse_args()

    if not args.execute and not args.dry_run:
        print("[INFO] No mode specified. Defaulting to --dry-run.")
        print("       Use --execute to write to DynamoDB.\n")
        args.dry_run = True

    run_ingestion(dry_run=not args.execute)


if __name__ == "__main__":
    main()
