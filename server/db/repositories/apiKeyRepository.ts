import { eq, desc, sql } from 'drizzle-orm';
import { db, apiKeys, apiKeyLogs } from '../index';
import type { NewApiKey, ApiKey, NewApiKeyLog, ApiKeyLog } from '../schema/apikeys';
import * as crypto from 'crypto';
import makeid from '../../functions/keys/generate';

// Type for API key with parsed permissions
export type ApiKeyWithPermissions = Omit<ApiKey, 'permissions'> & {
  permissions: any;
};

export class ApiKeyRepository {
  // Create a new API key
  async createApiKey(name: string, permissions: any): Promise<ApiKeyWithPermissions> {
    const [apiKey] = await db.insert(apiKeys).values({
      uuid: crypto.randomUUID(),
      name,
      key: makeid(),
      permissions: JSON.stringify(permissions),
      lastUsed: null,
      usageCount: 0
    }).returning();
    
    return {
      ...apiKey,
      permissions: JSON.parse(apiKey.permissions)
    };
  }

  // Get all API keys
  async getAllApiKeys(): Promise<ApiKeyWithPermissions[]> {
    const keys = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    return keys.map(key => ({
      ...key,
      permissions: JSON.parse(key.permissions)
    }));
  }

  // Get API key by UUID or key value
  async getApiKey(identifier: string): Promise<ApiKeyWithPermissions | undefined> {
    const [key] = await db.select().from(apiKeys)
      .where(eq(apiKeys.uuid, identifier))
      .limit(1);
    
    if (!key) {
      // Try to find by key value
      const [keyByValue] = await db.select().from(apiKeys)
        .where(eq(apiKeys.key, identifier))
        .limit(1);
      
      if (keyByValue) {
        return {
          ...keyByValue,
          permissions: JSON.parse(keyByValue.permissions)
        };
      }
      return undefined;
    }
    
    return {
      ...key,
      permissions: JSON.parse(key.permissions)
    };
  }

  // Validate API key and return it if valid
  async validateApiKey(key: string): Promise<ApiKeyWithPermissions | null> {
    const [apiKey] = await db.select().from(apiKeys)
      .where(eq(apiKeys.key, key))
      .where(eq(apiKeys.isActive, true))
      .limit(1);
    
    if (!apiKey) {
      return null;
    }

    // Update last used timestamp and usage count
    await db.update(apiKeys)
      .set({ 
        lastUsed: new Date().toISOString(),
        usageCount: sql`${apiKeys.usageCount} + 1`
      })
      .where(eq(apiKeys.id, apiKey.id));

    return {
      ...apiKey,
      permissions: JSON.parse(apiKey.permissions)
    };
  }

  // Update API key permissions
  async updateApiKeyPermissions(identifier: string, permissions: any): Promise<boolean> {
    // First find the key to get its ID
    const key = await this.getApiKey(identifier);
    if (!key) {
      return false;
    }
    
    const result = await db.update(apiKeys)
      .set({ 
        permissions: JSON.stringify(permissions),
        updatedAt: new Date().toISOString()
      })
      .where(eq(apiKeys.id, key.id));
    
    return result.changes > 0;
  }

  // Deactivate/Delete API key
  async deleteApiKey(identifier: string): Promise<boolean> {
    // First find the key to get its ID
    const key = await this.getApiKey(identifier);
    if (!key) {
      return false;
    }
    
    // Soft delete by deactivating
    const result = await db.update(apiKeys)
      .set({ 
        isActive: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(apiKeys.id, key.id));
    
    return result.changes > 0;
  }

  // Hard delete API key
  async hardDeleteApiKey(identifier: string): Promise<boolean> {
    // First find the key to get its ID
    const key = await this.getApiKey(identifier);
    if (!key) {
      return false;
    }
    
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, key.id));
    return result.changes > 0;
  }

  // Log API key usage
  async logApiKeyUsage(data: {
    apiKeyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    ipAddress: string,
    userAgent: string | null,
    responseTime: number | null
  }): Promise<void> {
    // First find the key to get its numeric ID
    const key = await this.getApiKey(data.apiKeyId);
    if (!key) {
      console.error('API key not found for logging:', data.apiKeyId);
      return;
    }
    
    await db.insert(apiKeyLogs).values({
      apiKeyId: key.id,
      method: data.method,
      path: data.endpoint,
      statusCode: data.statusCode,
      responseTime: data.responseTime,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    });
  }

  // Get API key logs
  async getApiKeyLogs(apiKeyId?: string, limit: number = 100): Promise<ApiKeyLog[]> {
    if (apiKeyId) {
      return await db.select().from(apiKeyLogs)
        .where(eq(apiKeyLogs.apiKeyId, apiKeyId))
        .orderBy(desc(apiKeyLogs.timestamp))
        .limit(limit);
    }
    
    return await db.select().from(apiKeyLogs)
      .orderBy(desc(apiKeyLogs.timestamp))
      .limit(limit);
  }

  // Get API key statistics
  async getApiKeyStats(apiKeyId: string) {
    const logs = await db.select().from(apiKeyLogs)
      .where(eq(apiKeyLogs.apiKeyId, apiKeyId))
      .orderBy(desc(apiKeyLogs.timestamp))
      .limit(1000);

    const totalRequests = logs.length;
    const statusCodes = logs.reduce((acc, log) => {
      acc[log.statusCode] = (acc[log.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const endpoints = logs.reduce((acc, log) => {
      const endpoint = `${log.method} ${log.endpoint}`;
      acc[endpoint] = (acc[endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgResponseTime = logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / logs.length;

    return {
      totalRequests,
      statusCodes,
      endpoints,
      avgResponseTime,
      lastUsed: logs[0]?.timestamp
    };
  }

  // Clear API logs
  async clearApiLogs(apiKeyId?: string): Promise<number> {
    if (apiKeyId) {
      const result = await db.delete(apiKeyLogs)
        .where(eq(apiKeyLogs.apiKeyId, apiKeyId));
      return result.changes;
    }
    
    const result = await db.delete(apiKeyLogs);
    return result.changes;
  }

  // Migrate from JSON file to database
  async migrateFromJson(jsonKeys: any[]): Promise<void> {
    for (const key of jsonKeys) {
      try {
        // Check if key already exists
        const existing = await this.getApiKey(key.uuid || key.id);
        if (!existing) {
          await db.insert(apiKeys).values({
            id: key.uuid || key.id || crypto.randomUUID(),
            name: key.name,
            key: key.key,
            permissions: JSON.stringify(key.permissions),
            isActive: true,
            createdAt: key.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastUsedAt: key.lastUsedAt || null
          });
        }
      } catch (error) {
        console.error(`Failed to migrate API key ${key.name}:`, error);
      }
    }
  }
}

export const apiKeyRepository = new ApiKeyRepository();