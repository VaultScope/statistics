import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { influxDB } from '../influxdb';
import { db } from '../../db/index';
import { nodes, alerts, alertHistory } from '../../db/index';
import { between, eq } from 'drizzle-orm';

interface ReportConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  format: 'pdf' | 'csv' | 'json' | 'html';
  metrics: string[];
  nodes?: string[];
  startDate: Date;
  endDate: Date;
  recipients?: string[];
}

interface SLAMetrics {
  uptime: number;
  availability: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
}

export class ReportGenerator {
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  public async generateReport(config: ReportConfig): Promise<string> {
    const data = await this.collectReportData(config);
    
    switch (config.format) {
      case 'pdf':
        return await this.generatePDFReport(data, config);
      case 'csv':
        return await this.generateCSVReport(data, config);
      case 'html':
        return await this.generateHTMLReport(data, config);
      case 'json':
      default:
        return await this.generateJSONReport(data, config);
    }
  }

  private async collectReportData(config: ReportConfig): Promise<any> {
    const reportData: any = {
      metadata: {
        generatedAt: new Date().toISOString(),
        period: {
          start: config.startDate.toISOString(),
          end: config.endDate.toISOString()
        },
        type: config.type
      },
      summary: {},
      metrics: {},
      nodes: [],
      alerts: [],
      sla: {}
    };

    // Collect node data
    const nodeData = await db.select().from(nodes);
    reportData.nodes = nodeData;

    // Collect alert data
    const alertData = await db.select()
      .from(alertHistory)
      .where(between(
        alertHistory.timestamp,
        config.startDate.toISOString(),
        config.endDate.toISOString()
      ));
    reportData.alerts = alertData;

    // Collect metrics from InfluxDB
    if (influxDB.isConnected()) {
      for (const metric of config.metrics) {
        const query = `
          from(bucket: "${process.env.INFLUXDB_BUCKET || 'metrics'}")
            |> range(start: ${config.startDate.toISOString()}, stop: ${config.endDate.toISOString()})
            |> filter(fn: (r) => r["_measurement"] == "${metric}")
            |> aggregateWindow(every: 1h, fn: mean)
        `;
        
        const result = await influxDB.query(query);
        reportData.metrics[metric] = result;
      }

      // Calculate SLA metrics
      reportData.sla = await this.calculateSLAMetrics(config.startDate, config.endDate);
    }

    // Calculate summary statistics
    reportData.summary = {
      totalNodes: nodeData.length,
      activeNodes: nodeData.filter(n => n.status === 'online').length,
      totalAlerts: alertData.length,
      criticalAlerts: alertData.filter(a => a.severity === 'critical').length,
      uptime: reportData.sla.uptime || 0,
      availability: reportData.sla.availability || 0
    };

    return reportData;
  }

  private async calculateSLAMetrics(startDate: Date, endDate: Date): Promise<SLAMetrics> {
    const totalTime = endDate.getTime() - startDate.getTime();
    
    // Calculate uptime from node status history
    const query = `
      from(bucket: "${process.env.INFLUXDB_BUCKET || 'metrics'}")
        |> range(start: ${startDate.toISOString()}, stop: ${endDate.toISOString()})
        |> filter(fn: (r) => r["_measurement"] == "node_status")
        |> filter(fn: (r) => r["_field"] == "status")
        |> aggregateWindow(every: 1m, fn: mean)
    `;
    
    const statusData = await influxDB.query(query);
    const uptimeMinutes = statusData.filter((d: any) => d._value === 1).length;
    const totalMinutes = statusData.length || 1;
    
    return {
      uptime: (uptimeMinutes / totalMinutes) * 100,
      availability: (uptimeMinutes / totalMinutes) * 100,
      responseTime: await this.getAverageResponseTime(startDate, endDate),
      errorRate: await this.getErrorRate(startDate, endDate),
      throughput: await this.getThroughput(startDate, endDate)
    };
  }

  private async getAverageResponseTime(startDate: Date, endDate: Date): Promise<number> {
    const query = `
      from(bucket: "${process.env.INFLUXDB_BUCKET || 'metrics'}")
        |> range(start: ${startDate.toISOString()}, stop: ${endDate.toISOString()})
        |> filter(fn: (r) => r["_measurement"] == "response_time")
        |> mean()
    `;
    
    const result = await influxDB.query(query);
    return result[0]?._value || 0;
  }

