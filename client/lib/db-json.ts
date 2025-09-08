import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { DEFAULT_ROLES } from './permissions';

const dbPath = path.join(process.cwd(), 'database.json');

interface Database {
  users: User[];
  nodes: Node[];
  categories: Category[];
  roles: Role[];
}

export interface User {
  id: number;
  username: string;
  firstName: string;
  password: string;
  roleId: string; // Changed from role to roleId
  email?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
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

function getDb(createIfNotExists: boolean = true): Database {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf-8');
      const parsedData = JSON.parse(data);
      
      // Validate and migrate database structure
      const db: Database = {
        users: parsedData.users || [],
        nodes: parsedData.nodes || [],
        categories: parsedData.categories || [
          { id: 1, name: 'default', color: '#ffffff', icon: 'folder', createdAt: new Date().toISOString() }
        ],
        roles: parsedData.roles || DEFAULT_ROLES
      };
      
      // Save the migrated/validated structure back if needed
      if (!parsedData.users || !parsedData.nodes || !parsedData.categories || !parsedData.roles) {
        saveDb(db);
      }
      
      return db;
    }
  } catch (error) {
    if (createIfNotExists) {
      console.log('Creating new database...');
    }
  }
  
  const defaultDb: Database = {
    users: [],
    nodes: [],
    categories: [
      { id: 1, name: 'default', color: '#ffffff', icon: 'folder', createdAt: new Date().toISOString() }
    ],
    roles: DEFAULT_ROLES
  };
  
  if (createIfNotExists) {
    saveDb(defaultDb);
  }
  return defaultDb;
}

