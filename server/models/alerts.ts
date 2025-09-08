import { Database } from 'better-sqlite3';
import db from '../db';

export interface Alert {
  id: number;
  nodeId: number;
  metric: string;
  condition: 'above' | 'below' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  cooldown: number; // Minutes before re-alerting
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertHistory {
  id: number;
  alertId: number;
  nodeId: number;
  value: number;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  triggeredAt: string;
}

export interface NotificationChannel {
  id: number;
  name: string;
  type: 'email' | 'slack' | 'discord' | 'webhook' | 'teams' | 'pagerduty';
  config: string; // JSON string with channel-specific config
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertNotification {
  id: number;
  alertId: number;
  channelId: number;
}

class AlertModel {
  private db: Database;

  constructor() {
    this.db = db;
    this.initTables();
  }

  private initTables() {
    // Alerts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nodeId INTEGER NOT NULL,
        metric TEXT NOT NULL,
        condition TEXT CHECK(condition IN ('above', 'below', 'equals', 'not_equals')) NOT NULL,
        threshold REAL NOT NULL,
        severity TEXT CHECK(severity IN ('critical', 'warning', 'info')) NOT NULL,
        enabled INTEGER DEFAULT 1,
        cooldown INTEGER DEFAULT 5,
        lastTriggered TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      )
    `);

    // Alert history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alertId INTEGER NOT NULL,
        nodeId INTEGER NOT NULL,
        value REAL NOT NULL,
        message TEXT NOT NULL,
        acknowledged INTEGER DEFAULT 0,
        acknowledgedBy TEXT,
        acknowledgedAt TEXT,
        triggeredAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (alertId) REFERENCES alerts(id) ON DELETE CASCADE
      )
    `);

