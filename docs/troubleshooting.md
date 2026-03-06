# Troubleshooting

Common errors, their causes, and step-by-step resolutions.

---

## Error 1 — ServiceNow 401 Unauthorized

**Symptom**: The ServiceNow connection test shows a red indicator and the message `401 Unauthorized` or `Authentication failed`.

**Likely Causes**:
- Incorrect username or password in the profile
- The ServiceNow instance URL is wrong or points to the wrong environment
- The account is locked or password has expired

**Resolution**:
1. Go to **Settings** and edit the active profile.
2. Verify the **Instance URL** format — it must be `https://<instance>.service-now.com` with no trailing path.
   - Correct: `https://dev12345.service-now.com`
   - Wrong: `https://dev12345.service-now.com/nav_to.do`
3. Re-enter the **Username** and **Password**.
4. Click **Test ServiceNow** to confirm the connection.
5. If still failing, log in to the ServiceNow instance directly in a browser with the same credentials to confirm they work.
6. If the account is locked, contact your ServiceNow administrator.

---

## Error 2 — Now Assist "Test Connection" 404 Not Found

**Symptom**: Clicking **Test Connection** in the Now Assist section shows `404 Not Found` or `Connection failed: 404`.

**Likely Causes**:
- The MCP Server endpoint URL is incorrect or the sys_id is wrong
- The `sn_mcp_server` plugin is not active on the ServiceNow instance
- The MCP Server record was deleted or deactivated

**Resolution**:
1. Log in to ServiceNow as an administrator.
2. Navigate to **System Definition > Plugins** and search for `sn_mcp_server`.
3. Confirm the plugin status is **Active**. If not, activate it.
4. Navigate to **Now Assist > MCP Server Console** and open the target server record.
5. Verify the sys_id in the URL of the record page. The endpoint must match exactly:
   ```
   https://<instance>.service-now.com/sncapps/mcp-server/<sys_id>
   ```
6. Copy the correct endpoint URL and update it in the app's Settings → Now Assist section.
7. Click **Test Connection** again.

---

## Error 3 — Now Assist 401: "Invalid token: Not enough segments"

**Symptom**: Test Connection (or Save) returns `401 Unauthorized` with the message `Invalid token: Not enough segments` or `Please provide a valid JWT token`.

**Root Cause**: The ServiceNow MCP Server endpoint (`/sncapps/mcp-server/mcp/…`) requires the Bearer token to be a properly structured **JWT** (three Base64 segments separated by dots: `header.payload.signature`). ServiceNow's default OAuth `access_token` is an **opaque string** (no dots, not a JWT) and is rejected by the MCP endpoint even though it was obtained from the same ServiceNow instance.

**Option A — Enable OIDC on the OAuth Application (recommended)**

When OpenID Connect (OIDC) is enabled, the token exchange returns an `id_token` which IS a JWT.  The app automatically uses the `id_token` instead of the `access_token` when both are present.

1. Log in to ServiceNow as an administrator.
2. Navigate to **System OAuth > Application Registry** → open your OAuth application record.
3. Set **Accessible from** to `All application scopes` if not already done.
4. Ensure the **Redirect URL** includes `http://localhost:7823/oauth` (required for Browser Login).
5. Verify the system property **`oauth2.oidc.enabled`** is `true`:
   - Search `sys_properties.list` → find `oauth2.oidc.enabled` → set value `true` → Save.
6. In the app, click **Browser Login** again.  The token exchange will now include an `id_token` (JWT).
7. The app will detect the JWT, store it, and the **Save** / **Test Connection** should succeed.

**Option B — Configure the OAuth Application to return JWT access tokens**

If OIDC cannot be enabled, configure the application to return JWT-formatted access tokens directly.

1. Navigate to **System OAuth > Application Registry** → open the OAuth application record.
2. Look for the **Token Type** field (available in San Diego and later).  Set it to **JWT**.
3. Create or select a **JWT Provider** record linked to this application.  The provider defines the signing key used to create the JWT.
4. Save the record.
5. Use **Browser Login** or **Fetch Token** again — the `access_token` will now be a JWT.

**Option C — Direct token paste (advanced)**

If neither OIDC nor JWT token type is available on the instance, you can paste a JWT directly obtained by other means (e.g. a ServiceNow REST Explore session in a browser that shows `Authorization: Bearer <jwt>`).

1. Log in to ServiceNow in a browser.
2. Open the browser DevTools Network tab.
3. Navigate to a ServiceNow REST request (e.g. `/api/now/table/incident`).
4. Copy the `Authorization: Bearer …` header value.
5. Paste the JWT into the **Bearer Token** field in the app → click **Save**.
6. Note: tokens obtained this way are typically session-bound and expire with the browser session.

