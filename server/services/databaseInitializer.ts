import fs from 'fs';
import path from 'path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from '../db/index';
import { roles, categories, users, nodes, apiKeys } from '../db/index';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { userRepository } from '../db/repositories/userRepository';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

interface InitializationResult {
  success: boolean;
  message: string;
  details?: {
    migrated: boolean;
    seeded: boolean;
    jsonMigrated: boolean;
    firstTimeSetup: boolean;
    adminKeyCreated?: string;
  };
}

class DatabaseInitializer {
  private static instance: DatabaseInitializer;
  private initialized: boolean = false;
  private dbPath: string;
  private stateFile: string;

  private constructor() {
    this.dbPath = process.env.NODE_ENV === 'production' 
      ? '/var/www/vaultscope-statistics/database.db'
      : path.join(__dirname, '..', 'database.db');
    
    this.stateFile = process.env.NODE_ENV === 'production'
      ? '/var/www/vaultscope-statistics/.db-initialized'
      : path.join(__dirname, '..', '.db-initialized');
  }

  public static getInstance(): DatabaseInitializer {
    if (!DatabaseInitializer.instance) {
      DatabaseInitializer.instance = new DatabaseInitializer();
    }
    return DatabaseInitializer.instance;
  }

  /**
   * Check if this is the first time the application is starting
   */
  private isFirstStart(): boolean {
    // Check if database file exists
    const dbExists = fs.existsSync(this.dbPath);
    
    // Check if initialization state file exists
    const stateExists = fs.existsSync(this.stateFile);
    
    return !dbExists || !stateExists;
  }

