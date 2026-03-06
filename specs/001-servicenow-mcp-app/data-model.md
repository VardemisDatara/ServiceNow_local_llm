# Data Model: ServiceNow MCP Bridge Application

**Feature**: 001-servicenow-mcp-app
**Date**: 2026-02-12
**Storage**: SQLite with Drizzle ORM
**Source**: Derived from Key Entities in [spec.md](./spec.md)

This document defines the database schema, entity relationships, validation rules, and state transitions for the ServiceNow MCP Bridge Application.

---

## Entity Relationship Diagram

```
┌──────────────────────┐
│ ConfigurationProfile │
│──────────────────────│
│ id: UUID (PK)        │
│ name: string         │
│ created_at: timestamp│
│ updated_at: timestamp│
└──────────┬───────────┘
           │ 1
           │
           │ N
┌──────────▼───────────┐
│  AISession           │
│──────────────────────│
│ id: UUID (PK)        │
│ config_id: UUID (FK) │
│ created_at: timestamp│
│ last_active: timestamp│
│ is_saved: boolean    │
└──────────┬───────────┘
           │ 1
           │
           │ N
┌──────────▼──────────────┐
│  ConversationMessage    │
│─────────────────────────│
│ id: UUID (PK)           │
│ session_id: UUID (FK)   │
│ sender: enum            │
│ content: text           │
│ timestamp: timestamp    │
│ metadata: JSON          │
└──────────┬──────────────┘
           │
           │ N
           ▼
┌─────────────────────┐
│  WebSearchResult    │
│─────────────────────│
│ id: UUID (PK)       │
│ message_id: UUID(FK)│
│ query: text         │
│ source_url: text    │
│ summary: text       │
│ relevance: float    │
└─────────────────────┘

┌─────────────────────┐       ┌──────────────────────┐
│  MCPTool            │       │  SecurityIncident    │
│─────────────────────│       │──────────────────────│
│ id: UUID (PK)       │       │ id: UUID (PK)        │
│ name: string        │       │ incident_id: string  │
│ description: text   │       │ severity: enum       │
│ schema: JSON        │       │ description: text    │
│ implementation: enum│       │ created_at: timestamp│
│ is_active: boolean  │       │ updated_at: timestamp│
└─────────────────────┘       └──────────┬───────────┘
                                         │ 1
                                         │
                                         │ N
                              ┌──────────▼───────────┐
                              │  AnalysisResult      │
                              │──────────────────────│
                              │ id: UUID (PK)        │
                              │ incident_id: UUID(FK)│
                              │ ai_source: enum      │
                              │ threat_assessment:   │
                              │   JSON               │
                              │ vuln_correlation:    │
                              │   JSON               │
                              │ recommendations:     │
                              │   JSON               │
                              │ created_at: timestamp│
                              └──────────────────────┘
```

---

## Entity Definitions

### 1. ConfigurationProfile

Stores connection settings and user preferences for ServiceNow instances, AI providers, and application settings.

**Schema:**
```typescript
{
  id: UUID (Primary Key),
  name: string (required, max 100 chars),
  servicenow_url: string (required, valid URL),
  servicenow_username: string (required),
  servicenow_credential_ref: string (required, keychain reference),
  ollama_endpoint: string (required, valid URL),
  ollama_model: string (required),
  search_provider: enum('duckduckgo', 'perplexity', 'google', 'custom') (default: 'duckduckgo'),
  search_api_key_ref: string (nullable, keychain reference),
  session_timeout_hours: integer (default: 24, min: 1, max: 168),
  persistence_default: boolean (default: false),
  created_at: timestamp (auto),
  updated_at: timestamp (auto, on update),
  is_active: boolean (default: false) // Only one profile can be active
}
```

**Validation Rules:**
- `servicenow_url` must be valid HTTPS URL
- `ollama_endpoint` must be valid URL (http/https)
- `servicenow_credential_ref` must exist in OS keychain
- Only one profile can have `is_active = true` at a time
- `name` must be unique per user

