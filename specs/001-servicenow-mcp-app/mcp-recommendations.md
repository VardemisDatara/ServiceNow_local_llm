# MCP Implementation Recommendations - ServiceNow Bridge Application

**Date**: 2026-02-13
**Project**: ServiceNow MCP Bridge Application
**Full Research**: See `mcp-research.md` for detailed analysis

---

## Executive Recommendations

### 1. SDK Selection: **TypeScript MCP SDK** ✅

**Package**: `@modelcontextprotocol/sdk` with `zod@^4.0.0`

**Installation**:
```bash
npm install @modelcontextprotocol/sdk zod
npm install @modelcontextprotocol/node  # For HTTP transport helpers
```

**Why TypeScript over Python/Rust**:
- ✅ Native integration with Electron/Tauri desktop frameworks
- ✅ Largest community with extensive examples and documentation
- ✅ Strong type safety through Zod schema validation
- ✅ Official Anthropic maintenance and support
- ✅ Fastest development cycle for TypeScript team
- ✅ Comprehensive middleware packages for HTTP/Express/Node.js

**Trade-offs Accepted**:
- Binary size larger than Rust (~150MB with Electron vs ~10MB Tauri+Rust)
- Memory footprint higher than Rust (~100-200MB vs ~30-50MB)
- Not as fast as Rust for compute-intensive operations (acceptable for this use case)

---

### 2. Desktop Framework: **Electron** ✅

**Why Electron over Tauri**:
- ✅ Native TypeScript MCP SDK integration (no FFI bridge needed)
- ✅ Mature ecosystem with extensive IPC examples
- ✅ Faster development with familiar web stack
- ✅ Better community resources and debugging tools
- ✅ Cross-platform support proven at scale (VS Code, Slack, Discord)

**Implementation Pattern**:
```typescript
// Main process: MCP server + client logic
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ipcMain } from "electron";

// Renderer process: React/Vue UI
// Communicates via Electron IPC to main process
```

**Trade-offs Accepted**:
- Larger binary size (~150MB) - acceptable for desktop application
- Higher memory baseline (~100-200MB) - within 500MB constraint
- Chromium dependency - provides consistent cross-platform UI rendering

**Alternative Considered**: Tauri would reduce binary to ~10-15MB but requires Rust learning curve and has smaller community. Choose Tauri only if binary size is critical constraint.

---

### 3. Transport Strategy: **Hybrid Architecture** ✅

#### Desktop App → ServiceNow (MCP Client)
**Use**: **HTTP Streamable Transport**

**Rationale**:
- ServiceNow is remote cloud-hosted service
- Requires network communication over HTTPS
- Supports multiple concurrent connections
- Standard HTTP infrastructure (proxies, load balancers work)

**Implementation**:
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { HttpStreamableTransport } from "@modelcontextprotocol/sdk/client/http.js";

const client = new Client(
  { name: "servicenow-client", version: "1.0.0" },
  { capabilities: {} }
);

const transport = new HttpStreamableTransport(
  new URL("https://instance.service-now.com/api/mcp"),
  {
    timeout: 30000,  // 30 second timeout
    retries: 3
  }
);

await client.connect(transport);
```

#### ServiceNow → Desktop App (MCP Server)
**Use**: **stdio Transport** (simplest) or **HTTP Transport** (if remote access needed)

**Recommendation**: **Start with stdio** for MVP, add HTTP if ServiceNow needs to initiate connections

**stdio Implementation** (simplest):
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "ollama-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**HTTP Implementation** (if bidirectional remote access needed):
```typescript
import { createHttpStreamableTransport } from "@modelcontextprotocol/node";
import express from "express";

