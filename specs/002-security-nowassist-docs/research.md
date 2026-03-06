# Research: 002-security-nowassist-docs

**Date**: 2026-03-02
**Branch**: `002-security-nowassist-docs`

---

## Decision 1: ServiceNow MCP Server Endpoint URL

**Decision**: The ServiceNow MCP server endpoint is `https://{instance}.service-now.com/sncapps/mcp-server`

**Rationale**: Confirmed via ServiceNow community and KB article KB2676985. Traffic from the instance URL path `/sncapps/mcp-server` is forwarded to the MCP service (`mcps-prod-default`). Tool packages are role-based (service desk, security, catalog, etc.) and must be configured and assigned in the ServiceNow MCP Server Console before they are discoverable by external clients.

**Alternatives considered**:
- Custom community implementations (e.g., `github.com/michaelbuckner/servicenow-mcp`) use a separate Node.js/Python proxy server and a different URL. Rejected because the spec targets the native ServiceNow Yokohama platform MCP server.
- Direct REST API calls bypassing MCP. Rejected because the spec requires MCP protocol interoperability with Now Assist tools.

---

## Decision 2: MCP Transport for ServiceNow Connection

**Decision**: Use `StreamableHTTPClientTransport` as primary, with automatic fallback to `SSEClientTransport` if the server responds with a 4xx to the Streamable HTTP initialisation request.

**Rationale**: Streamable HTTP is the current preferred MCP transport (SSE is deprecated in newer SDK versions). ServiceNow Yokohama supports both Streamable HTTP and SSE. Using a fallback pattern ensures compatibility across different patch levels of Yokohama. The `@modelcontextprotocol/sdk` is already installed in the project (`node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js` confirmed present).

**Alternatives considered**:
- SSE-only: Would work but limits forward compatibility as SSE is deprecated in newer MCP SDK versions.
- Stdio: Not supported by ServiceNow MCP server (server-side constraint).

---

## Decision 3: Authentication Header for Now Assist MCP

**Decision**: Support two authentication modes in the Settings UI, selectable by the user:

| Mode | Header sent | When to use |
|------|-------------|-------------|
| **API Key** | `x-sn-apikey: <token>` | ServiceNow native API Key (PAT generated in ServiceNow admin) — most common for desktop apps |
| **OAuth Bearer** | `Authorization: Bearer <token>` | OAuth 2.1 access token obtained externally |

Default mode: **API Key** (`x-sn-apikey`), since it is the most practical for a desktop app and avoids OAuth redirect complexity. The token is stored in the OS keychain via `IPC.storeApiKey('now_assist', profileId, token)`.

**Critical finding from research**: The ServiceNow native MCP Server Console uses `x-sn-apikey` (not `Authorization: Bearer`) as the inbound API Key header. This requires the `com.glide.tokenbased_auth` plugin to be active on the instance. Using `Authorization: Bearer` is only correct for OAuth 2.1 access tokens.

**SDK version confirmed**: `@modelcontextprotocol/sdk` v1.26.0 is installed in the project.

**MCP server connection URL format confirmed**: `https://<instance>.service-now.com/sncapps/mcp-server/<server-sys-id>` — the `<server-sys-id>` is the `sys_id` of the MCP Server record created in the ServiceNow MCP Server Console.

