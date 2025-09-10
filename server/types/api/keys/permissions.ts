export interface ApiKeyPermissions {
  viewStats?: boolean;
  createApiKey?: boolean;
  deleteApiKey?: boolean;
  viewApiKeys?: boolean;
  usePowerCommands?: boolean;
  admin?: boolean;
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  permissions: ApiKeyPermissions;
  createdAt: Date;
  lastUsedAt?: Date;
}

export default ApiKeyPermissions;