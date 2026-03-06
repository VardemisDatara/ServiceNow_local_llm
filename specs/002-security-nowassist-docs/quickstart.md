# Developer Quickstart: 002-security-nowassist-docs

**Branch**: `002-security-nowassist-docs`
**Date**: 2026-03-02

---

## Prerequisites

- Node.js 20+, pnpm, Rust 1.75+, Tauri CLI v2
- A running ServiceNow Yokohama instance (for Now Assist integration testing)
- ServiceNow MCP server activated on the instance (Admin Console → MCP Server Console)
- A ServiceNow Personal Access Token with MCP read permissions

---

## 1. Setup

```bash
# Install dependencies (already done if continuing from previous phases)
pnpm install

# Run the app in development mode
pnpm tauri dev
```

---

## 2. Feature Branches and Key Files

All new code lives in these locations:

| Area | Files |
|------|-------|
| DB migration | `src/core/storage/migrations/0002_add_now_assist_config.sql` |
| Schema changes | `src/core/storage/schema.ts` (add `nowAssistEndpoint`, `nowAssistApiKeyRef`) |
| Now Assist MCP client | `src/core/services/now-assist-mcp-client.ts` |
| Incident list panel | `src/renderer/components/IncidentListPanel.tsx` |
| Security page (refactored) | `src/renderer/pages/SecurityPage.tsx` |
| Settings (Now Assist section) | `src/renderer/components/Configuration.tsx` |
| Chat service (extended) | `src/core/services/chat.ts` |
| Message component (badge) | `src/renderer/components/Message.tsx` |
| Zustand store (extended) | `src/renderer/store/index.ts` |
| App documentation | `docs/` |

---

## 3. Running Tests

```bash
# Unit + integration tests (Vitest)
pnpm test

# Watch mode
pnpm test --watch

# Rust tests
cd src-tauri && cargo test

# Rust linting
cd src-tauri && cargo clippy
```

---

## 4. Testing the Incident List Panel (without a live ServiceNow instance)

The `IncidentListPanel` component accepts a `mockMode` prop (development only) that
returns a fixed list of 5 fake incidents. Enable it by setting `VITE_MOCK_INCIDENTS=true`
in your `.env.local`.

```
VITE_MOCK_INCIDENTS=true
```

---

## 5. Testing Now Assist Integration

1. Configure a ServiceNow profile in Settings with a valid instance URL.
2. In the **Now Assist** section of Settings, enter:
   - Endpoint: `https://YOUR_INSTANCE.service-now.com/sncapps/mcp-server`
   - Bearer Token: your Personal Access Token
3. Click **Test Connection** — the button shows the number of discovered tools on success.
4. In the Chat interface, ask a question that should trigger a Now Assist tool
   (e.g. `"Summarise the last open security incident"`).
5. The response will include a **Now Assist ✦** badge next to the Now Assist-generated portion.

---

## 6. DB Migration

The migration runs automatically on app start via the existing migration runner.
To run manually for testing:

```bash
# Check that schema.ts reflects the two new columns:
# - nowAssistEndpoint: text('now_assist_endpoint')
# - nowAssistApiKeyRef: text('now_assist_api_key_ref')

# Then restart the Tauri dev server — migration 0002 will apply automatically
pnpm tauri dev
```

---

## 7. Known Constraints

- The ServiceNow MCP server is only available on Yokohama or later.
- Tool names exposed by the MCP server vary by instance licensing — they are discovered dynamically, never hardcoded.
- `SSEClientTransport` Bearer auth has a known SDK bug: `requestInit` headers may not be forwarded to the initial EventSource GET. The implementation uses `eventSourceInit` as a workaround in the fallback path.
- `phi3:mini` is too small for reliable Now Assist tool routing — use `mistral:7b` or a cloud LLM for best results (consistent with existing Phase 5/6/7 guidance).

---

## 8. Architecture Notes

- **NowAssistMCPClient** is a singleton service instantiated once per active profile. It is destroyed and recreated when the active profile changes.
- **IncidentListPanel** manages its own polling timer (`useRef<NodeJS.Timeout>`). The timer is cleared on unmount. No Rust/Tauri involvement in the refresh loop.
- **Attribution**: `sender: 'servicenow_now_assist'` was already in the DB enum — no migration needed.
- **Credential key name**: `'now_assist'` (stored via `IPC.storeApiKey('now_assist', profileId, token)`).
