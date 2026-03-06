# ServiceNow MCP Bridge — Documentation

**ServiceNow MCP Bridge** is a desktop application that connects your local AI models (via Ollama or cloud LLMs) to your ServiceNow instance through the Model Context Protocol (MCP). It lets you query incidents, analyse security threats, and interact with Now Assist tools — all from a single, local-first interface.

---

## Feature Summary

| Feature | Description |
|---------|-------------|
| **AI Chat** | Conversational interface backed by Ollama, OpenAI, or Mistral. The model automatically detects when a ServiceNow query is needed and fetches live data. |
| **Security Incidents Dashboard** | A live, proactively loaded list of security incidents from your ServiceNow instance, with filters, auto-refresh, and row-level detail expansion. |
| **Now Assist Integration** | Connects to your ServiceNow MCP Server so the local model can invoke Now Assist tools (knowledge base lookups, change request creation, and more). |
| **Web Search Augmentation** | When the model detects time-sensitive questions, it queries DuckDuckGo, Perplexity, or Google before generating a response. |
| **Conversation History** | All conversations are persisted locally. Browse and revisit past sessions at any time. |

---

## Quick-Link Table

| Guide | What You'll Learn |
|-------|-------------------|
| [Getting Started](getting-started.md) | Install prerequisites, launch the app, create your first profile, send your first chat message |
| [Configuration](configuration.md) | Profile management, ServiceNow credentials, Ollama setup, LLM provider selection, web search, Now Assist |
| [Chat](features/chat.md) | Chat interface, model selection, MCP tool calling, web search cards, conversation history |
| [Security Tab](features/security-tab.md) | Incident list panel, filters, auto-refresh, row expansion, AI analysis workflow |
| [Now Assist](features/now-assist.md) | **ServiceNow-side admin setup** (plugins, roles, OAuth, MCP Server record, tool packages), app-side configuration, authentication modes, tool calling, attribution badge, graceful degradation |
| [Troubleshooting](troubleshooting.md) | Common errors and step-by-step resolutions |

---

## Prerequisites at a Glance

- **macOS** — Windows/Linux support planned
- **Node.js** 18+ and **pnpm** (for running from source)
- **Rust** toolchain (for Tauri build; not needed for pre-built releases)
- **Ollama** running locally (`ollama serve`) with at least one model pulled — recommended: `mistral:7b` or larger
- **ServiceNow** instance URL + credentials (read access to the `sn_si_incident` table)
- *Optional*: ServiceNow Yokohama instance with `sn_mcp_server` plugin for Now Assist features
- *Optional*: OpenAI or Mistral API key for cloud LLM providers
- *Optional*: Perplexity or Google Custom Search API key for web search augmentation
