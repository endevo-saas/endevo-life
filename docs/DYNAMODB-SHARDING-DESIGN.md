# DynamoDB Partition Key Sharding Design

> **Problem:** Single tenantId as PK = hot partition at scale (3,000 RCU limit per partition)
> **Impact:** 50,000 employees hitting one tenant at 9 AM = crash
> **Fix:** Composite sharding strategy
> **Status:** DESIGN PHASE — implement before first enterprise client

---

## Current Schema (Single Partition Risk)

| Table | PK | SK | Risk Level |
|-------|----|----|:---:|
| endevo-uat-users | userId | — | LOW (natural distribution) |
| endevo-uat-tenants | tenantId | — | LOW (few tenants, low traffic) |
| endevo-uat-audit | tenantId | sk | HIGH (heavy writes per tenant) |
| endevo-uat-training | tenantId | videoId | HIGH (all employees read same videos) |
| endevo-uat-questions | tenantId | questionId | HIGH (all employees read same questions) |
| endevo-uat-responses | tenantId | responseId | HIGH (burst writes during assessment) |
| endevo-uat-lms-lessons | tenantId | moduleOrder | HIGH (all employees read same lessons) |
| endevo-uat-lms-lesson-progress | userId | lessonId | LOW (natural distribution) |
| endevo-uat-lms-modules | tenantId | moduleNum | MEDIUM (read-heavy, cacheable) |
| endevo-uat-lms-user-modules | userId | moduleNum | LOW (natural distribution) |
| endevo-uat-certificates | tenantId | certId | LOW (low volume) |
| endevo-uat-video-progress | userId | videoId | LOW (natural distribution) |
| endevo-uat-config | tenantId | sk | LOW (rarely accessed) |

---

## Tables That Need Sharding (HIGH risk)

### 1. endevo-uat-audit
**Problem:** Every user action writes here. 50K employees = 50K writes/hour to one partition.

**Fix:** Shard by time + random suffix
```
Before: PK = tenantId,        SK = timestamp#auditId
After:  PK = tenantId#shard,  SK = timestamp#auditId
        where shard = hash(auditId) % 10  (0-9)
```

**Query pattern:** To get all audit for a tenant, query 10 shards in parallel and merge.

### 2. endevo-uat-training + endevo-uat-questions + endevo-uat-lms-lessons
**Problem:** READ-heavy. All employees in a tenant read the same content.

**Fix:** DAX (DynamoDB Accelerator) — NOT sharding.
```
Content tables are READ-heavy, WRITE-rare (admin only writes).
DAX provides microsecond reads from cache.
Cache TTL: 5 minutes for content, 0 for progress.
Cost: ~$0.25/hour per node = ~$180/month for 1 node.
```

**Alternative (cheaper):** Application-level caching in Lambda using global variables.
```python
# Lambda global scope — persists between invocations
_content_cache = {}
_cache_time = 0

def get_lessons(tenant_id, module_num):
    cache_key = f"{tenant_id}#{module_num}"
    if cache_key in _content_cache and (time.time() - _cache_time) < 300:
        return _content_cache[cache_key]
    # Query DynamoDB, cache result
    result = query_dynamo(...)
    _content_cache[cache_key] = result
    _cache_time = time.time()
    return result
```

Cost: $0. Effort: 2 hours. Good enough until 100K users.

### 3. endevo-uat-responses
**Problem:** Burst writes during assessment (all employees submit at same time).

**Fix:** Write-sharding
```
Before: PK = tenantId,              SK = responseId
After:  PK = tenantId#userId[:4],   SK = responseId
        (first 4 chars of userId as shard = ~65K shards)
```

Or simpler: change PK to `userId` (natural distribution).

---

## Implementation Plan

### Phase 1: Application-Level Caching (NOW — $0, 2 hours)
- Cache content tables (lessons, questions, modules) in Lambda memory
- 5-minute TTL
- Eliminates 95% of DynamoDB reads for content

### Phase 2: DAX Cluster (At 10K users — $180/month)
- Single-node DAX cluster in front of content tables
- Microsecond reads
- Write-through cache

### Phase 3: Partition Key Redesign (At 50K users — 2 weeks)
- Audit table: tenantId#shard (10-way shard)
- Responses table: userId as PK (natural distribution)
- Migrate existing data with DynamoDB export/import

---

## Scaling Projections

| Users | Reads/sec (peak) | Writes/sec (peak) | Sharding Needed? |
|-------|:-:|:-:|:-:|
| 82 (now) | ~10 | ~5 | NO |
| 1,000 | ~100 | ~50 | NO |
| 10,000 | ~1,000 | ~500 | APP CACHE needed |
| 50,000 | ~5,000 | ~2,500 | DAX + SHARD audit |
| 100,000 | ~10,000 | ~5,000 | Full sharding |
| 1,000,000 | ~100,000 | ~50,000 | DAX + sharding + SQS for writes |

---

## Quick Win: Application Cache (implement NOW)

Add to `backend/functions/lms/utils/cache.py`:
```python
"""Simple in-memory cache for Lambda. Persists between warm invocations."""
import time

_cache: dict = {}
_timestamps: dict = {}
DEFAULT_TTL = 300  # 5 minutes

def get(key: str):
    if key in _cache and (time.time() - _timestamps.get(key, 0)) < DEFAULT_TTL:
        return _cache[key]
    return None

def set(key: str, value, ttl: int = DEFAULT_TTL):
    _cache[key] = value
    _timestamps[key] = time.time()

def invalidate(key: str):
    _cache.pop(key, None)
    _timestamps.pop(key, None)
```

---

*This design supports linear scaling from 82 to 1M+ users with phased investment.*