  /**
   * Save initialization state
   */
  private saveInitializationState(): void {
    const state = {
      initialized: true,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
    
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<boolean> {
    console.log(`${colors.cyan}[DB-INIT]${colors.reset} Checking database schema...`);
    
    try {
      // Get the raw SQLite database instance
      const { sqlite } = require('../db');
      
      // Check if tables already exist
      const tablesExist = sqlite.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number };
      
      if (tablesExist && tablesExist.count > 5) { // More than just a few tables
        console.log(`${colors.green}[DB-INIT]${colors.reset} Database schema already exists (${tablesExist.count} tables found)`);
        return true;
      }
      
      // Try to run init.sql first
      const initSqlPath = path.join(__dirname, '..', 'db', 'init.sql');
      if (fs.existsSync(initSqlPath)) {
        console.log(`${colors.yellow}[DB-INIT]${colors.reset} Running database initialization script...`);
        const initSql = fs.readFileSync(initSqlPath, 'utf-8');
        
        // Execute the init SQL
        try {
          sqlite.exec(initSql);
          console.log(`${colors.green}[DB-INIT]${colors.reset} Database schema created successfully`);
          return true;
        } catch (sqlError: any) {
          if (sqlError.message?.includes('already exists')) {
            console.log(`${colors.yellow}[DB-INIT]${colors.reset} Some tables already exist, continuing...`);
            return true;
          }
          throw sqlError;
        }
      }
      
      // Fallback to migrations if init.sql doesn't exist
      const migrationsPath = path.join(__dirname, '..', 'db', 'migrations');
      if (fs.existsSync(path.join(migrationsPath, '0000_glorious_queen_noir.sql'))) {
        console.log(`${colors.yellow}[DB-INIT]${colors.reset} Running migration file...`);
        const migrationSql = fs.readFileSync(path.join(migrationsPath, '0000_glorious_queen_noir.sql'), 'utf-8');
        const statements = migrationSql.split('-->').map(s => s.replace('statement-breakpoint', '').trim()).filter(s => s);
        
        for (const stmt of statements) {
          try {
            sqlite.exec(stmt);
          } catch (e: any) {
            if (!e.message?.includes('already exists')) {
              console.error(`${colors.red}[DB-INIT]${colors.reset} Migration statement failed:`, e.message);
            }
          }
        }
        console.log(`${colors.green}[DB-INIT]${colors.reset} Database migrations completed`);
        return true;
      }
      
      console.log(`${colors.yellow}[DB-INIT]${colors.reset} No migration files found, database may not be fully initialized`);
      return false;
    } catch (error: any) {
      // If tables already exist error, that's okay
      if (error.message?.includes('already exists')) {
        console.log(`${colors.yellow}[DB-INIT]${colors.reset} Tables already exist, skipping migrations`);
        return true;
      }
      
      console.error(`${colors.red}[DB-INIT]${colors.reset} Migration failed:`, error);
      
      // Try to generate migrations if they don't exist
      console.log(`${colors.yellow}[DB-INIT]${colors.reset} Attempting to generate migrations...`);
      try {
        const { execSync } = require('child_process');
        execSync('npm run db:generate', { stdio: 'inherit' });
        
        // Retry migration
        await migrate(db, { migrationsFolder: './server/db/migrations' });
        console.log(`${colors.green}[DB-INIT]${colors.reset} Database migrations completed after generation`);
        return true;
      } catch (retryError: any) {
        // Again, if tables exist, that's fine
        if (retryError.message?.includes('already exists')) {
          console.log(`${colors.yellow}[DB-INIT]${colors.reset} Tables created, continuing...`);
          return true;
        }
        console.error(`${colors.red}[DB-INIT]${colors.reset} Failed to generate and run migrations:`, retryError);
        return false;
      }
    }
  }

  /**
   * Seed default data
   */
  private async seedDefaultData(): Promise<boolean> {
    console.log(`${colors.cyan}[DB-INIT]${colors.reset} Seeding default data...`);
    
    try {
      // Check and create default roles
      const existingRoles = await db.select().from(roles);
      
      if (existingRoles.length === 0) {
        console.log(`${colors.yellow}[DB-INIT]${colors.reset} Creating default roles...`);
        
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
        
        console.log(`${colors.green}[DB-INIT]${colors.reset} Default roles created`);
      }
      
      // Check and create default categories
      const existingCategories = await db.select().from(categories);
      
      if (existingCategories.length === 0) {
        console.log(`${colors.yellow}[DB-INIT]${colors.reset} Creating default categories...`);
        
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
        
        console.log(`${colors.green}[DB-INIT]${colors.reset} Default categories created`);
      }
      
      return true;
    } catch (error) {
      console.error(`${colors.red}[DB-INIT]${colors.reset} Seeding failed:`, error);
      return false;
    }
  }

  /**
   * Create initial admin user and API key
   */
  private async createInitialAdmin(): Promise<string | null> {
    console.log(`${colors.cyan}[DB-INIT]${colors.reset} Creating initial admin user...`);
    
    try {
      // Check if any users exist
      const existingUsers = await db.select().from(users);
      
      if (existingUsers.length === 0) {
        // Create default admin user
        const adminPassword = this.generateSecurePassword();
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        
        await db.insert(users).values({
          username: 'admin',
          firstName: 'Administrator',
          password: hashedPassword,
          roleId: 'admin',
          email: 'admin@localhost',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`${colors.green}[DB-INIT]${colors.reset} Admin user created`);
        console.log(`${colors.bright}${colors.yellow}═══════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}  ADMIN CREDENTIALS (Save these securely!)${colors.reset}`);
        console.log(`${colors.bright}${colors.yellow}═══════════════════════════════════════════════════════${colors.reset}`);
        console.log(`  Username: ${colors.bright}admin${colors.reset}`);
        console.log(`  Password: ${colors.bright}${adminPassword}${colors.reset}`);
        console.log(`${colors.bright}${colors.yellow}═══════════════════════════════════════════════════════${colors.reset}\n`);
      }
      
      // Check if any API keys exist
      const existingApiKeys = await db.select().from(apiKeys);
      
      if (existingApiKeys.length === 0) {
        // Create initial admin API key
        const apiKeyValue = this.generateApiKey();
        const apiKeyId = uuidv4();
        
        await db.insert(apiKeys).values({
          uuid: apiKeyId,
          name: 'Initial Admin Key',
          key: apiKeyValue,
          permissions: JSON.stringify({
            viewStats: true,
            createApiKey: true,
            deleteApiKey: true,
            viewApiKeys: true,
            usePowerCommands: true,
            admin: true
          }),
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`${colors.green}[DB-INIT]${colors.reset} Admin API key created`);
        console.log(`${colors.bright}${colors.yellow}═══════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}  ADMIN API KEY (Save this securely!)${colors.reset}`);
        console.log(`${colors.bright}${colors.yellow}═══════════════════════════════════════════════════════${colors.reset}`);
        console.log(`  ${colors.bright}${apiKeyValue}${colors.reset}`);
        console.log(`${colors.bright}${colors.yellow}═══════════════════════════════════════════════════════${colors.reset}\n`);
        
        return apiKeyValue;
      }
      
      return null;
    } catch (error) {
      console.error(`${colors.red}[DB-INIT]${colors.reset} Failed to create initial admin:`, error);
      return null;
    }
  }

  /**
   * Generate a secure random password
   */
  private generateSecurePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  /**
   * Generate an API key
   */
  private generateApiKey(): string {
    const prefix = 'vss_';
    const length = 32;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = prefix;
    
    for (let i = 0; i < length; i++) {
      key += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return key;
  }

  /**
   * Migrate existing JSON data
   */
  private async migrateJsonData(): Promise<boolean> {
    console.log(`${colors.cyan}[DB-INIT]${colors.reset} Checking for existing JSON data...`);
    
    const jsonPaths = {
      // Server no longer migrates from client's database.json since they're separate apps
      apiKeys: process.env.NODE_ENV === 'production'
        ? '/var/www/vaultscope-statistics/apiKeys.json'
        : path.join(__dirname, '..', 'apiKeys.json')
    };
    
    let migrated = false;
    
    // Migrate apiKeys.json
    if (fs.existsSync(jsonPaths.apiKeys)) {
      console.log(`${colors.yellow}[DB-INIT]${colors.reset} Found apiKeys.json, migrating...`);
      
      try {
        const apiKeysData = JSON.parse(fs.readFileSync(jsonPaths.apiKeys, 'utf-8'));
        
        if (Array.isArray(apiKeysData) && apiKeysData.length > 0) {
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
          console.log(`${colors.green}[DB-INIT]${colors.reset} API keys migrated from JSON`);
        }
        
        // Backup original file
        const backupPath = jsonPaths.apiKeys + '.backup-' + Date.now();
        fs.renameSync(jsonPaths.apiKeys, backupPath);
        console.log(`${colors.yellow}[DB-INIT]${colors.reset} Original apiKeys.json backed up`);
        
        migrated = true;
      } catch (error) {
        console.error(`${colors.red}[DB-INIT]${colors.reset} Failed to migrate apiKeys.json:`, error);
      }
    }
    
    return migrated;
  }

  /**
   * Initialize the database
   */
  public async initialize(): Promise<InitializationResult> {
    if (this.initialized) {
      return {
        success: true,
        message: 'Database already initialized',
        details: {
          migrated: false,
          seeded: false,
          jsonMigrated: false,
          firstTimeSetup: false
        }
      };
    }

    console.log(`${colors.bright}${colors.cyan}╔══════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║      VaultScope Statistics - Database Initializer     ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚══════════════════════════════════════════════════════╝${colors.reset}\n`);

    const isFirstStart = this.isFirstStart();
    
    if (isFirstStart) {
      console.log(`${colors.bright}${colors.yellow}[DB-INIT] First time setup detected!${colors.reset}`);
    } else {
      console.log(`${colors.green}[DB-INIT] Database already initialized${colors.reset}`);
    }

    try {
      // Step 1: Run migrations
      const migrated = await this.runMigrations();
      // Allow initialization to continue even if migrations fail
      // This handles cases where tables already exist
      if (!migrated && isFirstStart) {
        console.log(`${colors.yellow}[DB-INIT] Migrations skipped or failed, continuing with existing schema${colors.reset}`);
      }

      // Step 2: Seed default data
      const seeded = await this.seedDefaultData();
      if (!seeded && isFirstStart) {
        console.log(`${colors.yellow}[DB-INIT] Seeding skipped or failed, continuing...${colors.reset}`);
      }

      // Step 3: Migrate existing JSON data
      const jsonMigrated = await this.migrateJsonData();

      // Step 4: Create initial admin (only on first start)
      let adminKeyCreated: string | null = null;
      if (isFirstStart) {
        adminKeyCreated = await this.createInitialAdmin();
      }

      // Save initialization state
      if (isFirstStart) {
        this.saveInitializationState();
      }

      this.initialized = true;

      console.log(`${colors.bright}${colors.green}[DB-INIT] ✓ Database initialization complete!${colors.reset}\n`);

      return {
        success: true,
        message: isFirstStart ? 'First-time database setup completed successfully' : 'Database verified and ready',
        details: {
          migrated,
          seeded,
          jsonMigrated,
          firstTimeSetup: isFirstStart,
          adminKeyCreated: adminKeyCreated || undefined
        }
      };
    } catch (error: any) {
      console.error(`${colors.bright}${colors.red}[DB-INIT] ✗ Database initialization failed!${colors.reset}`, error);
      
      return {
        success: false,
        message: `Database initialization failed: ${error.message}`,
        details: {
          migrated: false,
          seeded: false,
          jsonMigrated: false,
          firstTimeSetup: isFirstStart
        }
      };
    }
  }

  /**
   * Check if database is healthy
   */
  public async checkHealth(): Promise<boolean> {
    try {
      // Simple query to check if database is accessible
      await db.select().from(roles).limit(1);
      return true;
    } catch (error) {
      console.error(`${colors.red}[DB-INIT]${colors.reset} Database health check failed:`, error);
      return false;
    }
  }

  /**
   * Reset database (for development/testing)
   */
  public async reset(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database reset is not allowed in production');
    }

    console.log(`${colors.yellow}[DB-INIT]${colors.reset} Resetting database...`);
    
    // Remove database file
    if (fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
    }
    
    // Remove state file
    if (fs.existsSync(this.stateFile)) {
      fs.unlinkSync(this.stateFile);
    }
    
    this.initialized = false;
    
    console.log(`${colors.green}[DB-INIT]${colors.reset} Database reset complete`);
  }
}

export default DatabaseInitializer.getInstance();
export { DatabaseInitializer, InitializationResult };