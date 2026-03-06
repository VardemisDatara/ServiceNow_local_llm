// Module declarations
mod keychain;
mod commands;
mod integrations;
mod mcp;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::expect_used, clippy::missing_panics_doc)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_log::Builder::default()
      .level(log::LevelFilter::Info)
      .build())
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations(
          "sqlite:servicenow_bridge.db",
          vec![
            tauri_plugin_sql::Migration {
              version: 1,
              description: "initial schema",
              sql: include_str!("../../src/core/storage/migrations/0000_initial.sql"),
              kind: tauri_plugin_sql::MigrationKind::Up,
            },
            tauri_plugin_sql::Migration {
              version: 2,
              description: "llm provider support",
              sql: include_str!("../../src/core/storage/migrations/0001_llm_provider.sql"),
              kind: tauri_plugin_sql::MigrationKind::Up,
            },
            tauri_plugin_sql::Migration {
              version: 3,
              description: "now assist mcp config",
              sql: include_str!("../../src/core/storage/migrations/0002_add_now_assist_config.sql"),
              kind: tauri_plugin_sql::MigrationKind::Up,
            },
            tauri_plugin_sql::Migration {
              version: 4,
              description: "now assist server id and oauth",
              sql: include_str!("../../src/core/storage/migrations/0003_now_assist_server_id.sql"),
              kind: tauri_plugin_sql::MigrationKind::Up,
            },
          ],
        )
        .build(),
    )
    .invoke_handler(tauri::generate_handler![
      // Credential management commands (T018-T019)
      commands::credentials::store_servicenow_credentials,
      commands::credentials::get_servicenow_credentials,
      commands::credentials::delete_servicenow_credentials,
      commands::credentials::has_servicenow_credentials,
      commands::credentials::store_api_key,
      commands::credentials::get_api_key,
      commands::credentials::delete_api_key,
      commands::credentials::has_api_key,
      commands::credentials::test_credentials,
      commands::credentials::get_now_assist_oauth_token,
      commands::credentials::now_assist_oauth_login,
      // Connection test commands (T032-T033)
      commands::test_ollama::test_ollama_connection,
      commands::test_servicenow::test_servicenow_connection,
      // Chat commands (T050)
      commands::chat::send_chat_message,
      commands::chat::search_duckduckgo,
      // MCP commands (T062)
      mcp::server::check_ollama_tool_calls,
      mcp::server::execute_mcp_tool,
      // Now Assist MCP proxy — bypasses WebView CORS
      commands::mcp_proxy::now_assist_connect,
      commands::mcp_proxy::now_assist_call_tool,
    ])
    .setup(|_app| {
      log::info!("ServiceNow MCP Bridge starting...");
      log::info!("Platform: {}", std::env::consts::OS);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
