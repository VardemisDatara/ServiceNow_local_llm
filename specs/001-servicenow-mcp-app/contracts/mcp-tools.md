# MCP Tool Contracts

**Feature**: 001-servicenow-mcp-app
**Date**: 2026-02-12
**Protocol**: Model Context Protocol (MCP)
**Spec Version**: MCP 1.0

This document defines the contract specifications for all MCP tools exposed by the ServiceNow MCP Bridge Application.

---

## Overview

The application implements **6 security-focused MCP tools** that enable bidirectional communication between Ollama (local AI) and ServiceNow Now Assist:

1. `analyze_threat_indicator` - IOC analysis against threat intelligence
2. `assess_vulnerability` - CVE assessment with CVSS scoring
3. `correlate_security_incidents` - Multi-incident pattern correlation
4. `generate_remediation_plan` - Prioritized remediation steps
5. `analyze_attack_surface` - External exposure scanning
6. `audit_security_compliance` - Framework compliance checking

**Implementation**: All tools use TypeScript Zod schemas for validation and expose via MCP server running in Tauri Rust backend.

---

## Tool 1: analyze_threat_indicator

**Purpose**: Analyze threat indicators (IOCs) against threat intelligence feeds to determine reputation and associated campaigns.

**Input Schema**:
```typescript
{
  indicator: string;        // Required: IP, domain, URL, or hash
  indicator_type: "ip" | "domain" | "url" | "hash" | "email";  // Required
  context?: {               // Optional: Additional context
    source?: string;        // Where indicator was observed
    timestamp?: string;     // ISO 8601 timestamp
    related_incidents?: string[];  // Related ServiceNow incident IDs
  };
}
```

**Output Schema**:
```typescript
{
  threat_level: "critical" | "high" | "medium" | "low" | "benign";
  reputation_score: number; // 0-100, higher = more malicious
  associated_campaigns: Array<{
    name: string;
    mitre_attack_ids: string[];  // e.g., ["T1566", "T1204"]
    first_seen: string;           // ISO 8601 timestamp
    confidence: number;           // 0-1
  }>;
  threat_feeds: Array<{
    source: string;               // e.g., "AbuseIPDB", "VirusTotal"
    last_updated: string;         // ISO 8601 timestamp
    verdict: "malicious" | "suspicious" | "clean";
  }>;
  recommendations: Array<{
    action: string;               // e.g., "Block at firewall"
    priority: "immediate" | "high" | "medium" | "low";
    rationale: string;
  }>;
  analysis_timestamp: string;     // ISO 8601
  processing_time_ms: number;
}
```

**Error Responses**:
```typescript
{
  error: {
    code: "INVALID_INDICATOR" | "RATE_LIMIT_EXCEEDED" | "FEED_UNAVAILABLE";
    message: string;
    details?: any;
  }
}
```

**Example**:
```json
// Input
{
  "indicator": "198.51.100.42",
  "indicator_type": "ip",
  "context": {
    "source": "firewall_logs",
    "timestamp": "2026-02-12T10:30:00Z"
  }
}

// Output
{
  "threat_level": "high",
  "reputation_score": 85,
  "associated_campaigns": [
    {
      "name": "Lazarus APT Campaign 2026",
      "mitre_attack_ids": ["T1566.001", "T1204.002"],
      "first_seen": "2026-01-15T00:00:00Z",
      "confidence": 0.92
    }
  ],
  "threat_feeds": [
    {
      "source": "AbuseIPDB",
      "last_updated": "2026-02-12T09:00:00Z",
      "verdict": "malicious"
    }
  ],
  "recommendations": [
    {
      "action": "Block IP at perimeter firewall",
      "priority": "immediate",
      "rationale": "High-confidence match to active APT campaign"
    }
  ],
  "analysis_timestamp": "2026-02-12T10:30:15Z",
  "processing_time_ms": 1250
}
```

---

## Tool 2: assess_vulnerability

**Purpose**: Assess CVE vulnerabilities with CVSS scoring, exploitability analysis, and patch availability.

**Input Schema**:
```typescript
{
  cve_id: string;           // Required: CVE identifier (e.g., "CVE-2024-1234")
  system_context?: {        // Optional: Target system details
    os: string;             // e.g., "Ubuntu 22.04"
    software_version: string;  // e.g., "Apache 2.4.52"
    environment: "production" | "staging" | "development";
    publicly_accessible: boolean;
  };
}
```