  private async getErrorRate(startDate: Date, endDate: Date): Promise<number> {
    const query = `
      from(bucket: "${process.env.INFLUXDB_BUCKET || 'metrics'}")
        |> range(start: ${startDate.toISOString()}, stop: ${endDate.toISOString()})
        |> filter(fn: (r) => r["_measurement"] == "errors")
        |> sum()
    `;
    
    const result = await influxDB.query(query);
    const errors = result[0]?._value || 0;
    
    const totalQuery = `
      from(bucket: "${process.env.INFLUXDB_BUCKET || 'metrics'}")
        |> range(start: ${startDate.toISOString()}, stop: ${endDate.toISOString()})
        |> filter(fn: (r) => r["_measurement"] == "requests")
        |> sum()
    `;
    
    const totalResult = await influxDB.query(totalQuery);
    const total = totalResult[0]?._value || 1;
    
    return (errors / total) * 100;
  }

  private async getThroughput(startDate: Date, endDate: Date): Promise<number> {
    const query = `
      from(bucket: "${process.env.INFLUXDB_BUCKET || 'metrics'}")
        |> range(start: ${startDate.toISOString()}, stop: ${endDate.toISOString()})
        |> filter(fn: (r) => r["_measurement"] == "requests")
        |> aggregateWindow(every: 1h, fn: sum)
    `;
    
    const result = await influxDB.query(query);
    const totalRequests = result.reduce((sum: number, r: any) => sum + (r._value || 0), 0);
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    
    return totalRequests / hours;
  }

  private async generatePDFReport(data: any, config: ReportConfig): Promise<string> {
    const doc = new PDFDocument();
    const filename = `report_${Date.now()}.pdf`;
    const filepath = path.join(process.cwd(), 'reports', filename);
    
    // Ensure reports directory exists
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    
    doc.pipe(fs.createWriteStream(filepath));

    // Title
    doc.fontSize(20).text('VaultScope Statistics Report', { align: 'center' });
    doc.moveDown();

    // Metadata
    doc.fontSize(12).text(`Generated: ${data.metadata.generatedAt}`);
    doc.text(`Period: ${data.metadata.period.start} to ${data.metadata.period.end}`);
    doc.moveDown();

    // Summary
    doc.fontSize(16).text('Executive Summary', { underline: true });
    doc.fontSize(12);
    doc.text(`Total Nodes: ${data.summary.totalNodes}`);
    doc.text(`Active Nodes: ${data.summary.activeNodes}`);
    doc.text(`Total Alerts: ${data.summary.totalAlerts}`);
    doc.text(`Critical Alerts: ${data.summary.criticalAlerts}`);
    doc.text(`System Uptime: ${data.summary.uptime.toFixed(2)}%`);
    doc.text(`Availability: ${data.summary.availability.toFixed(2)}%`);
    doc.moveDown();

    // SLA Metrics
    doc.fontSize(16).text('SLA Metrics', { underline: true });
    doc.fontSize(12);
    doc.text(`Uptime: ${data.sla.uptime.toFixed(2)}%`);
    doc.text(`Availability: ${data.sla.availability.toFixed(2)}%`);
    doc.text(`Average Response Time: ${data.sla.responseTime.toFixed(2)}ms`);
    doc.text(`Error Rate: ${data.sla.errorRate.toFixed(2)}%`);
    doc.text(`Throughput: ${data.sla.throughput.toFixed(0)} req/hour`);
    doc.moveDown();

    // Node Status
    doc.fontSize(16).text('Node Status', { underline: true });
    doc.fontSize(10);
    data.nodes.forEach((node: any) => {
      doc.text(`${node.name}: ${node.status} (${node.type})`);
    });

    doc.end();

    if (config.recipients && config.recipients.length > 0) {
      await this.sendReportEmail(filepath, config.recipients, config);
    }

    return filepath;
  }

