use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::ipc::Channel;

/// A single message in a chat conversation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatMessageInput {
    pub role: String,
    pub content: String,
}

/// Event types sent back to the frontend via Channel
#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum ChatEvent {
    Token { content: String },
    Done { total_duration_ms: u64 },
    Error { message: String },
}

/// NDJSON chunk from Ollama streaming /api/chat
#[derive(Deserialize, Debug)]
struct OllamaChatChunk {
    message: OllamaMessageChunk,
    done: bool,
    total_duration: Option<u64>, // nanoseconds
}

#[derive(Deserialize, Debug)]
struct OllamaMessageChunk {
    content: String,
}

/// T050: Send a chat message to Ollama with streaming response via Tauri Channel
///
/// The command POSTs to Ollama's /api/chat with stream=true and sends each
/// token back to the frontend as a ChatEvent::Token. When done, sends ChatEvent::Done.
#[tauri::command]
pub async fn send_chat_message(
    endpoint: String,
    model: String,
    messages: Vec<ChatMessageInput>,
    on_event: Channel<ChatEvent>,
) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let request_body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true,
    });

    let url = format!("{}/api/chat", endpoint.trim_end_matches('/'));
    log::info!("Sending chat message to Ollama: {} model={}", url, model);

    let response = client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("Failed to connect to Ollama: {e}");
            let _ = on_event.send(ChatEvent::Error { message: msg.clone() });
            msg
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let msg = format!("Ollama returned HTTP {status}");
        let _ = on_event.send(ChatEvent::Error { message: msg.clone() });
        return Err(msg);
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| {
            let msg = format!("Stream read error: {e}");
            let _ = on_event.send(ChatEvent::Error { message: msg.clone() });
            msg
        })?;

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process all complete newline-delimited JSON lines in the buffer
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            match serde_json::from_str::<OllamaChatChunk>(&line) {
                Ok(chunk_data) => {
                    if chunk_data.done {
                        let ms = chunk_data.total_duration.unwrap_or(0) / 1_000_000;
                        let _ = on_event.send(ChatEvent::Done { total_duration_ms: ms });
                        log::info!("Chat complete in {}ms", ms);
                        return Ok(());
                    } else if !chunk_data.message.content.is_empty() {
                        let _ = on_event.send(ChatEvent::Token {
                            content: chunk_data.message.content,
                        });
                    }
                }
                Err(e) => {
                    log::warn!("Failed to parse Ollama chunk: {} — line: {:?}", e, line);
                }
            }
        }
    }

    // Stream ended without a done=true chunk (shouldn't happen but handle gracefully)
    let _ = on_event.send(ChatEvent::Done { total_duration_ms: 0 });
    Ok(())
}

/// DuckDuckGo Instant Answer search — proxied through Rust to avoid CORS
#[derive(Serialize, Debug)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

#[derive(Deserialize, Debug)]
struct DdgResponse {
    #[serde(rename = "Abstract")]
    abstract_text: Option<String>,
    #[serde(rename = "AbstractURL")]
    abstract_url: Option<String>,
    #[serde(rename = "AbstractSource")]
    abstract_source: Option<String>,
    #[serde(rename = "RelatedTopics")]
    related_topics: Option<Vec<DdgTopic>>,
}

#[derive(Deserialize, Debug)]
struct DdgTopic {
    #[serde(rename = "Text")]
    text: Option<String>,
    #[serde(rename = "FirstURL")]
    first_url: Option<String>,
}

#[tauri::command]
pub async fn search_duckduckgo(query: String) -> Result<Vec<SearchResult>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("ServiceNow-MCP-Bridge/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let url = "https://api.duckduckgo.com/";
    log::info!("DuckDuckGo search: {:?}", query);

    let response = client
        .get(url)
        .query(&[
            ("q", query.as_str()),
            ("format", "json"),
            ("no_html", "1"),
            ("skip_disambig", "1"),
        ])
        .send()
        .await
        .map_err(|e| format!("Search request failed: {e}"))?;

    let ddg: DdgResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse search response: {e}"))?;

    let mut results: Vec<SearchResult> = Vec::new();

    // Add abstract/main result if available
    if let (Some(text), Some(url), Some(source)) = (
        ddg.abstract_text.filter(|s| !s.is_empty()),
        ddg.abstract_url.filter(|s| !s.is_empty()),
        ddg.abstract_source,
    ) {
        results.push(SearchResult {
            title: source,
            url,
            snippet: text,
        });
    }

    // Add related topics (up to 4 more)
    if let Some(topics) = ddg.related_topics {
        for topic in topics.into_iter().take(4) {
            if let (Some(text), Some(url)) = (
                topic.text.filter(|s| !s.is_empty()),
                topic.first_url.filter(|s| !s.is_empty()),
            ) {
                let title = text.split(" - ").next().unwrap_or(&text).to_string();
                results.push(SearchResult {
                    title,
                    url,
                    snippet: text,
                });
            }
        }
    }

    log::info!("DuckDuckGo returned {} results for {:?}", results.len(), query);
    Ok(results)
}
