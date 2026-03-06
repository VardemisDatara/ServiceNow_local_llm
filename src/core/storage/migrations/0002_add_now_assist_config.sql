-- Migration: Now Assist MCP Configuration
-- Version: 3
-- Created: 2026-03-02
-- Description: Add Now Assist MCP server configuration columns to configuration_profiles.
--              Safe ALTER TABLE ADD COLUMN — no drop/recreate needed (no CHECK constraints).

-- ── Add Now Assist fields to configuration_profiles ──────────────────────────
ALTER TABLE configuration_profiles ADD COLUMN now_assist_endpoint TEXT;
ALTER TABLE configuration_profiles ADD COLUMN now_assist_api_key_ref TEXT;
ALTER TABLE configuration_profiles ADD COLUMN now_assist_auth_mode TEXT DEFAULT 'apikey';
