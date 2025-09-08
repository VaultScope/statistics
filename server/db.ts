import Database from 'better-sqlite3';
import path from 'path';

// Database path based on environment
const dbPath = process.env.NODE_ENV === 'production'
  ? '/var/www/vaultscope-statistics/database.db'
  : path.join(process.cwd(), 'database.db');

// Create database instance
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode
db.pragma('journal_mode = WAL');

export default db;