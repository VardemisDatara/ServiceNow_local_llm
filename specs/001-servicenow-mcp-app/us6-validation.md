# US6: LLM Provider Selection — Phase Validation

**Date**: 2026-02-20
**Status**: Implementation complete, pending manual testing

---

## Automated Gates

| Gate | Status | Notes |
|------|--------|-------|
| TypeScript build — US6 files | ✓ PASS | No new errors from US6 changes |
| Pre-existing TS errors | — | servicenow.ts, logger.ts (pre-existing, not US6) |
| Linting | — | Run separately |
| Unit tests | — | To be added |

## What Was Implemented

### New Files
| File | Task | Description |
|------|------|-------------|
| `src/core/integrations/llm/provider.ts` | T109 | `LLMProviderName`, `LLMContext`, `CloudLLMProvider` interfaces |
| `src/core/integrations/llm/openai.ts` | T110 | OpenAI SSE streaming client; models: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |
| `src/core/integrations/llm/mistral.ts` | T111 | Mistral SSE streaming client; models: mistral-large-latest, mistral-small-latest, etc. |
| `src/core/integrations/llm/error-handler.ts` | T119 | `LLMQuotaError`, `LLMAuthError`, `LLMRateLimitError`; `classifyLLMError()` |
| `src/core/storage/migrations/0001_llm_provider.sql` | T115 | Adds `llm_provider`, `llm_api_key_ref`, `cloud_llm_model` columns; expands sender enum |
| `src/renderer/components/LLMProviderConfig.tsx` | T113 | Provider dropdown + model selector + API key field |

### Modified Files
| File | Task | Change |
|------|------|--------|
| `src/core/storage/schema.ts` | T114 | Added `llmProvider`, `llmApiKeyRef`, `cloudLlmModel` to configurationProfiles; added 'openai'/'mistral' to conversationMessages.sender enum |
| `src/core/mcp/protocol.ts` | T117 | Added `LLMProviderMetadata` interface |
| `src/models/Configuration.ts` | — | Added `llmProvider`, `llmApiKey`, `cloudLlmModel` to `ConfigurationFormValues`; updated `DEFAULT_CONFIGURATION` and `profileToFormValues` |
| `src/core/services/validation.ts` | T116 | Added `llmApiKey` to form errors; validate LLM API key when cloud provider selected |
| `src/core/services/chat.ts` | T112/T118 | Routes to OpenAI/Mistral when `llmContext.provider !== 'ollama'`; persists messages with `sender: 'openai'/'mistral'` and `LLMProviderMetadata` |
| `src/renderer/components/Message.tsx` | T117 | Added 'openai'/'mistral' SENDER_LABELS/SENDER_COLORS; shows model name from `LLMProviderMetadata` |
| `src/renderer/components/StatusIndicator.tsx` | T120 | Added `llmProviderName`/`llmProviderStatus` props to `ConnectionStatusPanel` |
| `src/renderer/components/Configuration.tsx` | — | Added "AI Language Model" section with `LLMProviderConfig` |
| `src/renderer/pages/Settings.tsx` | — | Stores LLM API keys as `llm_openai`/`llm_mistral` in keychain |
| `src/renderer/components/Chat.tsx` | — | Passes `llmContext` to `sendMessage`; dynamic progress label |
| `src-tauri/src/lib.rs` | T115 | Registered migration version 2 |

## Architecture Notes

- **Keychain key format**: LLM API keys stored as `llm_openai` or `llm_mistral` (provider name prefix) to avoid collision with search provider keys
- **Sender in DB**: Cloud LLM messages use `sender: 'openai'` or `sender: 'mistral'` (migration expands the CHECK constraint by recreating the table)
- **FTS rebuild**: Migration drops and rebuilds FTS5 virtual table to preserve functionality after table recreation
- **Context injection**: Cloud LLM messages also include `LLMProviderMetadata` for model attribution display
- **History preservation (T118)**: Conversation history is always stored in DB by sessionId regardless of provider — switching provider mid-conversation works naturally
- **Fallback**: If `llmProvider` is absent (old DB rows), Chat.tsx defaults to `'ollama'` via `??` operator

## Manual Test Plan

1. Open Settings → Edit Profile
2. Verify "AI Language Model" section appears below Ollama section
3. Select "OpenAI" from dropdown
4. Enter API key (sk-...) and select model (gpt-4o-mini)
5. Save profile
6. Open a new chat conversation
7. Send message → verify "OpenAI (gpt-4o-mini)" label appears on response
8. Switch back to Ollama in Settings → verify new messages show "Ollama" label
9. Verify old conversation history is still visible and unaffected
10. Test quota exceeded: use expired key → verify friendly error message
11. Test Mistral: enter Mistral API key → verify responses from Mistral
