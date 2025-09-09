import fs from 'fs';
import path from 'path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from '../db';
import { roles, categories, users, nodes, apiKeys } from '../db';
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
      : path.join(process.cwd(), 'database.db');
    
    this.stateFile = process.env.NODE_ENV === 'production'
      ? '/var/www/vaultscope-statistics/.db-initialized'
      : path.join(process.cwd(), '.db-initialized');
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
    console.log(`${colors.cyan}[DB-INIT]${colors.reset} Running database migrations...`);
    
    try {
      // Ensure migrations directory exists
      const migrationsPath = './server/db/migrations';
      if (!fs.existsSync(migrationsPath)) {
        console.log(`${colors.yellow}[DB-INIT]${colors.reset} Creating migrations directory...`);
        fs.mkdirSync(migrationsPath, { recursive: true });
      }

      // Run Drizzle migrations
      await migrate(db, { migrationsFolder: migrationsPath });
      console.log(`${colors.green}[DB-INIT]${colors.reset} Database migrations completed`);
      return true;
    } catch (error) {
      console.error(`${colors.red}[DB-INIT]${colors.reset} Migration failed:`, error);
      
      // Try to generate migrations if they don't exist
      console.log(`${colors.yellow}[DB-INIT]${colors.reset} Attempting to generate migrations...`);
      try {
        const { execSync } = require('child_process');
        execSync('npm run db:generate', { stdio: 'inherit' });
        
        // Retry migration
        await migrate(db, { migrationsFolder: migrationsPath });
        console.log(`${colors.green}[DB-INIT]${colors.reset} Database migrations completed after generation`);
        return true;
      } catch (retryError) {
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
          firstName: 'System',
          lastName: 'Administrator',
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
      database: process.env.NODE_ENV === 'production' 
        ? '/var/www/vaultscope-statistics/database.json'
        : path.join(process.cwd(), 'database.json'),
      apiKeys: process.env.NODE_ENV === 'production'
        ? '/var/www/vaultscope-statistics/apiKeys.json'
        : path.join(process.cwd(), 'apiKeys.json')
    };
    
    let migrated = false;
    
    // Migrate database.json
    if (fs.existsSync(jsonPaths.database)) {
      console.log(`${colors.yellow}[DB-INIT]${colors.reset} Found database.json, migrating...`);
      
      try {
        const jsonData = JSON.parse(fs.readFileSync(jsonPaths.database, 'utf-8'));
        
        // Migrate users
        if (jsonData.users && jsonData.users.length > 0) {
          for (const user of jsonData.users) {
            const existingUser = await userRepository.getUserByUsername(user.username);
            
            if (!existingUser) {
              await db.insert(users).values({
                username: user.username,
                firstName: user.firstName || user.username,
                lastName: user.lastName || '',
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
          console.log(`${colors.green}[DB-INIT]${colors.reset} Users migrated from JSON`);
        }
        
        // Backup original file
        const backupPath = jsonPaths.database + '.backup-' + Date.now();
        fs.renameSync(jsonPaths.database, backupPath);
        console.log(`${colors.yellow}[DB-INIT]${colors.reset} Original database.json backed up`);
        
        migrated = true;
      } catch (error) {
        console.error(`${colors.red}[DB-INIT]${colors.reset} Failed to migrate database.json:`, error);
      }
    }
    
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
      if (!migrated && isFirstStart) {
        throw new Error('Failed to run migrations on first start');
      }

      // Step 2: Seed default data
      const seeded = await this.seedDefaultData();
      if (!seeded && isFirstStart) {
        throw new Error('Failed to seed default data on first start');
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