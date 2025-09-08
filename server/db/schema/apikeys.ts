import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// API Keys table
export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull().unique(),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  permissions: text('permissions').notNull(), // JSON string
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastUsed: text('last_used'),
  usageCount: integer('usage_count').notNull().default(0),
  rateLimit: integer('rate_limit').default(1000), // requests per hour
  expiresAt: text('expires_at'), // optional expiration
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  metadata: text('metadata'), // JSON string for custom fields
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  keyIdx: index('idx_apikeys_key').on(table.key),
  uuidIdx: index('idx_apikeys_uuid').on(table.uuid),
  activeIdx: index('idx_apikeys_active').on(table.isActive),
}));

// API Key logs table
export const apiKeyLogs = sqliteTable('api_key_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  apiKeyId: integer('api_key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  path: text('path').notNull(),
  statusCode: integer('status_code'),
  responseTime: integer('response_time'), // milliseconds
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  errorMessage: text('error_message'),
  requestBody: text('request_body'), // JSON string (sanitized)
  responseSize: integer('response_size'), // bytes
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  apiKeyIdx: index('idx_keylogs_apikey').on(table.apiKeyId),
  timestampIdx: index('idx_keylogs_timestamp').on(table.createdAt),
  pathIdx: index('idx_keylogs_path').on(table.path),
}));

// Import for foreign key reference
import { users } from './users';

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyLog = typeof apiKeyLogs.$inferSelect;
export type NewApiKeyLog = typeof apiKeyLogs.$inferInsert;