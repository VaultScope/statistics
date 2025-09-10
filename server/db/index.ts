import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';

// Import all schemas
import * as usersSchema from './schema/users';
import * as nodesSchema from './schema/nodes';
import * as apikeysSchema from './schema/apikeys';
import * as alertsSchema from './schema/alerts';

// Determine database path based on environment
const getDatabasePath = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  if (process.env.NODE_ENV === 'production') {
    return '/var/www/vaultscope-statistics/database.db';
  }
  
  return path.join(__dirname, '..', 'database.db');
};

// Create SQLite connection
const sqlite: Database.Database = new Database(getDatabasePath());

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL');

// Create Drizzle instance with all schemas
export const db = drizzle(sqlite, {
  schema: {
    ...usersSchema,
    ...nodesSchema,
    ...apikeysSchema,
    ...alertsSchema,
  },
});

// Export all schemas for easy access
export * from './schema/users';
export * from './schema/nodes';
export * from './schema/apikeys';
export * from './schema/alerts';

// Export the raw SQLite instance if needed
export { sqlite };

// Graceful shutdown
process.on('SIGINT', () => {
  sqlite.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  sqlite.close();
  process.exit(0);
});