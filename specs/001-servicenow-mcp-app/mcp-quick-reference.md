# MCP Quick Reference Guide

**Project**: ServiceNow MCP Bridge Application
**Last Updated**: 2026-02-13

---

## Technology Stack Decision

```
Desktop App: Electron + TypeScript
MCP SDK:     @modelcontextprotocol/sdk (TypeScript)
Validation:  Zod v4
UI:          React (or Vue)
Storage:     SQLite (better-sqlite3)
Credentials: OS Keychain (keytar)
Auth:        OAuth 2.1 with PKCE
```

---

## Installation Commands

```bash
# Initialize project
npm init -y
npm install electron vite typescript

# MCP SDK
npm install @modelcontextprotocol/sdk zod
npm install @modelcontextprotocol/node  # HTTP transport helpers

# Desktop dependencies
npm install keytar better-sqlite3

# API clients
npm install ollama axios

# UI (if using React)
npm install react react-dom

# Development tools
npm install -D @types/node @types/react typescript vitest playwright eslint
```

---

## MCP Transport Decision Matrix

| Scenario | Transport | Code Example |
|----------|-----------|--------------|
| Desktop → ServiceNow (remote) | HTTP Streamable | `HttpStreamableTransport(url)` |
| ServiceNow → Desktop (local) | stdio (MVP) | `StdioServerTransport()` |
| ServiceNow → Desktop (remote needed) | HTTP Server | `express + createHttpStreamableTransport()` |

---

## Minimal MCP Server Example

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create server
const server = new Server(
  { name: "ollama-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Define tool
server.tool(
  "analyze_threat",
  "Analyze threat indicators using intelligence feeds",
  {
    indicator: z.string().describe("IP, domain, hash, or URL"),
    indicator_type: z.enum(["ip", "domain", "hash", "url"])
  },
  async ({ indicator, indicator_type }) => {
    // Your tool logic here
    const result = await threatAPI.analyze(indicator, indicator_type);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Minimal MCP Client Example

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { HttpStreamableTransport } from "@modelcontextprotocol/sdk/client/http.js";

// Create client
const client = new Client(
  { name: "servicenow-client", version: "1.0.0" },
  { capabilities: {} }
);

// Connect to remote MCP server
const transport = new HttpStreamableTransport(
  new URL("https://instance.service-now.com/api/mcp")
);
await client.connect(transport);

// Call tool
const result = await client.callTool({
  name: "query_incidents",
  arguments: {
    severity: "high",
    state: "new"
  }
});

console.log(result.content[0].text);
```

---

## Zod Schema Patterns

### Basic Types
```typescript
import { z } from "zod";

const schema = {
  // String with description
  indicator: z.string().describe("Threat indicator to analyze"),

  // Enum (predefined values)
  severity: z.enum(["low", "medium", "high", "critical"]),

  // Number with constraints
  timeout: z.number().min(1).max(300).default(30),

  // Boolean with default
  include_context: z.boolean().default(true),

  // Optional field
  user_id: z.string().optional(),

  // Array of strings
  affected_systems: z.array(z.string()).min(1),

  // Nested object
  business_context: z.object({
    asset_criticality: z.enum(["low", "medium", "high"]),
    downtime_acceptable: z.boolean()
  }).optional(),

  // String with regex validation
  cve_id: z.string().regex(/^CVE-\d{4}-\d{4,}$/)
};
```

### Complex Validation
```typescript
// Conditional validation
const schema = {
  operation: z.enum(["create", "update", "delete"]),
  id: z.string().optional()
}.refine(
  (data) => data.operation !== "update" || data.id !== undefined,
  { message: "ID required for update operations" }
);

// Union types
const identifier = z.union([
  z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/),  // IP
  z.string().url(),                                           // URL
  z.string().regex(/^[a-f0-9]{32,64}$/)                      // Hash
]);
```

---

## Error Handling Template

```typescript
server.tool("tool_name", "description", schema, async (params) => {
  try {
    // Tool logic
    const result = await externalAPI.call(params);

    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  } catch (error) {
    // Structured error response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Service unavailable",
          error_code: "SERVICE_UNAVAILABLE",
          details: error.message,
          suggested_action: "Verify network connectivity"
        })
      }],
      isError: true  // MCP protocol flag
    };
  }
});
```

---

## Retry Pattern

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      // Exponential backoff with jitter
      const delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Should not reach here");
}

// Usage
const result = await callWithRetry(() =>
  client.callTool({ name: "analyze_threat", arguments: params })
);
```

---

## Credential Storage (OS Keychain)

```typescript
import keytar from "keytar";

const SERVICE_NAME = "servicenow-mcp-bridge";

// Store credential
await keytar.setPassword(SERVICE_NAME, "instance1:api_key", "secret_key_123");

// Retrieve credential
const apiKey = await keytar.getPassword(SERVICE_NAME, "instance1:api_key");

// Delete credential
await keytar.deletePassword(SERVICE_NAME, "instance1:api_key");
```

---

## OAuth 2.1 Flow (Quick)