**Known SDK issue**: `SSEClientTransport` has a confirmed bug (issue #436) where `requestInit` headers may not be forwarded to the initial EventSource GET. Workaround: pass headers via both `eventSourceInit` and `requestInit`.

**Alternatives considered**:
- OAuth2 Authorization Code flow: Requires redirect URL, callback server, and token refresh logic — disproportionate complexity for a desktop app. Rejected as primary mode (supported as secondary).
- Basic auth (username/password): Disabled by default on native MCP Server Console; deprecated in newer ServiceNow releases. Rejected.

---

## Decision 4: Now Assist Tool Discovery and Invocation

**Decision**: Use `client.listTools()` (with cursor-based pagination) to discover available tools on connection, cache the list in component/service state. Use `client.callTool({ name, arguments })` to invoke. Tool invocation is triggered automatically by the local model via keyword/intent detection, consistent with existing Phase 5 MCP tool calling pattern.

**Rationale**: The `@modelcontextprotocol/sdk` Client class exposes `listTools()` and `callTool()` directly. Tool discovery runs once on successful connection and re-runs on explicit reconnect. The auto-detect trigger model (clarification Q2) avoids UX friction and aligns with the existing `detectToolCallsFromMessage()` architecture.

**Tool schema**: Tool names, descriptions, and input schemas are discovered dynamically at runtime — not hardcoded. This is intentional: specific tool names exposed by a ServiceNow instance depend on which Now Assist skills are licensed and activated. The client code must not assume specific tool names.

**Alternatives considered**:
- Hardcoding expected tool names: Fragile across different ServiceNow instances and licensing configurations. Rejected.
- Explicit user button: Clarification Q2 ruled this out as primary trigger (auto-detect preferred).

---

## Decision 5: Security Incidents Fetch for Dashboard

**Decision**: Reuse the existing `executeMCPTool('query_incidents', args)` call from `src/core/mcp/client.ts` for the incident list panel. Load on tab open + on manual refresh + on auto-refresh timer. Page size = 50 (matches existing `FR-006` and `query_incidents` tool max limit).

**Rationale**: The `query_incidents` MCP tool is already implemented (Phase 5) and tested. Reusing it avoids duplicating ServiceNow REST API calls. The TypeScript-side state filter in `formatToolResult` is the guaranteed gate (Rust-side filter may silently fail across instances — documented in MEMORY.md).

**Auto-refresh**: A `useRef<NodeJS.Timeout>` timer drives background refresh. Default 5 minutes, configurable via a stepper control (5–15 min range). The timer is cleared on component unmount. No background Rust/Tauri involvement needed.

**Alternatives considered**:
- Dedicated REST API call bypassing MCP: Would require duplicating auth and connection logic. Rejected.
- Rust-side polling with push to frontend: Overly complex for a read-only background refresh. Rejected.

---

## Decision 6: Now Assist Attribution Badge

**Decision**: Inline "Now Assist ✦" badge/tag rendered adjacent to the assistant message content when the message sender is `'servicenow_now_assist'`. Consistent with the existing `WebSearchCard` and `LLMProviderMetadata` display patterns in `Message.tsx`.

**Rationale**: Clarification Q4. The `'servicenow_now_assist'` sender value already exists in the `conversationMessages` sender enum — no DB migration needed for attribution. The badge pattern is the lightest-weight approach that fits the existing message card design.

**Alternatives considered**:
- Separate expandable card (like WebSearchCard): More visual weight; appropriate for search results but excessive for AI attribution. Rejected.
- Footer attribution: Less precise — doesn't indicate which part of the response came from Now Assist. Rejected.

---

## Decision 7: DB Schema Changes

**Decision**: Add two nullable columns to `configurationProfiles`:
- `nowAssistEndpoint TEXT` — the user-entered MCP server URL
- `nowAssistApiKeyRef TEXT` — reference key used to retrieve the token from OS keychain

**Rationale**: Follows the established pattern for `searchApiKeyRef` (optional, nullable) and `llmApiKeyRef`. No new table needed. SQLite column additions with `ALTER TABLE ... ADD COLUMN` (nullable columns) do not require the drop-and-recreate pattern (only CHECK constraint changes require that). The `'servicenow_now_assist'` sender enum already exists in `conversationMessages` — no message table changes.

**Alternatives considered**:
- New `mcpConnections` table: Over-engineered for a single-profile, single MCP endpoint use case scoped in this feature. Rejected.
- Storing endpoint in keychain alongside token: Mixes secret storage with non-secret configuration. Rejected.

---

## Decision 8: Security Tab Layout

**Decision**: Side-by-side split: `IncidentListPanel` (left, ~320px default, resizable 220–500px) + existing `SecurityWorkflow` (right, fills remaining width). Follows the established resizable sidebar pattern from `ChatPage.tsx` and `History.tsx`.

**Rationale**: Clarification Q3. `useRef<boolean>` for drag state, `useState<number>` for panel width, `window.addEventListener('mousemove'/'mouseup')` in a single `useEffect`. The `SecurityWorkflow` component is unchanged — it simply receives less horizontal space.

**Alternatives considered**:
- Stacked vertically: Less useful for simultaneous monitoring + investigation. Rejected.
- Sub-tabs: Hides one surface when using the other. Rejected.

---

## Decision 9: ServiceNow API Rate Limiting

**Decision**: Implement exponential backoff with jitter on HTTP 429 responses for both the incident list fetch and Now Assist tool calls. Max 3 retries, initial delay 1 second, max delay 30 seconds. Surface a user-visible warning (not error) on rate-limit retry.

**Rationale**: ServiceNow returns HTTP 429 when rate limits are exceeded, with a `Retry-After` header indicating seconds to wait. The `executeMCPTool` in `src/core/mcp/client.ts` already has 2-attempt retry logic on transient failures — this will be extended.

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|------------|
| MCP SDK version | `@modelcontextprotocol/sdk` v1.26.0 (already installed) |
| MCP SDK transport classes | `StreamableHTTPClientTransport` + `SSEClientTransport` from `@modelcontextprotocol/sdk` |
| ServiceNow MCP endpoint pattern | `https://{instance}.service-now.com/sncapps/mcp-server/{server-sys-id}` |
| Auth header — API Key mode | `x-sn-apikey: <token>` (ServiceNow-specific, NOT `Authorization: Bearer`) |
| Auth header — OAuth mode | `Authorization: Bearer <token>` |
| SSE header workaround | Pass in both `eventSourceInit` AND `requestInit` due to SDK bug #436 |
| Tool discovery method | `client.listTools()` with cursor pagination |
| Tool names | Instance-specific (discovered dynamically) — never hardcode |
| Sender enum for Now Assist | `'servicenow_now_assist'` already exists — no migration |
| DB migration scope | Only two nullable column additions to `configurationProfiles` |
| Rate limiting | HTTP 429 + `Retry-After` header + exponential backoff (3 retries, max 30 s) |
| Pagination | `X-Total-Count` response header + `Link: rel="next"` for table API pagination |