**State Transitions:**
- Created → Inactive (default state)
- Inactive → Active (user selects profile)
- Active → Inactive (user selects different profile or deactivates)
- Any state → Deleted (soft delete preserves historical data)

**Relationships:**
- Has many `AISession` records (conversations associated with this config)

---

### 2. AISession

Represents a conversation session with message history, AI provider context, and persistence settings.

**Schema:**
```typescript
{
  id: UUID (Primary Key),
  config_id: UUID (Foreign Key → ConfigurationProfile),
  title: string (nullable, user-defined or auto-generated from first message),
  ai_provider: enum('ollama', 'openai', 'perplexity', 'mistral') (default: 'ollama'),
  conversation_context: JSON (nullable, AI context window state),
  is_saved: boolean (default: false), // User chose to persist this conversation
  created_at: timestamp (auto),
  last_active: timestamp (auto, updated on message),
  expires_at: timestamp (nullable, calculated from session_timeout_hours),
  message_count: integer (default: 0, denormalized for performance),
  participant_ais: JSON (array of AI sources that contributed to this conversation)
}
```

**Validation Rules:**
- `config_id` must reference valid ConfigurationProfile
- `expires_at` = `last_active` + `session_timeout_hours` (from config)
- `message_count` ≥ 0
- `title` max 200 chars
- If `is_saved = false`, session can be auto-deleted after `expires_at`

**State Transitions:**
- Created → Active (first message sent)
- Active → Expired (no activity for `session_timeout_hours`)
- Active → Saved (user clicks "Save Conversation")
- Saved → Active (user reopens saved conversation)
- Expired → Deleted (auto-cleanup, unless `is_saved = true`)

**Lifecycle:**
- **Auto-Created**: When user starts new conversation
- **Auto-Expired**: After inactivity timeout (configurable 1-168 hours)
- **User-Saved**: Permanently persisted until explicit deletion
- **Cleanup**: Expired unsaved sessions deleted daily

**Relationships:**
- Belongs to `ConfigurationProfile` (config_id FK)
- Has many `ConversationMessage` records (messages in this session)

---

### 3. ConversationMessage

Represents a single message exchange in a conversation, including sender attribution and metadata.

**Schema:**
```typescript
{
  id: UUID (Primary Key),
  session_id: UUID (Foreign Key → AISession),
  sender: enum('user', 'ollama', 'servicenow_now_assist', 'system') (required),
  content: text (required, max 50,000 chars),
  timestamp: timestamp (auto),
  metadata: JSON (nullable), // Tool calls, search results, error details, etc.
  sequence_number: integer (auto-increment per session),
  parent_message_id: UUID (nullable, for threaded conversations),
  has_attachments: boolean (default: false),
  was_edited: boolean (default: false),
  edited_at: timestamp (nullable)
}
```

**Validation Rules:**
- `session_id` must reference valid AISession
- `content` cannot be empty string
- `sender` must be valid enum value
- `sequence_number` unique within session, auto-incrementing
- `parent_message_id` must reference message in same session (if not null)

**Metadata Structure (JSON):**
```typescript
{
  tool_calls?: Array<{
    tool_name: string,
    parameters: object,
    result: any,
    duration_ms: number
  }>,
  search_results?: Array<{
    query: string,
    provider: string,
    result_ids: UUID[] // References to WebSearchResult
  }>,
  error?: {
    code: string,
    message: string,
    stack_trace?: string
  },
  ai_model?: string, // Specific model used (e.g., "llama3.2:3b")
  response_time_ms?: number,
  token_count?: {input: number, output: number}
}
```

**Indexes:**
- Primary: `id`
- Foreign: `session_id`
- Composite: `(session_id, sequence_number)` for chronological ordering
- Full-text: FTS5 index on `content` for conversation search

**Relationships:**
- Belongs to `AISession` (session_id FK)
- Has many `WebSearchResult` records (via metadata.search_results)

---

### 4. WebSearchResult

Stores information retrieved from web searches during knowledge augmentation.

