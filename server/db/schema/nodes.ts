import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Nodes table
export const nodes = sqliteTable('nodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  apiKey: text('api_key'),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('offline'), // online, offline, error
  lastCheck: text('last_check'),
  lastResponseTime: integer('last_response_time'), // milliseconds
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  checkInterval: integer('check_interval').notNull().default(30), // seconds
  timeout: integer('timeout').notNull().default(5000), // milliseconds
  retries: integer('retries').notNull().default(3),
  metadata: text('metadata'), // JSON string for custom fields
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  statusIdx: index('idx_nodes_status').on(table.status),
  categoryIdx: index('idx_nodes_category').on(table.categoryId),
}));

// Categories table
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#gray'),
  icon: text('icon').notNull().default('folder'),
  description: text('description'),
  order: integer('order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Node metrics table (for historical data)
export const nodeMetrics = sqliteTable('node_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  timestamp: text('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`),
  
  // CPU metrics
  cpuUsage: real('cpu_usage'),
  cpuTemp: real('cpu_temp'),
  loadAvg1m: real('load_avg_1m'),
  loadAvg5m: real('load_avg_5m'),
  loadAvg15m: real('load_avg_15m'),
  
  // Memory metrics
  memoryUsage: real('memory_usage'),
  memoryTotal: integer('memory_total'),
  memoryUsed: integer('memory_used'),
  memoryFree: integer('memory_free'),
  swapUsage: real('swap_usage'),
  swapTotal: integer('swap_total'),
  swapUsed: integer('swap_used'),
  
  // Disk metrics
  diskUsage: real('disk_usage'),
  diskTotal: integer('disk_total'),
  diskUsed: integer('disk_used'),
  diskFree: integer('disk_free'),
  diskReadSpeed: integer('disk_read_speed'),
  diskWriteSpeed: integer('disk_write_speed'),
  
  // Network metrics
  networkRxSpeed: integer('network_rx_speed'),
  networkTxSpeed: integer('network_tx_speed'),
  networkRxTotal: integer('network_rx_total'),
  networkTxTotal: integer('network_tx_total'),
  networkConnections: integer('network_connections'),
  
  // Process metrics
  processCount: integer('process_count'),
  threadCount: integer('thread_count'),
  handleCount: integer('handle_count'),
  
  // System metrics
  uptime: integer('uptime'), // seconds
  bootTime: text('boot_time'),
  
  // Response metadata
  responseTime: integer('response_time'), // milliseconds
  errorMessage: text('error_message'),
}, (table) => ({
  nodeTimestampIdx: index('idx_metrics_node_timestamp').on(table.nodeId, table.timestamp),
  timestampIdx: index('idx_metrics_timestamp').on(table.timestamp),
}));

// Node events table (for tracking state changes)
export const nodeEvents = sqliteTable('node_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // status_change, error, recovered, maintenance
  severity: text('severity').notNull().default('info'), // critical, warning, info
  title: text('title').notNull(),
  description: text('description'),
  metadata: text('metadata'), // JSON string
  acknowledged: integer('acknowledged', { mode: 'boolean' }).notNull().default(false),
  acknowledgedBy: integer('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
  acknowledgedAt: text('acknowledged_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nodeIdx: index('idx_events_node').on(table.nodeId),
  typeIdx: index('idx_events_type').on(table.eventType),
  severityIdx: index('idx_events_severity').on(table.severity),
}));

// Import for foreign key reference
import { users } from './users';

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type NodeMetric = typeof nodeMetrics.$inferSelect;
export type NewNodeMetric = typeof nodeMetrics.$inferInsert;
export type NodeEvent = typeof nodeEvents.$inferSelect;
export type NewNodeEvent = typeof nodeEvents.$inferInsert;