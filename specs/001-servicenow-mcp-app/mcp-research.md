# Model Context Protocol (MCP) Research & Implementation Guide

**Research Date**: 2026-02-13
**Project**: ServiceNow MCP Bridge Application
**Spec Reference**: `/specs/001-servicenow-mcp-app/spec.md`

## Executive Summary

Model Context Protocol (MCP) is an open standard introduced by Anthropic in November 2024 for enabling secure, bidirectional connections between AI models and external data sources/tools. The protocol is hosted by The Linux Foundation with SDKs available for all major programming languages (TypeScript, Python, Rust). For the ServiceNow MCP Bridge Application requiring bidirectional communication between Ollama and ServiceNow, **TypeScript SDK with Electron or Tauri** is recommended for desktop application integration.

---

## 1. Official MCP SDKs and Language Support

### 1.1 TypeScript SDK (Recommended for This Project)

**Repository**: [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)
**Package**: `@modelcontextprotocol/sdk` with peer dependency `zod@^4.0.0`
**Status**: v1.x stable (production-ready), v2 in pre-alpha on main branch

**Installation**:
```bash
# Server SDK
npm install @modelcontextprotocol/server zod

# Client SDK
npm install @modelcontextprotocol/client zod

# Optional middleware for Node.js/Express/Hono
npm install @modelcontextprotocol/node
npm install @modelcontextprotocol/express express
npm install @modelcontextprotocol/hono hono
```

**Key Features**:
- Full MCP specification compliance
- Zod-based schema validation with type inference
- Built-in support for stdio and Streamable HTTP transports
- OAuth 2.1 authentication helpers
- Desktop-friendly (works with Electron/Tauri IPC)
- Comprehensive documentation and runnable examples

**Pros**:
- Native TypeScript integration with desktop frameworks (Electron, Tauri)
- Strong type safety through Zod schemas
- Best ecosystem support and community adoption
- Official Anthropic maintenance
- Excellent documentation with practical examples

**Cons**:
- Requires Node.js runtime (adds ~100MB to app size if using Electron)
- Zod dependency mandatory (adds validation overhead)

### 1.2 Python SDK

**Repository**: [github.com/modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk)
**Package**: `mcp[cli]` on PyPI
**Documentation**: [modelcontextprotocol.github.io/python-sdk](https://modelcontextprotocol.github.io/python-sdk/)

**Installation**:
```bash
uv add "mcp[cli]"
# or
pip install "mcp[cli]"
```

**Key Features**:
- FastMCP class for rapid server development
- Async/await support with type hints
- Pydantic integration for structured output
- Context-aware tools (logging, progress reporting)
- Lifespan management for startup/shutdown

**Example Server**:
```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("SecurityTools", json_response=True)

@mcp.tool()
async def analyze_threat(indicator: str, ctx: Context) -> dict:
    """Analyze threat indicators using threat intelligence"""
    await ctx.info(f"Analyzing: {indicator}")
    await ctx.report_progress(progress=0.5, total=1.0)
    return {"status": "analyzed", "severity": "high"}

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

**Pros**:
- Rapid prototyping with FastMCP decorator-based API
- Native integration with Python ML/security tools
- Smaller binary size compared to Node.js
- Strong async support

**Cons**:
- Limited desktop framework integration (PyQt/wxPython less mature than Electron/Tauri)
- Smaller community compared to TypeScript ecosystem
- No official Tauri Python bindings (community-maintained only)

### 1.3 Rust SDK

**Repository**: [github.com/modelcontextprotocol/rust-sdk](https://github.com/modelcontextprotocol/rust-sdk)
**Crate**: `mcp-sdk` on crates.io
**Status**: Official implementation with tokio async runtime

**Alternative Community SDKs**:
- **Prism MCP**: Production-grade, full 2025-06-18 spec compliance
- **mcp-protocol-sdk**: Fast, feature-complete implementation
- **mcpkit**: Unified `#[mcp_server]` macro for simplified development

**Pros**:
- Native Tauri integration (Rust-native desktop framework)
- Smallest binary size and memory footprint
- Best performance for compute-intensive security tools
- Memory safety guarantees

**Cons**:
- Steeper learning curve for developers unfamiliar with Rust
- Smaller ecosystem compared to TypeScript/Python
- Longer development time for rapid prototyping

### 1.4 SDK Recommendation Matrix

| Criteria | TypeScript | Python | Rust |
|----------|-----------|--------|------|
| Desktop framework support | Excellent (Electron, Tauri) | Limited (PyQt/wx) | Excellent (Tauri-native) |
| Development speed | Fast | Very fast | Moderate |
| Binary size | Large (~150MB with Electron) | Medium (~50MB) | Small (~10MB) |
| Type safety | Strong (Zod + TS) | Moderate (type hints) | Strongest (ownership) |
| Community/examples | Largest | Growing | Smaller |
| Security tool integration | Good | Excellent | Excellent |
| MCP spec compliance | Full | Full | Full |

**Recommendation**: **TypeScript SDK** for this project due to:
1. Best desktop framework integration (Electron + Tauri both supported)
2. Largest community and example implementations
3. Rapid development with strong type safety
4. Native support for bidirectional MCP communication
5. Mature tooling and testing ecosystem

---

## 2. MCP Architecture and Core Concepts

### 2.1 Protocol Foundation

**Base Protocol**: JSON-RPC 2.0 over stateful connections
**Specification**: [modelcontextprotocol.io/specification/2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)

**Key Participants**:
- **Hosts**: LLM applications that initiate connections (e.g., Claude Desktop)
- **Clients**: Connectors within host applications that manage protocol communication
- **Servers**: Services exposing context, tools, and capabilities

**Message Types**:
- **Request-Response**: Bidirectional structured exchanges expecting replies
- **Notifications**: One-way messages not requiring acknowledgment

### 2.2 Connection Lifecycle

1. **Initialization Handshake**:
   - Client sends `initialize` request with protocol version and capabilities
   - Server responds with its version and advertised capabilities
   - Client sends `initialized` notification to confirm handshake completion

2. **Active Communication Phase**:
   - Either party can initiate requests (bidirectional pattern)
   - Servers push status updates via notifications
   - Clients query tools/resources on demand

3. **Capability Negotiation**:
   - Both parties declare supported features during handshake
   - Dynamic feature discovery prevents version incompatibilities

### 2.3 Server Features (Exposed by MCP Servers)

**Resources**: Read-only context and data (similar to GET endpoints)
- URI-based addressing (e.g., `file://documents/{id}`)
- No significant computation allowed
- Used for providing context to AI models

**Prompts**: Templated messages and workflows
- Reusable interaction patterns
- Parameter substitution support
- Guide AI behavior with structured templates

**Tools**: Executable functions (similar to POST endpoints)
- AI models invoke tools to perform actions
- Can have side effects (database writes, API calls)
- JSON Schema-validated parameters

### 2.4 Client Features (Exposed by MCP Clients)

**Sampling**: Server-initiated LLM interactions
- Allows servers to recursively call LLMs
- Requires explicit user consent (security principle)
- Limited server visibility into prompts

**Roots**: Server-initiated filesystem/URI boundary inquiries
- Servers can request access scope information
- Used for permission management

**Elicitation**: Server-initiated user information requests
- Servers can ask users for additional input
- Enables interactive workflows

---

## 3. Transport Patterns for Bidirectional Communication

### 3.1 Transport Comparison

| Transport | Use Case | Latency | Complexity | Multi-Client |
|-----------|----------|---------|------------|--------------|
| **stdio** | Local CLI tools, single-user desktop apps | Microseconds | Low | No |
| **Streamable HTTP** | Remote servers, web apps, cloud deployments | Milliseconds | Medium | Yes |
| **HTTP+SSE** (deprecated) | Legacy remote access | Milliseconds | High | Yes |

### 3.2 stdio Transport (Recommended for Desktop App)

**How it works**:
- Server process launched as subprocess by client
- Communication via stdin/stdout pipes
- Newline-delimited JSON-RPC messages

**Ideal for**:
- Claude Desktop integrations
- Local desktop applications (Electron/Tauri)
- Single-user scenarios
- Minimal latency requirements

**Example (TypeScript)**:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "ollama-mcp-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},
    resources: {}
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Pros**:
- Zero network overhead (microsecond response times)
- Simple deployment (no firewall/port configuration)
- Automatic cleanup when parent process exits
- No authentication complexity

**Cons**:
- Cannot serve multiple clients simultaneously
- No remote access capability
- Process management complexity

### 3.3 Streamable HTTP Transport (Modern Standard)

**How it works**:
- Client sends HTTP POST requests to server
- Server responds with JSON or Server-Sent Events (SSE) stream
- Server decides response pattern based on operation type

**Ideal for**:
- Remote MCP servers (cloud-hosted)
- Multiple concurrent clients
- Browser-based integrations
- ServiceNow integrations (remote API access)

**Example (TypeScript Server)**:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createHttpStreamableTransport } from "@modelcontextprotocol/node";
import express from "express";