**Schema:**
```typescript
{
  id: UUID (Primary Key),
  message_id: UUID (Foreign Key → ConversationMessage),
  query: text (required, original search query),
  source_url: text (required, valid URL),
  summary: text (required, extracted/summarized content),
  relevance_score: float (0.0-1.0, ranking metric),
  provider: enum('duckduckgo', 'perplexity', 'google') (required),
  fetch_timestamp: timestamp (auto),
  cached_content: text (nullable, full page content for offline reference)
}
```

**Validation Rules:**
- `message_id` must reference valid ConversationMessage
- `source_url` must be valid URL
- `relevance_score` between 0.0 and 1.0 inclusive
- `query` max 500 chars
- `summary` max 5,000 chars

**Lifecycle:**
- Created when web search triggered during conversation
- Persisted if parent message's session is saved
- Auto-deleted when parent message is deleted (CASCADE)

**Indexes:**
- Primary: `id`
- Foreign: `message_id`
- Full-text: FTS5 index on `query`, `summary` for search result lookup

**Relationships:**
- Belongs to `ConversationMessage` (message_id FK)

---

### 5. MCPTool

Registry of MCP tool definitions (capabilities exposed via Model Context Protocol).

**Schema:**
```typescript
{
  id: UUID (Primary Key),
  name: string (required, unique, max 100 chars),
  description: text (required, human-readable purpose),
  schema: JSON (required, Zod schema definition),
  implementation: enum('ollama', 'servicenow', 'hybrid') (required),
  version: string (semantic version, default: '1.0.0'),
  is_active: boolean (default: true),
  created_at: timestamp (auto),
  updated_at: timestamp (auto, on update),
  usage_count: integer (default: 0, incremented on each invocation)
}
```

**Validation Rules:**
- `name` must be unique and follow MCP naming conventions (snake_case)
- `schema` must be valid JSON representing Zod schema
- `version` must follow semver (MAJOR.MINOR.PATCH)
- `is_active` determines if tool is exposed in MCP server

**Schema Structure (JSON):**
```typescript
{
  input: {
    type: "object",
    properties: {
      [key: string]: {
        type: "string" | "number" | "boolean" | "array" | "object",
        description: string,
        required?: boolean,
        enum?: any[],
        pattern?: string // regex for string validation
      }
    }
  },
  output: {
    type: "object",
    properties: { /* similar to input */ }
  }
}
```

**State Transitions:**
- Created → Active (tool available for invocation)
- Active → Inactive (tool temporarily disabled)
- Inactive → Active (tool re-enabled)
- Any state → Deprecated (tool replaced by newer version)

**Initial Tools (from research.md):**
1. `analyze_threat_indicator` - IOC analysis
2. `assess_vulnerability` - CVE assessment with CVSS
3. `correlate_security_incidents` - Multi-incident correlation
4. `generate_remediation_plan` - Prioritized remediation steps
5. `analyze_attack_surface` - External exposure scanning
6. `audit_security_compliance` - Framework compliance checking

**Relationships:**
- No direct FK relationships (registry/catalog entity)

---

### 6. SecurityIncident

Represents security events from ServiceNow with AI analysis results.

**Schema:**
```typescript
{
  id: UUID (Primary Key),
  incident_id: string (required, ServiceNow incident number, unique),
  severity: enum('critical', 'high', 'medium', 'low', 'informational') (required),
  description: text (required),
  affected_systems: JSON (array of system identifiers),
  detected_at: timestamp (required, when incident was first detected),
  created_at: timestamp (auto, when record created in our DB),
  updated_at: timestamp (auto, on update),
  status: enum('new', 'analyzing', 'analyzed', 'remediated', 'closed') (default: 'new'),
  servicenow_url: text (nullable, direct link to incident in ServiceNow)
}
```

**Validation Rules:**
- `incident_id` must be unique
- `severity` must be valid enum value
- `affected_systems` must be valid JSON array
- `detected_at` ≤ `created_at`

