# ServiceNow MCP Bridge — API Reference

This document covers the internal TypeScript APIs used within the application. It is intended for contributors and developers extending the codebase.

---

## Core Services

### `chat.ts` — `sendMessage(options)`

Orchestrates message sending, streaming, MCP tool calling, web search augmentation, and DB persistence.

```typescript
import { sendMessage } from './src/core/services/chat';

await sendMessage({
  sessionId: string,          // AI session ID
  content: string,            // User message content
  ollamaEndpoint: string,     // Ollama server URL
  ollamaModel: string,        // Model name (e.g. 'llama3.2')
  onToken: (token: string) => void,       // Called for each streamed token
  onDone: (totalMs: number) => void,      // Called when streaming completes
  onError: (message: string) => void,     // Called on error
  persist?: boolean,          // Save messages to DB (default: false)
  mcpContext?: MCPContext,     // Enables MCP tool calling
  searchContext?: SearchContext, // Enables web search augmentation
  llmContext?: LLMContext,    // Routes to cloud LLM (OpenAI/Mistral)
});
```

**`MCPContext`**:
```typescript
interface MCPContext {
  profileId: string;
  servicenowUrl: string;
  ollamaEndpoint: string;
  ollamaModel: string;
}
```

**`LLMContext`**:
```typescript
interface LLMContext {
  provider: 'ollama' | 'openai' | 'mistral';
  profileId: string;
  model: string;
}
```

---

### `search-augmentation.ts` — `augmentWithSearch()`

Augments a user query with web search results before sending to the LLM.

```typescript
import { augmentWithSearch, formatSearchForContext } from './src/core/services/search-augmentation';

const results = await augmentWithSearch(query, searchContext);
const contextBlock = formatSearchForContext(results);
```

---

### `analytics.ts` — Usage Tracking

In-memory analytics for tool calls, search queries, and LLM requests. Resets on app restart.

```typescript
import { analytics } from './src/core/services/analytics';

// Track events
analytics.trackToolCall('query_incidents', 320, true);
analytics.trackSearch('perplexity', 850, 5);
analytics.trackLLMRequest('openai', 'gpt-4o-mini', 2400, true);

// Read summaries
const summary = analytics.getSummary();
// { tools: {...}, search: {...}, llm: {...} }
```

---

### `validation.ts` — `validateConfigurationForm()`

Validates configuration form values before saving a profile.

```typescript
import { validateConfigurationForm } from './src/core/services/validation';

const errors = validateConfigurationForm(formValues);
// Returns { field: 'error message' } or {}
```

---

## Storage

### Repositories

All repositories are singletons exported from their respective modules.

#### `configurationProfileRepository`

```typescript
import { configurationProfileRepository } from './src/core/storage/repositories/configuration';

// CRUD
const profile = await configurationProfileRepository.create(data);
const profile = await configurationProfileRepository.findById(id);
const active  = await configurationProfileRepository.findActive();
const all     = await configurationProfileRepository.findAll();
const updated = await configurationProfileRepository.update(id, data);
const ok      = await configurationProfileRepository.delete(id);
await configurationProfileRepository.setActive(id);
```

#### `aiSessionRepository`

```typescript
import { aiSessionRepository } from './src/core/storage/repositories/session';

const session  = await aiSessionRepository.create(data);
const session  = await aiSessionRepository.findById(id);
const sessions = await aiSessionRepository.findSaved();
await aiSessionRepository.save(id, title);
await aiSessionRepository.delete(id);
```

#### `conversationMessageRepository`

```typescript
import { conversationMessageRepository } from './src/core/storage/repositories/message';

const msg  = await conversationMessageRepository.create(data);
const msgs = await conversationMessageRepository.findBySessionId(sessionId);
const n    = await conversationMessageRepository.deleteBySessionId(sessionId);
```

---

## LLM Integrations

### Cloud LLM Provider Interface

```typescript
interface CloudLLMProvider {
  name: LLMProviderName;
  defaultModel: string;
  availableModels: readonly string[];
  stream(
    messages: LLMMessage[],
    model: string,
    apiKey: string,
    callbacks: LLMStreamCallbacks
  ): Promise<void>;
}
```

Implementations: `openaiProvider`, `mistralProvider`.

### Error Types

