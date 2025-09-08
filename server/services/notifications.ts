import nodemailer from 'nodemailer';
import axios from 'axios';
import { NotificationChannel, AlertHistory, Alert } from '../models/alerts';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string[];
}

interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
}

interface DiscordConfig {
  webhookUrl: string;
  username?: string;
}

interface WebhookConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
}

interface TeamsConfig {
  webhookUrl: string;
}

interface PagerDutyConfig {
  integrationKey: string;
  serviceId: string;
}

export class NotificationService {
  async sendNotification(
    channel: NotificationChannel,
    alert: Alert,
    history: AlertHistory,
    nodeName: string
  ): Promise<boolean> {
    try {
      const config = JSON.parse(channel.config);
      
      switch (channel.type) {
        case 'email':
          return await this.sendEmail(config as EmailConfig, alert, history, nodeName);
        case 'slack':
          return await this.sendSlack(config as SlackConfig, alert, history, nodeName);
        case 'discord':
          return await this.sendDiscord(config as DiscordConfig, alert, history, nodeName);
        case 'webhook':
          return await this.sendWebhook(config as WebhookConfig, alert, history, nodeName);
        case 'teams':
          return await this.sendTeams(config as TeamsConfig, alert, history, nodeName);
        case 'pagerduty':
          return await this.sendPagerDuty(config as PagerDutyConfig, alert, history, nodeName);
        default:
          console.error(`Unknown notification type: ${channel.type}`);
          return false;
      }
    } catch (error) {
      console.error(`Failed to send notification via ${channel.name}:`, error);
      return false;
    }
  }

