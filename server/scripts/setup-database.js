#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🚀 Setting up VaultScope Statistics Database...');

const dbPath = path.join(__dirname, '..', 'database.db');
console.log('Database path:', dbPath);

// Check if database already exists
if (fs.existsSync(dbPath)) {
  console.log('✅ Database already exists, skipping initialization');
  process.exit(0);
}

const db = new Database(dbPath);

// Enable foreign keys and WAL mode
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

console.log('Creating tables...');

// Create roles table
db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT NOT NULL DEFAULT '[]',
    is_system BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create categories table
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#666666',
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    role_id TEXT NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
  )
`);

// Create nodes table
db.exec(`
  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 4000,
    api_key TEXT,
    category_id INTEGER,
    is_active BOOLEAN DEFAULT 1,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )
`);

// Create api_keys table with all required columns
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT 1,
    last_used TEXT,
    usage_count INTEGER DEFAULT 0,
    rate_limit INTEGER DEFAULT 1000,
    expires_at TEXT,
    created_by INTEGER,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create api_key_logs table
db.exec(`
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
  )
`);

// Create alerts table
db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    condition TEXT NOT NULL,
    threshold REAL,
    node_id TEXT,
    is_active BOOLEAN DEFAULT 1,
    notification_channels TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes(id)
  )
`);

// Create alert_history table
db.exec(`
  CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL,
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    value REAL,
    message TEXT,
    FOREIGN KEY (alert_id) REFERENCES alerts(id)
  )
`);

console.log('✅ Tables created successfully');

// Insert default data
console.log('Inserting default data...');

// Insert default roles
const insertRole = db.prepare('INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system) VALUES (?, ?, ?, ?, ?)');
insertRole.run('admin', 'Administrator', 'Full system access', JSON.stringify(['*']), 1);
insertRole.run('viewer', 'Viewer', 'Read-only access', JSON.stringify(['nodes.view', 'stats.view']), 1);
insertRole.run('operator', 'Operator', 'Manage nodes and view stats', JSON.stringify(['nodes.*', 'stats.view']), 0);

// Insert default categories
const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)');
insertCategory.run('Production', '#22c55e', 'server');
insertCategory.run('Development', '#3b82f6', 'code');
insertCategory.run('Testing', '#f59e0b', 'flask');
insertCategory.run('Backup', '#8b5cf6', 'database');
insertCategory.run('Monitoring', '#ef4444', 'activity');

// Create default admin user
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const adminId = crypto.randomUUID();
const adminPassword = 'admin123'; // Default password
const passwordHash = bcrypt.hashSync(adminPassword, 10);

const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, email, name, password_hash, role_id) VALUES (?, ?, ?, ?, ?)');
insertUser.run(adminId, 'admin@vaultscope.com', 'Admin User', passwordHash, 'admin');

console.log('✅ Default data inserted');
console.log('');
console.log('📌 Default admin credentials:');
console.log('   Email: admin@vaultscope.com');
console.log('   Password: admin123');
console.log('');

// Close database
db.close();

console.log('✅ Database setup complete!');