  private async generateCSVReport(data: any, config: ReportConfig): Promise<string> {
    const filename = `report_${Date.now()}.csv`;
    const filepath = path.join(process.cwd(), 'reports', filename);
    
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    // Prepare CSV data
    const csvData = [];
    
    // Add summary row
    csvData.push({
      type: 'summary',
      metric: 'total_nodes',
      value: data.summary.totalNodes,
      timestamp: data.metadata.generatedAt
    });
    
    // Add metrics
    for (const [metric, values] of Object.entries(data.metrics)) {
      if (Array.isArray(values)) {
        values.forEach((v: any) => {
          csvData.push({
            type: 'metric',
            metric,
            value: v._value,
            timestamp: v._time
          });
        });
      }
    }

    const parser = new Parser();
    const csv = parser.parse(csvData);
    
    fs.writeFileSync(filepath, csv);

    if (config.recipients && config.recipients.length > 0) {
      await this.sendReportEmail(filepath, config.recipients, config);
    }

    return filepath;
  }

  private async generateHTMLReport(data: any, config: ReportConfig): Promise<string> {
    const filename = `report_${Date.now()}.html`;
    const filepath = path.join(process.cwd(), 'reports', filename);
    
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>VaultScope Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        .summary { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .metric { margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #4CAF50; color: white; }
    </style>
</head>
<body>
    <h1>VaultScope Statistics Report</h1>
    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metric">Total Nodes: ${data.summary.totalNodes}</div>
        <div class="metric">Active Nodes: ${data.summary.activeNodes}</div>
        <div class="metric">Total Alerts: ${data.summary.totalAlerts}</div>
        <div class="metric">System Uptime: ${data.summary.uptime.toFixed(2)}%</div>
    </div>
    
    <h2>SLA Metrics</h2>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Uptime</td><td>${data.sla.uptime.toFixed(2)}%</td></tr>
        <tr><td>Availability</td><td>${data.sla.availability.toFixed(2)}%</td></tr>
        <tr><td>Response Time</td><td>${data.sla.responseTime.toFixed(2)}ms</td></tr>
        <tr><td>Error Rate</td><td>${data.sla.errorRate.toFixed(2)}%</td></tr>
        <tr><td>Throughput</td><td>${data.sla.throughput.toFixed(0)} req/hour</td></tr>
    </table>
    
    <h2>Node Status</h2>
    <table>
        <tr><th>Name</th><th>Status</th><th>Type</th></tr>
        ${data.nodes.map((n: any) => `<tr><td>${n.name}</td><td>${n.status}</td><td>${n.type}</td></tr>`).join('')}
    </table>
</body>
</html>`;

    fs.writeFileSync(filepath, html);

    if (config.recipients && config.recipients.length > 0) {
      await this.sendReportEmail(filepath, config.recipients, config);
    }

    return filepath;
  }

  private async generateJSONReport(data: any, config: ReportConfig): Promise<string> {
    const filename = `report_${Date.now()}.json`;
    const filepath = path.join(process.cwd(), 'reports', filename);
    
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    if (config.recipients && config.recipients.length > 0) {
      await this.sendReportEmail(filepath, config.recipients, config);
    }

    return filepath;
  }

  private async sendReportEmail(filepath: string, recipients: string[], config: ReportConfig): Promise<void> {
    if (!this.emailTransporter) return;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@vaultscope.com',
      to: recipients.join(', '),
      subject: `VaultScope ${config.type} Report - ${new Date().toLocaleDateString()}`,
      text: `Please find attached the ${config.type} report for the period ${config.startDate.toLocaleDateString()} to ${config.endDate.toLocaleDateString()}.`,
      attachments: [
        {
          filename: path.basename(filepath),
          path: filepath
        }
      ]
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  public async scheduleReports(): Promise<void> {
    // Daily reports at 2 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() === 0) {
        const config: ReportConfig = {
          type: 'daily',
          format: 'pdf',
          metrics: ['cpu', 'memory', 'disk', 'network'],
          startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          endDate: now,
          recipients: process.env.REPORT_RECIPIENTS?.split(',') || []
        };
        await this.generateReport(config);
      }
    }, 60000); // Check every minute
  }
}

export const reportGenerator = new ReportGenerator();