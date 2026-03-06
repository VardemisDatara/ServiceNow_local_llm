# ServiceNow MCP Bridge — User Guide

## Overview

ServiceNow MCP Bridge is a desktop application that connects your ServiceNow instance to local (Ollama) or cloud (OpenAI, Mistral AI) language models via the Model Context Protocol (MCP). It lets you chat with AI, query security incidents, run automated analysis workflows, and augment responses with live web search results.

---

## Quick Start

1. **Install** the application for your platform (see `quickstart.md`).
2. **Open Settings** → click **+ New Profile**.
3. Fill in:
   - **Profile Name** — any label (e.g. "Production").
   - **ServiceNow URL** — your instance URL, e.g. `https://yourcompany.service-now.com`.
   - **Ollama Endpoint** — default `http://localhost:11434` if running Ollama locally.
   - **Ollama Model** — e.g. `llama3.2` or `qwen2.5-coder`.
4. Optionally configure a **web search provider** and/or a **cloud AI model** (OpenAI / Mistral).
5. Click **Save**, then navigate to **Chat** or **Security** to begin.

---

## Pages

### Home

Displays real-time connection status for Ollama and ServiceNow. Use this to verify your configuration is correct before starting a conversation.

### Chat

The Chat page provides a streaming AI chat interface.

- Type a message and press **Enter** (or click **Send**).
- Responses stream token-by-token in real time.
- If **MCP tools** are configured (ServiceNow URL present), the AI can call ServiceNow APIs mid-conversation.
- If **web search** is enabled in your profile, the AI's responses are automatically augmented with relevant search results.
- Use the **model selector** dropdown in the chat header to switch between available Ollama models on the fly.
- Click **💾 Save** in the chat header to persist the conversation to history.

#### Supported AI Providers

| Provider | Config required |
|----------|----------------|
| Ollama (local) | Ollama running locally |
| OpenAI | API key in profile settings |
| Mistral AI | API key in profile settings |

### History

Browse and search previously saved conversations. Click a conversation to replay it (read-only).

### Security

The Security page provides AI-powered security incident analysis workflows.

1. Create an incident using **+ New** (or select an existing one from the list).
2. Choose a workflow type: **Phishing Analysis**, **Vulnerability Assessment**, or **Compliance Audit**.
3. Click **Analyze** on any incident to trigger the automated workflow.
4. Track step-by-step progress in the workflow progress panel.
5. View the full analysis report when the workflow completes.

### Settings

Manage configuration profiles. Each profile stores:

- ServiceNow URL and credentials
- Ollama endpoint and model
- Web search provider and API key
- Cloud LLM provider, model, and API key

**API keys are stored securely in the OS keychain** — never in the database.

---

## Configuration Reference

### Ollama

| Field | Description |
|-------|-------------|
| Endpoint | URL of your Ollama server (default: `http://localhost:11434`) |
| Model | Model name to use for generation (e.g. `llama3.2`, `mistral`) |

Run `ollama list` to see available models. Pull new models with `ollama pull <model>`.

### Web Search

| Provider | Description |
|----------|-------------|
| DuckDuckGo | No API key required; privacy-focused |
| Perplexity | API key required; high-quality AI-augmented results |
| Google | API key + Custom Search Engine ID required |

### Cloud LLM

| Provider | Available Models |
|----------|-----------------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |
| Mistral AI | mistral-large-latest, mistral-small-latest, open-mistral-7b, codestral-latest |

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send message | `Enter` |
| New line in message | `Shift+Enter` |

---

## Troubleshooting

### Ollama not connecting

- Ensure Ollama is running: `ollama serve`
- Check the endpoint URL in Settings (default: `http://localhost:11434`)
- Verify the model is pulled: `ollama pull <model>`

### ServiceNow connection issues

- Verify the instance URL (must include `https://`)
- Check that your credentials have API access
- Ensure the instance is not behind a VPN that blocks the app

### Cloud LLM errors

| Error | Cause | Fix |
|-------|-------|-----|
| Auth error | Invalid API key | Re-enter API key in Settings |
| Quota exceeded | Account limit reached | Upgrade plan or switch to Ollama |
| Rate limit | Too many requests | Wait and retry |

---

## Data & Privacy

- **All conversation data is stored locally** in an SQLite database at the Tauri app data directory.
- **API keys are stored in the OS keychain** (macOS Keychain, Windows Credential Manager, Linux Secret Service).
- Web search queries are sent to the configured provider; no data is sent to Anthropic or any third party by the app itself.