const app = express();
const server = new Server({
  name: "servicenow-mcp-server",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

app.post("/mcp", async (req, res) => {
  const transport = createHttpStreamableTransport(req, res);
  await server.connect(transport);
});

app.listen(8000);
```

**Example (TypeScript Client)**:
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { HttpStreamableTransport } from "@modelcontextprotocol/sdk/client/http.js";

const client = new Client({
  name: "ollama-client",
  version: "1.0.0"
}, {
  capabilities: {}
});

const transport = new HttpStreamableTransport(
  new URL("http://localhost:8000/mcp")
);
await client.connect(transport);
```

**Pros**:
- Serves multiple clients concurrently
- Remote access over network
- Flexible response patterns (JSON for simple calls, SSE for streaming)
- Standard HTTP infrastructure (load balancers, proxies work)

**Cons**:
- Higher latency than stdio (~10-50ms overhead)
- Requires port configuration and firewall rules
- More complex error handling (network timeouts, retries)

### 3.4 Recommended Transport Strategy for This Project

**Bidirectional Setup**:

1. **Ollama → ServiceNow** (MCP Client in Desktop App):
   - Use **Streamable HTTP** transport
   - Desktop app acts as MCP client
   - Connects to ServiceNow MCP server endpoint (remote)
   - HTTP allows ServiceNow to be cloud-hosted

2. **ServiceNow → Ollama** (MCP Server in Desktop App):
   - Use **stdio** transport initially (simplest)
   - Desktop app acts as MCP server
   - ServiceNow Now Assist connects via HTTP reverse proxy if needed
   - Alternative: Run local HTTP server on desktop for bidirectional HTTP

**Hybrid Architecture** (Recommended):
```
┌─────────────────────────────────────────┐
│   Desktop App (Electron/Tauri)         │
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │ MCP Client   │    │ MCP Server   │  │
│  │ (HTTP)       │    │ (stdio/HTTP) │  │
│  │              │    │              │  │
│  │ Calls        │    │ Exposes      │  │
│  │ ServiceNow   │    │ Ollama tools │  │
│  │ tools        │    │              │  │
│  └──────────────┘    └──────────────┘  │
│         ▲                    ▲          │
└─────────┼────────────────────┼──────────┘
          │                    │
          │ HTTP               │ stdio (local)
          │                    │ or HTTP (if remote needed)
          ▼                    ▼
┌──────────────────┐  ┌──────────────────┐
│ ServiceNow       │  │ Ollama Local     │
│ MCP Server       │  │ Instance         │
│ (Cloud/Remote)   │  │                  │
└──────────────────┘  └──────────────────┘
```

**Decision Rationale**:
- ServiceNow is remote → requires HTTP transport
- Ollama is local → stdio is fastest and simplest
- If ServiceNow needs to initiate calls to desktop app, add HTTP server with authentication

---

## 4. MCP Tool Schema Definition Best Practices

### 4.1 Tool Structure

Every MCP tool consists of:
1. **name**: Unique identifier (snake_case or camelCase)
2. **description**: Human-readable explanation for LLMs
3. **inputSchema**: JSON Schema object (Zod in TypeScript)
4. **handler**: Async function executing the tool logic

### 4.2 Zod Schema Validation (TypeScript)

**Core Pattern**:
```typescript
import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "security-tools", version: "1.0.0" }, { capabilities: { tools: {} } });

server.tool(
  "analyze_threat",
  "Analyze threat indicators using intelligence feeds",
  {
    indicator: z.string().describe("IOC to analyze (IP, domain, hash)"),
    indicator_type: z.enum(["ip", "domain", "hash", "url"]),
    context: z.object({
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      affected_systems: z.array(z.string()).optional()
    }).optional()
  },
  async ({ indicator, indicator_type, context }) => {
    // Tool implementation with type-safe parameters
    const result = await threatIntelligence.analyze(indicator, indicator_type);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            indicator,
            type: indicator_type,
            threat_score: result.score,
            associated_campaigns: result.campaigns,
            recommendations: result.recommendations
          }, null, 2)
        }
      ]
    };
  }
);
```

**Zod Benefits**:
- Runtime validation + compile-time type inference
- Automatic TypeScript type generation
- Self-documenting schemas (`.describe()` adds descriptions)
- Complex validation rules (regex, custom validators)

### 4.3 Best Practices for Tool Schemas

**1. Naming Conventions**:
- Use `snake_case` or `camelCase` consistently
- Name indicates action: `analyze_threat`, `correlate_vulnerabilities`, `generate_remediation`
- Avoid generic names: prefer `assess_vulnerability_risk` over `assess`

**2. Input Schema Design**:
```typescript
// Good: Clear, specific, validated
{
  cve_id: z.string().regex(/^CVE-\d{4}-\d{4,}$/).describe("CVE identifier (e.g., CVE-2024-1234)"),
  affected_systems: z.array(z.string()).min(1).describe("List of affected system hostnames"),
  severity_threshold: z.enum(["low", "medium", "high", "critical"]).default("medium")
}

// Bad: Vague, unvalidated
{
  data: z.any(),
  options: z.record(z.unknown())
}
```

**3. Use JSON Schema Features**:
- **Descriptions**: Guide LLM understanding with `.describe()`
- **Defaults**: Provide sensible defaults with `.default()`
- **Enums**: Constrain values with `.enum()` for predictable inputs
- **Examples**: Include examples with Zod's `.example()` method

**4. Structured Output**:
```typescript
const ThreatAnalysisResult = z.object({
  status: z.enum(["analyzed", "pending", "error"]),
  threat_level: z.enum(["benign", "suspicious", "malicious", "critical"]),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.object({
    type: z.string(),
    value: z.string(),
    source: z.string()
  })),
  recommendations: z.array(z.string())
});

// Return type-safe results
return {
  content: [
    {
      type: "text",
      text: JSON.stringify(ThreatAnalysisResult.parse(analysisResult), null, 2)
    }
  ]
};
```

**5. Error Handling**:
```typescript
server.tool("assess_risk", "Assess security risk", schema, async (params) => {
  try {
    const result = await riskEngine.assess(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (error) {
    // Return structured error with isError flag
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }
});
```

### 4.4 Six Security-Focused MCP Tools (Example Definitions)

**Tool 1: Threat Indicator Analysis**
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
    // Implementation
  }
);
```

**Tool 2: Vulnerability Assessment**
```typescript
server.tool(
  "assess_vulnerability",
  "Assess CVE vulnerabilities with CVSS scoring, exploitability analysis, and remediation recommendations",
  {
    cve_id: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
    affected_systems: z.array(z.string()).optional(),
    include_exploits: z.boolean().default(true).describe("Include known exploit availability")
  },
  async ({ cve_id, affected_systems, include_exploits }) => {
    // Implementation
  }
);
```

**Tool 3: Security Incident Correlation**
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
    // Implementation
  }
);
```

