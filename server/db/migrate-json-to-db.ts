#!/usr/bin/env node

import { apiKeyRepository } from './repositories/apiKeyRepository';
import fs from 'fs';
import path from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

async function migrateApiKeys() {
  console.log(`${colors.cyan}[MIGRATE]${colors.reset} Checking for apiKeys.json...`);
  
  const apiKeysPath = path.join(process.cwd(), 'server', 'apiKeys.json');
  
  if (fs.existsSync(apiKeysPath)) {
    console.log(`${colors.yellow}[INFO]${colors.reset} Found apiKeys.json, migrating to database...`);
    
    try {
      const jsonData = JSON.parse(fs.readFileSync(apiKeysPath, 'utf-8'));
      
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        console.log(`${colors.yellow}[INFO]${colors.reset} Migrating ${jsonData.length} API keys...`);
        
        await apiKeyRepository.migrateFromJson(jsonData);
        
        console.log(`${colors.green}[SUCCESS]${colors.reset} API keys migrated to database`);
        
        // Backup and remove old file
        const backupPath = apiKeysPath + '.backup-' + Date.now();
        fs.renameSync(apiKeysPath, backupPath);
        console.log(`${colors.yellow}[INFO]${colors.reset} Backed up apiKeys.json to ${backupPath}`);
      }
    } catch (error) {
      console.error(`${colors.red}[ERROR]${colors.reset} Failed to migrate API keys:`, error);
    }
  } else {
    console.log(`${colors.green}[INFO]${colors.reset} No apiKeys.json found - already using database`);
  }
}

async function removeApiLogs() {
  console.log(`${colors.cyan}[CLEANUP]${colors.reset} Checking for apiLogs.json...`);
  
  const apiLogsPath = path.join(process.cwd(), 'server', 'apiLogs.json');
  
  if (fs.existsSync(apiLogsPath)) {
    console.log(`${colors.yellow}[INFO]${colors.reset} Found apiLogs.json, removing (logs are now in database)...`);
    
    // Backup and remove old file
    const backupPath = apiLogsPath + '.backup-' + Date.now();
    fs.renameSync(apiLogsPath, backupPath);
    console.log(`${colors.yellow}[INFO]${colors.reset} Backed up apiLogs.json to ${backupPath}`);
  } else {
    console.log(`${colors.green}[INFO]${colors.reset} No apiLogs.json found - already using database`);
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}JSON to Database Migration${colors.reset}`);
  console.log('==========================\n');
  
  await migrateApiKeys();
  await removeApiLogs();
  
  console.log(`\n${colors.green}${colors.bright}✓ Migration complete!${colors.reset}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(`${colors.red}[FATAL]${colors.reset} Migration failed:`, error);
  process.exit(1);
});