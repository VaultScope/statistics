import { eq, and, or, like, desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db, users, roles, sessions, auditLogs } from '../index';
import type { NewUser, User, Role, NewRole, Session, NewSession } from '../schema/users';

export class UserRepository {
  // User CRUD operations
  async createUser(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const [user] = await db.insert(users).values({
      ...data,
      password: hashedPassword,
    }).returning();
    
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.username);
  }

  async updateUser(id: number, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined> {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() };
    
    // Hash password if it's being updated
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    
    const [updated] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    
    return updated;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.changes > 0;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async updateLastLogin(id: number): Promise<void> {
    await db.update(users)
      .set({ lastLogin: new Date().toISOString() })
      .where(eq(users.id, id));
  }

  async countUsers(): Promise<number> {
    const [result] = await db.select({ count: users.id }).from(users);
    return result?.count || 0;
  }

  async searchUsers(query: string): Promise<User[]> {
    return await db.select().from(users)
      .where(or(
        like(users.username, `%${query}%`),
        like(users.firstName, `%${query}%`),
        like(users.email, `%${query}%`)
      ))
      .orderBy(users.username);
  }

  // Role operations
  async createRole(data: Omit<NewRole, 'createdAt' | 'updatedAt'>): Promise<Role> {
    const [role] = await db.insert(roles).values({
      ...data,
      permissions: JSON.stringify(data.permissions),
    }).returning();
    
    return role;
  }

  async getRoleById(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async getAllRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(roles.name);
  }

  async updateRole(id: string, data: Partial<Omit<Role, 'id' | 'createdAt'>>): Promise<Role | undefined> {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() };
    
    if (data.permissions) {
      updateData.permissions = JSON.stringify(data.permissions);
    }
    
    const [updated] = await db.update(roles)
      .set(updateData)
      .where(and(eq(roles.id, id), eq(roles.isSystem, false)))
      .returning();
    
    return updated;
  }

  async deleteRole(id: string): Promise<boolean> {
    // Can't delete system roles
    const result = await db.delete(roles)
      .where(and(eq(roles.id, id), eq(roles.isSystem, false)));
    
    return result.changes > 0;
  }

  async getUserPermissions(userId: number): Promise<string[]> {
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    const role = await this.getRoleById(user.roleId);
    if (!role) return [];
    
    try {
      return JSON.parse(role.permissions);
    } catch {
      return [];
    }
  }

  // Session management
  async createSession(userId: number, expiresInHours: number = 24): Promise<Session> {
    const sessionId = uuidv4();
    const token = Buffer.from(`${sessionId}:${Date.now()}`).toString('base64');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
    
    const [session] = await db.insert(sessions).values({
      id: sessionId,
      userId,
      token,
      expiresAt,
    }).returning();
    
    return session;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    
    if (session && new Date(session.expiresAt) < new Date()) {
      // Session expired, delete it
      await this.deleteSession(session.id);
      return undefined;
    }
    
    return session;
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, id));
    return result.changes > 0;
  }

  async deleteUserSessions(userId: number): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async cleanExpiredSessions(): Promise<number> {
    const result = await db.delete(sessions)
      .where(like(sessions.expiresAt, `%${new Date().toISOString()}%`));
    
    return result.changes;
  }

  // Audit logging
  async logAudit(data: Omit<NewAuditLog, 'id' | 'createdAt'>): Promise<void> {
    await db.insert(auditLogs).values({
      ...data,
      details: data.details ? JSON.stringify(data.details) : null,
    });
  }

  async getAuditLogs(limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUserAuditLogs(userId: number, limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

export const userRepository = new UserRepository();