```typescript
import { classifyLLMError } from './src/core/integrations/llm/error-handler';

// Classify HTTP error responses from cloud LLM APIs
const error = classifyLLMError(status, provider, responseBody, retryAfterHeader);
// Returns: LLMQuotaError | LLMAuthError | LLMRateLimitError | Error
```

---

## MCP Tools

Each tool is defined as an `MCPToolDefinition` and registered in `tool-registry.ts`.

| Tool | Description |
|------|-------------|
| `query_incidents` | List security incidents from ServiceNow |
| `correlate_incidents` | Find related incidents |
| `analyze_threat` | Run threat analysis on an incident |
| `assess_vulnerability` | Assess CVE severity |
| `generate_remediation` | Generate remediation steps |
| `audit_compliance` | Run compliance checks |
| `analyze_attack_surface` | Map attack surface |

Tool execution:
```typescript
import { executeMCPTool } from './src/core/mcp/client';

const result = await executeMCPTool('query_incidents', { state: 'open', limit: 10 }, mcpContext);
```

---

## Performance Utilities

```typescript
import { measure, measureSync, OperationTimer, PERFORMANCE_BUDGETS } from './src/utils/performance';

// Async wrapper
const result = await measure('db.query', () => repo.findAll());

// Sync wrapper
const data = measureSync('ui.render', () => computeLayout());

// Manual timer
const t = new OperationTimer('mcp.tool');
// ... do work ...
const { durationMs, budgetExceeded } = t.end();
```

**Default budgets** (ms):

| Operation | Budget |
|-----------|--------|
| `db.query` | 100 |
| `db.write` | 200 |
| `ollama.stream` | 30,000 |
| `mcp.tool` | 5,000 |
| `search.query` | 3,000 |
| `llm.stream` | 60,000 |

---

## Logging

```typescript
import { logger } from './src/utils/logger';

logger.debug('Operation started', { id });
logger.info('Operation complete', { id, durationMs });
logger.warn('Retrying...', { attempt }, error);
logger.error('Failed', { context }, error);

// Child logger with fixed context
const log = logger.child({ service: 'chat' });
log.info('Message sent');
```

Log level is set to `DEBUG` in development and `INFO` in production.

---

## Credential Provider

### `credential-provider.ts` — Shared Types

```typescript
import type { ProviderId, ProviderStatus, ProviderConfiguration, CredentialKey } from './src/core/services/credential-provider';
import { CREDENTIAL_KEYS, PROVIDER_DISPLAY_NAMES, isCredentialKey, isProviderId } from './src/core/services/credential-provider';

// ProviderId: 'keychain' | '1password' | 'bitwarden'
// CredentialKey: one of the 10 known keys (servicenow_url, llm_openai, ...)
```

### `credential-router.ts` — Provider Routing

```typescript
import {
  getAvailableProviders,
  getProviderConfiguration,
  setDefaultProvider,
  setCredentialProviderOverride,
  removeCredentialProviderOverride,
  migrateCredentials,
} from './src/core/services/credential-router';

// Query installed/authenticated providers
const statuses: ProviderStatus[] = await getAvailableProviders();

// Read current config (default provider + per-key overrides)
const config: ProviderConfiguration = await getProviderConfiguration();

// Change global default
await setDefaultProvider('1password');

// Override a single key
await setCredentialProviderOverride('llm_openai', 'keychain');
await removeCredentialProviderOverride('llm_openai');

// Migrate all credentials from OS keychain to a new provider
const result = await migrateCredentials('bitwarden', bwSessionToken);
// result.success, result.migrated[], result.failed[]
```

### `provider-config.ts` — Repository

```typescript
import { ProviderConfigRepository } from './src/core/storage/repositories/provider-config';

const repo = new ProviderConfigRepository();
const defaultProvider = await repo.getDefaultProvider();       // 'keychain'
await repo.setDefaultProvider('1password');
const override = await repo.getOverride('llm_openai');        // undefined | ProviderId
await repo.setOverride('llm_openai', 'keychain');
await repo.removeOverride('llm_openai');
const all = await repo.getAllOverrides();                      // Record<string, ProviderId>
```

---

## IPC (Tauri Bridge)

```typescript
import { IPC } from './src/main/ipc';

// API key management (OS keychain)
await IPC.storeApiKey(service, profileId, key);
const key = await IPC.getApiKey(service, profileId);
await IPC.deleteApiKey(service, profileId);
```

`service` values: `'perplexity'`, `'google'`, `'llm_openai'`, `'llm_mistral'`.
