#!/usr/bin/env python3
"""
jesse-ingest.py
───────────────
Incrementally ingests a folder of documents into DynamoDB for Jesse AI.

Replaces Aryan's Aurora pgvector approach with DynamoDB-based vector storage.
Uses Bedrock Titan Embed V2 for 1024-dim embeddings.

Usage:
  # Dry run (default) — shows what would be ingested
  python scripts/jesse-ingest.py --folder ./content/

  # Actually ingest
  python scripts/jesse-ingest.py --folder ./content/ --execute

  # List already-ingested files
  python scripts/jesse-ingest.py --list

  # Search test (verify embeddings work)
  python scripts/jesse-ingest.py --search "what is a durable power of attorney"

SCALING NOTE:
  DynamoDB scan-based vector search works for <10K chunks.
  Beyond that, migrate to:
  - Amazon OpenSearch Serverless (k-NN plugin)
  - Amazon Bedrock Knowledge Base (managed RAG)
  - Amazon Aurora with pgvector
"""

import argparse
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

# ── Config ────────────────────────────────────────────────────────────────────

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
KNOWLEDGE_TABLE = os.environ.get("KNOWLEDGE_TABLE", "endevo-uat-knowledge-base")
S3_BUCKET = os.environ.get("S3_BUCKET", "endevo-uat-lms-content")
EMBED_MODEL = os.environ.get("BEDROCK_EMBED_MODEL", "amazon.titan-embed-text-v2:0")
EMBED_DIMENSIONS = 1024

# Chunking config — matches Aryan's approach but uses word counts
CHUNK_SIZE_WORDS = 300
OVERLAP_WORDS = 50
MIN_CHUNK_WORDS = 30

SUPPORTED_EXTENSIONS = {".txt", ".vtt"}
SKIP_EXTENSIONS = {".pdf", ".docx"}  # Print warning, user must pre-convert

# Bedrock throttle retry
MAX_RETRIES = 5
BASE_DELAY = 1.0  # seconds


# ── AWS Clients ───────────────────────────────────────────────────────────────

def get_dynamodb_table():
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return dynamodb.Table(KNOWLEDGE_TABLE)


def get_bedrock_client():
    return boto3.client("bedrock-runtime", region_name=AWS_REGION)


def get_s3_client():
    return boto3.client("s3", region_name=AWS_REGION)


# ── Text Extraction ──────────────────────────────────────────────────────────

def extract_text(file_path):
    """Extract text from a supported file. Returns text string or None."""
    ext = Path(file_path).suffix.lower()

    if ext in SKIP_EXTENSIONS:
        print(f"  [WARN] {ext} not supported — pre-convert to .txt: {file_path}")
        return None

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            raw = f.read()
    except (OSError, IOError) as err:
        print(f"  [ERROR] Cannot read {file_path}: {err}")
        return None

    if ext == ".vtt":
        return _clean_vtt(raw)

    # .txt — return as-is
    return raw


def _clean_vtt(raw):
    """Strip VTT timestamps, cue numbers, WEBVTT header, and NOTE blocks.

    Matches Aryan's VTT cleaning logic from ingest-folder.ts.
    """
    lines = []
    for line in raw.split("\n"):
        t = line.strip()
        if not t:
            continue
        if t == "WEBVTT":
            continue
        # Timestamp lines: 00:00:01.234 --> 00:00:05.678
        if re.match(r"^\d{2}:\d{2}", t):
            continue
        # NOTE blocks
        if t.startswith("NOTE"):
            continue
        # Cue sequence numbers (just digits)
        if re.match(r"^\d+$", t):
            continue
        lines.append(t)

    text = " ".join(lines)
    # Collapse multiple spaces
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


# ── Chunking ─────────────────────────────────────────────────────────────────