  private async sendEmail(
    config: EmailConfig,
    alert: Alert,
    history: AlertHistory,
    nodeName: string
  ): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      });

      const severityColors = {
        critical: '#dc2626',
        warning: '#f59e0b',
        info: '#3b82f6'
      };

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${severityColors[alert.severity]}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🚨 Alert: ${alert.metric}</h2>
            <p style="margin: 5px 0;">Severity: ${alert.severity.toUpperCase()}</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h3>Alert Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Node:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${nodeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Metric:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.metric}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Condition:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.condition} ${alert.threshold}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Current Value:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${history.value}</td>
              </tr>
              <tr>
                <td style="padding: 8px;"><strong>Triggered At:</strong></td>
                <td style="padding: 8px;">${new Date(history.triggeredAt).toLocaleString()}</td>
              </tr>
            </table>
            <p style="margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b;">
              ${history.message}
            </p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: config.from,
        to: config.to.join(', '),
        subject: `[${alert.severity.toUpperCase()}] Alert: ${alert.metric} on ${nodeName}`,
        html,
        text: history.message,
      });

      return true;
    } catch (error) {
      console.error('Email notification failed:', error);
      return false;
    }
  }

  private async sendSlack(
    config: SlackConfig,
    alert: Alert,
    history: AlertHistory,
    nodeName: string
  ): Promise<boolean> {
    try {
      const colors = {
        critical: '#dc2626',
        warning: '#f59e0b',
        info: '#3b82f6'
      };

      const payload = {
        channel: config.channel,
        username: config.username || 'VaultScope Alerts',
        attachments: [
          {
            color: colors[alert.severity],
            title: `${alert.severity.toUpperCase()} Alert: ${alert.metric}`,
            text: history.message,
            fields: [
              {
                title: 'Node',
                value: nodeName,
                short: true
              },
              {
                title: 'Current Value',
                value: history.value.toString(),
                short: true
              },
              {
                title: 'Condition',
                value: `${alert.condition} ${alert.threshold}`,
                short: true
              },
              {
                title: 'Time',
                value: new Date(history.triggeredAt).toLocaleString(),
                short: true
              }
            ],
            footer: 'VaultScope Statistics',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      const response = await axios.post(config.webhookUrl, payload);
      return response.status === 200;
    } catch (error) {
      console.error('Slack notification failed:', error);
      return false;
    }
  }

  private async sendDiscord(
    config: DiscordConfig,
    alert: Alert,
    history: AlertHistory,
    nodeName: string
  ): Promise<boolean> {
    try {
      const colors = {
        critical: 0xdc2626,
        warning: 0xf59e0b,
        info: 0x3b82f6
      };

      const payload = {
        username: config.username || 'VaultScope Alerts',
        embeds: [
          {
            title: `${alert.severity.toUpperCase()} Alert: ${alert.metric}`,
            description: history.message,
            color: colors[alert.severity],
            fields: [
              {
                name: 'Node',
                value: nodeName,
                inline: true
              },
              {
                name: 'Current Value',
                value: history.value.toString(),
                inline: true
              },
              {
                name: 'Condition',
                value: `${alert.condition} ${alert.threshold}`,
                inline: true
              },
              {
                name: 'Triggered At',
                value: new Date(history.triggeredAt).toLocaleString(),
                inline: false
              }
            ],
            footer: {
              text: 'VaultScope Statistics'
            },
            timestamp: new Date(history.triggeredAt).toISOString()
          }
        ]
      };

      const response = await axios.post(config.webhookUrl, payload);
      return response.status === 204;
    } catch (error) {
      console.error('Discord notification failed:', error);
      return false;
    }
  }

  private async sendWebhook(
    config: WebhookConfig,
    alert: Alert,
    history: AlertHistory,
    nodeName: string
  ): Promise<boolean> {
    try {
      const payload = {
        alert: {
          id: alert.id,
          metric: alert.metric,
          condition: alert.condition,
          threshold: alert.threshold,
          severity: alert.severity
        },
        trigger: {
          value: history.value,
          message: history.message,
          triggeredAt: history.triggeredAt
        },
        node: {
          id: alert.nodeId,
          name: nodeName
        }
      };

      const response = await axios({
        method: config.method,
        url: config.url,
        headers: config.headers,
        data: payload
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('Webhook notification failed:', error);
      return false;
    }
  }

  private async sendTeams(
    config: TeamsConfig,
    alert: Alert,
    history: AlertHistory,
    nodeName: string
  ): Promise<boolean> {
    try {
      const colors = {
        critical: 'FF0000',
        warning: 'FFA500',
        info: '0000FF'
      };

      const payload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: colors[alert.severity],
        summary: `Alert: ${alert.metric} on ${nodeName}`,
        sections: [
          {
            activityTitle: `${alert.severity.toUpperCase()} Alert`,
            activitySubtitle: `On ${nodeName}`,
            facts: [
              {
                name: 'Metric',
                value: alert.metric
              },
              {
                name: 'Condition',
                value: `${alert.condition} ${alert.threshold}`
              },
              {
                name: 'Current Value',
                value: history.value.toString()
              },
              {
                name: 'Time',
                value: new Date(history.triggeredAt).toLocaleString()
              }
            ],
            markdown: true,
            text: history.message
          }
        ]
      };

      const response = await axios.post(config.webhookUrl, payload);
      return response.status === 200;
    } catch (error) {
      console.error('Teams notification failed:', error);
      return false;
    }
  }

  private async sendPagerDuty(
    config: PagerDutyConfig,
    alert: Alert,
    history: AlertHistory,
    nodeName: string
  ): Promise<boolean> {
    try {
      const severityMap = {
        critical: 'critical',
        warning: 'warning',
        info: 'info'
      };

      const payload = {
        routing_key: config.integrationKey,
        event_action: 'trigger',
        dedup_key: `${alert.id}-${history.id}`,
        payload: {
          summary: `${alert.metric} ${alert.condition} ${alert.threshold} on ${nodeName}`,
          source: nodeName,
          severity: severityMap[alert.severity],
          timestamp: new Date(history.triggeredAt).toISOString(),
          custom_details: {
            metric: alert.metric,
            condition: alert.condition,
            threshold: alert.threshold,
            current_value: history.value,
            message: history.message
          }
        }
      };

      const response = await axios.post(
        'https://events.pagerduty.com/v2/enqueue',
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.status === 202;
    } catch (error) {
      console.error('PagerDuty notification failed:', error);
      return false;
    }
  }
}

export default new NotificationService();