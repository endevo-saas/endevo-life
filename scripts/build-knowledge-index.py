#!/usr/bin/env python3
"""
Build a compressed knowledge index for Jesse AI from Niki's knowledge base.

Reads the full 5.6MB knowledge_niki.txt (7,228 chunks, ~192 source files),
deduplicates overlapping content, compresses each source to essential content,
and produces a ~150-200KB file (~40-50K tokens) suitable for AI prompt injection.

Usage:
    python build-knowledge-index.py
"""

import os
import re
import sys
from collections import OrderedDict

# --- Configuration ---
INPUT_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "backend", "functions", "jesse", "knowledge_niki.txt"
)
OUTPUT_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "backend", "functions", "jesse", "knowledge_compressed.txt"
)

# Per-source character budget (after dedup). Prose sources get more, code sources get less.
PROSE_CHAR_BUDGET = 1000
CODE_CHAR_BUDGET = 600
# Minimum overlap length to detect chunk-boundary duplicates
OVERLAP_MIN = 80


def is_code_source(source_path: str) -> bool:
    """Check if a source is code/config rather than prose."""
    code_extensions = {".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".py", ".yaml", ".yml"}
    ext = os.path.splitext(source_path)[1].lower()
    if ext in code_extensions and "jesse-v2/" in source_path:
        return True
    return False


def extract_short_name(source_path: str) -> str:
    """Convert a full source path into a readable short name."""
    # Remove common prefix
    path = source_path.strip()
    path = re.sub(r"^Aryan AI Folder/", "", path)

    # Handle book episodes
    m = re.match(r"Book - Before I Ghost You/Batch \d+/(.+?)\.docx$", path)
    if m:
        return f"Book: {m.group(1)}"

    # Handle podcast blog transcripts
    m = re.match(r"Podcast blog transcripts/(.+?)\.docx$", path)
    if m:
        return f"Podcast: {m.group(1)}"

    # Handle client transcripts
    m = re.match(r"Book - Before I Ghost You/Batch \d+/(.+?)\.docx$", path)
    if m:
        return f"Client: {m.group(1)}"

    # Handle jesse-v2 code
    if path.startswith("jesse-v2/"):
        return f"Jesse Code: {path}"

    # Fallback: strip extension, use filename
    base = os.path.splitext(os.path.basename(path))[0]
    if base:
        return base
    return path


def generate_topic_summary(short_name: str, content_preview: str) -> str:
    """Generate a one-line topic summary from the source name and content."""
    content_preview = content_preview.strip()
    # Skip empty lines, headers, timestamps, and tab-separated metadata lines
    lines = []
    for l in content_preview.split("\n"):
        l_stripped = l.strip()
        if not l_stripped:
            continue
        if l_stripped.startswith("#"):
            continue
        # Skip otter.ai metadata lines (tab-separated dates, timestamps)
        if re.match(r'^[\w\s,&()]+\t', l_stripped):
            continue
        # Skip short timestamp-only lines
        if re.match(r'^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s', l_stripped):
            continue
        # Skip lines that are mostly special chars
        if len(re.sub(r'[^a-zA-Z]', '', l_stripped)) < 10:
            continue
        lines.append(l_stripped)

    # Find the first meaningful sentence (>40 chars, looks like prose)
    first_sentence = ""
    for line in lines[:15]:
        # Try to get a sentence
        sentences = re.split(r'(?<=[.!?])\s+', line)
        for s in sentences:
            s = s.strip()
            if len(s) > 40 and not s.startswith("http") and not s.startswith("("):
                # Verify it has actual words
                words = s.split()
                if len(words) >= 5:
                    first_sentence = s
                    break
        if first_sentence:
            break

    if first_sentence:
        # Truncate to 120 chars
        if len(first_sentence) > 120:
            first_sentence = first_sentence[:117] + "..."
        return first_sentence

    # Fallback: use the short_name itself as description
    return "legacy planning session transcript"


def remove_chunk_overlaps(text: str) -> str:
    """
    Remove overlapping content created by chunk boundaries.

    The chunking process creates ~150-char overlaps between consecutive chunks.
    We detect these by finding repeated substrings at line boundaries.
    """
    lines = text.split("\n")
    if len(lines) < 3:
        return text

    result_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # Check if this line is a partial duplicate of a previous line
        # (overlap fragments typically start mid-word or mid-sentence)
        if i > 0 and len(line.strip()) > 0:
            # Check if this line is a suffix of the previous assembled text
            prev_text = "\n".join(result_lines[-3:]) if result_lines else ""
            line_stripped = line.strip()

            # If the line is short and appears to be a fragment that already
            # exists in recent context, skip it
            if (len(line_stripped) < 200 and len(line_stripped) > 10
                and line_stripped in prev_text):
                i += 1
                continue

        result_lines.append(line)
        i += 1

    return "\n".join(result_lines)


def deduplicate_sentences(text: str) -> str:
    """
    Remove duplicate sentences from text while preserving order.
    Uses sentence-level dedup to handle chunk overlaps that span lines.
    """
    # Split into sentences (roughly)
    # Handle both period-based and newline-based boundaries
    paragraphs = text.split("\n\n")
    seen_sentences = set()
    result_paragraphs = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Split paragraph into sentences
        sentences = re.split(r'(?<=[.!?])\s+', para)
        unique_sentences = []

        for sent in sentences:
            sent_stripped = sent.strip()
            if not sent_stripped:
                continue

            # Normalize for comparison: lowercase, collapse whitespace
            normalized = re.sub(r'\s+', ' ', sent_stripped.lower())

            # Skip very short fragments (likely overlap artifacts)
            if len(normalized) < 15:
                unique_sentences.append(sent_stripped)
                continue

            # Check if we've seen this sentence (or close variant)
            if normalized not in seen_sentences:
                seen_sentences.add(normalized)
                unique_sentences.append(sent_stripped)

        if unique_sentences:
            result_paragraphs.append(" ".join(unique_sentences))

    return "\n\n".join(result_paragraphs)


def compress_source(text: str, budget: int) -> str:
    """
    Compress a source's content to fit within the character budget.
    Prioritizes the beginning of the content (intro/summary) and
    any list/actionable items.
    """
    text = text.strip()
    if len(text) <= budget:
        return text

    # Strategy: take the first portion up to budget, but try to break at
    # a sentence or paragraph boundary
    truncated = text[:budget]

    # Try to end at a paragraph boundary
    last_para = truncated.rfind("\n\n")
    if last_para > budget * 0.7:
        truncated = truncated[:last_para]
    else:
        # Try to end at a sentence boundary
        last_sentence = max(
            truncated.rfind(". "),
            truncated.rfind(".\n"),
            truncated.rfind("? "),
            truncated.rfind("! ")
        )
        if last_sentence > budget * 0.7:
            truncated = truncated[:last_sentence + 1]

    return truncated.strip()


def categorize_sources(sources: dict) -> dict:
    """Group sources into categories for the index."""
    categories = OrderedDict()
    categories["Book Chapters (Before I Ghost You)"] = []
    categories["Client Stories"] = []
    categories["Podcast Episodes"] = []
    categories["Jesse AI Code & Docs"] = []

    for source_path, data in sources.items():
        short_name = data["short_name"]
        if "Book:" in short_name or ("Book - Before I Ghost You" in source_path and "Episode" in source_path):
            categories["Book Chapters (Before I Ghost You)"].append(data)
        elif "Podcast:" in short_name:
            categories["Podcast Episodes"].append(data)
        elif "Jesse Code:" in short_name or source_path.startswith("jesse-v2/"):
            categories["Jesse AI Code & Docs"].append(data)
        else:
            # Client stories and other book content
            categories["Client Stories"].append(data)

    # Remove empty categories
    return OrderedDict((k, v) for k, v in categories.items() if v)


def parse_sources(filepath: str) -> OrderedDict:
    """Parse the knowledge file into source-grouped content."""
    print(f"Reading {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        raw = f.read()

    print(f"  Raw size: {len(raw):,} bytes ({len(raw.split(chr(10))):,} lines)")

    # Split by SOURCE headers
    source_pattern = re.compile(r"^### SOURCE:\s*(.+)$", re.MULTILINE)
    matches = list(source_pattern.finditer(raw))

    print(f"  Found {len(matches)} source sections")

    sources = OrderedDict()
    for idx, match in enumerate(matches):
        source_path = match.group(1).strip()
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(raw)
        content = raw[start:end].strip()

        if source_path in sources:
            # Append additional chunks for same source
            sources[source_path]["raw_content"] += "\n\n" + content
        else:
            sources[source_path] = {
                "source_path": source_path,
                "short_name": extract_short_name(source_path),
                "raw_content": content,
                "is_code": is_code_source(source_path),
            }

    return sources


def process_sources(sources: OrderedDict) -> OrderedDict:
    """Deduplicate and compress each source."""
    total_raw = 0
    total_compressed = 0

    for source_path, data in sources.items():
        raw_len = len(data["raw_content"])
        total_raw += raw_len

        # Step 1: Remove chunk overlaps
        cleaned = remove_chunk_overlaps(data["raw_content"])

        # Step 2: Deduplicate sentences
        deduped = deduplicate_sentences(cleaned)

        # Step 3: Compress to budget
        budget = CODE_CHAR_BUDGET if data["is_code"] else PROSE_CHAR_BUDGET
        compressed = compress_source(deduped, budget)

        data["compressed_content"] = compressed
        data["topic_summary"] = generate_topic_summary(
            data["short_name"], compressed
        )

        total_compressed += len(compressed)

    print(f"  Raw content total: {total_raw:,} chars")
    print(f"  Compressed total:  {total_compressed:,} chars")
    print(f"  Compression ratio: {total_compressed / total_raw * 100:.1f}%")

    return sources


def build_output(sources: OrderedDict) -> str:
    """Build the final compressed knowledge file."""
    categories = categorize_sources(sources)

    total_sources = sum(len(v) for v in categories.values())

    lines = []
    lines.append("# ENDEVO LIFE — Jesse AI Knowledge Base")
    lines.append(f"# Compiled from 7,228 chunks, {total_sources} source files")
    lines.append("# Use this context to answer questions about Niki's legacy planning methodology")
    lines.append("# Topics: estate planning, digital legacy, end-of-life planning, grief, caregiving,")
    lines.append("#         wills & trusts, funeral planning, digital assets, medical aid in dying,")
    lines.append("#         business continuity, divorce & death, natural burials, death doulas,")
    lines.append("#         Medicare, advance care planning, pet end-of-life, HR death benefits")
    lines.append("")
    lines.append("")

    # --- INDEX ---
    lines.append("## INDEX")
    lines.append("")

    for category, items in categories.items():
        lines.append(f"### {category}")
        for item in items:
            lines.append(f"- {item['short_name']} — {item['topic_summary']}")
        lines.append("")

    lines.append("")

    # --- CONTENT ---
    lines.append("## CONTENT")
    lines.append("")

    for category, items in categories.items():
        lines.append(f"{'=' * 60}")
        lines.append(f"## {category}")
        lines.append(f"{'=' * 60}")
        lines.append("")

        for item in items:
            lines.append(f"### {item['short_name']}")
            lines.append(f"Source: {item['source_path']}")
            lines.append("")
            lines.append(item["compressed_content"])
            lines.append("")
            lines.append("")

    return "\n".join(lines)


def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English text."""
    return len(text) // 4


def main():
    print("=" * 60)
    print("Jesse AI Knowledge Base Compressor")
    print("=" * 60)
    print()

    # Resolve paths
    input_path = os.path.normpath(INPUT_FILE)
    output_path = os.path.normpath(OUTPUT_FILE)

    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)

    # Parse
    sources = parse_sources(input_path)

    # Process
    print("\nProcessing sources...")
    sources = process_sources(sources)

    # Build output
    print("\nBuilding output...")
    output = build_output(sources)

    # Write
    print(f"\nWriting to {output_path}...")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(output)

    # Report
    file_size = os.path.getsize(output_path)
    token_est = estimate_tokens(output)

    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"  Input:       {os.path.getsize(input_path):,} bytes ({os.path.getsize(input_path) / 1024:.0f} KB)")
    print(f"  Output:      {file_size:,} bytes ({file_size / 1024:.0f} KB)")
    print(f"  Reduction:   {(1 - file_size / os.path.getsize(input_path)) * 100:.1f}%")
    print(f"  Est. tokens: ~{token_est:,}")
    print(f"  Sources:     {len(sources)}")
    print(f"  Output file: {output_path}")
    print()

    # Warn if over/under target
    if file_size > 220_000:
        print(f"  WARNING: Output is {file_size / 1024:.0f}KB, over 200KB target.")
        print("  Consider reducing PROSE_CHAR_BUDGET or CODE_CHAR_BUDGET.")
    elif file_size < 100_000:
        print(f"  NOTE: Output is {file_size / 1024:.0f}KB, under 100KB.")
        print("  Consider increasing PROSE_CHAR_BUDGET for more coverage.")
    else:
        print("  Output is within target range (150-200KB).")


if __name__ == "__main__":
    main()
