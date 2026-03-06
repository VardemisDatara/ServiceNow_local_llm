-- Migration: Initial Schema
-- Created: 2026-02-13
-- Description: Create all tables for ServiceNow MCP Bridge application

-- Configuration Profiles table
CREATE TABLE IF NOT EXISTS configuration_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  servicenow_url TEXT NOT NULL,
  servicenow_credential_ref TEXT NOT NULL,
  ollama_endpoint TEXT NOT NULL DEFAULT 'http://localhost:11434',
  ollama_model TEXT NOT NULL DEFAULT 'llama3.2',
  search_provider TEXT NOT NULL DEFAULT 'duckduckgo' CHECK(search_provider IN ('duckduckgo', 'perplexity', 'google')),
  search_api_key_ref TEXT,
  session_timeout_hours INTEGER NOT NULL DEFAULT 24,
  persist_conversations INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0
);

-- AI Sessions table
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  config_id TEXT NOT NULL REFERENCES configuration_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  ai_provider TEXT NOT NULL DEFAULT 'ollama' CHECK(ai_provider IN ('ollama', 'servicenow_now_assist', 'openai', 'mistral', 'perplexity')),
  is_saved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER,
  message_count INTEGER NOT NULL DEFAULT 0
);

-- Conversation Messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK(sender IN ('user', 'ollama', 'servicenow_now_assist', 'system', 'web_search')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,
  metadata TEXT
);

-- MCP Tools registry table
CREATE TABLE IF NOT EXISTS mcp_tools (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('security', 'search', 'data', 'workflow', 'analysis')),
  input_schema TEXT NOT NULL,
  output_schema TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL CHECK(provider IN ('ollama', 'servicenow', 'builtin')),
  call_count INTEGER NOT NULL DEFAULT 0,
  average_latency_ms INTEGER,
  created_at INTEGER NOT NULL
);

-- Security Incidents table
CREATE TABLE IF NOT EXISTS security_incidents (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  incident_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'analyzing', 'analyzed', 'resolved', 'closed')),
  threat_level TEXT CHECK(threat_level IN ('critical', 'high', 'medium', 'low', 'minimal')),
  cve_ids TEXT,
  correlated_incidents TEXT,
  created_at INTEGER NOT NULL,
  analyzed_at INTEGER
);

-- Analysis Results table
CREATE TABLE IF NOT EXISTS analysis_results (
  id TEXT PRIMARY KEY NOT NULL,
  incident_id TEXT NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_category TEXT NOT NULL,
  result TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  success INTEGER NOT NULL,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

-- Web Search Results cache table
CREATE TABLE IF NOT EXISTS web_search_results (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('duckduckgo', 'perplexity', 'google')),
  results TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  success INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS configuration_profiles_active_idx ON configuration_profiles(is_active) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS ai_sessions_config_idx ON ai_sessions(config_id);
CREATE INDEX IF NOT EXISTS ai_sessions_last_active_idx ON ai_sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS conversation_messages_session_idx ON conversation_messages(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS mcp_tools_name_idx ON mcp_tools(name);
CREATE INDEX IF NOT EXISTS mcp_tools_category_idx ON mcp_tools(category, is_enabled);
CREATE INDEX IF NOT EXISTS security_incidents_status_idx ON security_incidents(status);
CREATE INDEX IF NOT EXISTS security_incidents_severity_idx ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS security_incidents_session_idx ON security_incidents(session_id);
CREATE INDEX IF NOT EXISTS analysis_results_incident_idx ON analysis_results(incident_id);
CREATE INDEX IF NOT EXISTS web_search_results_query_idx ON web_search_results(query, provider);
CREATE INDEX IF NOT EXISTS web_search_results_expires_idx ON web_search_results(expires_at);

-- Full-Text Search (FTS5) for conversation messages
CREATE VIRTUAL TABLE IF NOT EXISTS conversation_messages_fts USING fts5(
  content,
  content=conversation_messages,
  content_rowid=rowid
);

-- Triggers to keep FTS5 table in sync with conversation_messages
CREATE TRIGGER IF NOT EXISTS conversation_messages_fts_insert AFTER INSERT ON conversation_messages BEGIN
  INSERT INTO conversation_messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS conversation_messages_fts_delete AFTER DELETE ON conversation_messages BEGIN
  DELETE FROM conversation_messages_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS conversation_messages_fts_update AFTER UPDATE ON conversation_messages BEGIN
  UPDATE conversation_messages_fts SET content = new.content WHERE rowid = new.rowid;
END;
