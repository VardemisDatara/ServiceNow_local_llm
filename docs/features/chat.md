# Chat

The **Chat** tab provides a conversational interface to your AI model with automatic ServiceNow data integration. Click **Chat** in the top navigation bar to open it.

---

## Interface Overview

The chat page is split into two panels separated by a resizable divider:

- **Left panel** (sidebar): conversation list
- **Right panel** (main area): active conversation with message thread and input

### Conversation Sidebar

- Lists all saved conversations by title.
- Click a conversation to open it.
- Click **+ New Conversation** (or the equivalent button) to start a fresh session.
- Each conversation shows a delete button. Clicking it reveals a confirmation prompt before deletion.

### Resizing

Drag the vertical divider between the sidebar and the main area to resize. The divider turns green on hover; drag left or right to adjust the sidebar width (minimum 150 px, maximum 450 px).

---

## Selecting the Active Model

The model used for a conversation is determined by the **LLM Provider** setting in your active profile (see [Configuration](../configuration.md#ai-language-model-llm-provider)). To change the model:

1. Go to **Settings**.
2. Edit your active profile.
3. Change the **AI Language Model** section.
4. Save the profile.

The next message you send will use the updated model. When using OpenAI or Mistral, the model name appears in parentheses next to the sender label (e.g. `OpenAI (gpt-4-turbo)`).

---

## How MCP Tool Calling Works

The app uses **keyword-based tool detection** — you do not need to use special commands or syntax. Just ask naturally.

**Example queries that trigger tool calls:**

- `List the 5 most recent open security incidents` → triggers `query_incidents`
- `Tell me about CVE-2024-1234` → triggers `assess_vulnerability`
- `Summarise INC0012345` → triggers `get_incident_details`
- `What phishing patterns are in the last 30 days?` → triggers `query_incidents` with phishing filter

**What happens behind the scenes:**

1. You send a message.
2. The app scans your message for keywords that match known ServiceNow tool signatures.
3. If a match is found, the tool call is executed against your ServiceNow instance before the model generates a response.
4. The tool result is injected into the model's context as a user/assistant pair.
5. The model generates a response using the live data.

**Tool result cards** appear in the chat thread with a light blue background and monospace font. Each card shows:
- The tool name (e.g. `MCP Tool: query_incidents`)
- The raw data returned from ServiceNow
- Execution latency in milliseconds
- A red `✗ failed` badge if the tool call errored

---

## Web Search Augmentation

When the app detects recency signals in your message (words like "latest", "recent", "current", "today", "this week"), it performs a web search **before** the model generates a response.

A **Web Search card** (orange/amber background) appears in the chat thread showing:
- The search query used
- The provider (DuckDuckGo, Perplexity, or Google)
- Up to 5 search results with title, snippet, and link

The search results are injected into the model's context so the response can reference current information.

Web search requires a provider to be configured in your profile (see [Configuration](../configuration.md#web-search-augmentation)).

---

## Understanding Message Types

| Sender label | Meaning |
|-------------|---------|
| **You** | Your message |
| **Ollama** | Response from a local Ollama model |
| **OpenAI (model)** | Response from the OpenAI API |
| **Mistral (model)** | Response from the Mistral API |
| **MCP Tool: \<name\>** | Raw data returned by a ServiceNow tool call |
| **Web Search** | Web search results card |
| **Now Assist ✦** | Response content sourced via the Now Assist MCP integration |

---

## Conversation History

All conversations are saved locally when **Persist conversations to database** is enabled in your profile settings.

To browse past conversations, click **History** in the top navigation bar. See [History](#history) for details.

### History Tab

The History page shows a sidebar with all saved conversations (title, message count, creation date). Click a session to view the full message thread. Sessions are read-only in History — you cannot send new messages from there.

---

## Tips

- Use **Mistral 7B or larger** for best tool-calling accuracy. Smaller models may miss keywords or hallucinate tool results.
- If a tool call fails (red `✗ failed` badge), check that your ServiceNow credentials are correct in Settings.
- Start a **+ New Conversation** to clear context when switching topics — this prevents the model from confusing separate threads.