    // Notification channels table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT CHECK(type IN ('email', 'slack', 'discord', 'webhook', 'teams', 'pagerduty')) NOT NULL,
        config TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      )
    `);

    // Alert-notification mapping table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alertId INTEGER NOT NULL,
        channelId INTEGER NOT NULL,
        FOREIGN KEY (alertId) REFERENCES alerts(id) ON DELETE CASCADE,
        FOREIGN KEY (channelId) REFERENCES notification_channels(id) ON DELETE CASCADE,
        UNIQUE(alertId, channelId)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_alerts_nodeId ON alerts(nodeId);
      CREATE INDEX IF NOT EXISTS idx_alerts_enabled ON alerts(enabled);
      CREATE INDEX IF NOT EXISTS idx_alert_history_alertId ON alert_history(alertId);
      CREATE INDEX IF NOT EXISTS idx_alert_history_acknowledged ON alert_history(acknowledged);
    `);
  }

  // Alert CRUD operations
  createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Alert {
    const stmt = this.db.prepare(`
      INSERT INTO alerts (nodeId, metric, condition, threshold, severity, enabled, cooldown)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      alert.nodeId,
      alert.metric,
      alert.condition,
      alert.threshold,
      alert.severity,
      alert.enabled ? 1 : 0,
      alert.cooldown
    );

    return this.getAlert(result.lastInsertRowid as number)!;
  }

  getAlert(id: number): Alert | undefined {
    const stmt = this.db.prepare('SELECT * FROM alerts WHERE id = ?');
    return stmt.get(id) as Alert;
  }

  getAlertsByNode(nodeId: number): Alert[] {
    const stmt = this.db.prepare('SELECT * FROM alerts WHERE nodeId = ? AND enabled = 1');
    return stmt.all(nodeId) as Alert[];
  }

  getAllAlerts(): Alert[] {
    const stmt = this.db.prepare('SELECT * FROM alerts ORDER BY nodeId, metric');
    return stmt.all() as Alert[];
  }

  updateAlert(id: number, updates: Partial<Alert>): boolean {
    const fields = Object.keys(updates)
      .filter(key => !['id', 'createdAt'].includes(key))
      .map(key => `${key} = ?`);
    
    if (fields.length === 0) return false;

    const values = Object.entries(updates)
      .filter(([key]) => !['id', 'createdAt'].includes(key))
      .map(([, value]) => value);

    const stmt = this.db.prepare(`
      UPDATE alerts 
      SET ${fields.join(', ')}, updatedAt = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(...values, id);
    return result.changes > 0;
  }

  deleteAlert(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM alerts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Alert history operations
  recordAlertTrigger(alertId: number, nodeId: number, value: number, message: string): AlertHistory {
    const stmt = this.db.prepare(`
      INSERT INTO alert_history (alertId, nodeId, value, message)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(alertId, nodeId, value, message);
    
    // Update last triggered time on alert
    this.db.prepare('UPDATE alerts SET lastTriggered = datetime("now") WHERE id = ?').run(alertId);
    
    return this.getAlertHistory(result.lastInsertRowid as number)!;
  }

  getAlertHistory(id: number): AlertHistory | undefined {
    const stmt = this.db.prepare('SELECT * FROM alert_history WHERE id = ?');
    return stmt.get(id) as AlertHistory;
  }

  getRecentAlerts(limit: number = 100): AlertHistory[] {
    const stmt = this.db.prepare(`
      SELECT ah.*, a.metric, a.severity 
      FROM alert_history ah
      JOIN alerts a ON ah.alertId = a.id
      ORDER BY ah.triggeredAt DESC
      LIMIT ?
    `);
    return stmt.all(limit) as AlertHistory[];
  }

  acknowledgeAlert(historyId: number, acknowledgedBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE alert_history 
      SET acknowledged = 1, acknowledgedBy = ?, acknowledgedAt = datetime('now')
      WHERE id = ?
    `);
    const result = stmt.run(acknowledgedBy, historyId);
    return result.changes > 0;
  }

  // Notification channel operations
  createChannel(channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>): NotificationChannel {
    const stmt = this.db.prepare(`
      INSERT INTO notification_channels (name, type, config, enabled)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      channel.name,
      channel.type,
      channel.config,
      channel.enabled ? 1 : 0
    );

    return this.getChannel(result.lastInsertRowid as number)!;
  }

  getChannel(id: number): NotificationChannel | undefined {
    const stmt = this.db.prepare('SELECT * FROM notification_channels WHERE id = ?');
    return stmt.get(id) as NotificationChannel;
  }

  getAllChannels(): NotificationChannel[] {
    const stmt = this.db.prepare('SELECT * FROM notification_channels ORDER BY name');
    return stmt.all() as NotificationChannel[];
  }

  updateChannel(id: number, updates: Partial<NotificationChannel>): boolean {
    const fields = Object.keys(updates)
      .filter(key => !['id', 'createdAt'].includes(key))
      .map(key => `${key} = ?`);
    
    if (fields.length === 0) return false;

    const values = Object.entries(updates)
      .filter(([key]) => !['id', 'createdAt'].includes(key))
      .map(([, value]) => value);

    const stmt = this.db.prepare(`
      UPDATE notification_channels 
      SET ${fields.join(', ')}, updatedAt = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(...values, id);
    return result.changes > 0;
  }

  deleteChannel(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM notification_channels WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Alert-Channel mapping
  linkAlertToChannel(alertId: number, channelId: number): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO alert_notifications (alertId, channelId)
        VALUES (?, ?)
      `);
      stmt.run(alertId, channelId);
      return true;
    } catch (error) {
      return false; // Likely duplicate
    }
  }

  unlinkAlertFromChannel(alertId: number, channelId: number): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM alert_notifications 
      WHERE alertId = ? AND channelId = ?
    `);
    const result = stmt.run(alertId, channelId);
    return result.changes > 0;
  }

  getChannelsForAlert(alertId: number): NotificationChannel[] {
    const stmt = this.db.prepare(`
      SELECT nc.* FROM notification_channels nc
      JOIN alert_notifications an ON nc.id = an.channelId
      WHERE an.alertId = ? AND nc.enabled = 1
    `);
    return stmt.all(alertId) as NotificationChannel[];
  }
}

export default new AlertModel();