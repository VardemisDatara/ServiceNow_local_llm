# Now Assist Integration

The Now Assist integration connects the local AI model to your ServiceNow instance's **MCP Server**, enabling it to invoke Now Assist tools such as knowledge base lookups, change request creation, and more — directly from the chat interface.

---

## Table of Contents

1. [Overview](#overview)
2. [ServiceNow Administration Setup](#servicenow-administration-setup)
   - [Required Releases & Licensing](#required-releases--licensing)
   - [Required Plugins & Apps](#required-plugins--apps)
   - [Required Roles](#required-roles)
   - [Enable the MCP System Property](#enable-the-mcp-system-property)
   - [Create an OAuth Application (Recommended)](#create-an-oauth-application-recommended)
   - [Configure the MCP Server Record](#configure-the-mcp-server-record)
   - [Assign Tool Packages](#assign-tool-packages)
   - [Find the MCP Server Endpoint URL](#find-the-mcp-server-endpoint-url)
3. [Configuring Now Assist in the App](#configuring-now-assist-in-the-app)
4. [How Now Assist Tool Calling Works](#how-now-assist-tool-calling-works)
5. [The Now Assist Attribution Badge](#the-now-assist--attribution-badge)
6. [Graceful Degradation](#graceful-degradation)
7. [Disconnecting / Switching Profiles](#disconnecting--switching-profiles)

---

## Overview

```
┌─────────────────────┐    MCP (HTTP/SSE)    ┌──────────────────────────┐
│  ServiceNow MCP     │ ◄──────────────────► │  ServiceNow MCP Bridge   │
│  Bridge (this app)  │                      │  (Now Assist MCP Server) │
└─────────────────────┘                      └──────────────────────────┘
         │                                               │
  Local Ollama / Cloud LLM              Now Assist Tools (KB, Incidents…)
```

When a user sends a message in the Chat tab, the app checks whether any of the discovered Now Assist tools match the intent. If so, it calls the tool via MCP, injects the result into the model context, and the model generates a grounded response.

---

## ServiceNow Administration Setup

This section covers everything an **instance administrator** must do on the ServiceNow side before the app can connect.

### Required Releases & Licensing

| Requirement | Details |
|-------------|---------|
| **ServiceNow release** | Yokohama Patch 11 or later (or Zurich Patch 4+) |
| **Now Assist license** | Pro Plus or Enterprise Plus SKU |
| **AI Agents store app** | Version 6.x or later |
| **MCP Client plugin** | Latest version from the ServiceNow Store |

> **Note:** On instances provisioned before January 2026, MCP Server functionality may require a support case (product: CNS — Application Delivery Controller) to be activated by ServiceNow support.

---

### Required Plugins & Apps

Log in as an administrator and verify these are installed and active:

1. Navigate to **System Definition > Plugins**.
2. Search for each of the following and confirm their status is **Active**:

| Plugin / App | Description |
|-------------|-------------|
| `sn_mcp_server` | MCP Server Console — required to host tool endpoints |
| `com.glide.tokenbased_auth` | Token-Based Authentication — required if using API Key mode |
| AI Agents store app (v6+) | Provides the AI Agent Studio and tool packages |
| Model Context Protocol Client | Enables client-side MCP connections in AI Agent Studio |

If any plugin is missing, go to **System Definition > Plugins**, search by name, and click **Activate/Upgrade**.

---

### Required Roles

The user account used to administer MCP connections must have **both** roles:

| Role | Purpose |
|------|---------|
| `sn_aia.admin` | Now Assist AI administration |
| `sn_mcp_client.admin` | MCP Client administration |

To assign roles: **User Administration > Users** → open the user record → **Roles** tab → add the roles above.

---

### Enable the MCP System Property

MCP tool calling must be explicitly enabled via a system property:

1. Navigate to **System Properties** (search "sys_properties.list" in the navigator).
2. Search for property name: `sn_aia.enable_mcp_tool`
3. Set the **Value** to `true`.
4. Save.

Without this property set to `true`, the MCP Server will not expose tools.

---

### Create an OAuth Application (Recommended)

OAuth 2.0 Bearer token authentication is the recommended method. If you prefer API Key authentication instead, skip to the next section.

1. Navigate to **System OAuth > Application Registry**.
2. Click **New** → select **"Create an OAuth API endpoint for external clients"**.
3. Fill in the form:
   - **Name**: e.g. `ServiceNow MCP Bridge`
   - **Client ID**: auto-generated (copy this value)
   - **Client Secret**: auto-generated (copy this value)
   - **Redirect URL**: `https://localhost/oauth_redirect` (or your app's redirect URL)
4. Save the record.
5. Keep the **Client ID** and **Client Secret** — you will need them to obtain a Bearer token.

**Getting a Bearer token from the CLI:**

```bash
curl -X POST "https://<instance>.service-now.com/oauth_token.do" \
  -d "grant_type=password" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "username=<SN_USERNAME>" \
  -d "password=<SN_PASSWORD>"
```

The response includes an `access_token` field — that is the Bearer token you will paste into the app.

**Token expiry:** OAuth tokens expire (typically after 30 minutes). When the token expires, the app falls back gracefully to the local model and logs a note. Re-generate a token and update the credential in Settings when needed.

---

### Configure the MCP Server Record

1. Navigate to **Now Assist > MCP Server Console** (or search "MCP Server Console" in the navigator).
2. Click **New** to create a server record, or open an existing one.
3. Configure the record:

| Field | Value |
|-------|-------|
| **Name** | A descriptive label (e.g. `External MCP Bridge`) |
| **Transport** | Streamable HTTP (HTTP/SSE) |
| **Status** | Active |

4. Save the record. Note the **sys_id** from the URL — you will need it to construct the endpoint URL.

---

### Assign Tool Packages

Tool packages group related Now Assist tools by persona. Assign the packages relevant to your use case:

| Package | Tools Included |
|---------|---------------|
| `service_desk` | Incident handling, request management |
| `change_coordinator` | Change request creation and management |
| `knowledge_author` | Knowledge base search and authoring |
| `catalog_builder` | Service catalog configuration |
| `system_administrator` | User and group management |
| `platform_developer` | Scripting and deployments |
| `agile_management` | User stories and project tracking |

To assign: open the MCP Server record → **Tool Packages** related list → click **New** → select the packages.

> If the app reports `0 tools discovered` after a successful connection, the most common cause is that no tool packages are assigned to the server record.

---

### Find the MCP Server Endpoint URL

The endpoint URL embeds the **sys_id** of your MCP Server record:

```
https://<instance>.service-now.com/sncapps/mcp-server/<sys_id>
```

To retrieve it:

1. Open the MCP Server record in the console.
2. Look at the browser URL — the long alphanumeric string after `sys_id=` is the sys_id.
3. Alternatively, the record may show a **Connection URL** field with the complete endpoint.

**Example:**
```
https://dev12345.service-now.com/sncapps/mcp-server/a1b2c3d4e5f6789012345678901234ab
```

---

## Configuring Now Assist in the App

Once the ServiceNow side is ready, configure the connection in the app:

1. Click **Settings** in the top navigation bar.
2. Edit your active profile (or create a new one).
3. Scroll down to the **Now Assist MCP Integration** section.

### MCP Server Endpoint

Paste the full endpoint URL:

```
https://dev12345.service-now.com/sncapps/mcp-server/a1b2c3d4e5f6789012345678901234ab
```

### Authentication Mode

Choose the mode that matches your ServiceNow configuration:

| Mode | Header Sent | When to Use |
|------|------------|-------------|
| **API Key (x-sn-apikey)** | `x-sn-apikey: <token>` | Use with a ServiceNow API key. Requires `com.glide.tokenbased_auth` plugin. |
| **OAuth Bearer** | `Authorization: Bearer <token>` | Use with an OAuth 2.0 Bearer token obtained via the OAuth Application Registry. |

### Token

Enter your API key or Bearer token in the **Token** field. The token is stored in the **system keychain** — it is never written to disk in plaintext or logged.

### Test Connection

Click **Test Connection** before saving to verify the endpoint and token are correct. A successful test shows:

```
✓ Connected — 7 tools discovered
```

The number reflects how many Now Assist tools are assigned to the MCP Server record. If you see `0 tools discovered`, check that tool packages are assigned in the MCP Server Console.

### Save and Clear

- **Save** — persists the endpoint and auth mode to the profile and stores the token in the keychain.
- **Clear** — removes the endpoint from the profile and deletes the token from the keychain entirely.

---

## How Now Assist Tool Calling Works

Once configured, the local AI model automatically detects when a user query could benefit from a Now Assist tool — **no special commands or syntax required**.

**Detection mechanism**: the app extracts meaningful keywords from each tool's description and checks whether those keywords appear in your message. For example:
- If a "search knowledge base" tool is discovered and you ask about "password reset procedures", the app matches "knowledge" and "password" and invokes the tool.
- If a "create change request" tool is discovered and you ask to "create a change request for the network upgrade", the tool fires.

**What happens step by step:**

1. Your message is sent.
2. The app checks the list of discovered tools from the MCP Server.
3. Matching tools are invoked via the MCP connection.
4. The tool result is injected into the model's context.
5. The model generates a response using the live Now Assist data.

---

## The Now Assist ✦ Attribution Badge

When a response includes content sourced via Now Assist, a purple pill badge appears immediately before the message content:

```
Now Assist ✦
```

This badge is always visible — it is never hidden — so you can always distinguish which parts of a response originated from Now Assist tools versus the local model's own knowledge.

---

## Graceful Degradation

If the Now Assist connection is unavailable (e.g. the token expired, the MCP Server is unreachable, or Now Assist is not configured), the app does **not** fail silently. Instead:

1. The Now Assist tool call is skipped.
2. The local model answers from its own knowledge.
3. A note is appended to the response:

   ```
   [Now Assist unavailable for this response — answered using local model only]
   ```

This ensures the chat remains functional even when the MCP Server is temporarily offline or misconfigured.

---

## Disconnecting / Switching Profiles

When you switch to a different profile (or clear the Now Assist credentials), the active MCP connection is terminated cleanly. If the new profile has Now Assist configured, the app reconnects automatically on the next app start.

To force a reconnect without restarting:
1. Go to **Settings** → edit the profile.
2. Click **Clear** in the Now Assist section.
3. Re-enter the endpoint and token.
4. Click **Save**.
5. Restart the app (or trigger a re-connect by reloading the profile).
