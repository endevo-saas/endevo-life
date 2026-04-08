"""
jesse-vector-search.py
──────────────────────
Vector search utility for Jesse AI knowledge base.
Uses DynamoDB + cosine similarity (no Aurora/pgvector needed).

Can be imported by the Jesse Lambda (jesse/main.py) or used standalone.

Usage as module:
    from scripts.jesse_vector_search import search_knowledge_base

Usage standalone:
    python scripts/jesse-vector-search.py "what is a durable power of attorney"
    python scripts/jesse-vector-search.py "estate planning basics" --top-k 10

SCALING NOTE:
    This DynamoDB scan approach works well for <10K chunks.
    Beyond that, migrate to one of:
    - Amazon OpenSearch Serverless with k-NN plugin
    - Amazon Bedrock Knowledge Base (fully managed RAG)
    - Amazon Aurora PostgreSQL with pgvector extension
    The interface (search_knowledge_base) stays the same —
    only the internal implementation changes.
"""

import json
import math
import os
import sys
import time
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

# ── Config ────────────────────────────────────────────────────────────────────

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
KNOWLEDGE_TABLE = os.environ.get("KNOWLEDGE_TABLE", "endevo-uat-knowledge-base")
EMBED_MODEL = os.environ.get("BEDROCK_EMBED_MODEL", "amazon.titan-embed-text-v2:0")
EMBED_DIMENSIONS = 1024

MAX_RETRIES = 5
BASE_DELAY = 1.0


# ── Cosine Similarity (pure Python, no numpy) ───────────────────────────────

def cosine_similarity(vec_a, vec_b):
    """Compute cosine similarity between two vectors.

    Args:
        vec_a: First vector (list of floats)
        vec_b: Second vector (list of floats)

    Returns:
        Float between -1.0 and 1.0 (1.0 = identical direction)
    """
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ── Embedding ────────────────────────────────────────────────────────────────

def _get_bedrock_client():
    """Lazy-init Bedrock client."""
    return boto3.client("bedrock-runtime", region_name=AWS_REGION)


def _get_dynamodb_table():
    """Lazy-init DynamoDB table resource."""
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return dynamodb.Table(KNOWLEDGE_TABLE)


def embed_query(text, bedrock_client=None):
    """Generate embedding for a query string via Bedrock Titan Embed V2.

    Args:
        text: The query text to embed
        bedrock_client: Optional pre-initialized client (for reuse in Lambda)

    Returns:
        List of 1024 floats, or None on failure
    """
    if bedrock_client is None:
        bedrock_client = _get_bedrock_client()

    # Titan Embed V2 supports up to 8192 tokens
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
            return result.get("embedding", [])

        except ClientError as err:
            error_code = err.response["Error"]["Code"]
            if error_code == "ThrottlingException" and attempt < MAX_RETRIES - 1:
                delay = BASE_DELAY * (2 ** attempt)
                time.sleep(delay)
                continue
            return None
        except Exception:
            return None

    return None


# ── Knowledge Base Search ────────────────────────────────────────────────────

