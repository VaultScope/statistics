#!/usr/bin/env node

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './index';
import { userRepository } from './repositories/userRepository';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

async function runMigrations() {
  console.log(`${colors.cyan}[MIGRATION]${colors.reset} Running database migrations...`);
  
  try {
    // Run Drizzle migrations
    await migrate(db, { migrationsFolder: './server/db/migrations' });
    console.log(`${colors.green}[SUCCESS]${colors.reset} Database migrations completed`);
  } catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Migration failed:`, error);
    process.exit(1);
  }
}

async function seedDefaultData() {
  console.log(`${colors.cyan}[SEED]${colors.reset} Seeding default data...`);
  
  try {
    // Check if roles exist
    const existingRoles = await db.select().from(roles);
    
    if (existingRoles.length === 0) {
      console.log(`${colors.yellow}[INFO]${colors.reset} Creating default roles...`);
      
      const defaultRoles = [
        {
          id: 'admin',
          name: 'Administrator',
          description: 'Full system access',
          permissions: JSON.stringify([
            'nodes.view', 'nodes.create', 'nodes.edit', 'nodes.delete', 'nodes.power',
            'users.view', 'users.create', 'users.edit', 'users.delete', 'users.roles',
            'apikeys.view', 'apikeys.create', 'apikeys.edit', 'apikeys.delete', 'apikeys.logs',
            'system.roles', 'system.permissions', 'system.settings', 'system.categories',
            'monitoring.hardware', 'monitoring.process', 'monitoring.network', 'monitoring.overview',
            'alerts.view', 'alerts.create', 'alerts.edit', 'alerts.delete'
          ]),
          isSystem: true,
        },
        {
          id: 'manager',
          name: 'Manager',
          description: 'Manage nodes and API keys',
          permissions: JSON.stringify([
            'nodes.view', 'nodes.create', 'nodes.edit',
            'apikeys.view', 'apikeys.create', 'apikeys.edit', 'apikeys.logs',
            'monitoring.hardware', 'monitoring.process', 'monitoring.network', 'monitoring.overview',
            'system.categories', 'alerts.view', 'alerts.create', 'alerts.edit'
          ]),
          isSystem: true,
        },
        {
          id: 'operator',
          name: 'Operator',
          description: 'Monitor and operate nodes',
          permissions: JSON.stringify([
            'nodes.view', 'nodes.power',
            'monitoring.hardware', 'monitoring.process', 'monitoring.network', 'monitoring.overview',
            'apikeys.view', 'apikeys.logs', 'alerts.view'
          ]),
          isSystem: true,
        },
        {
          id: 'viewer',
          name: 'Viewer',
          description: 'Read-only access',
          permissions: JSON.stringify([
            'nodes.view', 'monitoring.hardware', 'monitoring.overview'
          ]),
          isSystem: true,
        }
      ];
      
      for (const role of defaultRoles) {
        await db.insert(roles).values(role);
      }
      
      console.log(`${colors.green}[SUCCESS]${colors.reset} Default roles created`);
    }
    
    // Check if categories exist
    const existingCategories = await db.select().from(categories);
    
    if (existingCategories.length === 0) {
      console.log(`${colors.yellow}[INFO]${colors.reset} Creating default categories...`);
      
      const defaultCategories = [
        { name: 'Production', color: '#22c55e', icon: 'server', order: 1 },
        { name: 'Development', color: '#3b82f6', icon: 'code', order: 2 },
        { name: 'Testing', color: '#f59e0b', icon: 'flask', order: 3 },
        { name: 'Backup', color: '#8b5cf6', icon: 'database', order: 4 },
        { name: 'Monitoring', color: '#ef4444', icon: 'activity', order: 5 }
      ];
      
      for (const category of defaultCategories) {
        await db.insert(categories).values(category);
      }
      
      console.log(`${colors.green}[SUCCESS]${colors.reset} Default categories created`);
    }
    
  } catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Seeding failed:`, error);
    process.exit(1);
  }
}

