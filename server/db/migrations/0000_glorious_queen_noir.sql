CREATE TABLE `alert_channels` (
	`alert_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`alert_id`, `channel_id`),
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `notification_channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_alertchannels_alert` ON `alert_channels` (`alert_id`);--> statement-breakpoint
CREATE INDEX `idx_alertchannels_channel` ON `alert_channels` (`channel_id`);--> statement-breakpoint
CREATE TABLE `alert_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` integer NOT NULL,
	`node_id` integer NOT NULL,
	`value` real NOT NULL,
	`threshold` real NOT NULL,
	`condition` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`acknowledged` integer DEFAULT false NOT NULL,
	`acknowledged_by` integer,
	`acknowledged_at` text,
	`acknowledge_note` text,
	`resolved` integer DEFAULT false NOT NULL,
	`resolved_at` text,
	`resolved_automatically` integer DEFAULT false NOT NULL,
	`triggered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_history_alert` ON `alert_history` (`alert_id`);--> statement-breakpoint
CREATE INDEX `idx_history_node` ON `alert_history` (`node_id`);--> statement-breakpoint
CREATE INDEX `idx_history_acknowledged` ON `alert_history` (`acknowledged`);--> statement-breakpoint
CREATE INDEX `idx_history_resolved` ON `alert_history` (`resolved`);--> statement-breakpoint
CREATE INDEX `idx_history_timestamp` ON `alert_history` (`triggered_at`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`node_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`metric` text NOT NULL,
	`condition` text NOT NULL,
	`threshold` real NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`cooldown_minutes` integer DEFAULT 5 NOT NULL,
	`last_triggered` text,
	`trigger_count` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_alerts_node` ON `alerts` (`node_id`);--> statement-breakpoint
CREATE INDEX `idx_alerts_enabled` ON `alerts` (`is_enabled`);--> statement-breakpoint
CREATE INDEX `idx_alerts_metric` ON `alerts` (`metric`);--> statement-breakpoint
CREATE TABLE `notification_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`test_status` text,
	`last_test_at` text,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_channels_name_unique` ON `notification_channels` (`name`);--> statement-breakpoint
CREATE INDEX `idx_channels_type` ON `notification_channels` (`type`);--> statement-breakpoint
CREATE INDEX `idx_channels_enabled` ON `notification_channels` (`is_enabled`);--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_history_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`status` text NOT NULL,
	`attempt_count` integer DEFAULT 1 NOT NULL,
	`error_message` text,
	`response_data` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`alert_history_id`) REFERENCES `alert_history`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `notification_channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notiflog_history` ON `notification_logs` (`alert_history_id`);--> statement-breakpoint
CREATE INDEX `idx_notiflog_channel` ON `notification_logs` (`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_notiflog_status` ON `notification_logs` (`status`);--> statement-breakpoint
CREATE TABLE `api_key_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`api_key_id` integer NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`status_code` integer,
	`response_time` integer,
	`ip_address` text,
	`user_agent` text,
	`error_message` text,
	`request_body` text,
	`response_size` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_keylogs_apikey` ON `api_key_logs` (`api_key_id`);--> statement-breakpoint
CREATE INDEX `idx_keylogs_timestamp` ON `api_key_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_keylogs_path` ON `api_key_logs` (`path`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`permissions` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_used` text,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`rate_limit` integer DEFAULT 1000,
	`expires_at` text,
	`created_by` integer,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_uuid_unique` ON `api_keys` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_unique` ON `api_keys` (`key`);--> statement-breakpoint
CREATE INDEX `idx_apikeys_key` ON `api_keys` (`key`);--> statement-breakpoint
CREATE INDEX `idx_apikeys_uuid` ON `api_keys` (`uuid`);--> statement-breakpoint
CREATE INDEX `idx_apikeys_active` ON `api_keys` (`is_active`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#gray' NOT NULL,
	`icon` text DEFAULT 'folder' NOT NULL,
	`description` text,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `node_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`node_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`metadata` text,
	`acknowledged` integer DEFAULT false NOT NULL,
	`acknowledged_by` integer,
	`acknowledged_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_events_node` ON `node_events` (`node_id`);--> statement-breakpoint
CREATE INDEX `idx_events_type` ON `node_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `idx_events_severity` ON `node_events` (`severity`);--> statement-breakpoint
CREATE TABLE `node_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`node_id` integer NOT NULL,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`cpu_usage` real,
	`cpu_temp` real,
	`load_avg_1m` real,
	`load_avg_5m` real,
	`load_avg_15m` real,
	`memory_usage` real,
	`memory_total` integer,
	`memory_used` integer,
	`memory_free` integer,
	`swap_usage` real,
	`swap_total` integer,
	`swap_used` integer,
	`disk_usage` real,
	`disk_total` integer,
	`disk_used` integer,
	`disk_free` integer,
	`disk_read_speed` integer,
	`disk_write_speed` integer,
	`network_rx_speed` integer,
	`network_tx_speed` integer,
	`network_rx_total` integer,
	`network_tx_total` integer,
	`network_connections` integer,
	`process_count` integer,
	`thread_count` integer,
	`handle_count` integer,
	`uptime` integer,
	`boot_time` text,
	`response_time` integer,
	`error_message` text,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_metrics_node_timestamp` ON `node_metrics` (`node_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_metrics_timestamp` ON `node_metrics` (`timestamp`);--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`api_key` text,
	`category_id` integer,
	`status` text DEFAULT 'offline' NOT NULL,
	`last_check` text,
	`last_response_time` integer,
	`is_enabled` integer DEFAULT true NOT NULL,
	`check_interval` integer DEFAULT 30 NOT NULL,
	`timeout` integer DEFAULT 5000 NOT NULL,
	`retries` integer DEFAULT 3 NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nodes_name_unique` ON `nodes` (`name`);--> statement-breakpoint
CREATE INDEX `idx_nodes_status` ON `nodes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_nodes_category` ON `nodes` (`category_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`resource` text,
	`resource_id` text,
	`details` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`permissions` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`first_name` text NOT NULL,
	`password` text NOT NULL,
	`role_id` text DEFAULT 'viewer' NOT NULL,
	`email` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);