def search_knowledge_base(query_text, top_k=5, bedrock_client=None, table=None):
    """Search the Jesse AI knowledge base for chunks relevant to a query.

    This is the main entry point for the Jesse Lambda to call.

    Args:
        query_text: Natural language query string
        top_k: Number of results to return (default 5)
        bedrock_client: Optional pre-initialized Bedrock client
        table: Optional pre-initialized DynamoDB table resource

    Returns:
        List of dicts with keys: sourceFile, chunkIndex, content, score
        Sorted by relevance (highest score first).

    SCALING NOTE:
        Current implementation scans the full DynamoDB table and computes
        cosine similarity in Python. This is fine for <10K chunks.
        For production scale, replace the internals with:
        - OpenSearch Serverless k-NN query
        - Bedrock Knowledge Base RetrieveAndGenerate API
    """
    if bedrock_client is None:
        bedrock_client = _get_bedrock_client()
    if table is None:
        table = _get_dynamodb_table()

    # 1. Embed the query
    query_embedding = embed_query(query_text, bedrock_client)
    if not query_embedding:
        return []

    # 2. Scan all chunks from DynamoDB
    all_chunks = _scan_all_chunks(table)
    if not all_chunks:
        return []

    # 3. Score each chunk by cosine similarity
    scored = []
    for chunk in all_chunks:
        stored_embedding = chunk.get("embedding", [])
        if not stored_embedding:
            continue

        # DynamoDB stores as Decimal — convert to float for math
        stored_floats = [float(v) for v in stored_embedding]
        score = cosine_similarity(query_embedding, stored_floats)

        scored.append({
            "sourceFile": chunk.get("sourceFile", ""),
            "chunkIndex": chunk.get("chunkIndex", ""),
            "content": chunk.get("content", ""),
            "score": score,
        })

    # 4. Sort by score descending, return top_k
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def _scan_all_chunks(table):
    """Scan the entire knowledge base table.

    Uses ProjectionExpression to fetch only the fields we need,
    minimizing read capacity consumption.

    Returns list of items with: sourceFile, chunkIndex, content, embedding
    """
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

    return all_chunks


# ── Convenience: Build Context String for Jesse ──────────────────────────────

def get_knowledge_context(query_text, top_k=5, bedrock_client=None, table=None):
    """Search knowledge base and return a formatted context string.

    This is a convenience wrapper that the Jesse Lambda can call directly
    to get a string suitable for injecting into the LLM prompt.

    Args:
        query_text: The user's question
        top_k: Number of chunks to include
        bedrock_client: Optional pre-initialized client
        table: Optional pre-initialized table

    Returns:
        Formatted string with relevant knowledge chunks, or empty string
    """
    results = search_knowledge_base(
        query_text,
        top_k=top_k,
        bedrock_client=bedrock_client,
        table=table,
    )

    if not results:
        return ""

    # Filter out low-relevance results (below 0.3 cosine similarity)
    relevant = [r for r in results if r["score"] >= 0.3]
    if not relevant:
        return ""

    sections = []
    for r in relevant:
        source = r["sourceFile"]
        score = r["score"]
        content = r["content"]
        sections.append(
            f"[Source: {source} | Relevance: {score:.2f}]\n{content}"
        )

    return "\n\n---\n\n".join(sections)


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    """Standalone CLI for testing vector search."""
    if len(sys.argv) < 2:
        print("Usage: python jesse-vector-search.py <query> [--top-k N]")
        print()
        print("Example:")
        print('  python jesse-vector-search.py "what is a durable power of attorney"')
        print('  python jesse-vector-search.py "estate planning" --top-k 10')
        sys.exit(1)

    query = sys.argv[1]
    top_k = 5

    if "--top-k" in sys.argv:
        idx = sys.argv.index("--top-k")
        if idx + 1 < len(sys.argv):
            top_k = int(sys.argv[idx + 1])

    print(f'Searching: "{query}" (top {top_k})')
    print(f"Table: {KNOWLEDGE_TABLE}")
    print(f"Model: {EMBED_MODEL}")
    print()

    results = search_knowledge_base(query, top_k=top_k)

    if not results:
        print("No results found.")
        return

    for i, r in enumerate(results):
        score = r["score"]
        source = r["sourceFile"]
        chunk_id = r["chunkIndex"]
        preview = r["content"][:250].replace("\n", " ")
        print(f"{i + 1}. [{score:.4f}] {source} ({chunk_id})")
        print(f"   {preview}...")
        print()

    # Also show formatted context
    print("-" * 60)
    print("Formatted context for Jesse prompt:")
    print("-" * 60)
    context = get_knowledge_context(query, top_k=top_k)
    if context:
        print(context)
    else:
        print("(no chunks above relevance threshold)")


if __name__ == "__main__":
    main()
