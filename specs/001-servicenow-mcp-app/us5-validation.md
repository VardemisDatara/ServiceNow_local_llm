# US5 Validation: Web Search Knowledge Augmentation

**Feature**: T099–T108 — Configurable search providers (DuckDuckGo, Perplexity, Google)
**Date**: 2026-02-19
**Status**: Implementation complete, pending runtime validation

---

## Automated Gates

| Gate | Status | Notes |
|------|--------|-------|
| Unit tests passing | Pending | No new unit tests added for provider clients in this iteration |
| Code coverage ≥80% | Pending | Provider code is thin wrappers over fetch; runtime E2E covers the path |
| Performance <2s per search | Pending | Perplexity 15s timeout, Google 10s timeout enforced |
| Regression suite US1-US5 | Pending | Full suite to be run manually |
| Security: API keys in keychain | ✓ PASS | Keys stored via `IPC.storeApiKey(provider, profileId, key)` — never in DB or logs |

---

## Manual Test Plan

### Configure DuckDuckGo (default)
- [ ] Open Settings → Edit profile → Web Search Provider shows "DuckDuckGo" by default
- [ ] No API key field visible for DuckDuckGo
- [ ] Send a chat message that triggers knowledge gap → DuckDuckGo results appended

### Configure Perplexity
- [ ] Switch provider to "Perplexity AI" → API key input appears
- [ ] Enter a valid Perplexity API key and save
- [ ] Chat message with knowledge gap → Perplexity results appended with citations
- [ ] Simulate failure (invalid key) → fallback to DuckDuckGo results appended

### Configure Google Custom Search
- [ ] Switch provider to "Google Custom Search" → two inputs appear (API key + CX)
- [ ] Enter API key and CX, save
- [ ] Chat message with knowledge gap → Google results appended
- [ ] Simulate failure (invalid key) → fallback to DuckDuckGo

### Fallback Behaviour
- [ ] Perplexity returns 0 results (mock) → DuckDuckGo fallback used
- [ ] Google returns error → DuckDuckGo fallback used
- [ ] Both fail → augmentation skipped gracefully (no crash)

---

## Implementation Summary

### New files
- `src/core/integrations/search/provider.ts` — SearchResult, SearchContext, SearchProvider interfaces
- `src/core/integrations/search/perplexity.ts` — Perplexity sonar API client
- `src/core/integrations/search/google.ts` — Google Custom Search JSON API client
- `src/renderer/components/SearchProviderConfig.tsx` — Provider selector UI

### Modified files
- `src/core/services/search-augmentation.ts` — Multi-provider dispatch + DuckDuckGo fallback
- `src/core/services/chat.ts` — `searchContext?: SearchContext` threaded through `SendMessageOptions`
- `src/renderer/components/Chat.tsx` — Passes `searchContext` from active profile
- `src/renderer/components/Configuration.tsx` — Embeds `SearchProviderConfig` in form
- `src/renderer/components/StatusIndicator.tsx` — Optional search provider status row

### Key design decisions
- Google API key + CX stored as `"key|||cx"` composite string in keychain (single keychain entry)
- DuckDuckGo always used as fallback — zero-config, no API key required
- `augmentWithSearch` accepts optional `SearchContext`; falls back to DuckDuckGo when undefined