def chunk_text(text):
    """Split text into ~300-word chunks with 50-word overlap.

    Mirrors Aryan's sliding window approach but uses word boundaries
    instead of character boundaries for more semantic coherence.
    """
    # Clean up whitespace
    clean = re.sub(r"\r\n", "\n", text)
    clean = re.sub(r"\n{3,}", "\n\n", clean)
    clean = re.sub(r"[ \t]{2,}", " ", clean).strip()

    words = clean.split()
    if len(words) < MIN_CHUNK_WORDS:
        return []

    chunks = []
    start = 0
    while start < len(words):
        end = min(start + CHUNK_SIZE_WORDS, len(words))
        chunk_words = words[start:end]
        chunk_text_str = " ".join(chunk_words)

        if len(chunk_words) >= MIN_CHUNK_WORDS:
            chunks.append(chunk_text_str)

        if end >= len(words):
            break
        start = end - OVERLAP_WORDS

    return chunks


# ── Embeddings ───────────────────────────────────────────────────────────────

def embed_text(bedrock_client, text):
    """Generate embedding via Bedrock Titan Embed V2 (1024-dim).

    Includes retry with exponential backoff for throttling.
    Returns list of floats, or None on failure.
    """
    # Titan Embed V2 has 8192 token input limit; truncate to be safe
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


# ── DynamoDB Operations ──────────────────────────────────────────────────────