const app = express();
app.post("/mcp", async (req, res) => {
  const transport = createHttpStreamableTransport(req, res);
  await server.connect(transport);
});
app.listen(8000);
```

**Decision Criteria**:
- If ServiceNow only *responds* to desktop app requests → **stdio sufficient**
- If ServiceNow needs to *initiate* requests to desktop app → **add HTTP server with authentication**

---

### 4. MCP Tool Definitions: **6 Security-Focused Tools**

All tools use **Zod schemas** for type-safe validation. Each tool includes:
- Descriptive name (snake_case)
- Human-readable description for LLM guidance
- JSON Schema via Zod with validation rules
- Async handler with error handling

#### Tool 1: Threat Indicator Analysis
```typescript
server.tool(
  "analyze_threat_indicator",
  "Analyze threat indicators (IOCs) using multiple intelligence feeds and return threat scoring with associated campaigns",
  {
    indicator: z.string().describe("Indicator of Compromise (IP, domain, file hash, URL)"),
    indicator_type: z.enum(["ip", "domain", "hash", "url"]),
    enrich_context: z.boolean().default(true).describe("Fetch additional context from threat feeds")
  },
  async ({ indicator, indicator_type, enrich_context }) => {
    // Query threat intelligence APIs (VirusTotal, AbuseIPDB, etc.)
    // Return structured threat assessment
  }
);
```

#### Tool 2: Vulnerability Assessment
```typescript
server.tool(
  "assess_vulnerability",
  "Assess CVE vulnerabilities with CVSS scoring, exploitability analysis, and remediation recommendations",
  {
    cve_id: z.string().regex(/^CVE-\d{4}-\d{4,}$/).describe("CVE identifier (e.g., CVE-2024-1234)"),
    affected_systems: z.array(z.string()).optional(),
    include_exploits: z.boolean().default(true).describe("Include known exploit availability")
  },
  async ({ cve_id, affected_systems, include_exploits }) => {
    // Query NVD, ExploitDB, CISA KEV catalog
    // Return CVSS score, exploitability, remediation steps
  }
);
```

#### Tool 3: Security Incident Correlation
```typescript
server.tool(
  "correlate_security_incidents",
  "Correlate multiple security incidents to identify patterns, common IOCs, and potential attack campaigns",
  {
    incident_ids: z.array(z.string()).min(2),
    time_window_hours: z.number().min(1).max(720).default(24),
    correlation_threshold: z.number().min(0).max(1).default(0.7)
  },
  async ({ incident_ids, time_window_hours, correlation_threshold }) => {
    // Fetch incidents from ServiceNow
    // Analyze common indicators, timelines, affected systems
    // Return correlation graph and attack campaign assessment
  }
);
```

#### Tool 4: Remediation Plan Generation
```typescript
server.tool(
  "generate_remediation_plan",
  "Generate prioritized remediation plan with step-by-step instructions based on vulnerability scan results",
  {
    vulnerabilities: z.array(z.object({
      cve_id: z.string(),
      severity: z.enum(["low", "medium", "high", "critical"]),
      affected_asset: z.string()
    })),
    business_context: z.object({
      asset_criticality: z.enum(["low", "medium", "high", "critical"]),
      acceptable_downtime_minutes: z.number().optional()
    }).optional()
  },
  async ({ vulnerabilities, business_context }) => {
    // Prioritize by severity + business context
    // Generate step-by-step remediation plan
    // Include rollback procedures and testing steps
  }
);
```

#### Tool 5: Attack Surface Analysis
```typescript
server.tool(
  "analyze_attack_surface",
  "Analyze organization's external attack surface including exposed services, misconfigurations, and vulnerable endpoints",
  {
    target_scope: z.object({
      domains: z.array(z.string()).optional(),
      ip_ranges: z.array(z.string()).optional(),
      include_subdomains: z.boolean().default(true)
    }),
    scan_depth: z.enum(["quick", "standard", "deep"]).default("standard")
  },
  async ({ target_scope, scan_depth }) => {
    // Use Shodan, Censys, or custom scanning
    // Identify exposed ports, services, certificates
    // Flag misconfigurations and known vulnerabilities
  }
);
```

#### Tool 6: Security Compliance Audit
```typescript
server.tool(
  "audit_security_compliance",
  "Audit system configuration against security compliance frameworks (CIS, NIST, PCI-DSS) and generate gap analysis",
  {
    target_systems: z.array(z.string()),
    framework: z.enum(["cis-benchmark", "nist-800-53", "pci-dss", "iso-27001"]),
    compliance_level: z.enum(["level-1", "level-2"]).optional(),
    generate_remediation: z.boolean().default(true)
  },
  async ({ target_systems, framework, compliance_level, generate_remediation }) => {
    // Run compliance checks against framework
    // Generate gap analysis report
    // Optionally generate remediation tasks
  }
);
```

---

### 5. Error Handling & Resilience Patterns

#### Retry Strategy with Exponential Backoff
```typescript
class MCPClient {
  async callToolWithRetry<T>(
    toolName: string,
    params: unknown,
    options: { maxAttempts?: number; baseDelayMs?: number } = {}
  ): Promise<T> {
    const { maxAttempts = 3, baseDelayMs = 1000 } = options;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.client.callTool({ name: toolName, arguments: params });
        if (result.isError) throw new MCPToolError(result.content[0].text);
        return JSON.parse(result.content[0].text);
      } catch (error) {
        if (attempt === maxAttempts || !this.isRetriable(error)) throw error;

        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await sleep(delay);
      }
    }
  }

  private isRetriable(error: unknown): boolean {
    // Retry network errors, timeouts, rate limits
    // Don't retry authentication failures, validation errors
    return error instanceof NetworkError || error instanceof TimeoutError;
  }
}
```

#### Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      throw new Error("Circuit breaker is OPEN - service unavailable");
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.failureCount >= 5) this.state = "open";  // Open after 5 failures
  }
}
```

