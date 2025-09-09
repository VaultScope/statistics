import nodemailer from 'nodemailer';
import { IncomingWebhook } from '@slack/webhook';
import { db } from '../../db/index';
import { alerts, alertHistory } from '../../db/schema/alerts';
import { eq, and, gte, lte, or } from 'drizzle-orm';
import influxDB from '../influxdb';
import axios from 'axios';

interface AlertRule {
  id: number;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // minutes
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  channels: string[];
  metadata: any;
}

interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: any;
}

interface Alert {
  ruleId: number;
  ruleName: string;
  severity: string;
  message: string;
  value: number;
  threshold: number;
  nodeId?: string;
  metadata?: any;
}

export class AlertManager {
  private emailTransporter: nodemailer.Transporter | null = null;
  private slackWebhook: IncomingWebhook | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private channels: Map<string, AlertChannel> = new Map();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Initialize email transporter
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }

    // Initialize Slack webhook
    if (process.env.SLACK_WEBHOOK_URL) {
      this.slackWebhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);
    }

    // Load alert channels from database
    await this.loadChannels();

    // Start monitoring
    this.startMonitoring();
  }

  private async loadChannels() {
    // Load notification channels from database or config
    const channelsConfig = process.env.ALERT_CHANNELS ? JSON.parse(process.env.ALERT_CHANNELS) : [];
    
    for (const channel of channelsConfig) {
      this.channels.set(channel.id, channel);
    }
  }

  public async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const result = await db.insert(alertRules).values({
      name: rule.name,
      description: rule.description,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      duration: rule.duration,
      severity: rule.severity,
      enabled: rule.enabled,
      channels: JSON.stringify(rule.channels),
      metadata: JSON.stringify(rule.metadata),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning();

    return {
      ...result[0],
      channels: JSON.parse(result[0].channels),
      metadata: JSON.parse(result[0].metadata || '{}')
    };
  }

  public async updateAlertRule(id: number, updates: Partial<AlertRule>): Promise<void> {
    const updateData: any = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (updates.channels) {
      updateData.channels = JSON.stringify(updates.channels);
    }
    if (updates.metadata) {
      updateData.metadata = JSON.stringify(updates.metadata);
    }

    await db.update(alertRules).set(updateData).where(eq(alertRules.id, id));
  }

  public async deleteAlertRule(id: number): Promise<void> {
    await db.delete(alertRules).where(eq(alertRules.id, id));
  }

  public async getAlertRules(): Promise<AlertRule[]> {
    const rules = await db.select().from(alertRules);
    return rules.map(rule => ({
      ...rule,
      channels: JSON.parse(rule.channels),
      metadata: JSON.parse(rule.metadata || '{}')
    }));
  }

  private startMonitoring() {
    // Check alerts every minute
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, 60000);

    // Initial check
    this.checkAlerts();
  }

  private async checkAlerts() {
    try {
      const rules = await this.getAlertRules();
      const enabledRules = rules.filter(rule => rule.enabled);

      for (const rule of enabledRules) {
        await this.evaluateRule(rule);
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  private async evaluateRule(rule: AlertRule) {
    try {
      // Get metric value from InfluxDB
      const value = await this.getMetricValue(rule.metric, rule.duration);
      
      if (value === null) return;

      // Check condition
      const triggered = this.checkCondition(value, rule.condition, rule.threshold);

      if (triggered) {
        // Check if alert is already active
        const activeAlert = await db.select()
          .from(alertHistory)
          .where(and(
            eq(alertHistory.alertId, rule.id),
            eq(alertHistory.resolved, false)
          ))
          .get();

        if (!activeAlert) {
          // Create new alert
          await this.createAlert({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.condition} ${rule.threshold})`,
            value,
            threshold: rule.threshold,
            metadata: rule.metadata
          });

          // Send notifications
          await this.sendNotifications(rule, value);
        }
      } else {
        // Check if there's an active alert to resolve
        const activeAlert = await db.select()
          .from(alertHistory)
          .where(and(
            eq(alertHistory.alertId, rule.id),
            eq(alertHistory.resolved, false)
          ))
          .get();

        if (activeAlert) {
          // Resolve alert
          await this.resolveAlert(activeAlert.id);
          
          // Send resolution notification
          await this.sendResolutionNotification(rule, value);
        }
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.name}:`, error);
    }
  }

  private async getMetricValue(metric: string, duration: number): Promise<number | null> {
    if (!influxDB.isConnected()) return null;

    const query = `
      from(bucket: "${process.env.INFLUXDB_BUCKET || 'metrics'}")
        |> range(start: -${duration}m)
        |> filter(fn: (r) => r["_measurement"] == "${metric.split('.')[0]}")
        |> filter(fn: (r) => r["_field"] == "${metric.split('.')[1] || 'value'}")
        |> mean()
    `;

    const result = await influxDB.query(query);
    return result[0]?._value || null;
  }

  private checkCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  private async createAlert(alert: Alert): Promise<void> {
    await db.insert(alerts).values({
      ruleId: alert.ruleId,
      severity: alert.severity,
      status: 'active',
      message: alert.message,
      nodeId: alert.nodeId,
      value: alert.value,
      threshold: alert.threshold,
      metadata: JSON.stringify(alert.metadata || {}),
      triggeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Add to history
    await db.insert(alertHistory).values({
      ruleId: alert.ruleId,
      severity: alert.severity,
      status: 'triggered',
      message: alert.message,
      nodeId: alert.nodeId,
      value: alert.value,
      threshold: alert.threshold,
      metadata: JSON.stringify(alert.metadata || {}),
      timestamp: new Date().toISOString()
    });
  }

  private async resolveAlert(alertId: number): Promise<void> {
    const alert = await db.select().from(alerts).where(eq(alerts.id, alertId)).get();
    
    if (alert) {
      await db.update(alerts)
        .set({
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(alerts.id, alertId));

      // Add resolution to history
      await db.insert(alertHistory).values({
        ruleId: alert.ruleId,
        severity: alert.severity,
        status: 'resolved',
        message: `${alert.message} - RESOLVED`,
        nodeId: alert.nodeId,
        value: alert.value,
        threshold: alert.threshold,
        metadata: alert.metadata,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async sendNotifications(rule: AlertRule, value: number): Promise<void> {
    for (const channelId of rule.channels) {
      const channel = this.channels.get(channelId);
      if (!channel) continue;

      try {
        switch (channel.type) {
          case 'email':
            await this.sendEmailNotification(channel.config, rule, value);
            break;
          case 'slack':
            await this.sendSlackNotification(channel.config, rule, value);
            break;
          case 'webhook':
            await this.sendWebhookNotification(channel.config, rule, value);
            break;
          case 'sms':
            await this.sendSMSNotification(channel.config, rule, value);
            break;
        }
      } catch (error) {
        console.error(`Failed to send notification to ${channel.type}:`, error);
      }
    }
  }

  private async sendEmailNotification(config: any, rule: AlertRule, value: number): Promise<void> {
    if (!this.emailTransporter) return;

    const mailOptions = {
      from: config.from || process.env.SMTP_FROM,
      to: config.to,
      subject: `[${rule.severity.toUpperCase()}] Alert: ${rule.name}`,
      html: `
        <h2>Alert Triggered</h2>
        <p><strong>Rule:</strong> ${rule.name}</p>
        <p><strong>Description:</strong> ${rule.description}</p>
        <p><strong>Severity:</strong> ${rule.severity}</p>
        <p><strong>Metric:</strong> ${rule.metric}</p>
        <p><strong>Current Value:</strong> ${value}</p>
        <p><strong>Threshold:</strong> ${rule.condition} ${rule.threshold}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  private async sendSlackNotification(config: any, rule: AlertRule, value: number): Promise<void> {
    const webhook = config.webhookUrl ? new IncomingWebhook(config.webhookUrl) : this.slackWebhook;
    
    if (!webhook) return;

    const color = rule.severity === 'critical' ? 'danger' : 
                  rule.severity === 'warning' ? 'warning' : 'good';

    await webhook.send({
      attachments: [{
        color,
        title: `${rule.severity.toUpperCase()} Alert: ${rule.name}`,
        text: rule.description,
        fields: [
          { title: 'Metric', value: rule.metric, short: true },
          { title: 'Current Value', value: value.toString(), short: true },
          { title: 'Threshold', value: `${rule.condition} ${rule.threshold}`, short: true },
          { title: 'Severity', value: rule.severity, short: true }
        ],
        footer: 'VaultScope Alerting',
        ts: Math.floor(Date.now() / 1000).toString()
      }]
    });
  }

  private async sendWebhookNotification(config: any, rule: AlertRule, value: number): Promise<void> {
    const payload = {
      alert: {
        rule: rule.name,
        description: rule.description,
        severity: rule.severity,
        metric: rule.metric,
        value,
        threshold: rule.threshold,
        condition: rule.condition,
        timestamp: new Date().toISOString()
      }
    };

    await axios.post(config.url, payload, {
      headers: config.headers || {},
      timeout: 10000
    });
  }

  private async sendSMSNotification(config: any, rule: AlertRule, value: number): Promise<void> {
    // Implement SMS notification using Twilio or other provider
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      await twilio.messages.create({
        body: `[${rule.severity.toUpperCase()}] ${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.condition} ${rule.threshold})`,
        from: config.from || process.env.TWILIO_PHONE_NUMBER,
        to: config.to
      });
    }
  }

  private async sendResolutionNotification(rule: AlertRule, value: number): Promise<void> {
    // Similar to sendNotifications but with resolution message
    for (const channelId of rule.channels) {
      const channel = this.channels.get(channelId);
      if (!channel) continue;

      const message = `Alert RESOLVED: ${rule.name} - ${rule.metric} is now ${value} (back to normal)`;
      
      // Send resolution notification based on channel type
      // Implementation similar to sendNotifications but with resolved status
    }
  }

  public async getActiveAlerts(): Promise<any[]> {
    return await db.select().from(alerts).where(eq(alerts.status, 'active'));
  }

  public async getAlertHistory(startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = db.select().from(alertHistory);
    
    if (startDate && endDate) {
      query = query.where(and(
        gte(alertHistory.timestamp, startDate.toISOString()),
        lte(alertHistory.timestamp, endDate.toISOString())
      ));
    }
    
    return await query;
  }

  public async acknowledgeAlert(alertId: number, userId: number, note?: string): Promise<void> {
    await db.update(alerts)
      .set({
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date().toISOString(),
        notes: note,
        updatedAt: new Date().toISOString()
      })
      .where(eq(alerts.id, alertId));
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const alertManager = new AlertManager();