**Output Schema**:
```typescript
{
  cve_id: string;
  cvss_score: {
    version: "3.1" | "4.0";
    base_score: number;     // 0-10
    vector_string: string;  // e.g., "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
    severity: "critical" | "high" | "medium" | "low" | "none";
  };
  exploitability: {
    likelihood: "high" | "medium" | "low";
    public_exploits_available: boolean;
    exploit_maturity: "weaponized" | "poc" | "unproven";
    exploit_sources: string[];  // URLs to exploit databases
  };
  affected_systems: {
    count: number;
    environments: string[];  // ["production", "staging"]
    business_criticality: "critical" | "high" | "medium" | "low";
  };
  patch_availability: {
    available: boolean;
    version: string | null;  // Fixed version number
    release_date: string | null;  // ISO 8601
    workarounds: string[];   // If patch unavailable
  };
  risk_assessment: {
    current_risk: "critical" | "high" | "medium" | "low";
    residual_risk_after_patch: "high" | "medium" | "low" | "minimal";
    business_impact: string;
  };
  recommendations: Array<{
    step: string;
    timeline: string;         // e.g., "Within 24 hours"
    effort_estimate_hours: number;
  }>;
  analysis_timestamp: string;
  processing_time_ms: number;
}
```

**Error Responses**:
```typescript
{
  error: {
    code: "CVE_NOT_FOUND" | "INVALID_CVE_FORMAT" | "NVD_API_ERROR";
    message: string;
    details?: any;
  }
}
```

**Example**:
```json
// Input
{
  "cve_id": "CVE-2024-1234",
  "system_context": {
    "os": "Ubuntu 22.04",
    "software_version": "OpenSSL 3.0.2",
    "environment": "production",
    "publicly_accessible": true
  }
}

// Output
{
  "cve_id": "CVE-2024-1234",
  "cvss_score": {
    "version": "3.1",
    "base_score": 9.8,
    "vector_string": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    "severity": "critical"
  },
  "exploitability": {
    "likelihood": "high",
    "public_exploits_available": true,
    "exploit_maturity": "weaponized",
    "exploit_sources": ["https://github.com/exploit-db/CVE-2024-1234"]
  },
  "affected_systems": {
    "count": 5,
    "environments": ["production", "staging"],
    "business_criticality": "critical"
  },
  "patch_availability": {
    "available": true,
    "version": "3.0.13",
    "release_date": "2026-02-10T00:00:00Z",
    "workarounds": []
  },
  "risk_assessment": {
    "current_risk": "critical",
    "residual_risk_after_patch": "low",
    "business_impact": "Potential remote code execution on public-facing servers"
  },
  "recommendations": [
    {
      "step": "Patch OpenSSL to version 3.0.13 on all production systems",
      "timeline": "Within 24 hours",
      "effort_estimate_hours": 4
    }
  ],
  "analysis_timestamp": "2026-02-12T10:30:00Z",
  "processing_time_ms": 850
}
```

---

## Tool 3: correlate_security_incidents

**Purpose**: Correlate multiple security incidents to identify attack patterns and common indicators.

**Input Schema**:
```typescript
{
  incident_ids: string[];   // Required: Array of ServiceNow incident IDs (min 2)
  time_window_hours?: number;  // Optional: Time window for correlation (default: 24)
  correlation_threshold?: number;  // Optional: Minimum similarity score 0-1 (default: 0.6)
}
```

**Output Schema**:
```typescript
{
  correlation_score: number;  // 0-1, higher = more correlated
  correlation_type: "direct" | "indirect" | "none";
  common_indicators: {
    ip_addresses: string[];
    domains: string[];
    user_accounts: string[];
    affected_systems: string[];
    attack_vectors: string[];
  };
  attack_pattern: {
    name: string;            // e.g., "Multi-Stage Ransomware Attack"
    mitre_attack_ids: string[];
    phases: Array<{
      phase_name: string;    // e.g., "Initial Access", "Lateral Movement"
      incident_ids: string[];  // Which incidents map to this phase
      timestamp_range: {
        start: string;       // ISO 8601
        end: string;
      };
    }>;
    confidence: number;      // 0-1
  };
  timeline: Array<{
    timestamp: string;       // ISO 8601
    incident_id: string;
    event: string;
    severity: "critical" | "high" | "medium" | "low";
  }>;
  recommendations: Array<{
    action: string;
    priority: "immediate" | "high" | "medium" | "low";
    affected_incident_ids: string[];
  }>;
  analysis_timestamp: string;
  processing_time_ms: number;
}
```