def get_ingested_files(table):
    """Return a set of sourceFile values already in the knowledge base.

    Scans with a ProjectionExpression to minimize read cost.
    """
    ingested = set()
    params = {
        "ProjectionExpression": "sourceFile",
        "FilterExpression": "chunkIndex = :first_chunk",
        "ExpressionAttributeValues": {":first_chunk": "CHUNK#0000"},
    }

    while True:
        response = table.scan(**params)
        for item in response.get("Items", []):
            ingested.add(item["sourceFile"])
        if "LastEvaluatedKey" not in response:
            break
        params["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return ingested


def store_chunk(table, source_file, chunk_index, content, embedding, metadata):
    """Store a single chunk + embedding in DynamoDB.

    Embeddings are stored as a list of Decimal values (DynamoDB
    does not support float — Decimal is required).
    """
    sk = f"CHUNK#{chunk_index:04d}"

    # Convert float embedding to Decimal for DynamoDB
    decimal_embedding = [Decimal(str(round(v, 8))) for v in embedding]

    item = {
        "sourceFile": source_file,
        "chunkIndex": sk,
        "content": content,
        "embedding": decimal_embedding,
        "metadata": {
            "fileType": Path(source_file).suffix.lower(),
            "wordCount": len(content.split()),
            "chunkSize": CHUNK_SIZE_WORDS,
            "ingestedAt": datetime.now(timezone.utc).isoformat(),
        },
        "ingestedAt": datetime.now(timezone.utc).isoformat(),
    }
    if metadata:
        item["metadata"].update(metadata)

    table.put_item(Item=item)


def upload_to_s3(s3_client, file_path, source_key):
    """Upload original file to S3 for archival."""
    s3_key = f"knowledge-base/{source_key}"
    try:
        s3_client.upload_file(
            Filename=str(file_path),
            Bucket=S3_BUCKET,
            Key=s3_key,
            ExtraArgs={"ContentType": _content_type(file_path)},
        )
        return True
    except ClientError as err:
        print(f"  [ERROR] S3 upload failed: {err}")
        return False


def _content_type(file_path):
    ext = Path(file_path).suffix.lower()
    return {
        ".txt": "text/plain",
        ".vtt": "text/vtt",
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }.get(ext, "application/octet-stream")


# ── File Scanner ─────────────────────────────────────────────────────────────

def scan_folder(folder_path):
    """Recursively find supported files. Returns list of Path objects."""
    folder = Path(folder_path)
    all_extensions = SUPPORTED_EXTENSIONS | SKIP_EXTENSIONS
    files = []
    for f in sorted(folder.rglob("*")):
        if f.is_file() and f.suffix.lower() in all_extensions:
            files.append(f)
    return files


# ── Cosine Similarity (pure Python) ─────────────────────────────────────────

def cosine_similarity(vec_a, vec_b):
    """Compute cosine similarity between two vectors. Pure Python, no numpy."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ── Vector Search ────────────────────────────────────────────────────────────

def search_knowledge(table, bedrock_client, query_text, top_k=5):
    """Search knowledge base using cosine similarity.

    DynamoDB does not have native vector search, so we:
    1. Embed the query via Bedrock Titan Embed V2
    2. Scan the knowledge-base table (OK for <10K chunks)
    3. Compute cosine similarity between query and each chunk
    4. Return top_k most similar chunks

    SCALING NOTE: For >10K chunks, migrate to:
    - Amazon OpenSearch Serverless (k-NN plugin)
    - Amazon Bedrock Knowledge Base (managed RAG)
    """
    query_embedding = embed_text(bedrock_client, query_text)
    if not query_embedding:
        print("[search] Failed to embed query")
        return []

    # Scan all chunks
    all_chunks = []
    params = {
        "ProjectionExpression": "sourceFile, chunkIndex, content, embedding",
    }
    while True:
        response = table.scan(**params)
        all_chunks.extend(response.get("Items", []))
        if "LastEvaluatedKey" not in response:
            break
        params["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    if not all_chunks:
        print("[search] Knowledge base is empty")
        return []

    # Score each chunk
    scored = []
    for chunk in all_chunks:
        stored_embedding = [float(v) for v in chunk.get("embedding", [])]
        if not stored_embedding:
            continue
        score = cosine_similarity(query_embedding, stored_embedding)
        scored.append({
            "sourceFile": chunk["sourceFile"],
            "chunkIndex": chunk["chunkIndex"],
            "content": chunk["content"],
            "score": score,
        })

    # Sort by score descending, return top_k
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


# ── CLI Commands ─────────────────────────────────────────────────────────────

def cmd_ingest(args):
    """Ingest files from a folder into DynamoDB + S3."""
    folder = Path(args.folder).resolve()
    dry_run = not args.execute

    print("=" * 60)
    print("  Jesse Knowledge Base — DynamoDB Ingestion")
    print("=" * 60)
    print(f"  Folder  : {folder}")
    print(f"  Table   : {KNOWLEDGE_TABLE}")
    print(f"  S3      : {S3_BUCKET}")
    print(f"  Model   : {EMBED_MODEL} ({EMBED_DIMENSIONS}-dim)")
    print(f"  Mode    : {'EXECUTE' if not dry_run else 'DRY RUN (use --execute to write)'}")
    print("=" * 60)
    print()

    if not folder.exists():
        print(f"[ERROR] Folder not found: {folder}")
        sys.exit(1)

    # 1. Scan folder
    all_files = scan_folder(folder)
    print(f"[ingest] Found {len(all_files)} file(s)")
    if not all_files:
        print("[ingest] Nothing to do.")
        return

    # 2. Check already-ingested files
    table = get_dynamodb_table()

    if not dry_run:
        print("[ingest] Checking for previously ingested files...")
        ingested = get_ingested_files(table)
        print(f"[ingest] Already in DB: {len(ingested)} unique file(s)")
        bedrock_client = get_bedrock_client()
        s3_client = get_s3_client()
    else:
        ingested = set()
        bedrock_client = None
        s3_client = None

    print()

    stats = {"new": 0, "skipped_dup": 0, "skipped_unsupported": 0,
             "chunks_embedded": 0, "chunks_failed": 0}

    for file_path in all_files:
        source_key = str(file_path.relative_to(folder)).replace("\\", "/")

        # Skip unsupported formats (PDF/DOCX)
        if file_path.suffix.lower() in SKIP_EXTENSIONS:
            print(f"  [SKIP] {source_key} — {file_path.suffix} not supported, pre-convert to .txt")
            stats["skipped_unsupported"] += 1
            continue

        # Skip already ingested
        if source_key in ingested:
            print(f"  [SKIP] {source_key} — already ingested")
            stats["skipped_dup"] += 1
            continue

        # Extract text
        text = extract_text(str(file_path))
        if not text or len(text.split()) < MIN_CHUNK_WORDS:
            print(f"  [SKIP] {source_key} — empty or too short")
            continue

        # Chunk
        chunks = chunk_text(text)
        print(f"  [NEW]  {source_key} — {len(chunks)} chunks, {len(text.split())} words")

        if dry_run:
            stats["new"] += 1
            stats["chunks_embedded"] += len(chunks)
            continue

        # Embed + store each chunk
        file_ok = 0
        for i, chunk_content in enumerate(chunks):
            embedding = embed_text(bedrock_client, chunk_content)
            if not embedding:
                print(f"    chunk {i}: embed failed — skipping")
                stats["chunks_failed"] += 1
                continue

            store_chunk(
                table=table,
                source_file=source_key,
                chunk_index=i,
                content=chunk_content,
                embedding=embedding,
                metadata={"folder": str(Path(source_key).parent)},
            )
            file_ok += 1
            stats["chunks_embedded"] += 1

        # Upload original to S3
        if s3_client:
            upload_to_s3(s3_client, file_path, source_key)

        print(f"    -> {file_ok}/{len(chunks)} chunks stored")
        stats["new"] += 1

    # Summary
    print()
    print("=" * 60)
    print("  DONE")
    print(f"    New files ingested    : {stats['new']}")
    print(f"    Files skipped (dup)   : {stats['skipped_dup']}")
    print(f"    Files skipped (format): {stats['skipped_unsupported']}")
    print(f"    Chunks embedded       : {stats['chunks_embedded']}")
    print(f"    Chunks failed         : {stats['chunks_failed']}")
    if dry_run:
        print()
        print("  ** DRY RUN — no data was written **")
        print("  Re-run with --execute to ingest for real.")
    print("=" * 60)


def cmd_list(args):
    """List all ingested files in the knowledge base."""
    print("[list] Scanning knowledge base...")
    table = get_dynamodb_table()
    ingested = get_ingested_files(table)

    if not ingested:
        print("[list] Knowledge base is empty.")
        return

    print(f"\n[list] {len(ingested)} ingested file(s):\n")
    for source_file in sorted(ingested):
        print(f"  - {source_file}")


def cmd_search(args):
    """Search the knowledge base with a query string."""
    query = args.search
    print(f'[search] Query: "{query}"')
    print(f"[search] Embedding via {EMBED_MODEL}...")

    table = get_dynamodb_table()
    bedrock_client = get_bedrock_client()

    results = search_knowledge(table, bedrock_client, query, top_k=5)

    if not results:
        print("[search] No results found.")
        return

    print(f"\n[search] Top {len(results)} results:\n")
    for i, result in enumerate(results):
        score = result["score"]
        source = result["sourceFile"]
        chunk_id = result["chunkIndex"]
        content_preview = result["content"][:200].replace("\n", " ")
        print(f"  {i + 1}. [{score:.4f}] {source} ({chunk_id})")
        print(f"     {content_preview}...")
        print()


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Jesse AI Knowledge Base Ingestion Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/jesse-ingest.py --folder ./content/            # dry run
  python scripts/jesse-ingest.py --folder ./content/ --execute  # real ingest
  python scripts/jesse-ingest.py --list                         # list ingested files
  python scripts/jesse-ingest.py --search "power of attorney"   # search test
        """,
    )

    parser.add_argument(
        "--folder",
        type=str,
        help="Path to folder containing content files (PDFs, TXT, VTT, DOCX)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Actually write to DynamoDB and S3 (default is dry run)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        default=False,
        help="List all ingested files in the knowledge base",
    )
    parser.add_argument(
        "--search",
        type=str,
        help="Search the knowledge base with a query string",
    )

    args = parser.parse_args()

    # Route to command
    if args.list:
        cmd_list(args)
    elif args.search:
        cmd_search(args)
    elif args.folder:
        cmd_ingest(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
