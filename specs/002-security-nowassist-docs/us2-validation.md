# US2 Validation: Local LLM ↔ Now Assist Exchange via MCP

**Date**: 2026-03-03
**Tasks**: T017–T025
**Status**: ✅ PASS

---

## Automated Gate Results

| Gate | Status | Notes |
|------|--------|-------|
| `pnpm test` — T017 unit tests (12 tests) | ✅ PASS | All 12 tests passing after T021/T023 implementation |
| `pnpm test` — T018 integration tests (6 tests) | ✅ PASS | All 6 tests passing after T019 NowAssistConfig implementation |
| `pnpm test` — full suite (59 tests) | ✅ PASS | All 59 tests pass; no regressions from US1 |
| TypeScript strict: zero new errors | ✅ PASS | Fixed `src/main/index.ts:42` cast; all remaining errors are pre-existing |
| Regression: US1 tests still passing | ✅ PASS | IncidentListPanel 15 tests + security-tab 8 tests all pass |

## Files Modified / Created

| File | Task | Change |
|------|------|--------|
| `tests/unit/services/chat-service-now-assist.test.ts` | T017 | Created — 12 unit tests |
| `tests/integration/now-assist-integration.test.tsx` | T018 | Created — 6 integration tests (note: `.tsx` extension required for JSX) |
| `src/renderer/components/Configuration.tsx` | T019 | Added `NowAssistConfig` component + `NowAssistConfigProps` interface |
| `src/main/index.ts` | T020 | Added `connectNowAssist()` auto-connect on app startup |
| `src/core/services/chat.ts` | T021+T023+T025 | Exported `detectToolCallsFromMessage` + `formatToolResult`; added Now Assist keyword detection, now_assist format case, graceful degradation |
| `src/core/mcp/client.ts` | T022 | Added `provider?` param to `executeMCPTool`; routes `provider:'now_assist'` to `nowAssistMCPClient.callTool()` |
| `src/renderer/components/Message.tsx` | T024 | Added `isNowAssist` flag + "Now Assist ✦" pill badge |

## TDD Notes

- T017 confirmed FAILING before T021/T023 implementation: `detectToolCallsFromMessage is not a function`
- T018 confirmed FAILING before T019 implementation: `NowAssistConfig is not a function`
- Both test files used `vi.hoisted()` pattern to avoid Vitest mock hoisting issues
- T018 file renamed from `.ts` → `.tsx` (esbuild requires `.tsx` for JSX in test files)
- Token label changed from "API Key / Token" to "Token" to avoid `getByLabelText` collision with "API Key (x-sn-apikey)" radio button

## Known Limitations (manual gates deferred)

The following manual gates require a live Yokohama ServiceNow instance with `sn_mcp_server` plugin and cannot be validated in this automated pass:

- Settings: enter valid Now Assist endpoint + token → Test Connection shows tool count
- Settings: save credentials → restart app → token persists in keychain
- Chat: ask question matching a Now Assist tool → response includes **Now Assist ✦** badge
- Chat: disconnect Now Assist → local model responds alone with degradation note
- Dev tools inspection: no credential strings visible in requests/logs

These are validated during T036 (end-to-end scenario) in Phase 6.