function saveDb(db: Database): void {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

export const userExists = (): boolean => {
  try {
    // Check if database file even exists first
    if (!fs.existsSync(dbPath)) {
      return false;
    }
    // Don't create database file when just checking
    const db = getDb(false);
    return db.users && db.users.length > 0;
  } catch (error) {
    console.error('Error checking if user exists:', error);
    return false;
  }
};

export const createUser = async (
  username: string, 
  firstName: string, 
  password: string,
  roleId: string = 'viewer',
  email?: string
): Promise<User> => {
  const db = getDb();
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // First user is always admin
  const isFirstUser = db.users.length === 0;
  
  const user: User = {
    id: db.users.length + 1,
    username,
    firstName,
    password: hashedPassword,
    roleId: isFirstUser ? 'admin' : roleId,
    email,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  
  db.users.push(user);
  saveDb(db);
  
  return user;
};

export const getUser = (username: string): User | undefined => {
  const db = getDb();
  return db.users.find(u => u.username === username);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const getNodes = (): Node[] => {
  const db = getDb();
  return db.nodes.sort((a, b) => a.name.localeCompare(b.name));
};

export const getNode = (id: number): Node | undefined => {
  const db = getDb();
  return db.nodes.find(n => n.id === id);
};

export const createNode = (name: string, url: string, apiKey: string, category?: string): Node => {
  const db = getDb();
  
  const node: Node = {
    id: Math.max(0, ...db.nodes.map(n => n.id)) + 1,
    name,
    url,
    apiKey,
    category: category || 'default',
    status: 'offline',
    lastCheck: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  
  db.nodes.push(node);
  saveDb(db);
  
  return node;
};

export const updateNode = (id: number, data: Partial<Node>): boolean => {
  const db = getDb();
  const index = db.nodes.findIndex(n => n.id === id);
  
  if (index === -1) return false;
  
  db.nodes[index] = { ...db.nodes[index], ...data };
  saveDb(db);
  
  return true;
};

export const deleteNode = (id: number): boolean => {
  const db = getDb();
  const index = db.nodes.findIndex(n => n.id === id);
  
  if (index === -1) return false;
  
  db.nodes.splice(index, 1);
  saveDb(db);
  
  return true;
};

export const getCategories = (): Category[] => {
  const db = getDb();
  return db.categories.sort((a, b) => a.name.localeCompare(b.name));
};

export const createCategory = (name: string, color?: string, icon?: string): Category => {
  const db = getDb();
  
  const category: Category = {
    id: Math.max(0, ...db.categories.map(c => c.id)) + 1,
    name,
    color: color || '#ffffff',
    icon: icon || 'folder',
    createdAt: new Date().toISOString()
  };
  
  db.categories.push(category);
  saveDb(db);
  
  return category;
};

export const deleteCategory = (id: number): boolean => {
  const db = getDb();
  const index = db.categories.findIndex(c => c.id === id && c.name !== 'default');
  
  if (index === -1) return false;
  
  db.categories.splice(index, 1);
  saveDb(db);
  
  return true;
};

// Additional user management functions
export const getAllUsers = (): User[] => {
  const db = getDb();
  return db.users;
};

export const getUserById = (id: number): User | undefined => {
  const db = getDb();
  return db.users.find(u => u.id === id);
};

export const updateUser = (id: number, updates: Partial<User>): boolean => {
  const db = getDb();
  const userIndex = db.users.findIndex(u => u.id === id);
  
  if (userIndex === -1) return false;
  
  // Don't allow updating certain fields
  const { id: _, password: __, ...safeUpdates } = updates;
  
  db.users[userIndex] = {
    ...db.users[userIndex],
    ...safeUpdates
  };
  
  saveDb(db);
  return true;
};

export const updateUserPassword = async (id: number, newPassword: string): Promise<boolean> => {
  const db = getDb();
  const userIndex = db.users.findIndex(u => u.id === id);
  
  if (userIndex === -1) return false;
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  db.users[userIndex].password = hashedPassword;
  
  saveDb(db);
  return true;
};

export const deleteUser = (id: number): boolean => {
  const db = getDb();
  
  // Don't delete the last admin
  const user = db.users.find(u => u.id === id);
  if (user?.roleId === 'admin') {
    const adminCount = db.users.filter(u => u.roleId === 'admin').length;
    if (adminCount <= 1) return false;
  }
  
  const index = db.users.findIndex(u => u.id === id);
  if (index === -1) return false;
  
  db.users.splice(index, 1);
  saveDb(db);
  
  return true;
};

export const updateLastLogin = (username: string): void => {
  const db = getDb();
  const userIndex = db.users.findIndex(u => u.username === username);
  
  if (userIndex !== -1) {
    db.users[userIndex].lastLogin = new Date().toISOString();
    saveDb(db);
  }
};

// Role Management Functions
export const getAllRoles = (): Role[] => {
  const db = getDb();
  return db.roles || DEFAULT_ROLES;
};

export const getRole = (id: string): Role | undefined => {
  const db = getDb();
  return db.roles.find(r => r.id === id);
};

export const createRole = (name: string, description: string, permissions: string[]): Role => {
  const db = getDb();
  
  const role: Role = {
    id: name.toLowerCase().replace(/\s+/g, '_'),
    name,
    description,
    permissions,
    isSystem: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  if (!db.roles) db.roles = DEFAULT_ROLES;
  db.roles.push(role);
  saveDb(db);
  
  return role;
};

export const updateRole = (id: string, updates: Partial<Role>): boolean => {
  const db = getDb();
  const roleIndex = db.roles.findIndex(r => r.id === id);
  
  if (roleIndex === -1 || db.roles[roleIndex].isSystem) return false;
  
  const { id: _, isSystem: __, ...safeUpdates } = updates;
  
  db.roles[roleIndex] = {
    ...db.roles[roleIndex],
    ...safeUpdates,
    updatedAt: new Date().toISOString()
  };
  
  saveDb(db);
  return true;
};

export const deleteRole = (id: string): boolean => {
  const db = getDb();
  const role = db.roles.find(r => r.id === id);
  
  // Can't delete system roles
  if (!role || role.isSystem) return false;
  
  // Check if any users have this role
  const usersWithRole = db.users.filter(u => u.roleId === id);
  if (usersWithRole.length > 0) return false;
  
  const index = db.roles.findIndex(r => r.id === id);
  db.roles.splice(index, 1);
  saveDb(db);
  
  return true;
};

export const getUserPermissions = (userId: number): string[] => {
  const db = getDb();
  const user = db.users?.find(u => u.id === userId);
  if (!user) return [];
  
  const role = db.roles?.find(r => r.id === user.roleId);
  return role ? role.permissions : [];
};

export default getDb;