**State Transitions:**
- Created → New (incident imported from ServiceNow)
- New → Analyzing (AI analysis initiated)
- Analyzing → Analyzed (AI analysis complete)
- Analyzed → Remediated (fixes applied)
- Remediated → Closed (incident resolved)
- Any state → Escalated (severity increased)

**Relationships:**
- Has many `AnalysisResult` records (AI-generated analysis from Ollama and Now Assist)

---

### 7. AnalysisResult

AI-generated analysis output for security incidents, tracking which AI contributed what insights.

**Schema:**
```typescript
{
  id: UUID (Primary Key),
  incident_id: UUID (Foreign Key → SecurityIncident),
  ai_source: enum('ollama', 'servicenow_now_assist') (required),
  analysis_type: enum('threat_assessment', 'vulnerability_correlation', 'remediation_plan', 'risk_assessment') (required),
  threat_assessment: JSON (nullable, threat intelligence findings),
  vulnerability_correlation: JSON (nullable, related CVEs and exploits),
  recommendations: JSON (required, array of actionable steps),
  confidence_score: float (0.0-1.0, AI confidence in analysis),
  created_at: timestamp (auto),
  processing_time_ms: integer (nullable, time taken to generate analysis)
}
```

**Validation Rules:**
- `incident_id` must reference valid SecurityIncident
- `confidence_score` between 0.0 and 1.0 inclusive
- At least one of `threat_assessment`, `vulnerability_correlation`, or `recommendations` must be non-null
- `ai_source` determines attribution for audit trail

**Threat Assessment Structure (JSON):**
```typescript
{
  threat_level: "critical" | "high" | "medium" | "low",
  iocs: Array<{
    indicator: string,
    type: "ip" | "domain" | "url" | "hash",
    reputation_score: number,
    threat_feeds: string[]
  }>,
  attack_patterns: Array<{
    pattern_name: string,
    mitre_attack_ids: string[],
    likelihood: number
  }>
}
```

**Vulnerability Correlation Structure (JSON):**
```typescript
{
  cves: Array<{
    cve_id: string,
    cvss_score: number,
    exploitability: "high" | "medium" | "low",
    patch_available: boolean
  }>,
  affected_systems: string[],
  blast_radius: {
    system_count: number,
    user_count: number,
    business_impact: "critical" | "high" | "medium" | "low"
  }
}
```

**Recommendations Structure (JSON):**
```typescript
{
  immediate_actions: Array<{
    step: string,
    priority: number,
    estimated_effort_hours: number
  }>,
  short_term: Array<{step: string, timeline: string}>,
  long_term: Array<{step: string, timeline: string}>
}
```

**Lifecycle:**
- Created when AI analysis completes for an incident
- Immutable after creation (historical record)
- Multiple analysis results per incident show AI collaboration (Ollama + Now Assist)

**Indexes:**
- Primary: `id`
- Foreign: `incident_id`
- Composite: `(incident_id, ai_source)` for retrieving AI-specific analysis

**Relationships:**
- Belongs to `SecurityIncident` (incident_id FK)

---

## Database Constraints & Indexes

### Primary Keys
- All entities use UUID primary keys for global uniqueness

### Foreign Keys with Cascade Rules
```sql
AISession.config_id → ConfigurationProfile.id (ON DELETE CASCADE)
ConversationMessage.session_id → AISession.id (ON DELETE CASCADE)
WebSearchResult.message_id → ConversationMessage.id (ON DELETE CASCADE)
AnalysisResult.incident_id → SecurityIncident.id (ON DELETE CASCADE)
```

### Unique Constraints
- `ConfigurationProfile.name` (per user)
- `SecurityIncident.incident_id` (ServiceNow incident numbers)
- `MCPTool.name` (tool registry names)

### Indexes for Performance
```sql
CREATE INDEX idx_aisession_config_active ON AISession(config_id, last_active DESC);
CREATE INDEX idx_aisession_expires ON AISession(expires_at) WHERE is_saved = false;
CREATE INDEX idx_message_session_seq ON ConversationMessage(session_id, sequence_number);
CREATE INDEX idx_analysis_incident_source ON AnalysisResult(incident_id, ai_source);
CREATE INDEX idx_incident_status_severity ON SecurityIncident(status, severity);
```