async function migrateJsonData() {
  console.log(`${colors.cyan}[MIGRATE]${colors.reset} Checking for existing JSON data...`);
  
  const jsonPaths = {
    database: process.env.NODE_ENV === 'production' 
      ? '/var/www/vaultscope-statistics/database.json'
      : path.join(process.cwd(), 'database.json'),
    apiKeys: process.env.NODE_ENV === 'production'
      ? '/var/www/vaultscope-statistics/apiKeys.json'
      : path.join(process.cwd(), 'apiKeys.json')
  };
  
  // Migrate database.json
  if (fs.existsSync(jsonPaths.database)) {
    console.log(`${colors.yellow}[INFO]${colors.reset} Found database.json, migrating...`);
    
    try {
      const jsonData = JSON.parse(fs.readFileSync(jsonPaths.database, 'utf-8'));
      
      // Migrate users
      if (jsonData.users && jsonData.users.length > 0) {
        console.log(`${colors.yellow}[INFO]${colors.reset} Migrating ${jsonData.users.length} users...`);
        
        for (const user of jsonData.users) {
          const existingUser = await userRepository.getUserByUsername(user.username);
          
          if (!existingUser) {
            await db.insert(users).values({
              username: user.username,
              firstName: user.firstName || user.username,
              password: user.password, // Already hashed
              roleId: user.roleId || user.role || 'viewer',
              email: user.email || null,
              isActive: user.isActive !== false,
              lastLogin: user.lastLogin || null,
              createdAt: user.createdAt || new Date().toISOString(),
              updatedAt: user.createdAt || new Date().toISOString(),
            });
          }
        }
        
        console.log(`${colors.green}[SUCCESS]${colors.reset} Users migrated`);
      }
      
      // Migrate nodes
      if (jsonData.nodes && jsonData.nodes.length > 0) {
        console.log(`${colors.yellow}[INFO]${colors.reset} Migrating ${jsonData.nodes.length} nodes...`);
        
        for (const node of jsonData.nodes) {
          // Find category ID
          let categoryId = null;
          if (node.category) {
            const [category] = await db.select().from(categories)
              .where(eq(categories.name, node.category));
            categoryId = category?.id || null;
          }
          
          await db.insert(nodes).values({
            name: node.name,
            url: node.url,
            apiKey: node.apiKey || null,
            categoryId,
            status: node.status || 'offline',
            lastCheck: node.lastCheck || null,
            createdAt: node.createdAt || new Date().toISOString(),
            updatedAt: node.createdAt || new Date().toISOString(),
          });
        }
        
        console.log(`${colors.green}[SUCCESS]${colors.reset} Nodes migrated`);
      }
      
      // Backup original file
      const backupPath = jsonPaths.database + '.backup-' + Date.now();
      fs.renameSync(jsonPaths.database, backupPath);
      console.log(`${colors.yellow}[INFO]${colors.reset} Original database.json backed up to ${backupPath}`);
      
    } catch (error) {
      console.error(`${colors.red}[ERROR]${colors.reset} Failed to migrate database.json:`, error);
    }
  }
  
  // Migrate apiKeys.json
  if (fs.existsSync(jsonPaths.apiKeys)) {
    console.log(`${colors.yellow}[INFO]${colors.reset} Found apiKeys.json, migrating...`);
    
    try {
      const apiKeysData = JSON.parse(fs.readFileSync(jsonPaths.apiKeys, 'utf-8'));
      
      if (Array.isArray(apiKeysData) && apiKeysData.length > 0) {
        console.log(`${colors.yellow}[INFO]${colors.reset} Migrating ${apiKeysData.length} API keys...`);
        
        for (const apiKey of apiKeysData) {
          await db.insert(apiKeys).values({
            uuid: apiKey.uuid || apiKey.id || uuidv4(),
            name: apiKey.name || 'Unnamed Key',
            key: apiKey.key,
            permissions: JSON.stringify(apiKey.permissions || {}),
            isActive: true,
            createdAt: apiKey.createdAt || new Date().toISOString(),
            updatedAt: apiKey.createdAt || new Date().toISOString(),
          });
        }
        
        console.log(`${colors.green}[SUCCESS]${colors.reset} API keys migrated`);
      }
      
      // Backup original file
      const backupPath = jsonPaths.apiKeys + '.backup-' + Date.now();
      fs.renameSync(jsonPaths.apiKeys, backupPath);
      console.log(`${colors.yellow}[INFO]${colors.reset} Original apiKeys.json backed up to ${backupPath}`);
      
    } catch (error) {
      console.error(`${colors.red}[ERROR]${colors.reset} Failed to migrate apiKeys.json:`, error);
    }
  }
}

// Import schemas
import { roles, categories, users, nodes, apiKeys } from './index';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log(`${colors.bright}${colors.cyan}VaultScope Statistics - Database Migration Tool${colors.reset}`);
  console.log('================================================\n');
  
  // Run migrations
  await runMigrations();
  
  // Seed default data
  await seedDefaultData();
  
  // Migrate existing JSON data
  await migrateJsonData();
  
  console.log(`\n${colors.green}${colors.bright}✓ Database setup complete!${colors.reset}`);
  
  // Close database connection
  sqlite.close();
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(`${colors.red}[FATAL]${colors.reset} Migration failed:`, error);
    process.exit(1);
  });
}

export { runMigrations, seedDefaultData, migrateJsonData };