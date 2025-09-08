import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Alerts table
export const alerts = sqliteTable('alerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  metric: text('metric').notNull(),
  condition: text('condition').notNull(), // above, below, equals, not_equals, contains, not_contains
  threshold: real('threshold').notNull(),
  severity: text('severity').notNull().default('warning'), // critical, warning, info
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(5),
  lastTriggered: text('last_triggered'),
  triggerCount: integer('trigger_count').notNull().default(0),
  metadata: text('metadata'), // JSON string for custom fields
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nodeIdx: index('idx_alerts_node').on(table.nodeId),
  enabledIdx: index('idx_alerts_enabled').on(table.isEnabled),
  metricIdx: index('idx_alerts_metric').on(table.metric),
}));

// Alert history table
export const alertHistory = sqliteTable('alert_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  alertId: integer('alert_id').notNull().references(() => alerts.id, { onDelete: 'cascade' }),
  nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  value: real('value').notNull(),
  threshold: real('threshold').notNull(),
  condition: text('condition').notNull(),
  severity: text('severity').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  metadata: text('metadata'), // JSON string
  acknowledged: integer('acknowledged', { mode: 'boolean' }).notNull().default(false),
  acknowledgedBy: integer('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
  acknowledgedAt: text('acknowledged_at'),
  acknowledgeNote: text('acknowledge_note'),
  resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
  resolvedAt: text('resolved_at'),
  resolvedAutomatically: integer('resolved_automatically', { mode: 'boolean' }).notNull().default(false),
  triggeredAt: text('triggered_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  alertIdx: index('idx_history_alert').on(table.alertId),
  nodeIdx: index('idx_history_node').on(table.nodeId),
  acknowledgedIdx: index('idx_history_acknowledged').on(table.acknowledged),
  resolvedIdx: index('idx_history_resolved').on(table.resolved),
  timestampIdx: index('idx_history_timestamp').on(table.triggeredAt),
}));

// Notification channels table
export const notificationChannels = sqliteTable('notification_channels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  type: text('type').notNull(), // email, slack, discord, webhook, teams, pagerduty, telegram, sms
  config: text('config').notNull(), // Encrypted JSON string
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  testStatus: text('test_status'), // success, failed, pending
  lastTestAt: text('last_test_at'),
  failureCount: integer('failure_count').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  typeIdx: index('idx_channels_type').on(table.type),
  enabledIdx: index('idx_channels_enabled').on(table.isEnabled),
}));

// Alert-Channel mapping table (many-to-many)
export const alertChannels = sqliteTable('alert_channels', {
  alertId: integer('alert_id').notNull().references(() => alerts.id, { onDelete: 'cascade' }),
  channelId: integer('channel_id').notNull().references(() => notificationChannels.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey({ columns: [table.alertId, table.channelId] }),
  alertIdx: index('idx_alertchannels_alert').on(table.alertId),
  channelIdx: index('idx_alertchannels_channel').on(table.channelId),
}));

// Notification log table
export const notificationLogs = sqliteTable('notification_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  alertHistoryId: integer('alert_history_id').notNull().references(() => alertHistory.id, { onDelete: 'cascade' }),
  channelId: integer('channel_id').notNull().references(() => notificationChannels.id, { onDelete: 'cascade' }),
  status: text('status').notNull(), // sent, failed, pending, retry
  attemptCount: integer('attempt_count').notNull().default(1),
  errorMessage: text('error_message'),
  responseData: text('response_data'), // JSON string
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  historyIdx: index('idx_notiflog_history').on(table.alertHistoryId),
  channelIdx: index('idx_notiflog_channel').on(table.channelId),
  statusIdx: index('idx_notiflog_status').on(table.status),
}));

// Import for foreign key references
import { nodes } from './nodes';
import { users } from './users';

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type AlertHistory = typeof alertHistory.$inferSelect;
export type NewAlertHistory = typeof alertHistory.$inferInsert;
export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type NewNotificationChannel = typeof notificationChannels.$inferInsert;
export type AlertChannel = typeof alertChannels.$inferSelect;
export type NewAlertChannel = typeof alertChannels.$inferInsert;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type NewNotificationLog = typeof notificationLogs.$inferInsert;