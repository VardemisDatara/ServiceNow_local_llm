import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * ConfigurationProfile - Stores user's ServiceNow instance and Ollama configuration
 * Primary entity for User Story 1 (Configure AI Bridge Connections)
 */
export const configurationProfiles = sqliteTable('configuration_profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),

  // ServiceNow Configuration
  servicenowUrl: text('servicenow_url').notNull(),
  servicenowCredentialRef: text('servicenow_credential_ref').notNull(), // Reference to OS keychain

  // Ollama Configuration
  ollamaEndpoint: text('ollama_endpoint').notNull().default('http://localhost:11434'),
  ollamaModel: text('ollama_model').notNull().default('llama3.2'),

  // Search Configuration
  searchProvider: text('search_provider', {
    enum: ['duckduckgo', 'perplexity', 'google']
  }).notNull().default('duckduckgo'),
  searchApiKeyRef: text('search_api_key_ref'), // Optional reference to OS keychain

  // LLM Provider Configuration (T114)
  llmProvider: text('llm_provider', {
    enum: ['ollama', 'openai', 'mistral']
  }).notNull().default('ollama'),
  llmApiKeyRef: text('llm_api_key_ref'), // Optional keychain ref for cloud LLM API key
  cloudLlmModel: text('cloud_llm_model'), // e.g. 'gpt-4o-mini', 'mistral-small-latest'

  // Now Assist MCP Configuration (T005 — 002-security-nowassist-docs)
  nowAssistEndpoint: text('now_assist_endpoint'),         // Derived full URL (servicenowUrl + serverId)
  nowAssistApiKeyRef: text('now_assist_api_key_ref'),     // Keychain ref for API key / Bearer token
  nowAssistAuthMode: text('now_assist_auth_mode'),        // 'apikey' | 'bearer', default 'apikey'
  nowAssistServerId: text('now_assist_server_id'),        // MCP Server sys_id (user-facing input)
  nowAssistOAuthClientId: text('now_assist_oauth_client_id'), // OAuth Application Registry client_id
  nowAssistOAuthSecretRef: text('now_assist_oauth_secret_ref'), // Keychain ref for OAuth client_secret

  // Session Configuration
  sessionTimeoutHours: integer('session_timeout_hours').notNull().default(24),
  persistConversations: integer('persist_conversations', { mode: 'boolean' })
    .notNull()
    .default(true),

  // Metadata
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),

  // Active profile flag (only one can be active at a time)
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
});

/**
 * AISession - Represents a conversation session with optional persistence
 * Primary entity for User Story 2 (Chat with Ollama AI)
 */
export const aiSessions = sqliteTable('ai_sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  configId: text('config_id')
    .notNull()
    .references(() => configurationProfiles.id, { onDelete: 'cascade' }),

  title: text('title').notNull().default('New Conversation'),
  aiProvider: text('ai_provider', {
    enum: ['ollama', 'servicenow_now_assist', 'openai', 'mistral', 'perplexity']
  }).notNull().default('ollama'),

  isSaved: integer('is_saved', { mode: 'boolean' }).notNull().default(false),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // Null if saved

  messageCount: integer('message_count').notNull().default(0),
});

/**
 * ConversationMessage - Individual messages in a conversation
 * Supports User Story 2 (Chat) and User Story 3 (Bidirectional AI Communication)
 */
export const conversationMessages = sqliteTable('conversation_messages', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id')
    .notNull()
    .references(() => aiSessions.id, { onDelete: 'cascade' }),

  sender: text('sender', {
    enum: ['user', 'ollama', 'servicenow_now_assist', 'system', 'web_search', 'openai', 'mistral']
  }).notNull(),
  content: text('content').notNull(),

  timestamp: integer('timestamp', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  sequenceNumber: integer('sequence_number').notNull(),

  // Metadata for MCP tool calls, search results, etc.
  metadata: text('metadata', { mode: 'json' }),
});

/**
 * MCPTool - Registry of available MCP tools
 * Primary entity for User Story 3 (Bidirectional AI Communication)
 */
export const mcpTools = sqliteTable('mcp_tools', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  category: text('category', {
    enum: ['security', 'search', 'data', 'workflow', 'analysis']
  }).notNull(),

  // JSON schema for input/output validation (Zod schemas serialized)
  inputSchema: text('input_schema', { mode: 'json' }).notNull(),
  outputSchema: text('output_schema', { mode: 'json' }).notNull(),

  // Availability
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  provider: text('provider', {
    enum: ['ollama', 'servicenow', 'builtin']
  }).notNull(),

  // Performance tracking
  callCount: integer('call_count').notNull().default(0),
  averageLatencyMs: integer('average_latency_ms'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * SecurityIncident - Security incidents for analysis workflows
 * Primary entity for User Story 4 (Security Incident Analysis Workflow)
 */
export const securityIncidents = sqliteTable('security_incidents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id')
    .notNull()
    .references(() => aiSessions.id, { onDelete: 'cascade' }),

  incidentId: text('incident_id').notNull(), // ServiceNow incident ID
  title: text('title').notNull(),
  description: text('description').notNull(),

  severity: text('severity', {
    enum: ['critical', 'high', 'medium', 'low', 'info']
  }).notNull(),
  status: text('status', {
    enum: ['new', 'analyzing', 'analyzed', 'resolved', 'closed']
  }).notNull().default('new'),

  // Analysis results from MCP tools
  threatLevel: text('threat_level', {
    enum: ['critical', 'high', 'medium', 'low', 'minimal']
  }),
  cveIds: text('cve_ids', { mode: 'json' }), // Array of CVE IDs
  correlatedIncidents: text('correlated_incidents', { mode: 'json' }), // Array of incident IDs

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  analyzedAt: integer('analyzed_at', { mode: 'timestamp' }),
});