#### Error Response Pattern
```typescript
// Tool implementation with structured errors
server.tool("analyze_threat", "...", schema, async (params) => {
  try {
    const result = await threatAPI.analyze(params.indicator);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Threat intelligence API unreachable",
          error_code: "SERVICE_UNAVAILABLE",
          details: error.message,
          suggested_action: "Verify network connectivity and API endpoint"
        })
      }],
      isError: true  // MCP protocol flag
    };
  }
});
```

---

### 6. Authentication: **OAuth 2.1 with PKCE** ✅

**Why OAuth 2.1 over API Keys**:
- ✅ Scoped, time-limited tokens (better security)
- ✅ User identity verification
- ✅ Automatic token refresh
- ✅ PKCE eliminates need for client secrets (critical for desktop apps)
- ✅ Industry standard for enterprise integrations

**Implementation**:
```typescript
import { OAuthClient } from "@modelcontextprotocol/sdk/auth/oauth.js";

class ServiceNowAuthManager {
  private oauthClient: OAuthClient;

  constructor() {
    this.oauthClient = new OAuthClient({
      authorizationEndpoint: "https://instance.service-now.com/oauth_auth.do",
      tokenEndpoint: "https://instance.service-now.com/oauth_token.do",
      clientId: "your_client_id",
      usePKCE: true,  // Always use PKCE for public clients
      scopes: ["mcp:tools:execute", "servicenow:incidents:read"]
    });
  }

  async authenticate(): Promise<string> {
    const { verifier, challenge } = await this.oauthClient.generatePKCE();

    const authUrl = this.oauthClient.buildAuthorizationUrl({
      redirectUri: "http://localhost:8080/callback",
      codeChallenge: challenge,
      codeChallengeMethod: "S256"
    });

    await shell.openExternal(authUrl);  // Open browser
    const authCode = await this.waitForCallback();

    const tokens = await this.oauthClient.exchangeCodeForToken({
      code: authCode,
      redirectUri: "http://localhost:8080/callback",
      codeVerifier: verifier
    });

    await this.storeTokensInKeychain(tokens);
    return tokens.access_token;
  }
}
```