**Diagnostic info**: The app logs the token type on each connection attempt.  In Tauri dev mode, open the log panel and look for `token length=… dots=…` — a valid JWT always shows `dots=2`.

---

## Error 4 — Ollama Not Responding

**Symptom**: The Ollama connection test shows a red indicator, or the chat hangs indefinitely after sending a message with no response.

**Likely Causes**:
- The Ollama server is not running
- Ollama is running on a different port or host
- A firewall is blocking the connection

**Resolution**:
1. Open a terminal and check if Ollama is running:
   ```
   curl http://localhost:11434/api/tags
   ```
   If the command times out or returns a connection error, Ollama is not running.
2. Start Ollama:
   ```
   ollama serve
   ```
3. Go to **Settings** and verify the **Ollama Endpoint** is `http://localhost:11434` (the default).
4. Click **Test Ollama** to confirm the connection.
5. If you are running Ollama on a different port (e.g. Docker), update the endpoint accordingly.
6. If you have a firewall (e.g. Little Snitch on macOS), confirm the app is allowed to connect to `localhost:11434`.

---

## Error 5 — Incident List Shows "Connection Error"

**Symptom**: The Security tab opens but the left panel shows an error banner instead of incidents, with a **Retry** button.

**Likely Causes**:
- No active profile is configured
- The active profile's ServiceNow credentials have expired or are incorrect
- The ServiceNow instance is unreachable (network/VPN issue)
- The account lacks read access to the `sn_si_incident` table

**Resolution**:
1. Go to **Settings** and confirm a profile exists with the **Set as active profile** checkbox checked.
2. Click **Test ServiceNow** — if it fails, fix the credentials as described in Error 1.
3. If you are on a corporate network or VPN is required to reach the ServiceNow instance, connect to the VPN and retry.
4. If credentials are correct but incidents still don't load, ask your ServiceNow administrator to verify that your account has at least `read` access to:
   - `sn_si_incident` table (for security incidents)
   - `incident` table (for regular incidents)
5. Click the **Retry** button in the incident list panel after resolving the issue.

---

## Error 6 — Now Assist Test Connection Succeeds but Reports 0 Tools

**Symptom**: The Now Assist **Test Connection** button shows `✓ Connected — 0 tools discovered`.

**Likely Causes**:
- The MCP Server record on ServiceNow has no tool packages assigned
- The server role associated with the connection does not have access to the configured tools

**Resolution**:
1. Log in to ServiceNow as an administrator.
2. Navigate to **Now Assist > MCP Server Console**.
3. Open the MCP Server record that matches your endpoint.
4. Look for a **Tool Packages** or **Assigned Tools** related list.
5. Add the desired tool packages (e.g. Knowledge Base, Change Management) to the server record.
6. Save the record and click **Test Connection** again in the app.
7. The tool count should now reflect the number of tools in the assigned packages.

---

## Error 7 — Fetch Token Returns "access_denied"

**Symptom**: Clicking **Fetch Token** in the Now Assist section shows `Failed to fetch token: HTTP 401 Unauthorized: access_denied`.

**Likely Causes**:
- The OAuth Application Registry record does not exist or is **Inactive**
- The OAuth Application was created as the wrong type (e.g. "Authorization Code" only — it must also support the **Resource Owner Password** grant type)
- The `client_id` or `client_secret` entered in the app does not match the record in ServiceNow
- The user account (`adam.long`) does not have the **`oauth_user`** role, which is required for the password grant flow on most ServiceNow instances

**Resolution**:
1. Log in to ServiceNow as an administrator.
2. Navigate to **System OAuth > Application Registry**.
3. Search for the Application Registry record you created for this integration.
4. Verify:
   - **Active** checkbox is checked.
   - **Application type**: `Create an OAuth API endpoint for external clients`.
   - Copy the **Client ID** exactly — it is case-sensitive.
   - Click **Show Client Secret** and copy the secret exactly.
5. If you need to create the record from scratch:
   - Click **New** → select **Create an OAuth API endpoint for external clients**.
   - Fill **Name**, leave **Client ID** and **Client Secret** auto-generated.
   - Set **Redirect URL**: `https://localhost/oauth_redirect` (required even for the password flow).
   - Save, then copy the Client ID and Client Secret.
6. Assign the **`oauth_user`** role to the user account:
   - Navigate to **User Administration > Users** → open the user record → **Roles** tab → Add **`oauth_user`**.
7. Paste the correct Client ID and Client Secret into the app's **Settings → Now Assist → OAuth Application Credentials** fields and retry **Fetch Token**.