**Tool 4: Remediation Plan Generation**
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
    // Implementation
  }
);
```

**Tool 5: Attack Surface Analysis**
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
    // Implementation
  }
);
```

**Tool 6: Security Compliance Audit**
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
    // Implementation
  }
);
```

---

## 5. Error Handling and Retry Patterns

### 5.1 Error Types and Handling Strategy

**Error Categories**:

| Error Type | Retry? | Strategy |
|------------|--------|----------|
| Network timeout | Yes | Exponential backoff with jitter |
| Authentication failure | No | Prompt user for credentials |
| Invalid parameters | No | Return validation error immediately |
| Transient service error | Yes | Retry with backoff (3-5 attempts) |
| Permanent service error | No | Log and notify user |

### 5.2 MCP Error Response Pattern

**Standard Error Response**:
```typescript
return {
  content: [
    {
      type: "text",
      text: JSON.stringify({
        error: "Threat intelligence API unreachable",
        error_code: "SERVICE_UNAVAILABLE",
        details: "Connection timeout after 10s",
        suggested_action: "Verify network connectivity and API endpoint"
      })
    }
  ],
  isError: true  // MCP protocol flag
};
```

### 5.3 Retry Pattern with Exponential Backoff

**Implementation Example**:
```typescript
class MCPClient {
  async callToolWithRetry<T>(
    toolName: string,
    params: unknown,
    options: {
      maxAttempts?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
    } = {}
  ): Promise<T> {
    const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 10000 } = options;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.client.callTool({
          name: toolName,
          arguments: params
        });