/**
 * AnalysisResult - Results from MCP tool executions
 * Supports User Story 4 (Security Incident Analysis)
 */
export const analysisResults = sqliteTable('analysis_results', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  incidentId: text('incident_id')
    .notNull()
    .references(() => securityIncidents.id, { onDelete: 'cascade' }),

  toolName: text('tool_name').notNull(),
  toolCategory: text('tool_category').notNull(),

  result: text('result', { mode: 'json' }).notNull(),
  confidence: integer('confidence').notNull(), // 0-100

  executionTimeMs: integer('execution_time_ms').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorMessage: text('error_message'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * WebSearchResult - Cache for web search results
 * Primary entity for User Story 5 (Web Search Knowledge Augmentation)
 */
export const webSearchResults = sqliteTable('web_search_results', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id')
    .notNull()
    .references(() => aiSessions.id, { onDelete: 'cascade' }),

  query: text('query').notNull(),
  provider: text('provider', {
    enum: ['duckduckgo', 'perplexity', 'google']
  }).notNull(),

  results: text('results', { mode: 'json' }).notNull(),
  resultCount: integer('result_count').notNull(),

  latencyMs: integer('latency_ms').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24 hours cache
});

// Indexes for performance
export const indexes = {
  // Configuration profiles - quick active lookup
  configurationProfilesActiveIdx: sql`CREATE INDEX IF NOT EXISTS configuration_profiles_active_idx ON configuration_profiles(is_active) WHERE is_active = 1`,

  // AI Sessions - lookup by config and recent activity
  aiSessionsConfigIdx: sql`CREATE INDEX IF NOT EXISTS ai_sessions_config_idx ON ai_sessions(config_id)`,
  aiSessionsLastActiveIdx: sql`CREATE INDEX IF NOT EXISTS ai_sessions_last_active_idx ON ai_sessions(last_active_at DESC)`,

  // Conversation Messages - ordered retrieval by session
  conversationMessagesSessionIdx: sql`CREATE INDEX IF NOT EXISTS conversation_messages_session_idx ON conversation_messages(session_id, sequence_number)`,

  // MCP Tools - quick name lookup and category filtering
  mcpToolsNameIdx: sql`CREATE INDEX IF NOT EXISTS mcp_tools_name_idx ON mcp_tools(name)`,
  mcpToolsCategoryIdx: sql`CREATE INDEX IF NOT EXISTS mcp_tools_category_idx ON mcp_tools(category, is_enabled)`,

  // Security Incidents - status and severity filtering
  securityIncidentsStatusIdx: sql`CREATE INDEX IF NOT EXISTS security_incidents_status_idx ON security_incidents(status)`,
  securityIncidentsSeverityIdx: sql`CREATE INDEX IF NOT EXISTS security_incidents_severity_idx ON security_incidents(severity)`,
  securityIncidentsSessionIdx: sql`CREATE INDEX IF NOT EXISTS security_incidents_session_idx ON security_incidents(session_id)`,

  // Analysis Results - incident lookup
  analysisResultsIncidentIdx: sql`CREATE INDEX IF NOT EXISTS analysis_results_incident_idx ON analysis_results(incident_id)`,

  // Web Search Results - query cache lookup
  webSearchResultsQueryIdx: sql`CREATE INDEX IF NOT EXISTS web_search_results_query_idx ON web_search_results(query, provider)`,
  webSearchResultsExpiresIdx: sql`CREATE INDEX IF NOT EXISTS web_search_results_expires_idx ON web_search_results(expires_at)`,
};

// Full-Text Search (FTS5) for conversation messages
export const conversationMessagesFts = sql`
  CREATE VIRTUAL TABLE IF NOT EXISTS conversation_messages_fts USING fts5(
    content,
    content=conversation_messages,
    content_rowid=rowid
  )
`;

// Export types for TypeScript usage
export type ConfigurationProfile = typeof configurationProfiles.$inferSelect;
export type NewConfigurationProfile = typeof configurationProfiles.$inferInsert;
export type AISession = typeof aiSessions.$inferSelect;
export type NewAISession = typeof aiSessions.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
export type MCPTool = typeof mcpTools.$inferSelect;
export type NewMCPTool = typeof mcpTools.$inferInsert;
export type SecurityIncident = typeof securityIncidents.$inferSelect;
export type NewSecurityIncident = typeof securityIncidents.$inferInsert;
export type AnalysisResult = typeof analysisResults.$inferSelect;
export type NewAnalysisResult = typeof analysisResults.$inferInsert;
export type WebSearchResult = typeof webSearchResults.$inferSelect;
export type NewWebSearchResult = typeof webSearchResults.$inferInsert;
