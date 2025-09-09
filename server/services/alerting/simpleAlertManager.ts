import { db } from '../../db/index';
import { alerts, alertHistory } from '../../db/schema/alerts';
import { eq, and, gte, lte } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { IncomingWebhook } from '@slack/webhook';

export class SimpleAlertManager {
  private emailTransporter: nodemailer.Transporter | null = null;
  private slackWebhook: IncomingWebhook | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Initialize email if configured
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

    // Initialize Slack if configured
    if (process.env.SLACK_WEBHOOK_URL) {
      this.slackWebhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);
    }
  }

  public async createAlert(nodeId: number, name: string, metric: string, threshold: number, severity: string = 'warning') {
    const result = await db.insert(alerts).values({
      nodeId,
      name,
      metric,
      condition: 'gt',
      threshold,
      severity,
      isEnabled: true,
      cooldownMinutes: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning();

    return result[0];
  }

  public async triggerAlert(alertId: number, nodeId: number, value: number, message: string) {
    const result = await db.insert(alertHistory).values({
      alertId,
      nodeId,
      value,
      threshold: 0,
      condition: 'gt',
      severity: 'warning',
      title: 'Alert Triggered',
      message,
      triggeredAt: new Date().toISOString()
    }).returning();

    // Send notifications
    await this.sendNotifications(message, 'warning');

    return result[0];
  }

  private async sendNotifications(message: string, severity: string) {
    // Email notification
    if (this.emailTransporter && process.env.ALERT_EMAIL) {
      try {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'alerts@vaultscope.com',
          to: process.env.ALERT_EMAIL,
          subject: `[${severity.toUpperCase()}] Alert`,
          text: message
        });
      } catch (error) {
        console.error('Failed to send email alert:', error);
      }
    }

    // Slack notification
    if (this.slackWebhook) {
      try {
        await this.slackWebhook.send({
          text: `*${severity.toUpperCase()} Alert*\n${message}`
        });
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }
  }

  public async getActiveAlerts() {
    return await db.select().from(alertHistory).where(eq(alertHistory.resolved, false));
  }

  public async resolveAlert(alertHistoryId: number) {
    await db.update(alertHistory)
      .set({
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolvedAutomatically: true
      })
      .where(eq(alertHistory.id, alertHistoryId));
  }

  public async getAlertHistory(startDate?: Date, endDate?: Date) {
    if (startDate && endDate) {
      return await db.select().from(alertHistory).where(and(
        gte(alertHistory.triggeredAt, startDate.toISOString()),
        lte(alertHistory.triggeredAt, endDate.toISOString())
      ));
    }
    return await db.select().from(alertHistory);
  }
}

export const alertManager = new SimpleAlertManager();