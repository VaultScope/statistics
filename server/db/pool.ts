import Database from 'better-sqlite3';
import path from 'path';

interface ConnectionPoolOptions {
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
}

class SQLiteConnectionPool {
  private connections: Database.Database[] = [];
  private availableConnections: Database.Database[] = [];
  private waitingQueue: Array<(conn: Database.Database) => void> = [];
  private options: Required<ConnectionPoolOptions>;
  private dbPath: string;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(dbPath: string, options: ConnectionPoolOptions = {}) {
    this.dbPath = dbPath;
    this.options = {
      max: options.max || 10,
      min: options.min || 2,
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      acquireTimeoutMillis: options.acquireTimeoutMillis || 30000
    };

    this.initialize();
  }

  private initialize() {
    // Create minimum connections
    for (let i = 0; i < this.options.min; i++) {
      this.createConnection();
    }

    // Setup cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.options.idleTimeoutMillis);
  }

  private createConnection(): Database.Database {
    const conn = new Database(this.dbPath);
    
    // Optimize connection settings
    conn.pragma('foreign_keys = ON');
    conn.pragma('journal_mode = WAL');
    conn.pragma('synchronous = NORMAL');
    conn.pragma('cache_size = -64000'); // 64MB cache
    conn.pragma('temp_store = MEMORY');
    conn.pragma('mmap_size = 30000000000'); // 30GB mmap
    conn.pragma('page_size = 4096');
    conn.pragma('optimize');
    
    this.connections.push(conn);
    this.availableConnections.push(conn);
    
    return conn;
  }

  async acquire(): Promise<Database.Database> {
    // Return available connection
    if (this.availableConnections.length > 0) {
      return this.availableConnections.pop()!;
    }

    // Create new connection if under max limit
    if (this.connections.length < this.options.max) {
      const conn = this.createConnection();
      this.availableConnections.splice(this.availableConnections.indexOf(conn), 1);
      return conn;
    }

    // Wait for connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.indexOf(resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.options.acquireTimeoutMillis);

      this.waitingQueue.push((conn: Database.Database) => {
        clearTimeout(timeout);
        resolve(conn);
      });
    });
  }

  release(connection: Database.Database) {
    // Give connection to waiting request or return to pool
    if (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift()!;
      resolve(connection);
    } else {
      this.availableConnections.push(connection);
    }
  }

  async execute<T>(fn: (db: Database.Database) => T): Promise<T> {
    const conn = await this.acquire();
    try {
      return fn(conn);
    } finally {
      this.release(conn);
    }
  }

  async transaction<T>(fn: (db: Database.Database) => T): Promise<T> {
    return this.execute(db => {
      return db.transaction(fn as any)();
    });
  }

  private cleanup() {
    // Remove excess idle connections
    while (this.availableConnections.length > this.options.min) {
      const conn = this.availableConnections.pop()!;
      const index = this.connections.indexOf(conn);
      if (index !== -1) {
        this.connections.splice(index, 1);
        conn.close();
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const conn of this.connections) {
      try {
        conn.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }

    this.connections = [];
    this.availableConnections = [];
    this.waitingQueue = [];
  }

  getStats() {
    return {
      total: this.connections.length,
      available: this.availableConnections.length,
      waiting: this.waitingQueue.length,
      active: this.connections.length - this.availableConnections.length
    };
  }
}

// Create singleton pool instance
const dbPath = process.env.NODE_ENV === 'production'
  ? '/var/www/vaultscope-statistics/database.db'
  : path.join(process.cwd(), 'database.db');

const pool = new SQLiteConnectionPool(dbPath, {
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  idleTimeoutMillis: 30000,
  acquireTimeoutMillis: 30000
});

export default pool;