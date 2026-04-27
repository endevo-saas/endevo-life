# Audit: Domain 8 — Jesse V2 Inventory
**Date:** 2026-04-19 | **Auditor:** Autonomous audit session

---

## Repository

| Item | Value |
|------|-------|
| Location | `C:/Projects2026/jesse-endevo-v2/` |
| Type | Separate repo (not a monorepo package) |
| Commits | 15 |
| Branch | main |
| Context | Hackathon/prototype build |

---

## Architecture

### Frontend
| Item | Value |
|------|-------|
| Framework | React + Vite |
| Auth | Firebase Authentication |
| Hosting | Firebase Hosting (separate from uat.endevo.life) |
| Purpose | Standalone Jesse AI chat interface |

### Backend
| Item | Value |
|------|-------|
| Framework | Node.js + Express |
| AI SDK | Anthropic SDK (direct API calls) |
| Hosting | Vercel (serverless) |
| Purpose | Proxy between frontend and Anthropic API |

---

## AWS Resources Used by Jesse V2

| Resource | Name | Status |
|----------|------|--------|
| Bedrock Agent | endevo-jesse-agent (XR2QDIVFB6) | PREPARED — shared with main app |
| S3 Knowledge Bucket | endevo-uat-knowledge-v2 | Active |
| S3 Knowledge Bucket (legacy) | endevo-uat-knowledge | Active (older chunks) |
| DynamoDB | endevo-uat-jesse-chat | ~100 items — chat history |
| Lambda | endevo-uat-fn-jesse | Active — also used by main app |

---

## Integration with Main App

| Item | Status |
|------|--------|
| `JesseAIWidget.tsx` in main app | ✓ Present in all 3 layouts (admin, HR, employee) |
| `JesseChatWindow.tsx` | ✓ Present |
| `ActionCard.tsx` | ✓ Present |
| Backend route | `/api/jesse/*` served by `endevo-uat-fn-jesse` |
| Jesse V2 frontend | Standalone — NOT embedded in uat.endevo.life |

---

## Duplication / Overlap

| Item | Main App | Jesse V2 | Notes |
|------|----------|----------|-------|
| Jesse chat UI | `JesseAIWidget` + `JesseChatWindow` | Full React app | Two separate UIs for same feature |
| Backend AI call | `fn-jesse` Python Lambda | Node/Express on Vercel | Two separate backends |
| Knowledge base | Bedrock agent XR2QDIVFB6 | Same Bedrock agent | Shared — no duplication |
| Auth | Cognito JWT | Firebase Auth | Different auth systems |

---

## Extraction / Integration Options

Jesse V2 was built as a hackathon prototype. The main app already has a production Jesse widget.

1. **Keep separate** — Jesse V2 as an independent chat tool; main app widget for in-context help
2. **Extract UI improvements** — cherry-pick UX improvements from Jesse V2 into `JesseChatWindow.tsx`
3. **Deprecate Jesse V2** — main app widget covers the use case; Jesse V2 adds maintenance overhead

Recommendation: **Option 2** — audit Jesse V2 UI for improvements worth porting, then deprecate the standalone Firebase app.

---

## Issues

| Severity | Issue |
|----------|-------|
| P2 | Two parallel Jesse backends (fn-jesse + Vercel Node) — divergence risk |
| P2 | Two auth systems (Cognito vs Firebase) — Jesse V2 users not in Cognito |
| P2 | Jesse V2 uses Anthropic SDK directly — bypasses Bedrock agent instrumentation |
| INFO | Jesse V2 shares Bedrock agent with main app — changes to agent affect both |
| INFO | 15-commit repo with no tests — hackathon quality code |