```typescript
import { OAuthClient } from "@modelcontextprotocol/sdk/auth/oauth.js";

const oauth = new OAuthClient({
  authorizationEndpoint: "https://instance.service-now.com/oauth_auth.do",
  tokenEndpoint: "https://instance.service-now.com/oauth_token.do",
  clientId: "your_client_id",
  usePKCE: true,  // Always true for desktop apps
  scopes: ["mcp:tools:execute"]
});

// 1. Generate PKCE verifier/challenge
const { verifier, challenge } = await oauth.generatePKCE();

// 2. Build authorization URL
const authUrl = oauth.buildAuthorizationUrl({
  redirectUri: "http://localhost:8080/callback",
  codeChallenge: challenge,
  codeChallengeMethod: "S256"
});

// 3. Open browser for user login
await shell.openExternal(authUrl);

// 4. Wait for callback with authorization code
const authCode = await waitForCallback();

// 5. Exchange code for tokens
const tokens = await oauth.exchangeCodeForToken({
  code: authCode,
  redirectUri: "http://localhost:8080/callback",
  codeVerifier: verifier
});

// 6. Store tokens in keychain
await keytar.setPassword(SERVICE_NAME, "access_token", tokens.access_token);
await keytar.setPassword(SERVICE_NAME, "refresh_token", tokens.refresh_token);
```

---

## Electron IPC Pattern

```typescript
// Main process (handles MCP logic)
import { ipcMain } from "electron";

ipcMain.handle("mcp:call-tool", async (event, { toolName, params }) => {
  const result = await mcpClient.callTool({
    name: toolName,
    arguments: params
  });
  return result;
});

// Renderer process (UI)
import { ipcRenderer } from "electron";

async function callMCPTool(toolName: string, params: unknown) {
  return ipcRenderer.invoke("mcp:call-tool", { toolName, params });
}
```

---

## 6 Security Tools (Names & Purposes)

1. **analyze_threat_indicator** - Analyze IOCs (IPs, domains, hashes) against threat feeds
2. **assess_vulnerability** - Assess CVE vulnerabilities with CVSS scoring and exploitability
3. **correlate_security_incidents** - Correlate multiple incidents to identify attack patterns
4. **generate_remediation_plan** - Generate prioritized remediation steps for vulnerabilities
5. **analyze_attack_surface** - Scan external attack surface for exposed services/misconfigs
6. **audit_security_compliance** - Audit systems against compliance frameworks (CIS, NIST)

---

## Testing Commands

```bash
# Run unit tests
npm run test:unit

# Run integration tests (requires ServiceNow/Ollama running)
npm run test:integration

# Run E2E tests
npm run test:e2e

# Test coverage report
npm run test:coverage

# Lint code
npm run lint
```

---

## Build Commands

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package  # Creates installers for current platform

# Package for all platforms
npm run package:all  # Windows, Mac, Linux
```

---

## Debugging MCP Communication

### Enable MCP Protocol Logging
```typescript
import debug from "debug";

// Enable MCP debug logs
debug.enable("mcp:*");

// In server/client code
const log = debug("mcp:client");
log("Calling tool:", toolName, params);
```

### Inspect MCP Messages
```typescript
// Add middleware to log all requests
client.setRequestMiddleware(async (request) => {
  console.log("MCP Request:", JSON.stringify(request, null, 2));
  return request;
});

server.setRequestHandler(async (request, next) => {
  console.log("MCP Server Received:", JSON.stringify(request, null, 2));
  return next(request);
});
```

### Test MCP Server with Inspector
```bash
# Install MCP Inspector
npx @modelcontextprotocol/inspector

# Test your server
npx @modelcontextprotocol/inspector node dist/server.js
```

---

## Common Issues & Solutions

### Issue: "Cannot find module '@modelcontextprotocol/sdk'"
**Solution**: Ensure you installed the package:
```bash
npm install @modelcontextprotocol/sdk zod
```

### Issue: Zod validation fails with cryptic errors
**Solution**: Add detailed descriptions to help debug:
```typescript
const schema = {
  cve_id: z.string()
    .regex(/^CVE-\d{4}-\d{4,}$/)
    .describe("CVE identifier in format CVE-YYYY-NNNN")
};
```

### Issue: OAuth callback not working
**Solution**: Ensure redirect URI matches exactly (including trailing slash):
```typescript
redirectUri: "http://localhost:8080/callback"  // Must match ServiceNow config
```

### Issue: Electron IPC not receiving responses
**Solution**: Use `ipcMain.handle()` (not `on()`) for async operations:
```typescript
// Correct
ipcMain.handle("mcp:call", async (event, data) => {
  return await mcpClient.callTool(data);
});

// Incorrect - won't return value to renderer
ipcMain.on("mcp:call", async (event, data) => {
  const result = await mcpClient.callTool(data);
  event.reply("mcp:response", result);  // Awkward pattern
});
```

---

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| UI Feedback | <100ms | `performance.now()` before/after |
| API Response | <200ms p95 | Log timestamps, calculate percentiles |
| AI Response | <5s (95%) | Measure Ollama call duration |
| Memory Usage | <500MB | Task Manager / Activity Monitor |
| CPU Usage | <70% peak | Task Manager / Activity Monitor |
| Startup Time | <3s | Measure from `app.on('ready')` to window shown |

---

## Security Checklist

- [ ] No hardcoded API keys or credentials in code
- [ ] All credentials stored in OS keychain (keytar)
- [ ] OAuth 2.1 with PKCE for ServiceNow authentication
- [ ] Input validation on all tool parameters (Zod)
- [ ] Sanitize user inputs before display (XSS prevention)
- [ ] HTTPS for all external API calls
- [ ] Run OWASP Dependency Check before release
- [ ] No sensitive data in logs or error messages
- [ ] Secure IPC: use `contextIsolation: true` in Electron

---

## Useful Links

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [TypeScript SDK Docs](https://modelcontextprotocol.github.io/typescript-sdk/)
- [Zod Documentation](https://zod.dev/)
- [Electron IPC Guide](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [OAuth 2.1 Spec](https://oauth.net/2.1/)
- [Full Research Document](./mcp-research.md)
- [Implementation Recommendations](./mcp-recommendations.md)

---

**Quick Start**: See `mcp-recommendations.md` Section "Implementation Checklist" for phased rollout plan.
