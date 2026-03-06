import type { Config } from 'drizzle-kit';

export default {
  schema: './src/core/storage/schema.ts',
  out: './src/core/storage/migrations',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: process.env.DB_PATH || './data/servicenow-mcp-bridge.db',
  },
  verbose: true,
  strict: true,
} satisfies Config;
