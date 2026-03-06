# Quickstart Guide: ServiceNow MCP Bridge Application

**Feature**: 001-servicenow-mcp-app
**Date**: 2026-02-12
**Target Audience**: Developers setting up the development environment

This guide will help you set up your development environment and start contributing to the ServiceNow MCP Bridge Application within 30 minutes.

---

## Prerequisites

### Required Software

1. **Node.js 20+** and **npm 10+**
   ```bash
   node --version  # Should be >= 20.0.0
   npm --version   # Should be >= 10.0.0
   ```
   Download from: https://nodejs.org/

2. **Rust 1.75+** and **Cargo**
   ```bash
   rustc --version  # Should be >= 1.75.0
   cargo --version
   ```
   Install via rustup: https://rustup.rs/

3. **Git**
   ```bash
   git --version
   ```

### Optional but Recommended

- **VS Code** with extensions:
  - rust-analyzer
  - Tauri
  - ESLint
  - Prettier
- **Ollama** (for testing local AI integration)
  - Download: https://ollama.ai/
  - Install a model: `ollama pull llama3.2`

---

## Quick Setup (5 Minutes)

### 1. Clone Repository
```bash
git clone <repository-url>
cd servicenow_mcp_handling
git checkout 001-servicenow-mcp-app
```

### 2. Install Dependencies
```bash
# Install Tauri CLI globally
cargo install tauri-cli

# Install Node dependencies
npm install

# Install Rust dependencies (automatic via Cargo.toml)
cd src-tauri
cargo build
cd ..
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings (optional for development)
# OLLAMA_ENDPOINT=http://localhost:11434
# LOG_LEVEL=debug
```

### 4. Start Development Server
```bash
# Start Tauri in development mode (hot reload enabled)
npm run tauri dev
```

The application should launch in a desktop window!

---

## Project Structure Overview

```
servicenow_mcp_handling/
├── src/                      # Frontend (TypeScript/React)
│   ├── main/                 # Tauri main process
│   ├── renderer/             # Web UI components
│   ├── core/                 # Business logic
│   │   ├── mcp/              # MCP protocol implementation
│   │   ├── integrations/     # Ollama, ServiceNow, Search APIs
│   │   ├── storage/          # SQLite + Drizzle ORM
│   │   └── security/         # Credential management
│   └── models/               # TypeScript types
├── src-tauri/                # Backend (Rust)
│   ├── src/
│   │   ├── main.rs           # Entry point
│   │   ├── commands/         # Tauri commands (IPC)
│   │   ├── mcp_server/       # MCP server implementation
│   │   └── keychain/         # OS credential storage
│   └── Cargo.toml
├── tests/                    # Test suites
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── e2e/
├── specs/001-servicenow-mcp-app/  # Design docs
│   ├── spec.md
│   ├── plan.md
│   ├── data-model.md
│   ├── contracts/
│   └── research.md
└── package.json
```

---

## Development Workflow

### Running the Application

```bash
# Development mode (hot reload)
npm run tauri dev

# Build for production
npm run tauri build

# Build frontend only (fast iteration)
npm run dev
```

### Database Operations

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Open Drizzle Studio (GUI)
npx drizzle-kit studio
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run contract tests (MCP tools)
npm run test:contract

# Check coverage
npm run test:coverage  # Target: ≥80%
```

### Linting & Formatting

```bash
# TypeScript linting
npm run lint

# Rust linting
cd src-tauri && cargo clippy

# Format all code
npm run format
```

---

## Common Tasks

### 1. Add a New MCP Tool

**Step 1**: Define tool schema in `src/core/mcp/tools/my_new_tool.ts`
```typescript
import { z } from 'zod';

export const MyNewToolSchema = z.object({
  input: z.object({
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional(),
  }),
  output: z.object({
    result: z.string(),
    confidence: z.number().min(0).max(1),
  }),
});

export type MyNewToolInput = z.infer<typeof MyNewToolSchema.shape.input>;
export type MyNewToolOutput = z.infer<typeof MyNewToolSchema.shape.output>;
```

**Step 2**: Implement tool logic in `src/core/mcp/tools/my_new_tool.ts`
```typescript
export async function executeMyNewTool(
  input: MyNewToolInput
): Promise<MyNewToolOutput> {
  // Implementation here
  return {
    result: 'Success',
    confidence: 0.95,
  };
}
```

**Step 3**: Register tool in `src/core/mcp/server.ts`
```typescript
import { MyNewToolSchema, executeMyNewTool } from './tools/my_new_tool';

// In registerTools():
server.addTool('my_new_tool', {
  description: 'Tool description',
  schema: MyNewToolSchema,
  handler: executeMyNewTool,
});
```

**Step 4**: Write contract test in `tests/contract/my_new_tool.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { MyNewToolSchema } from '../src/core/mcp/tools/my_new_tool';

describe('my_new_tool contract', () => {
  it('validates input schema', () => {
    const valid = { param1: 'test', param2: 123 };
    expect(() => MyNewToolSchema.shape.input.parse(valid)).not.toThrow();
  });

  it('validates output schema', () => {
    const valid = { result: 'Success', confidence: 0.95 };
    expect(() => MyNewToolSchema.shape.output.parse(valid)).not.toThrow();
  });
});
```

### 2. Add a New Database Entity

**Step 1**: Define schema in `src/core/storage/schema.ts` (Drizzle)
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const myNewTable = sqliteTable('my_new_table', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

**Step 2**: Generate and apply migration
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

**Step 3**: Create repository in `src/core/storage/repositories/my_new_table.ts`
```typescript
import { db } from '../database';
import { myNewTable } from '../schema';