**Tip:** To verify your credentials manually before using the app, run this `curl` command:
```bash
curl -X POST "https://<instance>.service-now.com/oauth_token.do" \
  -d "grant_type=password" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "username=<SN_USERNAME>" \
  -d "password=<SN_PASSWORD>"
```
If this returns an `access_token`, the credentials are correct and the app's Fetch Token button will work.

---

## Error 8 — Now Assist OAuth Bearer Token Returns 401 After Pasting Token

**Symptom**: `Test Connection` shows `401 Unauthorized` even though you chose **OAuth Bearer** mode and pasted a token.

**Likely Causes**:
- The token has expired (OAuth tokens typically last 30 minutes)
- The token was generated for a different OAuth application (client_id mismatch)
- The OAuth Application Registry record is inactive or not saved
- The token is missing — it was not stored in the keychain after a **Clear** operation

**Resolution**:
1. Regenerate a fresh Bearer token:
   ```bash
   curl -X POST "https://<instance>.service-now.com/oauth_token.do" \
     -d "grant_type=password" \
     -d "client_id=<CLIENT_ID>" \
     -d "client_secret=<CLIENT_SECRET>" \
     -d "username=<SN_USERNAME>" \
     -d "password=<SN_PASSWORD>"
   ```
2. Copy the `access_token` value from the response.
3. Go to **Settings** → edit the profile → **Now Assist** section → paste the new token → **Save**.
4. Verify in ServiceNow that the **OAuth Application Registry** record (System OAuth > Application Registry) is **Active** and that the client_id/secret match what you used in step 1.
5. Click **Test Connection** again.

**Tip:** If tokens expire too often, consider requesting a longer-lived token or ask your ServiceNow admin to extend the OAuth token lifetime in the Application Registry record.

---

## Error 9 — Now Assist MCP Option Not Visible in AI Agent Studio

**Symptom**: In ServiceNow, the **"Add MCP Server"** button is missing from **AI Agent Studio > Settings**, or the Now Assist MCP Server Console is not in the navigator.

**Likely Causes**:
- The MCP Client plugin is not installed or is outdated
- The `sn_aia.enable_mcp_tool` system property is not set to `true`
- The logged-in user is missing the `sn_aia.admin` or `sn_mcp_client.admin` role
- The instance was provisioned before January 2026 and MCP has not been enabled by ServiceNow support

**Resolution**:
1. Log in to ServiceNow as an administrator.
2. Check roles: navigate to **User Administration > Users**, open your user record → **Roles** tab. Ensure both `sn_aia.admin` and `sn_mcp_client.admin` are present.
3. Check the system property: search "sys_properties.list" → find `sn_aia.enable_mcp_tool` → confirm it is set to `true`.
4. Check plugin version: navigate to **System Definition > Plugins** → search for "Model Context Protocol Client" → confirm it is Active and on the latest version. Upgrade if needed.
5. If the instance is older than January 2026: open a ServiceNow support case with Product: **CNS — Application Delivery Controller** to request MCP Server enablement.

---

## Error 10 — Stale Sessions Cause Connection Failures

**Symptom**: Now Assist was working, then stopped — test connection fails or returns unexpected errors, but credentials have not changed.

**Likely Causes**:
- The `sn_mcp_client_server_session_mapping` table has accumulated stale/expired session records
- The MCP server session expired server-side but the client still holds a stale reference

**Resolution**:
1. Log in to ServiceNow as an administrator.
2. Navigate to the table directly: enter `sn_mcp_client_server_session_mapping.list` in the navigator.
3. Delete any sessions that appear expired or invalid (check the `created_on` / `expires` fields).
4. Go back to the app → Settings → Now Assist section → click **Clear** → re-enter endpoint and token → **Save**.
5. Click **Test Connection** to verify the fresh session is established.

---

## Error 11 — Chat Sends Message but No Response Appears

**Symptom**: You send a message and the "streaming" cursor appears, but no text is generated — the cursor disappears without any response.

**Likely Causes**:
- The selected Ollama model is not downloaded
- The cloud LLM API key is invalid or expired (for OpenAI/Mistral)
- An in-flight tool call failed silently

**Resolution**:
1. Open a terminal and verify the model is downloaded:
   ```
   ollama list
   ```
   If your model is not listed, pull it:
   ```
   ollama pull mistral:7b
   ```
2. Go to **Settings** → edit the profile → confirm the **Default Model** matches an installed model.
3. If using OpenAI or Mistral, verify the API key is valid by testing it directly with a `curl` call.
4. Open the browser DevTools (Tauri dev mode only) and check the console for error messages during the request.
5. Start a new conversation (sidebar → **+ New Conversation**) and retry — long context can occasionally cause timeout issues.
