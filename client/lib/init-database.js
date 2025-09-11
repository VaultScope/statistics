#!/usr/bin/env node

/**
 * Client Database Initialization
 * Automatically creates the client database.json on first start
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.json');

// Check if database already exists
if (fs.existsSync(dbPath)) {
  console.log('✅ Client database already exists');
  process.exit(0);
}

// Create default database structure
const defaultDatabase = {
  users: [],
  nodes: [],
  categories: [
    {
      id: 1,
      name: "Production",
      color: "#22c55e",
      icon: "server",
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      name: "Development",
      color: "#3b82f6",
      icon: "code",
      createdAt: new Date().toISOString()
    },
    {
      id: 3,
      name: "Testing",
      color: "#f59e0b",
      icon: "flask",
      createdAt: new Date().toISOString()
    },
    {
      id: 4,
      name: "Backup",
      color: "#8b5cf6",
      icon: "database",
      createdAt: new Date().toISOString()
    },
    {
      id: 5,
      name: "Monitoring",
      color: "#ef4444",
      icon: "activity",
      createdAt: new Date().toISOString()
    }
  ],
  roles: [
    {
      id: "admin",
      name: "Administrator",
      description: "Full system access",
      permissions: [
        "nodes.view",
        "nodes.create",
        "nodes.edit",
        "nodes.delete",
        "users.view",
        "users.create",
        "users.edit",
        "users.delete",
        "system.settings"
      ],
      isSystem: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "viewer",
      name: "Viewer",
      description: "Read-only access",
      permissions: ["nodes.view", "users.view"],
      isSystem: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "operator",
      name: "Operator",
      description: "Manage nodes",
      permissions: [
        "nodes.view",
        "nodes.create",
        "nodes.edit",
        "users.view"
      ],
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  settings: {
    theme: "light",
    refreshInterval: 30000,
    notificationsEnabled: true,
    serverUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
  }
};

// Write database file
try {
  fs.writeFileSync(dbPath, JSON.stringify(defaultDatabase, null, 2));
  console.log('✅ Client database initialized successfully');
  console.log(`   Path: ${dbPath}`);
} catch (error) {
  console.error('❌ Failed to initialize client database:', error.message);
  process.exit(1);
}