**Credential Storage** (OS Keychain):
```typescript
import keytar from "keytar";

class CredentialManager {
  private readonly SERVICE_NAME = "servicenow-mcp-bridge";

  async storeTokens(instance: string, accessToken: string, refreshToken: string): Promise<void> {
    await keytar.setPassword(this.SERVICE_NAME, `${instance}:access`, accessToken);
    await keytar.setPassword(this.SERVICE_NAME, `${instance}:refresh`, refreshToken);
  }

  async getTokens(instance: string): Promise<{ access: string; refresh: string } | null> {
    const access = await keytar.getPassword(this.SERVICE_NAME, `${instance}:access`);
    const refresh = await keytar.getPassword(this.SERVICE_NAME, `${instance}:refresh`);
    if (!access || !refresh) return null;
    return { access, refresh };
  }
}
```

**Fallback**: Support API keys for local/demo setups, but strongly recommend OAuth for production.

---

### 7. Bidirectional Communication Architecture

**High-Level Architecture**:
```
┌─────────────────────────────────────────────┐
│   Desktop App (Electron)                    │
│                                             │
│  ┌──────────────────┐  ┌──────────────────┐│
│  │  MCP Client      │  │  MCP Server      ││
│  │  (HTTP)          │  │  (stdio/HTTP)    ││
│  │                  │  │                  ││
│  │  Calls ServiceNow│  │  Exposes Ollama  ││
│  │  tools           │  │  tools           ││
│  └────────┬─────────┘  └────────▲─────────┘│
│           │                     │          │
│           │   Electron IPC      │          │
│           │                     │          │
│  ┌────────▼─────────────────────┴─────────┐│
│  │  Business Logic Layer                  ││
│  │  - Conversation Manager                ││
│  │  - AI Orchestrator                     ││
│  │  - Web Search Integration              ││
│  │  - Credential Manager                  ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
          │                    ▲
          │ HTTPS              │ Local API
          │                    │
          ▼                    ▼
┌────────────────┐    ┌────────────────┐
│ ServiceNow     │    │ Ollama         │
│ MCP Server     │    │ Local Instance │
│ (Cloud)        │    │                │
└────────────────┘    └────────────────┘
```

**Communication Flow Example**:

1. **User asks question**: "Check ServiceNow for open security incidents"
2. **Ollama AI** (local) processes question, determines it needs ServiceNow data
3. **Desktop app MCP client** calls ServiceNow MCP server tool: `query_incidents()`
4. **ServiceNow** returns incident list
5. **Ollama AI** analyzes incidents, determines threat analysis needed
6. **ServiceNow AI** (if configured) calls desktop app MCP server tool: `analyze_threat_indicator()`
7. **Desktop app** executes threat analysis via Ollama
8. **Combined results** displayed in UI with attribution

**Key Implementation Pattern**:
```typescript
// Orchestrator in main process
class AIOrchestrator {
  async handleUserQuery(query: string, context: ConversationContext): Promise<Response> {
    // 1. Send query to Ollama
    const ollamaResponse = await this.ollamaClient.chat({ message: query, context });

    // 2. Check if Ollama requested MCP tool calls
    if (ollamaResponse.tool_calls) {
      for (const toolCall of ollamaResponse.tool_calls) {
        // 3. Route to appropriate MCP client/server
        if (toolCall.name.startsWith("servicenow_")) {
          // Call ServiceNow via MCP client
          const result = await this.servicenowClient.callTool(toolCall.name, toolCall.params);
          context.addToolResult(toolCall.id, result);
        }
      }

      // 4. Send tool results back to Ollama for synthesis
      const finalResponse = await this.ollamaClient.chat({ tool_results: context.tool_results });
      return finalResponse;
    }

    return ollamaResponse;
  }
}
```

---

