import Database from '@tauri-apps/plugin-sql';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema';
import { logger } from '../../utils/logger';

/**
 * Database connection via tauri-plugin-sql
 * Uses drizzle-orm/sqlite-proxy to bridge the Tauri SQL plugin with Drizzle ORM
 * The actual SQLite file is managed by the Rust backend; migrations run on first load.
 */

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

let dbPromise: Promise<DrizzleDB> | null = null;

/**
 * Get (or lazily initialise) the Drizzle database instance.
 * Safe to call multiple times — returns the same Promise after the first call.
 */
export async function getDatabase(): Promise<DrizzleDB> {
  if (!dbPromise) {
    dbPromise = createDatabase();
  }
  return dbPromise;
}

async function createDatabase(): Promise<DrizzleDB> {
  logger.debug('Initializing SQLite database connection');
  const sqlite = await Database.load('sqlite:servicenow_bridge.db');
  logger.info('SQLite database connection established', { db: 'servicenow_bridge.db' });

  const db = drizzle<typeof schema>(
    async (sql, params, method) => {
      if (method === 'run') {
        await sqlite.execute(sql, params as unknown[]);
        return { rows: [] };
      }

      // 'all', 'get', 'values' — plugin returns array of row objects
      const rows = await sqlite.select<Record<string, unknown>[]>(
        sql,
        params as unknown[]
      );
      return { rows: rows.map((row) => Object.values(row)) };
    },
    { schema }
  );

  return db;
}

/** Reset the singleton (useful in tests) */
export function resetDatabase(): void {
  logger.debug('Resetting database connection singleton');
  dbPromise = null;
}

export { schema };
