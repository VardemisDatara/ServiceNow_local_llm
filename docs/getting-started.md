# Getting Started

This guide takes you from zero to a working chat session with your ServiceNow instance in under 15 minutes.

---

## Step 1 — Install Prerequisites

### Ollama (required)

Ollama runs AI models locally on your machine.

1. Download and install Ollama from [ollama.com](https://ollama.com).
2. After installation, open a terminal and start the Ollama server:
   ```
   ollama serve
   ```
3. Pull a recommended model (Mistral 7B gives the best results for ServiceNow queries):
   ```
   ollama pull mistral:7b
   ```
   Smaller models like `phi3:mini` work but have limited tool-calling capability.

### Node.js and pnpm (for running from source)

1. Install Node.js 18 or later from [nodejs.org](https://nodejs.org).
2. Install pnpm:
   ```
   npm install -g pnpm
   ```

### Rust toolchain (for Tauri build, source only)

1. Install Rust from [rustup.rs](https://rustup.rs):
   ```
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. Install Tauri prerequisites for macOS:
   ```
   xcode-select --install
   ```

---

## Step 2 — Install and Launch the App

### From source

1. Clone the repository:
   ```
   git clone <repository-url>
   cd servicenow_mcp_handling
   ```
2. Install JavaScript dependencies:
   ```
   pnpm install
   ```
3. Start the app in development mode:
   ```
   pnpm tauri dev
   ```
   The app window opens after a short Rust compilation step (first run only).

### From a pre-built release

Download the `.dmg` file from the releases page and open it to install the app. No Rust or Node.js required.

---

## Step 3 — Create Your First Profile

A **profile** stores all your connection settings (ServiceNow URL, credentials, Ollama endpoint, model preference). You can have multiple profiles for different ServiceNow instances.

1. Click **Settings** in the top navigation bar.
2. Click the **+ New Profile** button.
3. Fill in the **Profile Name** field (e.g. "Production" or "Dev Instance").
4. Under **ServiceNow Connection**, enter:
   - **Instance URL** — the base URL of your ServiceNow instance, e.g. `https://dev12345.service-now.com`
   - **Username** — your ServiceNow username
   - **Password** — your ServiceNow password
5. Under **Ollama Connection**, enter:
   - **Ollama Endpoint** — leave as `http://localhost:11434` if Ollama is running locally
6. Click **Test Connections** to verify both connections succeed. Green indicators confirm success.
7. Once Ollama is connected, the **Default Model** field becomes a dropdown — select `mistral:7b` (or the model you pulled).
8. Check **Set as active profile** at the bottom of the form.
9. Click **Create Profile**.

---

## Step 4 — Send Your First Chat Message

1. Click **Chat** in the top navigation bar.
2. If no conversation exists, a new one is created automatically. Otherwise, click **+ New Conversation** in the left sidebar.
3. Type a question in the message input at the bottom. Try:
   ```
   List the 5 most recent open security incidents
   ```
4. Press **Enter** or click the send button.
5. The model streams its response. If it detects a ServiceNow query is needed, you will see a **tool result card** appear (light blue background) with the raw data before the final answer.

---

## What's Next?

- **[Configuration](configuration.md)** — Set up cloud LLM providers, web search, and Now Assist
- **[Chat](features/chat.md)** — Understand MCP tool calling and web search augmentation
- **[Security Tab](features/security-tab.md)** — Explore the live incident dashboard
- **[Troubleshooting](troubleshooting.md)** — Resolve common connection issues