        if (result.isError) {
          throw new MCPToolError(result.content[0].text);
        }

        return JSON.parse(result.content[0].text);
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;
        const isRetriable = this.isRetriableError(error);

        if (!isRetriable || isLastAttempt) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
          maxDelayMs
        );

        await this.sleep(delay);
      }
    }
  }

  private isRetriableError(error: unknown): boolean {
    if (error instanceof NetworkError) return true;
    if (error instanceof TimeoutError) return true;
    if (error instanceof MCPToolError) {
      // Check if error code indicates transient failure
      return ["TIMEOUT", "SERVICE_UNAVAILABLE", "RATE_LIMITED"].includes(
        error.code
      );
    }
    return false;
  }
}
```

### 5.4 Circuit Breaker Pattern

**Prevent cascading failures**:
```typescript
class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount = 0;
  private lastFailureTime?: number;

  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000,
    private successThreshold: number = 2
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime! > this.resetTimeoutMs) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is OPEN - service unavailable");
      }
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

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.failureCount = 0;
      this.state = "closed";
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }
}

// Usage with MCP client
const servicenowCircuit = new CircuitBreaker(5, 60000, 2);

async function callServiceNowTool(toolName: string, params: unknown) {
  return servicenowCircuit.execute(() =>
    mcpClient.callTool({ name: toolName, arguments: params })
  );
}
```

### 5.5 Timeout Configuration

**Transport-Level Timeouts**:
```typescript
// HTTP client with timeout
const transport = new HttpStreamableTransport(
  new URL("http://servicenow.example.com/mcp"),
  {
    timeout: 30000,  // 30 second timeout
    retries: 3,
    retryDelay: 1000
  }
);

// Tool-level timeout wrapper
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(errorMessage)), timeoutMs)
    )
  ]);
}

// Usage
const result = await withTimeout(
  mcpClient.callTool({ name: "analyze_threat", arguments: params }),
  10000,
  "Threat analysis timed out after 10s"
);
```

### 5.6 Error Logging and Monitoring

**Structured Logging**:
```typescript
interface MCPErrorLog {
  timestamp: string;
  error_type: "network" | "validation" | "timeout" | "service";
  tool_name: string;
  error_message: string;
  retry_attempt?: number;
  duration_ms: number;
}

class MCPLogger {
  logError(error: MCPErrorLog): void {
    // Log to local file for user debugging
    fs.appendFileSync("mcp-errors.log", JSON.stringify(error) + "\n");

    // Emit to UI for real-time display
    ipcRenderer.send("mcp-error", error);
  }
}
```

---

## 6. Authentication and Authorization Patterns

### 6.1 Authentication Approaches

**API Keys** (Simple, suitable for local/demo):
- Static token identifying application/service
- Straightforward implementation
- **Limitations**: No user identity, no expiration, rotation complexity

**OAuth 2.1** (Recommended for production):
- Scoped, time-limited tokens from authorization server
- User identity verification
- Token refresh mechanism
- PKCE (Proof Key for Code Exchange) for public clients

### 6.2 API Key Authentication Pattern

**Server-Side Implementation**:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "servicenow-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

// Middleware for API key validation
server.setRequestHandler("tool:call", async (request, next) => {
  const apiKey = request.params.meta?.authorization?.split("Bearer ")[1];

  if (!apiKey || !isValidApiKey(apiKey)) {
    return {
      error: {
        code: -32001,
        message: "Invalid or missing API key"
      }
    };
  }

  return next(request);
});

function isValidApiKey(key: string): boolean {
  // Validate against stored keys (use secure storage, not hardcoded)
  const validKeys = loadApiKeysFromSecureStorage();
  return validKeys.includes(key);
}
```

**Client-Side Implementation**:
```typescript
const client = new Client({ name: "ollama-client", version: "1.0.0" }, { capabilities: {} });

// Inject API key in request metadata
client.setRequestMiddleware(async (request) => {
  const apiKey = await getApiKeyFromKeychain();
  return {
    ...request,
    params: {
      ...request.params,
      meta: {
        authorization: `Bearer ${apiKey}`
      }
    }
  };
});
```

### 6.3 OAuth 2.1 with PKCE Pattern

**Authorization Flow**:
```typescript
import { OAuthClient } from "@modelcontextprotocol/sdk/auth/oauth.js";

class MCPOAuthClient {
  private oauthClient: OAuthClient;

  constructor(
    private authUrl: string,
    private tokenUrl: string,
    private clientId: string
  ) {
    this.oauthClient = new OAuthClient({
      authorizationEndpoint: authUrl,
      tokenEndpoint: tokenUrl,
      clientId,
      usePKCE: true,  // Always use PKCE for public clients
      scopes: ["mcp:tools:read", "mcp:tools:execute"]
    });
  }

  async authenticate(): Promise<string> {
    // Generate PKCE verifier and challenge
    const { verifier, challenge } = await this.oauthClient.generatePKCE();

    // Build authorization URL
    const authUrl = this.oauthClient.buildAuthorizationUrl({
      redirectUri: "http://localhost:8080/callback",
      state: generateRandomState(),
      codeChallenge: challenge,
      codeChallengeMethod: "S256"
    });

    // Open browser for user authentication
    await shell.openExternal(authUrl);

    // Wait for callback with authorization code
    const authCode = await this.waitForCallback();

    // Exchange code for access token
    const tokens = await this.oauthClient.exchangeCodeForToken({
      code: authCode,
      redirectUri: "http://localhost:8080/callback",
      codeVerifier: verifier
    });

    return tokens.access_token;
  }

  async refreshToken(refreshToken: string): Promise<string> {
    const tokens = await this.oauthClient.refreshAccessToken(refreshToken);
    return tokens.access_token;
  }
}
```

