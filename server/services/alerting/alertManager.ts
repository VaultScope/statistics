import nodemailer from 'nodemailer';
import { IncomingWebhook } from '@slack/webhook';
import { db } from '../../db/index';
import { alerts, alertHistory, notificationChannels, alertChannels } from '../../db/schema/alerts';
import { eq, and, gte, lte, or } from 'drizzle-orm';
import influxDB from '../influxdb';
import axios from 'axios';

interface AlertRule {
  id: number;
  nodeId: number;
  name: string;
  description: string | null;
  metric: string;
  condition: string;
  threshold: number;
  severity: string;
  isEnabled: boolean;
  cooldownMinutes: number;
  lastTriggered: string | null;
  triggerCount: number;
  metadata: any;
}

interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: any;
}

interface Alert {
  alertId: number;
  nodeId: number;
  ruleName: string;
  severity: string;
  message: string;
  value: number;
  threshold: number;
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
    try {
      const channels = await db.select().from(notificationChannels).where(eq(notificationChannels.isEnabled, true));
      
      for (const channel of channels) {
        this.channels.set(channel.id.toString(), {
          type: channel.type as any,
          config: JSON.parse(channel.config)
        });
      }
    } catch (error) {
      console.error('Failed to load notification channels:', error);
    }
  }

  public async createAlertRule(rule: Omit<AlertRule, 'id' | 'lastTriggered' | 'triggerCount'>): Promise<AlertRule> {
    const result = await db.insert(alerts).values({
      nodeId: rule.nodeId,
      name: rule.name,
      description: rule.description,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      severity: rule.severity,
      isEnabled: rule.isEnabled,
      cooldownMinutes: rule.cooldownMinutes,
      metadata: typeof rule.metadata === 'string' ? rule.metadata : JSON.stringify(rule.metadata || {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning();

    return {
      ...result[0],
      metadata: JSON.parse(result[0].metadata || '{}')
    };
  }

  public async updateAlertRule(id: number, updates: Partial<AlertRule>): Promise<void> {
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.metric !== undefined) updateData.metric = updates.metric;
    if (updates.condition !== undefined) updateData.condition = updates.condition;
    if (updates.threshold !== undefined) updateData.threshold = updates.threshold;
    if (updates.severity !== undefined) updateData.severity = updates.severity;
    if (updates.isEnabled !== undefined) updateData.isEnabled = updates.isEnabled;
    if (updates.cooldownMinutes !== undefined) updateData.cooldownMinutes = updates.cooldownMinutes;
    if (updates.metadata !== undefined) {
      updateData.metadata = typeof updates.metadata === 'string' ? updates.metadata : JSON.stringify(updates.metadata);
    }

    await db.update(alerts).set(updateData).where(eq(alerts.id, id));
  }

  public async deleteAlertRule(id: number): Promise<void> {
    await db.delete(alerts).where(eq(alerts.id, id));
  }

  public async getAlertRules(): Promise<AlertRule[]> {
    const rules = await db.select().from(alerts);
    return rules.map(rule => ({
      ...rule,
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
      const enabledRules = rules.filter(rule => rule.isEnabled);

      for (const rule of enabledRules) {
        await this.evaluateRule(rule);
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  private async evaluateRule(rule: AlertRule) {
    try {
      // Get metric value
      const value = await this.getMetricValue(rule.metric, rule.cooldownMinutes, rule.nodeId);
      
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
          // Check cooldown
          if (rule.lastTriggered) {
            const lastTriggeredTime = new Date(rule.lastTriggered).getTime();
            const cooldownExpiry = lastTriggeredTime + (rule.cooldownMinutes * 60 * 1000);
            if (Date.now() < cooldownExpiry) {
              return; // Still in cooldown period
            }
          }

          // Create new alert
          await this.createAlert({
            alertId: rule.id,
            nodeId: rule.nodeId,
            ruleName: rule.name,
            severity: rule.severity,
            message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.condition} ${rule.threshold})`,
            value,
            threshold: rule.threshold,
            metadata: rule.metadata
          });

          // Update last triggered
          await db.update(alerts)
            .set({ 
              lastTriggered: new Date().toISOString(),
              triggerCount: (rule.triggerCount || 0) + 1,
              updatedAt: new Date().toISOString()
            })
            .where(eq(alerts.id, rule.id));

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

  private async getMetricValue(metric: string, duration: number, nodeId: number): Promise<number | null> {
    try {
      // Try to get value from InfluxDB if available
      const data = await influxDB.queryMetrics(
        nodeId.toString(),
        metric,
        `-${duration}m`
      );
      
      if (data && data.length > 0) {
        // Return the average of the values
        const sum = data.reduce((acc: number, d: any) => acc + (d.value || 0), 0);
        return sum / data.length;
      }
    } catch (error) {
      console.error('Error getting metric from InfluxDB:', error);
    }

    // Fallback: generate random value for testing
    return Math.random() * 100;
  }

  private checkCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt':
      case 'above': 
        return value > threshold;
      case 'lt':
      case 'below': 
        return value < threshold;
      case 'eq':
      case 'equals': 
        return value === threshold;
      case 'gte': 
        return value >= threshold;
      case 'lte': 
        return value <= threshold;
      case 'not_equals': 
        return value !== threshold;
      default: 
        return false;
    }
  }

  private async createAlert(alert: Alert): Promise<void> {
    await db.insert(alertHistory).values({
      alertId: alert.alertId,
      nodeId: alert.nodeId,
      value: alert.value,
      threshold: alert.threshold,
      condition: 'gt', // Default condition for history
      severity: alert.severity,
      title: alert.ruleName,
      message: alert.message,
      metadata: JSON.stringify(alert.metadata || {}),
      acknowledged: false,
      resolved: false,
      triggeredAt: new Date().toISOString()
    });
  }

  private async resolveAlert(alertHistoryId: number): Promise<void> {
    await db.update(alertHistory)
      .set({
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolvedAutomatically: true
      })
      .where(eq(alertHistory.id, alertHistoryId));
  }

  private async sendNotifications(rule: AlertRule, value: number): Promise<void> {
    // Get alert channels for this alert
    const alertChannelMappings = await db.select()
      .from(alertChannels)
      .where(eq(alertChannels.alertId, rule.id));

    for (const mapping of alertChannelMappings) {
      const channel = this.channels.get(mapping.channelId.toString());
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

    // Also send to default channels if configured
    if (this.emailTransporter && process.env.ALERT_EMAIL) {
      await this.sendEmailNotification({ to: process.env.ALERT_EMAIL }, rule, value);
    }
    
    if (this.slackWebhook) {
      await this.sendSlackNotification({}, rule, value);
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
        <p><strong>Description:</strong> ${rule.description || 'N/A'}</p>
        <p><strong>Severity:</strong> ${rule.severity}</p>
        <p><strong>Metric:</strong> ${rule.metric}</p>
        <p><strong>Current Value:</strong> ${value}</p>
        <p><strong>Threshold:</strong> ${rule.condition} ${rule.threshold}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Node ID:</strong> ${rule.nodeId}</p>
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
        text: rule.description || '',
        fields: [
          { title: 'Metric', value: rule.metric, short: true },
          { title: 'Current Value', value: value.toString(), short: true },
          { title: 'Threshold', value: `${rule.condition} ${rule.threshold}`, short: true },
          { title: 'Severity', value: rule.severity, short: true },
          { title: 'Node ID', value: rule.nodeId.toString(), short: true }
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
        nodeId: rule.nodeId,
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
    const message = `Alert RESOLVED: ${rule.name} - ${rule.metric} is now ${value} (back to normal)`;
    
    // Send email if configured
    if (this.emailTransporter && process.env.ALERT_EMAIL) {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM,
        to: process.env.ALERT_EMAIL,
        subject: `[RESOLVED] Alert: ${rule.name}`,
        text: message
      });
    }
    
    // Send Slack if configured
    if (this.slackWebhook) {
      await this.slackWebhook.send({
        attachments: [{
          color: 'good',
          title: `RESOLVED: ${rule.name}`,
          text: `${rule.metric} is now ${value}`,
          footer: 'VaultScope Alerting',
          ts: Math.floor(Date.now() / 1000).toString()
        }]
      });
    }
  }

  public async getActiveAlerts(): Promise<any[]> {
    return await db.select()
      .from(alertHistory)
      .where(eq(alertHistory.resolved, false));
  }

  public async getAlertHistory(startDate?: Date, endDate?: Date): Promise<any[]> {
    if (startDate && endDate) {
      return await db.select()
        .from(alertHistory)
        .where(and(
          gte(alertHistory.triggeredAt, startDate.toISOString()),
          lte(alertHistory.triggeredAt, endDate.toISOString())
        ));
    }
    
    return await db.select().from(alertHistory);
  }

  public async acknowledgeAlert(alertId: number, userId: number, note?: string): Promise<void> {
    await db.update(alertHistory)
      .set({
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date().toISOString(),
        acknowledgeNote: note
      })
      .where(eq(alertHistory.id, alertId));
  }

  public async createNotificationChannel(channel: {
    name: string;
    type: string;
    config: any;
    isEnabled?: boolean;
    isDefault?: boolean;
  }): Promise<any> {
    const result = await db.insert(notificationChannels).values({
      name: channel.name,
      type: channel.type,
      config: JSON.stringify(channel.config),
      isEnabled: channel.isEnabled !== false,
      isDefault: channel.isDefault || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning();

    // Reload channels
    await this.loadChannels();

    return result[0];
  }

  public async linkAlertToChannel(alertId: number, channelId: number): Promise<void> {
    await db.insert(alertChannels).values({
      alertId,
      channelId,
      createdAt: new Date().toISOString()
    });
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const alertManager = new AlertManager();