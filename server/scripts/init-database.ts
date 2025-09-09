#!/usr/bin/env node

import { ApiKeyRepository } from '../db/repositories/apiKeyRepository';
import { db, apiKeys } from '../db/index';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

const apiKeyRepository = new ApiKeyRepository();

interface InitialAdminKey {
  name: string;
  key: string;
  uuid: string;
}

async function initializeDatabase(): Promise<InitialAdminKey | null> {
  console.log(`${colors.cyan}[INIT]${colors.reset} Initializing production database...`);
  
  try {
    // Check if we already have any admin API keys
    const existingAdminKeys = await db.select().from(apiKeys).limit(1);
    
    if (existingAdminKeys.length > 0) {
      console.log(`${colors.yellow}[INFO]${colors.reset} Database already has API keys. Skipping initialization.`);
      return null;
    }

    // Create the initial admin API key using the repository
    const adminPermissions = {
      viewStats: true,
      createApiKey: true,
      deleteApiKey: true,
      viewApiKeys: true,
      usePowerCommands: true,
      admin: true
    };

    console.log(`${colors.cyan}[INIT]${colors.reset} Creating initial admin API key...`);

    const createdKey = await apiKeyRepository.createApiKey('Initial Admin Key', adminPermissions);

    console.log(`${colors.green}[SUCCESS]${colors.reset} Created admin API key with UUID: ${createdKey.uuid}`);
    
    return {
      name: createdKey.name,
      key: createdKey.key,
      uuid: createdKey.uuid!
    };

  } catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Failed to initialize database:`, error);
    throw error;
  }
}

async function validateDatabase() {
  console.log(`${colors.cyan}[VALIDATE]${colors.reset} Validating database structure...`);
  
  try {
    // Test if we can query the api_keys table
    await db.select().from(apiKeys).limit(1);
    console.log(`${colors.green}[SUCCESS]${colors.reset} Database structure is valid`);
  } catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Database validation failed:`, error);
    console.log(`${colors.yellow}[INFO]${colors.reset} Please run: npm run db:init-tables`);
    throw error;
  }
}

async function main() {
  try {
    // First validate the database structure exists
    await validateDatabase();
    
    // Initialize with admin key if needed
    const adminKey = await initializeDatabase();
    
    if (adminKey) {
      console.log(`\n${colors.green}${colors.bright}✓ Database initialization completed!${colors.reset}`);
      console.log(`${colors.blue}[ADMIN KEY]${colors.reset} Save this information securely:`);
      console.log(`${colors.bright}UUID:${colors.reset} ${adminKey.uuid}`);
      console.log(`${colors.bright}Key:${colors.reset} ${adminKey.key}`);
      console.log(`${colors.bright}Name:${colors.reset} ${adminKey.name}`);
      console.log(`\n${colors.yellow}[WARNING]${colors.reset} This API key will not be shown again!`);
      console.log(`${colors.cyan}[INFO]${colors.reset} Use this key for initial setup and creating additional keys`);
    } else {
      console.log(`${colors.green}${colors.bright}✓ Database already initialized${colors.reset}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}[FATAL]${colors.reset} Database initialization failed:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { initializeDatabase, validateDatabase };