## Implementation Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Initialize Electron project with TypeScript
- [ ] Install MCP SDK dependencies (`@modelcontextprotocol/sdk`, `zod`)
- [ ] Set up basic IPC bridge between main and renderer
- [ ] Implement OS keychain credential storage
- [ ] Create SQLite database schema for conversations
- [ ] Build basic UI shell (React/Vue)

### Phase 2: MCP Server (Week 3-4)
- [ ] Define 6 security tool Zod schemas
- [ ] Implement stdio MCP server in main process
- [ ] Connect Ollama local instance
- [ ] Build tool handlers with error handling
- [ ] Add progress reporting and logging
- [ ] Write unit tests (80% coverage target)

### Phase 3: MCP Client (Week 5-6)
- [ ] Implement HTTP MCP client for ServiceNow
- [ ] Add OAuth 2.1 authentication with PKCE
- [ ] Build ServiceNow API wrapper
- [ ] Implement circuit breaker and retry patterns
- [ ] Add connection health monitoring
- [ ] Write integration tests

### Phase 4: Bidirectional Communication (Week 7-8)
- [ ] Build AI orchestrator for multi-AI workflows
- [ ] Implement conversation context manager
- [ ] Add web search augmentation (DuckDuckGo)
- [ ] Create security incident analysis workflow
- [ ] Build attribution system
- [ ] Add conversation persistence

### Phase 5: UI/UX (Week 9-10)
- [ ] Build configuration panel
- [ ] Implement chat interface with real-time updates
- [ ] Add status indicators and progress feedback
- [ ] Create conversation browsing UI
- [ ] Implement accessibility (WCAG 2.1 AA)
- [ ] Write E2E tests with Playwright

### Phase 6: Polish (Week 11-12)
- [ ] Performance optimization (<500MB memory, <70% CPU)
- [ ] Security audit (OWASP Top 10)
- [ ] Cross-platform testing (Windows, Mac, Linux)
- [ ] User acceptance testing
- [ ] Documentation and quickstart guide
- [ ] Prepare deployment packages

---

## Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@modelcontextprotocol/node": "^1.0.0",
    "zod": "^4.0.0",
    "electron": "^28.0.0",
    "keytar": "^7.9.0",
    "better-sqlite3": "^9.0.0",
    "ollama": "^0.5.0",
    "axios": "^1.6.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "playwright": "^1.40.0",
    "eslint": "^8.55.0"
  }
}
```

---

## Summary: Critical Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **MCP SDK** | TypeScript | Native desktop integration, largest community |
| **Desktop Framework** | Electron | Mature ecosystem, fastest development |
| **Transport (Client)** | HTTP Streamable | ServiceNow is remote, requires network |
| **Transport (Server)** | stdio (MVP), HTTP (future) | Simplest for local, upgrade if remote needed |
| **Authentication** | OAuth 2.1 + PKCE | Industry standard, secure for desktop apps |
| **Tool Validation** | Zod schemas | Runtime + compile-time type safety |
| **Error Handling** | Retry + Circuit Breaker | Resilient to transient failures |
| **Credential Storage** | OS Keychain (keytar) | Secure, platform-native |
| **Conversation Storage** | SQLite (better-sqlite3) | Fast, embedded, no external dependencies |

---

## Next Steps

1. **Review this document with team** - Ensure alignment on technical decisions
2. **Set up development environment** - Install Node.js, Electron, MCP SDK
3. **Create project repository** - Initialize with TypeScript, ESLint, Vite
4. **Begin Phase 1 implementation** - Foundation (Electron + IPC + credentials)
5. **Define security tool contracts** - Write Zod schemas for 6 tools before implementation
6. **Set up ServiceNow MCP server** - Coordinate with ServiceNow team for endpoint URLs

---

**Document Status**: ✅ Complete
**Last Updated**: 2026-02-13
**Next Review**: After Phase 1 completion
