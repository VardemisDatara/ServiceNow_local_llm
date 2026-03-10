# Configuration

All application settings are managed through the **Settings** page. Click **Settings** in the top navigation bar to open it.

---

## Profile Management

A **profile** bundles all connection settings (ServiceNow, Ollama, LLM provider, web search, Now Assist) into a named configuration. You can create multiple profiles for different ServiceNow instances and switch between them at any time.

### Creating a Profile

1. Click **+ New Profile**.
2. Fill in all required fields (marked with `*`).
3. Click **Create Profile**.

### Editing a Profile

1. Select the profile from the dropdown (if you have more than one).
2. Click **Edit**.
3. Modify the fields and click **Save Changes**.

### Switching Profiles

Use the profile dropdown at the top of the Settings page to select a different profile. The selected profile becomes active immediately.

### Deleting a Profile

1. Open the profile you want to delete (view mode).
2. Click **Delete Profile** at the bottom of the card.
3. Confirm deletion in the dialog that appears.

> **Warning**: Deletion is permanent and cannot be undone.

---

## ServiceNow Connection

| Field | Description |
|-------|-------------|
| **Instance URL** *(required)* | Base URL of your ServiceNow instance. Format: `https://<instance>.service-now.com` |
| **Username** *(required)* | Your ServiceNow login username |
| **Password** *(required on create)* | Your ServiceNow password. In edit mode, leave blank to keep the current password. |

Click **Test ServiceNow** to verify the connection. A green indicator and latency value confirm success.

---

## Ollama Connection

| Field | Description |
|-------|-------------|
| **Ollama Endpoint** *(required)* | URL where Ollama is running. Default: `http://localhost:11434` |
| **Default Model** *(required)* | The model used for chat. After a successful Ollama connection test, this becomes a dropdown showing all locally available models. |

Click **Test Ollama** to verify the connection. If successful, the Default Model field refreshes with available models.

> **Recommended model**: `mistral:7b` or larger. `phi3:mini` works but has limited tool-calling capability and cannot perform RAG over web search results effectively.

---

## AI Language Model (LLM Provider)

Choose between a local Ollama model or a cloud provider.

### Ollama (default)

No additional configuration needed beyond the Ollama Connection section above.

### OpenAI

1. Select **OpenAI** from the provider selector.
2. Enter your **OpenAI API Key**.
3. Select a model (e.g. `gpt-4-turbo` or `gpt-3.5-turbo`).

OpenAI responses stream directly from the renderer — no data passes through the Tauri backend.

### Mistral

1. Select **Mistral** from the provider selector.
2. Enter your **Mistral API Key**.
3. Select a model (e.g. `mistral-large`).

---

## Web Search Augmentation

When enabled, the app performs a live web search before generating a response if the model detects time-sensitive keywords (e.g. "latest", "recent", "current").

| Provider | API Key Required | Notes |
|----------|-----------------|-------|
| **None** | No | Web search disabled |
| **DuckDuckGo** | No | Returns Wikipedia-style instant answers. Free but limited to factual lookups. |
| **Perplexity** | Yes | Full search results. Best quality. Model: `sonar`. |
| **Google** | Yes | Google Custom Search API. Requires a Custom Search Engine ID. |

To configure:
1. Select a provider from the **Search Provider** dropdown.
2. If prompted, enter the API key.
3. Save the profile.

---

## Now Assist MCP Integration

Now Assist integration connects your local model to the ServiceNow Now Assist tools via the Model Context Protocol. See [Now Assist](features/now-assist.md) for full setup details.

| Field | Description |
|-------|-------------|
| **MCP Server Endpoint** | Full URL to the MCP Server record on your ServiceNow instance. Format: `https://<instance>.service-now.com/sncapps/mcp-server/<sys_id>` |
| **Authentication Mode** | **API Key (x-sn-apikey)** — uses `x-sn-apikey` header (requires `com.glide.tokenbased_auth` plugin). **OAuth Bearer** — uses `Authorization: Bearer` header (standard OAuth2 token). |
| **Token** | The API key or bearer token. Stored securely in the system keychain — never written to disk in plaintext. |

**Buttons:**
- **Test Connection** — Connects to the MCP server, lists available tools, disconnects, and reports the tool count.
- **Save** — Persists the endpoint and auth mode to the profile and stores the token in the system keychain.
- **Clear** — Removes the endpoint from the profile and deletes the token from the keychain.

---

## Credential Storage

Choose where the app stores passwords and API keys. The setting is global and applies to all profiles.

### Providers

| Provider | Requirement | Notes |
|----------|------------|-------|
| **OS Keychain** *(default)* | None | macOS Keychain / Windows Credential Manager / Linux Secret Service |
| **1Password** | 1Password CLI v2 (`op`) installed and signed in | Run `op signin` before using the app |
| **Bitwarden** | Bitwarden CLI (`bw`) installed and vault unlocked | Run `bw unlock` to obtain a session token |

### Selecting a Provider

1. Open the **Credential Storage** section in Settings (collapsible panel).
2. The app automatically detects which providers are installed.
3. Select a provider radio button — only providers that are installed and authenticated show as **Ready**.
4. Click **Save**. If credentials are already stored in the current provider, a **migration wizard** opens.

### Credential Migration

When you switch the active provider, the migration wizard:
1. Reads all stored credential keys from the current provider (OS keychain).
2. Writes them to the selected target provider.
3. If all writes succeed, updates the active provider and removes the originals.
4. If any write fails, rolls back all partially-written items and leaves the original provider unchanged.

### Per-Credential Override

To store a specific key (e.g. an API key) in a different vault than the global default:

1. Find the credential field in Settings (ServiceNow password, API key, etc.).
2. Use the **Provider** dropdown next to that field.
3. Select any **Ready** provider — or choose **(using default)** to revert.

### Provider Lock Handling

If the active vault locks mid-session (e.g. 1Password session expires), the app returns a `PROVIDER_LOCKED` error and prompts you to re-authenticate. No silent fallback occurs.

---

## Session Settings

| Setting | Description |
|---------|-------------|
| **Session Timeout (hours)** | How long an inactive session is kept before being marked stale. Range: 1–168 hours. |
| **Persist conversations to database** | When enabled, all chat messages are saved locally and accessible in the History tab. |
| **Set as active profile** | Makes this profile the one used for all features (chat, security tab, Now Assist). Only one profile can be active at a time. |