**Error Responses**:
```typescript
{
  error: {
    code: "INSUFFICIENT_INCIDENTS" | "INCIDENT_NOT_FOUND" | "CORRELATION_FAILED";
    message: string;
    details?: any;
  }
}
```

---

## Tool 4: generate_remediation_plan

**Purpose**: Generate prioritized remediation plan with business context and effort estimates.

**Input Schema**:
```typescript
{
  vulnerability_data: {
    cve_ids?: string[];      // CVE identifiers
    findings?: Array<{       // Custom findings
      title: string;
      severity: "critical" | "high" | "medium" | "low";
      description: string;
      affected_systems: string[];
    }>;
  };
  business_context: {
    environment: "production" | "staging" | "development";
    business_criticality: "critical" | "high" | "medium" | "low";
    maintenance_window_available: boolean;
    available_resources: number;  // Team size
  };
  constraints?: {
    max_downtime_hours?: number;
    must_maintain_uptime_percent?: number;  // e.g., 99.9
    budget_limit_usd?: number;
  };
}
```

**Output Schema**:
```typescript
{
  plan_summary: {
    total_steps: number;
    estimated_total_hours: number;
    estimated_cost_usd: number | null;
    recommended_timeline: string;  // e.g., "2 weeks"
  };
  prioritized_steps: Array<{
    step_number: number;
    title: string;
    description: string;
    priority: "critical" | "high" | "medium" | "low";
    estimated_effort_hours: number;
    requires_downtime: boolean;
    downtime_duration_hours?: number;
    prerequisites: number[];  // Step numbers that must complete first
    success_criteria: string[];
    rollback_plan: string;
  }>;
  dependencies: {
    parallel_execution_possible: boolean;
    dependency_graph: Record<number, number[]>;  // step_number -> depends_on_step_numbers
  };
  risks: Array<{
    risk: string;
    likelihood: "high" | "medium" | "low";
    impact: "high" | "medium" | "low";
    mitigation: string;
  }>;
  validation_checklist: string[];
  analysis_timestamp: string;
  processing_time_ms: number;
}
```

**Error Responses**:
```typescript
{
  error: {
    code: "INVALID_INPUT" | "INSUFFICIENT_DATA" | "PLANNING_FAILED";
    message: string;
    details?: any;
  }
}
```

---

## Tool 5: analyze_attack_surface

**Purpose**: Analyze external attack surface by scanning exposed services and identifying vulnerabilities.

**Input Schema**:
```typescript
{
  target_scope: {
    ip_ranges?: string[];    // CIDR notation (e.g., "192.0.2.0/24")
    domains?: string[];      // Domains to scan
    exclude?: string[];      // Exclusions
  };
  scan_depth: "quick" | "standard" | "thorough";  // Required
  focus_areas?: Array<"ports" | "ssl" | "dns" | "web_apps" | "cloud_assets">;
}
```

**Output Schema**:
```typescript
{
  summary: {
    total_assets: number;
    exposed_services: number;
    vulnerabilities_found: number;
    overall_risk_score: number;  // 0-100
  };
  exposed_services: Array<{
    asset: string;           // IP or domain
    port: number;
    protocol: "tcp" | "udp";
    service: string;         // e.g., "HTTP", "SSH"
    version: string | null;
    banner: string | null;
    is_publicly_accessible: boolean;
  }>;
  vulnerabilities: Array<{
    asset: string;
    service: string;
    vulnerability_type: string;
    severity: "critical" | "high" | "medium" | "low";
    cve_ids: string[];
    description: string;
  }>;
  risk_assessment: {
    critical_findings: number;
    high_findings: number;
    attack_vectors: string[];
    compliance_issues: string[];
  };
  hardening_recommendations: Array<{
    asset: string;
    recommendation: string;
    priority: "immediate" | "high" | "medium" | "low";
    effort_estimate: string;
  }>;
  analysis_timestamp: string;
  processing_time_ms: number;
}
```

**Error Responses**:
```typescript
{
  error: {
    code: "INVALID_SCOPE" | "SCAN_PERMISSION_DENIED" | "SCAN_TIMEOUT";
    message: string;
    details?: any;
  }
}
```