### 6.4 Credential Storage (OS Keychain Integration)

**Secure Credential Management**:
```typescript
import keytar from "keytar";  // npm package for OS keychain access

class CredentialManager {
  private readonly SERVICE_NAME = "servicenow-mcp-bridge";

  async storeApiKey(instanceName: string, apiKey: string): Promise<void> {
    await keytar.setPassword(this.SERVICE_NAME, `${instanceName}:api_key`, apiKey);
  }

  async getApiKey(instanceName: string): Promise<string | null> {
    return keytar.getPassword(this.SERVICE_NAME, `${instanceName}:api_key`);
  }

  async deleteApiKey(instanceName: string): Promise<boolean> {
    return keytar.deletePassword(this.SERVICE_NAME, `${instanceName}:api_key`);
  }

  async storeOAuthTokens(
    instanceName: string,
    accessToken: string,
    refreshToken: string
  ): Promise<void> {
    await keytar.setPassword(this.SERVICE_NAME, `${instanceName}:access_token`, accessToken);
    await keytar.setPassword(this.SERVICE_NAME, `${instanceName}:refresh_token`, refreshToken);
  }

  async getOAuthTokens(instanceName: string): Promise<{ access: string; refresh: string } | null> {
    const access = await keytar.getPassword(this.SERVICE_NAME, `${instanceName}:access_token`);
    const refresh = await keytar.getPassword(this.SERVICE_NAME, `${instanceName}:refresh_token`);

    if (!access || !refresh) return null;
    return { access, refresh };
  }
}
```

### 6.5 Security Best Practices

**Never Embed Secrets**:
```typescript
// BAD - Never do this
const API_KEY = "sk_live_abcdef123456";

// GOOD - Load from environment or keychain
const apiKey = process.env.SERVICENOW_API_KEY || await credentialManager.getApiKey("instance1");
```

**Scope Limitation**:
```typescript
// Request minimal scopes needed
const scopes = [
  "mcp:tools:execute",        // Execute MCP tools
  "servicenow:incidents:read" // Read incidents only (not write)
];
```

**Token Rotation**:
```typescript
class TokenManager {
  async ensureValidToken(): Promise<string> {
    const tokens = await credentialManager.getOAuthTokens("instance1");

    if (!tokens) {
      throw new Error("Not authenticated");
    }

    // Check if token is expired (decode JWT or track expiry)
    if (this.isTokenExpired(tokens.access)) {
      const newAccessToken = await oauthClient.refreshToken(tokens.refresh);
      await credentialManager.storeOAuthTokens("instance1", newAccessToken, tokens.refresh);
      return newAccessToken;
    }

    return tokens.access;
  }
}
```

**Audit Logging**:
```typescript
interface AuthAuditLog {
  timestamp: string;
  event: "login" | "logout" | "token_refresh" | "auth_failure";
  user_id?: string;
  instance: string;
  success: boolean;
  error_message?: string;
}

function logAuthEvent(event: AuthAuditLog): void {
  fs.appendFileSync("auth-audit.log", JSON.stringify(event) + "\n");
}
```

---

## 7. Example MCP Server Implementations

### 7.1 Security-Focused MCP Servers

**Notable Projects**:

