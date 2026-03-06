-- Migration: Now Assist Server ID and OAuth Client Credentials
-- Version: 4
-- Created: 2026-03-05
-- Description: Add Server ID (MCP Server sys_id), OAuth client_id, and
--              OAuth secret keychain ref to configuration_profiles.
--              The full endpoint URL is derived at runtime from
--              servicenow_url + now_assist_server_id.

ALTER TABLE configuration_profiles ADD COLUMN now_assist_server_id TEXT;
ALTER TABLE configuration_profiles ADD COLUMN now_assist_oauth_client_id TEXT;
ALTER TABLE configuration_profiles ADD COLUMN now_assist_oauth_secret_ref TEXT;
