import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

let db: Database.Database | null = null;

function getDb() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'client', 'app.db');
    db = new Database(dbPath);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    firstName TEXT NOT NULL,
    password TEXT NOT NULL,
    isAdmin BOOLEAN DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    apiKey TEXT NOT NULL,
    category TEXT DEFAULT 'default',
    status TEXT DEFAULT 'offline',
    lastCheck DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#ffffff',
    icon TEXT DEFAULT 'folder',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

    db.exec(`
      INSERT OR IGNORE INTO categories (name, color, icon) VALUES ('default', '#ffffff', 'folder')
`);
  }
  return db;
}

export interface User {
  id: number;
  username: string;
  firstName: string;
  password: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Node {
  id: number;
  name: string;
  url: string;
  apiKey: string;
  category: string;
  status: string;
  lastCheck: string;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
}

export const userExists = (): boolean => {
  const database = getDb();
  const stmt = database.prepare('SELECT COUNT(*) as count FROM users');
  const result = stmt.get() as { count: number };
  return result.count > 0;
};

export const createUser = async (username: string, firstName: string, password: string): Promise<User> => {
  const database = getDb();
  const hashedPassword = await bcrypt.hash(password, 10);
  const stmt = database.prepare('INSERT INTO users (username, firstName, password) VALUES (?, ?, ?)');
  const result = stmt.run(username, firstName, hashedPassword);
  
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as User;
  return user;
};

export const getUser = (username: string): User | undefined => {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username) as User | undefined;
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const getNodes = (): Node[] => {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM nodes ORDER BY name');
  return stmt.all() as Node[];
};

export const getNode = (id: number): Node | undefined => {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM nodes WHERE id = ?');
  return stmt.get(id) as Node | undefined;
};

export const createNode = (name: string, url: string, apiKey: string, category?: string): Node => {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO nodes (name, url, apiKey, category) VALUES (?, ?, ?, ?)');
  const result = stmt.run(name, url, apiKey, category || 'default');
  
  const node = database.prepare('SELECT * FROM nodes WHERE id = ?').get(result.lastInsertRowid) as Node;
  return node;
};

export const updateNode = (id: number, data: Partial<Node>): boolean => {
  const database = getDb();
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) return false;
  
  values.push(id);
  const stmt = database.prepare(`UPDATE nodes SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  
  return result.changes > 0;
};

export const deleteNode = (id: number): boolean => {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM nodes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

export const getCategories = (): Category[] => {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM categories ORDER BY name');
  return stmt.all() as Category[];
};

export const createCategory = (name: string, color?: string, icon?: string): Category => {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)');
  const result = stmt.run(name, color || '#ffffff', icon || 'folder');
  
  const category = database.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid) as Category;
  return category;
};

export const deleteCategory = (id: number): boolean => {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM categories WHERE id = ? AND name != ?');
  const result = stmt.run(id, 'default');
  return result.changes > 0;
};

export default getDb;