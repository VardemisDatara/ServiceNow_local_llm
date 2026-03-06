-- Migration: LLM Provider Support
-- Version: 2
-- Created: 2026-02-20
-- Description: Add LLM provider configuration to profiles and expand conversation
--              message sender enum to include cloud LLM providers.

-- ── 1. Add LLM provider fields to configuration_profiles ────────────────────
ALTER TABLE configuration_profiles ADD COLUMN llm_provider TEXT NOT NULL DEFAULT 'ollama';
ALTER TABLE configuration_profiles ADD COLUMN llm_api_key_ref TEXT;
ALTER TABLE configuration_profiles ADD COLUMN cloud_llm_model TEXT;

-- ── 2. Expand conversation_messages.sender to include cloud LLM providers ────
-- SQLite cannot modify CHECK constraints via ALTER TABLE, so we recreate the table.

-- Drop FTS infrastructure that references conversation_messages (must go first)
DROP TRIGGER IF EXISTS conversation_messages_fts_update;
DROP TRIGGER IF EXISTS conversation_messages_fts_delete;
DROP TRIGGER IF EXISTS conversation_messages_fts_insert;
DROP TABLE IF EXISTS conversation_messages_fts;

-- Create replacement table with expanded sender check
CREATE TABLE conversation_messages_new (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK(sender IN ('user', 'ollama', 'servicenow_now_assist', 'system', 'web_search', 'openai', 'mistral')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,
  metadata TEXT
);

INSERT INTO conversation_messages_new SELECT * FROM conversation_messages;
DROP TABLE conversation_messages;
ALTER TABLE conversation_messages_new RENAME TO conversation_messages;

-- Restore index
CREATE INDEX IF NOT EXISTS conversation_messages_session_idx
  ON conversation_messages(session_id, sequence_number);

-- Recreate FTS virtual table
CREATE VIRTUAL TABLE conversation_messages_fts USING fts5(
  content,
  content=conversation_messages,
  content_rowid=rowid
);

-- Rebuild FTS index from existing rows
INSERT INTO conversation_messages_fts(conversation_messages_fts) VALUES('rebuild');

-- Recreate sync triggers
CREATE TRIGGER conversation_messages_fts_insert AFTER INSERT ON conversation_messages BEGIN
  INSERT INTO conversation_messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER conversation_messages_fts_delete AFTER DELETE ON conversation_messages BEGIN
  DELETE FROM conversation_messages_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER conversation_messages_fts_update AFTER UPDATE ON conversation_messages BEGIN
  UPDATE conversation_messages_fts SET content = new.content WHERE rowid = new.rowid;
END;
