# User Story 3 Validation: Bidirectional AI Communication via MCP

**Date**: 2026-02-19
**Branch**: 001-servicenow-mcp-app

## Summary

Phase 5 (User Story 3) implemented bidirectional AI communication between Ollama and ServiceNow via the MCP (Model Context Protocol) tool calling system. Ollama can now detect when ServiceNow intelligence is needed and invoke tools automatically during a chat conversation.

## Implementation

### Files Created

| File | Purpose | Task |
|------|---------|------|
| `src/core/mcp/protocol.ts` | MCP protocol types (tool definitions, results, metadata) | T061 |
| `src/core/mcp/client.ts` | TypeScript MCP client (invokes Rust commands) | T063 |
| `src/core/mcp/tools/analyze_threat.ts` | analyze_threat_indicator schema + Ollama definition | T065/T067 |
| `src/core/mcp/tools/assess_vulnerability.ts` | assess_vulnerability schema + Ollama definition | T066/T068 |
| `src/core/mcp/error-handler.ts` | MCP error classification and user-friendly messages | T073 |
| `src/core/mcp/retry.ts` | Exponential backoff retry for MCP calls | T075 |
| `src/core/services/tool-registry.ts` | Central tool registry for Ollama tool definitions | T064 |
| `src-tauri/src/mcp/mod.rs` | Rust MCP module declaration | T062 |
| `src-tauri/src/mcp/server.rs` | Rust commands: check_ollama_tool_calls + execute_mcp_tool | T062/T069/T070 |

### Files Modified

| File | Change | Task |
|------|--------|------|
| `src/core/services/chat.ts` | Added MCP tool calling before streaming (executeMCPToolCalls) | T071 |
| `src/renderer/components/Message.tsx` | Added tool result rendering with AI attribution | T072 |
| `src/renderer/components/Chat.tsx` | Pass mcpContext to sendMessage when profile has ServiceNow URL | T071 |
| `src-tauri/src/lib.rs` | Registered check_ollama_tool_calls + execute_mcp_tool commands | T062 |

### Tool Calling Flow

```
User sends message
    │
    ▼
[Persist user message to DB]
    │
    ▼
[Build message history from DB]
    │
    ▼
[check_ollama_tool_calls] ─── non-streaming Ollama call with tools list
    │
    ├── No tool calls → skip to streaming
    │
    └── Tool calls detected:
            │
            ▼
        [execute_mcp_tool] ── loads credentials from OS keychain
            │                  dispatches to ServiceNow REST API
            ▼
        [Persist tool result as servicenow_now_assist message]
            │
            ▼
        [Add tool result to Ollama context]
    │
    ▼
[Streaming response from Ollama]
    │
    ▼
[Search augmentation]
    │
    ▼
[Persist AI response]
```

### Registered MCP Tools

1. **analyze_threat_indicator** — Queries ServiceNow Threat Intelligence (`sn_ti_observable`) for IOCs (IP, domain, hash, URL). Returns risk score, threat type, first/last seen.

2. **assess_vulnerability** — Queries ServiceNow Vulnerability Management (`sn_vul_entry`) for CVE details. Returns CVSS score, severity, state, affected items.

### Security Design

- ServiceNow credentials are loaded from OS keychain inside the Rust `execute_mcp_tool` command using `crate::keychain::get_servicenow_credentials(profile_id)`. Credentials never pass through the TypeScript IPC layer during tool execution.
- Tool results are visible to the user as attributed `servicenow_now_assist` messages with `metadata.type = 'tool_result'` for transparency.

## Automated Gates

| Gate | Status | Notes |
|------|--------|-------|
| TypeScript compilation (Phase 5 files) | ✅ PASS | No errors in new/modified files |
| Rust compilation | ✅ PASS | `cargo build` succeeds, 10 pre-existing warnings only |
| Linting (new files) | ✅ PASS | No ESLint errors |

## Manual Gates

| Gate | Status | Notes |
|------|--------|-------|
| Tool calling integration | ✅ Ready for testing | Requires Ollama + ServiceNow instance |
| Error handling | ✅ Implemented | MCPError enum with graceful fallback |
| AI attribution display | ✅ Implemented | Tool results shown with "MCP Tool: toolName" label |
| Security review | ✅ Pass | Credentials loaded server-side from keychain |

## Notes

- Tool calling is opt-in: only enabled when `activeProfile.servicenowUrl` is set
- If Ollama doesn't support tools (e.g., older models), `check_ollama_tool_calls` fails gracefully and falls back to regular streaming
- Tool results are persisted as `servicenow_now_assist` messages so they appear in conversation history
- T059/T060 were already complete (mcpTools schema + SQL migration existed from Phase 2)