---

## Tool 6: audit_security_compliance

**Purpose**: Audit systems against security compliance frameworks (CIS, NIST, PCI-DSS, etc.).

**Input Schema**:
```typescript
{
  framework: "CIS" | "NIST_800-53" | "PCI-DSS" | "ISO_27001" | "SOC2";  // Required
  framework_version?: string;  // e.g., "CIS v8.0"
  system_inventory: Array<{
    system_id: string;
    type: "server" | "workstation" | "network_device" | "application";
    os: string;
    configurations: Record<string, any>;  // System-specific configs
  }>;
  scope?: string[];  // Specific control IDs to audit (optional, audits all if omitted)
}
```

**Output Schema**:
```typescript
{
  framework: string;
  framework_version: string;
  compliance_score: number;  // 0-100, percentage of controls met
  audit_summary: {
    total_controls: number;
    passed: number;
    failed: number;
    not_applicable: number;
    not_tested: number;
  };
  failed_controls: Array<{
    control_id: string;       // e.g., "CIS 1.1.1"
    control_name: string;
    severity: "critical" | "high" | "medium" | "low";
    affected_systems: string[];
    current_state: string;
    expected_state: string;
    gap_description: string;
  }>;
  remediation_priorities: Array<{
    control_id: string;
    priority_rank: number;
    remediation_steps: string[];
    estimated_effort_hours: number;
    business_justification: string;
  }>;
  evidence_gaps: Array<{
    control_id: string;
    missing_evidence: string;
    how_to_collect: string;
  }>;
  next_audit_date: string;   // ISO 8601, recommended re-audit date
  analysis_timestamp: string;
  processing_time_ms: number;
}
```

**Error Responses**:
```typescript
{
  error: {
    code: "UNSUPPORTED_FRAMEWORK" | "INVALID_INVENTORY" | "AUDIT_FAILED";
    message: string;
    details?: any;
  }
}
```

---

## Common Patterns

### Error Handling
All tools follow consistent error response format:
```typescript
{
  error: {
    code: string;        // Machine-readable error code
    message: string;     // Human-readable error message
    details?: any;       // Additional context (optional)
    retry_after_ms?: number;  // For rate limiting
  }
}
```

### Progress Reporting
For long-running operations (>3 seconds), tools emit progress events:
```typescript
{
  progress: {
    current: number;     // Current step
    total: number;       // Total steps
    status: string;      // Human-readable status
    percent: number;     // 0-100
  }
}
```

### Timestamps
- All timestamps use ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`
- Always UTC timezone

### Performance SLAs
- `processing_time_ms` included in all responses
- Target: 95% of requests <5 seconds
- Timeout: 30 seconds (return partial results if possible)

---

## Testing Strategy

### Contract Tests
Each tool requires contract tests validating:
1. Input schema validation (Zod)
2. Output schema validation (Zod)
3. Error response format
4. Required fields presence
5. Data type correctness

### Integration Tests
1. End-to-end tool invocation via MCP protocol
2. ServiceNow API integration (mock and real)
3. Ollama integration (mock and real)
4. Error handling and retry logic
5. Performance benchmarks (<5s response time)

### Test Files Location
```
tests/
├── contract/
│   ├── analyze_threat_indicator.test.ts
│   ├── assess_vulnerability.test.ts
│   ├── correlate_security_incidents.test.ts
│   ├── generate_remediation_plan.test.ts
│   ├── analyze_attack_surface.test.ts
│   └── audit_security_compliance.test.ts
└── integration/
    └── mcp_tools.integration.test.ts
```

---

## Implementation Checklist

- [ ] Define Zod schemas for all 6 tools (input + output)
- [ ] Implement MCP server exposing tools (Rust backend)
- [ ] Implement MCP client consuming ServiceNow tools (TypeScript frontend)
- [ ] Add error handling and retry logic
- [ ] Add progress reporting for long operations
- [ ] Write contract tests (100% coverage)
- [ ] Write integration tests (≥80% coverage)
- [ ] Performance testing (95% <5s target)
- [ ] Security review (input validation, rate limiting)
- [ ] Documentation (API docs, examples)

---

This contract specification satisfies FR-009, FR-010, FR-015-FR-017 and provides the foundation for MCP tool implementation in Phase 2: Feature Implementation.
