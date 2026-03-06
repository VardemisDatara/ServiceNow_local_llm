# ServiceNow MCP Bridge

Desktop application enabling bidirectional AI communication between Ollama (local AI) and ServiceNow Now Assist via Model Context Protocol (MCP).

## Features

- 🤖 **Bidirectional AI Communication**: Ollama and ServiceNow Now Assist can access each other's capabilities via MCP
- 🔒 **Secure Credential Storage**: OS-native keychain integration (macOS Keychain, Windows Credential Vault, Linux Secret Service)
- 🔍 **Web Search Augmentation**: Responses automatically enriched with DuckDuckGo, Perplexity, or Google search results
- 🧠 **Cloud LLM Support**: Route conversations to OpenAI (GPT-4o, GPT-4-turbo) or Mistral AI instead of local Ollama
- 💾 **Conversation Persistence**: Save and resume conversations with configurable session timeout
- 🛡️ **Security Workflow Automation**: 6 specialized MCP tools for threat analysis, vulnerability assessment, incident correlation, compliance audit, and more
- ♿ **Accessible UI**: ARIA-compliant components with keyboard navigation and screen reader support
- 🔌 **Extensible Architecture**: Easy to add new capabilities and integrations

## Prerequisites

- **Node.js 20+** and **npm 10+**
- **Rust 1.75+** (via [rustup](https://rustup.rs/))
- **Ollama** (optional, for local AI): [https://ollama.ai/](https://ollama.ai/)

## Quick Start

```bash
# 1. Clone the repository
git checkout 001-servicenow-mcp-app

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Run in development mode
npm run tauri:dev
```

The application should launch in a desktop window!

## Development

```bash
# Run frontend dev server only (fast iteration)
npm run dev

# Run full Tauri app with hot reload
npm run tauri:dev

# Build for production
npm run tauri:build

# Linting
npm run lint

# Formatting
npm run format

# Tests
npm test                 # Run all tests
npm run test:unit       # Unit tests
npm run test:integration # Integration tests
npm run test:contract   # MCP contract tests
npm run test:e2e        # End-to-end tests
npm run test:coverage   # Coverage report (target: ≥80%)
```

## Project Structure

```
servicenow_mcp_handling/
├── src/                    # Frontend (TypeScript/React)
│   ├── main/               # Tauri main process
│   ├── renderer/           # Web UI components
│   ├── core/               # Business logic
│   │   ├── mcp/            # MCP protocol implementation
│   │   ├── integrations/   # Ollama, ServiceNow, Search APIs
│   │   ├── storage/        # SQLite + Drizzle ORM
│   │   └── security/       # Credential management
│   └── models/             # TypeScript types
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── commands/       # Tauri commands (IPC)
│   │   └── keychain/       # OS credential storage
│   └── Cargo.toml
├── tests/                  # Test suites
└── specs/001-servicenow-mcp-app/  # Design docs
```

## Configuration

### In-App Configuration
- ServiceNow instance URL and credentials
- Ollama model selection
- Search provider (DuckDuckGo, Perplexity, Google)
- Session timeout (1-168 hours)
- Persistence defaults

### Environment Variables
See `.env.example` for all available options.

## Documentation

- **User Guide**: [docs/user-guide.md](./docs/user-guide.md)
- **API Reference**: [docs/api-reference.md](./docs/api-reference.md)
- **Developer Quickstart**: [specs/001-servicenow-mcp-app/quickstart.md](./specs/001-servicenow-mcp-app/quickstart.md)
- **Feature Specification**: [specs/001-servicenow-mcp-app/spec.md](./specs/001-servicenow-mcp-app/spec.md)
- **Implementation Plan**: [specs/001-servicenow-mcp-app/plan.md](./specs/001-servicenow-mcp-app/plan.md)
- **MCP Tool Contracts**: [specs/001-servicenow-mcp-app/contracts/mcp-tools.md](./specs/001-servicenow-mcp-app/contracts/mcp-tools.md)
- **Data Model**: [specs/001-servicenow-mcp-app/data-model.md](./specs/001-servicenow-mcp-app/data-model.md)

## Architecture

- **Desktop Framework**: Tauri v2.0 (Rust backend + TypeScript/React frontend)
- **Database**: SQLite with better-sqlite3 + Drizzle ORM
- **MCP Implementation**: @modelcontextprotocol/sdk (TypeScript) + mcp-protocol-sdk (Rust)
- **Testing**: Vitest (unit/integration) + Playwright (E2E)
- **Performance**: <500MB memory, <3s startup, <100ms UI feedback

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and code quality standards.

## License

MIT

## Support

- **GitHub Issues**: [Link to repository issues]
- **Design Docs**: [specs/001-servicenow-mcp-app/](./specs/001-servicenow-mcp-app/)
