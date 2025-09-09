#!/usr/bin/env node

import { sqlite } from './index';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

async function createTables() {
  console.log(`${colors.cyan}[INIT]${colors.reset} Creating database tables...`);
  
  try {
    // Create api_keys table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE,
        permissions TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        last_used TEXT,
        usage_count INTEGER DEFAULT 0,
        rate_limit INTEGER DEFAULT 1000,
        expires_at TEXT,
        created_by INTEGER,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log(`${colors.green}[SUCCESS]${colors.reset} Created api_keys table`);
    
    // Create api_key_logs table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS api_key_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_key_id INTEGER NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER,
        response_time INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        error_message TEXT,
        request_body TEXT,
        response_size INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
      )
    `);
    console.log(`${colors.green}[SUCCESS]${colors.reset} Created api_key_logs table`);
    
    // Create indexes
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_uuid ON api_keys(uuid)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_api_key_logs_api_key_id ON api_key_logs(api_key_id)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_api_key_logs_timestamp ON api_key_logs(created_at)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_api_key_logs_path ON api_key_logs(path)`);
    console.log(`${colors.green}[SUCCESS]${colors.reset} Created indexes`);
    
    console.log(`${colors.green}${colors.bright}✓ Database tables created successfully!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Failed to create tables:`, error);
    process.exit(1);
  }
}

createTables().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(`${colors.red}[FATAL]${colors.reset} Database initialization failed:`, error);
  process.exit(1);
});