1. **FuzzingLabs/mcp-security-hub** ([GitHub](https://github.com/FuzzingLabs/mcp-security-hub))
   - 35 production-ready Dockerized MCP servers
   - Categories: reconnaissance (nmap, masscan), web security (nuclei, sqlmap), binary analysis (Ghidra), cloud security (Trivy)
   - 163+ security tools exposed via natural language
   - Defense-in-depth: non-root execution, minimal base images, read-only mounts

2. **cyproxio/mcp-for-security** ([GitHub](https://github.com/cyproxio/mcp-for-security))
   - Popular security tools: SQLMap, FFUF, NMAP, Masscan
   - Integrated into AI workflows for pentesting and bug bounty hunting

3. **Google/mcp-security** ([GitHub](https://github.com/google/mcp-security))
   - Google Threat Intelligence (VirusTotal) integration
   - Tools for threat analysis and IOC enrichment

4. **securityfortech/secops-mcp** ([GitHub](https://github.com/securityfortech/secops-mcp))
   - All-in-one security testing toolbox
   - Single MCP interface for pentesting, threat hunting, and security operations

### 7.2 Tool Implementation Patterns from Examples

**Pattern 1: Docker Container Orchestration**:
```typescript
// Example from mcp-security-hub
server.tool(
  "run_nmap_scan",
  "Execute Nmap port scan against target hosts",
  {
    target: z.string().describe("Target IP or hostname"),
    scan_type: z.enum(["quick", "full", "stealth"]),
    ports: z.string().optional().describe("Port range (e.g., '1-1000')")
  },
  async ({ target, scan_type, ports }) => {
    const docker = new Docker();

    const container = await docker.createContainer({
      Image: "nmap-mcp:latest",
      Cmd: buildNmapCommand(target, scan_type, ports),
      HostConfig: {
        NetworkMode: "none",  // Isolate from host network
        ReadonlyRootfs: true,
        CapDrop: ["ALL"],     // Drop all Linux capabilities
        CapAdd: ["NET_RAW"]   // Add only required capability
      }
    });

    await container.start();
    const output = await container.logs({ stdout: true });
    await container.remove();

    return {
      content: [{ type: "text", text: output }]
    };
  }
);
```

**Pattern 2: External API Integration**:
```typescript
// Example: VirusTotal threat intelligence
server.tool(
  "lookup_file_hash",
  "Query VirusTotal for file hash reputation and detection details",
  {
    hash: z.string().regex(/^[a-fA-F0-9]{32,64}$/),
    hash_type: z.enum(["md5", "sha1", "sha256"])
  },
  async ({ hash, hash_type }) => {
    const apiKey = await credentialManager.getApiKey("virustotal");

    const response = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
      headers: { "x-apikey": apiKey }
    });

    if (!response.ok) {
      return {
        content: [{ type: "text", text: `Error: ${response.statusText}` }],
        isError: true
      };
    }

    const data = await response.json();

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          hash,
          malicious_detections: data.data.attributes.last_analysis_stats.malicious,
          total_scanners: data.data.attributes.last_analysis_stats.total,
          file_type: data.data.attributes.type_description,
          names: data.data.attributes.names
        }, null, 2)
      }]
    };
  }
);
```

**Pattern 3: Database Query Tools**:
```typescript
// Example: ServiceNow incident lookup
server.tool(
  "query_servicenow_incidents",
  "Query ServiceNow for security incidents matching criteria",
  {
    query: z.object({
      severity: z.enum(["1", "2", "3", "4"]).optional(),
      state: z.enum(["new", "in_progress", "resolved", "closed"]).optional(),
      assigned_to: z.string().optional(),
      created_after: z.string().datetime().optional()
    }),
    limit: z.number().min(1).max(100).default(10)
  },
  async ({ query, limit }) => {
    const apiUrl = await getServiceNowUrl();
    const credentials = await credentialManager.getOAuthTokens("servicenow");

    const queryParams = new URLSearchParams({
      sysparm_limit: limit.toString(),
      sysparm_query: buildServiceNowQuery(query)
    });

    const response = await fetch(
      `${apiUrl}/api/now/table/incident?${queryParams}`,
      {
        headers: {
          "Authorization": `Bearer ${credentials.access}`,
          "Accept": "application/json"
        }
      }
    );

    const data = await response.json();

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data.result, null, 2)
      }]
    };
  }
);
```

---

## 8. Desktop Application Integration

### 8.1 Electron vs Tauri Comparison

| Feature | Electron | Tauri |
|---------|----------|-------|
| **Language** | TypeScript/JavaScript | Rust + TypeScript (UI) |
| **Binary size** | ~150MB (includes Chromium + Node.js) | ~10-15MB (uses OS webview) |
| **Memory usage** | ~100-200MB baseline | ~30-50MB baseline |
| **Startup time** | 1-3 seconds | <1 second |
| **MCP SDK support** | Native (TypeScript SDK) | Via Rust SDK + IPC bridge |
| **Cross-platform** | Excellent (Windows, Mac, Linux) | Excellent (Windows, Mac, Linux) |
| **Development speed** | Fast (familiar web stack) | Moderate (Rust learning curve) |
| **Security** | Good (sandboxed renderer) | Excellent (Rust memory safety) |
| **Community/ecosystem** | Very large | Growing rapidly |

**Recommendation**: **Electron** for this project due to:
- Native TypeScript MCP SDK support
- Faster development with familiar web stack
- Larger community and example implementations
- Binary size acceptable for desktop application (~150MB)

### 8.2 Electron + MCP Architecture

**IPC Communication Pattern**:
```
┌─────────────────────────────────────────────────┐
│              Electron Main Process              │
│  (Node.js runtime - full system access)         │
│                                                  │
│  ┌─────────────────┐      ┌──────────────────┐ │
│  │  MCP Server     │      │  MCP Client      │ │
│  │  (stdio/HTTP)   │      │  (HTTP)          │ │
│  │                 │      │                  │ │
│  │  Exposes Ollama │      │  Calls ServiceNow│ │
│  │  tools          │      │  tools           │ │
│  └─────────────────┘      └──────────────────┘ │
│           ▲                        ▲            │
│           │                        │            │
│           │    IPC Bridge          │            │
│           │                        │            │
└───────────┼────────────────────────┼────────────┘
            │                        │
            ▼                        ▼
┌───────────────────────────────────────────────┐
│          Electron Renderer Process            │
│  (Chromium-based UI - sandboxed)              │
│                                                │
│  React/Vue Components:                         │
│  - Chat Interface                              │
│  - Configuration Panel                         │
│  - Conversation History                        │
│  - Status Indicators                           │
└────────────────────────────────────────────────┘
```

**Main Process (MCP Logic)**:
```typescript
// src/main/index.ts
import { app, BrowserWindow, ipcMain } from "electron";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HttpStreamableTransport } from "@modelcontextprotocol/sdk/client/http.js";

// MCP Server (exposes Ollama tools to ServiceNow)
const mcpServer = new Server(
  { name: "ollama-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Register security tools
mcpServer.tool("analyze_threat", "Analyze threat indicators", schema, handler);
mcpServer.tool("assess_vulnerability", "Assess CVE vulnerabilities", schema, handler);
// ... 4 more tools

// Start stdio server
const stdioTransport = new StdioServerTransport();
await mcpServer.connect(stdioTransport);

// MCP Client (calls ServiceNow tools)
const mcpClient = new Client(
  { name: "servicenow-client", version: "1.0.0" },
  { capabilities: {} }
);

const httpTransport = new HttpStreamableTransport(
  new URL("https://instance.service-now.com/api/mcp")
);
await mcpClient.connect(httpTransport);

// IPC Handlers for renderer process
ipcMain.handle("mcp:call-servicenow-tool", async (event, { toolName, params }) => {
  const result = await mcpClient.callTool({
    name: toolName,
    arguments: params
  });
  return result;
});

ipcMain.handle("mcp:chat-with-ollama", async (event, { message, context }) => {
  // Call Ollama via local API, potentially invoking MCP tools
  const response = await ollamaClient.chat({
    model: "llama3",
    messages: context.concat({ role: "user", content: message })
  });
  return response;
});
```

**Renderer Process (UI)**:
```typescript
// src/renderer/services/ipc.ts
import { ipcRenderer } from "electron";

export class MCPService {
  async callServiceNowTool(toolName: string, params: unknown): Promise<unknown> {
    return ipcRenderer.invoke("mcp:call-servicenow-tool", { toolName, params });
  }

  async chatWithOllama(message: string, context: Message[]): Promise<string> {
    return ipcRenderer.invoke("mcp:chat-with-ollama", { message, context });
  }
}

// src/renderer/components/Chat.tsx
import React, { useState } from "react";
import { MCPService } from "../services/ipc";

export function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const mcpService = new MCPService();

  async function handleSend(userMessage: string) {
    setMessages([...messages, { role: "user", content: userMessage }]);

    const response = await mcpService.chatWithOllama(userMessage, messages);

    setMessages([...messages, { role: "assistant", content: response }]);
  }

  return <div>{/* Chat UI */}</div>;
}
```

### 8.3 Tauri Integration (Alternative)

**Tauri + Rust SDK Pattern**:
```rust
// src-tauri/src/main.rs
use mcp_sdk::{Server, Tool};
use tauri::Manager;

#[tauri::command]
async fn call_servicenow_tool(tool_name: String, params: serde_json::Value) -> Result<String, String> {
    let client = MCPClient::new("https://instance.service-now.com/api/mcp");
    let result = client.call_tool(&tool_name, params).await
        .map_err(|e| e.to_string())?;
    Ok(serde_json::to_string(&result).unwrap())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![call_servicenow_tool])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
```

**Frontend (TypeScript)**:
```typescript
// src/services/tauri-mcp.ts
import { invoke } from "@tauri-apps/api/tauri";

export class TauriMCPService {
  async callServiceNowTool(toolName: string, params: unknown): Promise<unknown> {
    const result = await invoke("call_servicenow_tool", { toolName, params });
    return JSON.parse(result as string);
  }
}
```

### 8.4 Recommendation for Desktop Integration

**Choose Electron if**:
- Team has strong TypeScript/JavaScript experience
- Rapid development is priority
- Binary size ~150MB is acceptable
- Want native MCP TypeScript SDK integration

**Choose Tauri if**:
- Team has Rust experience or willing to learn
- Binary size and memory footprint are critical (<20MB target)
- Need maximum security (Rust memory safety)
- Comfortable with Rust/TypeScript hybrid architecture

**For this project**: **Electron is recommended** due to faster development cycle, native MCP SDK support, and team familiarity with TypeScript ecosystem.

---

## 9. Implementation Roadmap

### Phase 0: Research & Technology Selection (Completed)
- ✅ MCP SDK research (TypeScript, Python, Rust)
- ✅ Transport pattern analysis (stdio vs HTTP)
- ✅ Desktop framework evaluation (Electron vs Tauri)
- ✅ Security tool example review
- ✅ Authentication pattern research

### Phase 1: Core Infrastructure
**Tasks**:
1. Initialize Electron project with TypeScript
2. Set up MCP TypeScript SDK dependencies
3. Implement credential manager with OS keychain integration
4. Create SQLite database schema for conversations and configurations
5. Build IPC bridge between main and renderer processes
6. Implement basic UI shell (React/Vue components)

**Deliverables**:
- Working Electron app with basic UI
- Secure credential storage functional
- Database persistence operational

### Phase 2: MCP Server Implementation (Ollama Tools)
**Tasks**:
1. Implement 6 security-focused MCP tools with Zod schemas
2. Set up stdio MCP server in Electron main process
3. Integrate Ollama client library
4. Implement tool handlers with error handling and retry logic
5. Add progress reporting and logging
6. Write unit tests for each tool (80% coverage target)

**Deliverables**:
- Functional MCP server exposing Ollama capabilities
- 6 security tools operational with validation
- Comprehensive test suite

### Phase 3: MCP Client Implementation (ServiceNow Integration)
**Tasks**:
1. Implement HTTP MCP client for ServiceNow connection
2. Add OAuth 2.1 authentication flow with PKCE
3. Build ServiceNow API wrapper for incident/threat queries
4. Implement circuit breaker and retry patterns
5. Add connection health monitoring
6. Write integration tests with mocked ServiceNow responses

**Deliverables**:
- Functional MCP client calling ServiceNow tools
- Robust error handling and recovery
- Integration test suite

### Phase 4: Bidirectional Communication & Orchestration
**Tasks**:
1. Implement conversation context manager
2. Build AI-to-AI communication orchestrator
3. Add web search augmentation (DuckDuckGo integration)
4. Implement security incident analysis workflow
5. Create attribution system for multi-AI responses
6. Add conversation persistence logic

**Deliverables**:
- Working bidirectional AI communication
- Security workflows functional
- Conversation history management

### Phase 5: UI/UX & Configuration
**Tasks**:
1. Build configuration panel for credentials and settings
2. Implement chat interface with real-time updates
3. Add status indicators and progress feedback
4. Create conversation browsing and search UI
5. Implement accessibility features (WCAG 2.1 AA)
6. Write E2E tests with Playwright

**Deliverables**:
- Polished user interface
- Complete configuration management
- E2E test suite

### Phase 6: Testing, Optimization & Documentation
**Tasks**:
1. Performance profiling and optimization (<500MB memory, <70% CPU)
2. Security audit (OWASP Top 10 compliance)
3. Cross-platform testing (Windows, Mac, Linux)
4. User acceptance testing with P1-P4 scenarios
5. Write user documentation and quickstart guide
6. Prepare deployment packages

**Deliverables**:
- Production-ready application
- Complete documentation
- Deployment artifacts for all platforms

---

## 10. Key Takeaways and Recommendations

### SDK Choice: **TypeScript MCP SDK**
- Best desktop framework integration (Electron, Tauri)
- Largest community and example implementations
- Strong type safety with Zod validation
- Official Anthropic support and maintenance

### Desktop Framework: **Electron**
- Native TypeScript MCP SDK support
- Faster development with familiar web stack
- Larger community and resources
- Acceptable binary size for desktop application

### Transport Strategy: **Hybrid**
- **Ollama → ServiceNow**: HTTP/Streamable transport (ServiceNow is remote)
- **ServiceNow → Ollama**: stdio initially, HTTP if remote access needed

### Security Tools: **Define 6+ Tools with Zod Schemas**
1. Threat indicator analysis
2. Vulnerability assessment
3. Security incident correlation
4. Remediation plan generation
5. Attack surface analysis
6. Security compliance audit

### Authentication: **OAuth 2.1 with PKCE**
- Use PKCE for public desktop client security
- Store tokens in OS keychain (never hardcode)
- Implement token refresh mechanism
- Fallback to API keys for simple local setups

### Error Handling: **Resilient Patterns**
- Exponential backoff with jitter for retries
- Circuit breaker to prevent cascading failures
- Structured error responses with actionable messages
- Comprehensive logging for debugging

### Tool Schema Best Practices**:
- Use descriptive names (snake_case or camelCase)
- Leverage Zod for runtime + compile-time validation
- Provide detailed descriptions for LLM guidance
- Include defaults, enums, and examples
- Return structured output with source attribution

---

## 11. Additional Resources

### Official Documentation
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [TypeScript SDK Documentation](https://modelcontextprotocol.github.io/typescript-sdk/)
- [Python SDK Documentation](https://modelcontextprotocol.github.io/python-sdk/)
- [MCP Best Practices Guide](https://modelcontextprotocol.info/docs/best-practices/)

### Example Implementations
- [MCP Security Hub](https://github.com/FuzzingLabs/mcp-security-hub) - 35 security-focused MCP servers
- [MCP for Security](https://github.com/cyproxio/mcp-for-security) - Popular security tools integration
- [Google MCP Security](https://github.com/google/mcp-security) - Threat intelligence tools
- [TypeScript SDK Examples](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples)

### Community Resources
- [Anthropic MCP Course](https://anthropic.skilljar.com/introduction-to-model-context-protocol)
- [MCP Client Development Guide](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-client-development-guide.md)
- [MCP Server Development Guide](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-server-development-guide.md)
- [Awesome MCP Security](https://github.com/Puliczek/awesome-mcp-security)

### Desktop Integration
- [Tauri MCP Plugin](https://github.com/P3GLEG/tauri-plugin-mcp) - Tauri debugging tools
- [Tauri MCP Server](https://github.com/dirvine/tauri-mcp) - Tauri application interaction
- [Electron Documentation](https://www.electronjs.org/docs)
- [Tauri Documentation](https://v2.tauri.app/)

### Authentication & Security
- [MCP Authorization Guide](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [MCP Auth Developer Guide (WorkOS)](https://workos.com/blog/mcp-auth-developer-guide)
- [OAuth 2.1 Specification](https://oauth.net/2.1/)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)

### Error Handling & Resilience
- [MCP Timeout and Retry Strategies](https://octopus.com/blog/mcp-timeout-retry)
- [Error Handling in MCP Servers](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)
- [Circuit Breaker Pattern](https://microservices.io/patterns/reliability/circuit-breaker.html)

---

## Sources

- [Anthropic - Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [Model Context Protocol Official Documentation](https://modelcontextprotocol.io/)
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [GitHub - modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- [GitHub - modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk)
- [GitHub - modelcontextprotocol/rust-sdk](https://github.com/modelcontextprotocol/rust-sdk)
- [Build an MCP Client - Official Guide](https://modelcontextprotocol.io/docs/develop/build-client)
- [Build an MCP Server - Official Guide](https://modelcontextprotocol.io/docs/develop/build-server)
- [@modelcontextprotocol/sdk - npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [MCP Python SDK - PyPI](https://pypi.org/project/mcp/1.7.1/)
- [GitHub - FuzzingLabs/mcp-security-hub](https://github.com/FuzzingLabs/mcp-security-hub)
- [GitHub - cyproxio/mcp-for-security](https://github.com/cyproxio/mcp-for-security)
- [GitHub - google/mcp-security](https://github.com/google/mcp-security)
- [MCP Server Transports: STDIO vs SSE vs StreamableHTTP](https://mcpcat.io/guides/comparing-stdio-sse-streamablehttp/)
- [Why MCP Deprecated SSE and Went with Streamable HTTP](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
- [MCP Tool Schema Guide](https://www.merge.dev/blog/mcp-tool-schema)
- [Add Custom Tools to TypeScript MCP Servers](https://mcpcat.io/guides/adding-custom-tools-mcp-server-typescript/)
- [Zod Documentation](https://zod.dev/)
- [Mastering Zod Validation in MCP Servers](https://sko.kr/en/blog/zod-for-mcp)
- [MCP Timeout and Retry Strategies](https://octopus.com/blog/mcp-timeout-retry)
- [Error Handling in MCP Servers](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)
- [Understanding MCP Authorization](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [MCP Auth Developer Guide - WorkOS](https://workos.com/blog/mcp-auth-developer-guide)
- [MCP Authentication & Authorization Implementation Guide](https://stytch.com/blog/MCP-authentication-and-authorization-guide/)
- [Understanding MCP Architecture](https://nebius.com/blog/posts/understanding-model-context-protocol-mcp-architecture)
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture)
- [GitHub - P3GLEG/tauri-plugin-mcp](https://github.com/P3GLEG/tauri-plugin-mcp)
- [GitHub - dirvine/tauri-mcp](https://github.com/dirvine/tauri-mcp)
- [Electron vs Tauri - DoltHub Blog](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)