### Full-Text Search Indexes (FTS5)
```sql
CREATE VIRTUAL TABLE fts_messages USING fts5(
  content,
  session_id UNINDEXED,
  sender UNINDEXED,
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE fts_search_results USING fts5(
  query,
  summary,
  source_url UNINDEXED,
  tokenize='porter unicode61'
);
```

---

## Data Retention & Cleanup Policies

### Automatic Cleanup
- **Expired Sessions** (is_saved = false, expires_at < NOW): Deleted daily
- **Orphaned WebSearchResults**: Cascade deleted with parent messages
- **Analysis Results**: Retained indefinitely (historical security data)

### User-Controlled Cleanup
- **Manual Deletion**: User can delete saved conversations from UI
- **Bulk Cleanup**: "Delete conversations older than X days" feature
- **Configuration Export/Import**: Backup before major cleanup operations

### Backup Strategy
- **Daily**: Rotating 7-day backups using SQLite Online Backup API
- **Weekly**: Rotating 4-week backups
- **Monthly**: Rotating 12-month backups
- **User-Triggered**: SQL export for portability

---

## Migration Strategy

### Initial Schema (v1.0.0)
Drizzle ORM migration to create all 7 entities with relationships, indexes, and FTS5 tables.

### Future Migrations
- **v1.1.0**: Add `conversation_tags` table for user organization
- **v1.2.0**: Add `mcp_tool_invocation_log` for usage analytics
- **v1.3.0**: Add `user_preferences` table for UI customization

### Migration Commands
```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Review generated SQL in drizzle/ directory

# Apply migration to database
npx drizzle-kit migrate
```

---

## Security Considerations

### Credential Storage
- **Never store plaintext credentials in database**
- Store only keychain references (`servicenow_credential_ref`, `search_api_key_ref`)
- Retrieve credentials from OS keychain at runtime via `tauri-plugin-keyring`

### SQL Injection Prevention
- Use Drizzle ORM parameterized queries exclusively
- Never concatenate user input into SQL strings

### Data Encryption at Rest
- Database file permissions: 600 (Unix) - owner read/write only
- Optional: SQLCipher for full database encryption if handling regulated data

### Audit Logging
- `AnalysisResult` records provide audit trail for AI decisions
- `ConversationMessage.metadata` tracks tool invocations
- `MCPTool.usage_count` tracks tool usage patterns

---

## Performance Optimization

### Query Optimization
- Denormalized `AISession.message_count` avoids COUNT queries
- Composite indexes on common query patterns
- FTS5 for full-text search (not LIKE '%pattern%')

### Connection Pooling
- Single WAL-mode connection with unlimited readers
- Prepared statement cache for frequently executed queries

### Vacuum Schedule
```sql
-- Run weekly to reclaim space
VACUUM;

-- Analyze for query optimizer
ANALYZE;
```

---

## Entity Statistics (Estimated Scale)

| Entity | Expected Records | Growth Rate | Retention |
|--------|-----------------|-------------|-----------|
| ConfigurationProfile | 1-5 | Static | Permanent |
| AISession | 10-1000 | 5-10/week | User-controlled |
| ConversationMessage | 100-50,000 | 20-100/day | Tied to session |
| WebSearchResult | 50-5,000 | 5-20/day | Tied to message |
| MCPTool | 6-20 | Slow | Permanent |
| SecurityIncident | 0-10,000 | Variable | 90 days typical |
| AnalysisResult | 0-20,000 | 2x incident count | 90 days typical |

**Total Database Size Estimate**: 10 MB (empty) to 500 MB (heavy usage over 1 year)

---

This data model satisfies all functional requirements (FR-006, FR-007, FR-025-FR-029) and provides the foundation for the implementation tasks defined in the next phase.
