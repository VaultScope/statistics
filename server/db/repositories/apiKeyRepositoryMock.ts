// Mock repository for testing - bypasses database type errors
import makeid from '../../functions/keys/generate';
export type ApiKeyWithPermissions = {
  id: number;
  uuid: string;
  name: string;
  key: string;
  permissions: any;
  isActive: boolean;
  lastUsed: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export class ApiKeyRepository {
  private mockKeys: ApiKeyWithPermissions[] = [
    {
      id: 1,
      uuid: "test-uuid",
      name: "Test Key",
      key: "test-key-12345",
      permissions: {
        viewStats: true,
        createApiKey: true,
        deleteApiKey: true,
        viewApiKeys: true,
        usePowerCommands: true
      },
      isActive: true,
      lastUsed: null,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  async createApiKey(name: string, permissions: any): Promise<ApiKeyWithPermissions> {
    const newKey: ApiKeyWithPermissions = {
      id: this.mockKeys.length + 1,
      uuid: `uuid-${Date.now()}`,
      name,
      key: makeid(),
      permissions,
      isActive: true,
      lastUsed: null,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.mockKeys.push(newKey);
    return newKey;
  }

  async getAllApiKeys(): Promise<ApiKeyWithPermissions[]> {
    return this.mockKeys;
  }

  async getApiKey(identifier: string): Promise<ApiKeyWithPermissions | undefined> {
    return this.mockKeys.find(k => k.uuid === identifier || k.key === identifier);
  }

  async validateApiKey(key: string): Promise<ApiKeyWithPermissions | null> {
    const found = this.mockKeys.find(k => k.key === key && k.isActive);
    if (found) {
      found.lastUsed = new Date().toISOString();
      found.usageCount++;
    }
    return found || null;
  }

  async updateApiKeyPermissions(identifier: string, permissions: any): Promise<boolean> {
    const key = this.mockKeys.find(k => k.uuid === identifier || k.key === identifier);
    if (key) {
      key.permissions = permissions;
      key.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  async deleteApiKey(identifier: string): Promise<boolean> {
    const key = this.mockKeys.find(k => k.uuid === identifier || k.key === identifier);
    if (key) {
      key.isActive = false;
      key.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  async hardDeleteApiKey(identifier: string): Promise<boolean> {
    const index = this.mockKeys.findIndex(k => k.uuid === identifier || k.key === identifier);
    if (index !== -1) {
      this.mockKeys.splice(index, 1);
      return true;
    }
    return false;
  }

  async logApiKeyUsage(data: any): Promise<void> {
    console.log('Mock: Logging API key usage', data);
  }

  async getApiKeyLogs(apiKeyId?: string, limit: number = 100): Promise<any[]> {
    return [];
  }

  async getApiKeyStats(apiKeyId: string): Promise<any> {
    return {
      totalRequests: 0,
      statusCodes: {},
      endpoints: {},
      avgResponseTime: 0,
      lastUsed: null
    };
  }

  async clearApiLogs(apiKeyId?: string): Promise<number> {
    return 0;
  }

  async migrateFromJson(jsonKeys: any[]): Promise<void> {
    console.log('Mock: Would migrate', jsonKeys.length, 'keys');
  }
}

export const apiKeyRepository = new ApiKeyRepository();