export class MyNewTableRepository {
  async create(data: InsertMyNewTable): Promise<MyNewTable> {
    const [result] = await db.insert(myNewTable).values(data).returning();
    return result;
  }

  async findById(id: string): Promise<MyNewTable | undefined> {
    const [result] = await db.select().from(myNewTable).where(eq(myNewTable.id, id));
    return result;
  }
}
```

### 3. Add a New API Integration

**Step 1**: Create client in `src/core/integrations/my_service.ts`
```typescript
export class MyServiceClient {
  constructor(private readonly apiKey: string) {}

  async callApi(params: any): Promise<any> {
    const response = await fetch('https://api.myservice.com/endpoint', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }
}
```

**Step 2**: Add configuration to `ConfigurationProfile` entity (if needed)

**Step 3**: Write integration test in `tests/integration/my_service.test.ts`

---

## Debugging

### Frontend Debugging

1. **Browser DevTools**: Right-click in app → "Inspect Element"
2. **Console Logs**: `console.log()` statements appear in DevTools
3. **React DevTools**: Install extension for React component inspection

### Backend (Rust) Debugging

1. **Logging**:
   ```rust
   use log::{info, warn, error};
   info!("Informational message");
   error!("Error: {}", err);
   ```

2. **VS Code Debugging**:
   - Install rust-analyzer extension
   - Set breakpoints in Rust code
   - Press F5 to start debugging

3. **Print Debugging**:
   ```rust
   eprintln!("Debug: {:?}", value);  // Prints to stderr
   ```

### Database Debugging

```bash
# Open database in SQLite CLI
sqlite3 ~/.local/share/servicenow-mcp-bridge/db.sqlite

# Or use Drizzle Studio GUI
npx drizzle-kit studio
```

### MCP Protocol Debugging

```bash
# Enable MCP debug logging
export MCP_DEBUG=1
npm run tauri dev

# Logs will show MCP message exchange
```

---

## Troubleshooting

### Build Errors

**Problem**: `cargo build` fails with native module errors
```
Solution:
1. Ensure Rust is up to date: rustup update
2. Clear build cache: cargo clean
3. Rebuild: cargo build
```

**Problem**: `npm install` fails
```
Solution:
1. Delete node_modules and package-lock.json
2. Clear npm cache: npm cache clean --force
3. Reinstall: npm install
```

### Runtime Errors

**Problem**: "Failed to connect to Ollama"
```
Solution:
1. Ensure Ollama is running: ollama serve
2. Check endpoint: curl http://localhost:11434/api/version
3. Verify .env configuration
```

**Problem**: "Keychain access denied"
```
Solution (macOS):
1. Open Keychain Access app
2. Find servicenow-mcp-bridge entry
3. Right-click → Get Info → Access Control → Allow all applications
```

**Problem**: "Database locked"
```
Solution:
1. Close all instances of the app
2. Remove lock file: rm ~/.local/share/servicenow-mcp-bridge/db.sqlite-wal
3. Restart app
```

---

## Configuration

### Environment Variables (.env)

```bash
# Ollama Configuration
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.2

# Logging
LOG_LEVEL=info  # debug, info, warn, error
LOG_TO_FILE=true

# Database
DB_PATH=~/.local/share/servicenow-mcp-bridge/db.sqlite

# Development
DEV_MODE=true
HOT_RELOAD=true
```

### User Configuration (in-app)

Users configure via Settings UI:
- ServiceNow instance URL + credentials
- Ollama model selection
- Search provider (DuckDuckGo, Perplexity, etc.)
- Session timeout (1-168 hours)
- Persistence defaults

---

## Performance Tips

1. **Fast Iteration**: Use `npm run dev` for frontend-only changes (skips Rust compilation)
2. **Parallel Tests**: Run tests in parallel: `npm test -- --reporter=verbose --parallel`
3. **Incremental Builds**: Rust supports incremental compilation by default
4. **Database Indexing**: Check query performance with `EXPLAIN QUERY PLAN` in SQLite

---

## Next Steps

1. **Read the Spec**: [spec.md](./spec.md) - Understand user stories and requirements
2. **Review Architecture**: [plan.md](./plan.md) - Technical decisions and structure
3. **Check Contracts**: [contracts/mcp-tools.md](./contracts/mcp-tools.md) - MCP tool APIs
4. **Pick a Task**: Once tasks.md is generated, pick a P1 task to start

### Suggested First Contributions

- **Easy**: Add a new search provider integration
- **Medium**: Implement one of the 6 MCP tools
- **Hard**: Build the bidirectional MCP communication layer

---

## Resources

### Documentation
- [Tauri Documentation](https://v2.tauri.app/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Zod Validation](https://zod.dev/)

### Community
- **Project Slack**: (link TBD)
- **GitHub Issues**: (repository URL)
- **Design Docs**: `specs/001-servicenow-mcp-app/`

### Getting Help

1. Check this quickstart guide
2. Review troubleshooting section above
3. Search existing GitHub issues
4. Ask in project Slack #dev-help channel
5. Create a new GitHub issue with:
   - Operating system
   - Node/Rust versions
   - Error message (full stack trace)
   - Steps to reproduce

---

## Development Principles

Follow the project constitution (`.specify/memory/constitution.md`):

1. **Test-First**: Write tests before implementation (TDD)
2. **Type Safety**: Use TypeScript strict mode, leverage Rust's type system
3. **Clean Code**: Functions <50 lines, descriptive names, documented APIs
4. **Security**: Input validation, encrypted credentials, OWASP compliance
5. **Performance**: <100ms UI feedback, <5s AI responses, <500MB memory

---

Welcome to the team! 🚀

If you encounter any issues with this quickstart guide, please submit a PR to improve it.
