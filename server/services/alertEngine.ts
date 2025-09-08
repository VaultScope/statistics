import alertModel from '../models/alerts';
import notificationService from './notifications';
import { getNodes } from '../../client/lib/db-json';
import axios from 'axios';

interface MetricValue {
  nodeId: number;
  nodeName: string;
  metrics: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    network_rx_sec?: number;
    network_tx_sec?: number;
    load_1m?: number;
    load_5m?: number;
    load_15m?: number;
    temperature?: number;
    processes_count?: number;
    uptime_hours?: number;
  };
}

export class AlertEngine {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 30000; // Check every 30 seconds

  start() {
    if (this.isRunning) {
      console.log('Alert engine is already running');
      return;
    }

    console.log('Starting alert engine...');
    this.isRunning = true;
    
    // Initial check
    this.checkAlerts();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, this.checkIntervalMs);
  }

  stop() {
    if (!this.isRunning) {
      console.log('Alert engine is not running');
      return;
    }

    console.log('Stopping alert engine...');
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkAlerts() {
    try {
      // Get all nodes
      const nodes = getNodes();
      
      for (const node of nodes) {
        try {
          // Fetch metrics from node
          const metrics = await this.fetchNodeMetrics(node);
          
          if (!metrics) {
            continue;
          }

          // Get alerts for this node
          const alerts = alertModel.getAlertsByNode(node.id);
          
          for (const alert of alerts) {
            await this.evaluateAlert(alert, metrics, node.name);
          }
        } catch (error) {
          console.error(`Failed to check alerts for node ${node.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Alert check failed:', error);
    }
  }

  private async fetchNodeMetrics(node: any): Promise<MetricValue | null> {
    try {
      // Fetch stats from the node's API
      const headers: any = {};
      if (node.apiKey) {
        headers['x-api-key'] = node.apiKey;
      }

      const [cpuRes, memRes, diskRes, netRes, loadRes] = await Promise.allSettled([
        axios.get(`${node.url}/stats/cpu`, { headers, timeout: 5000 }),
        axios.get(`${node.url}/stats/memory`, { headers, timeout: 5000 }),
        axios.get(`${node.url}/stats/disk`, { headers, timeout: 5000 }),
        axios.get(`${node.url}/stats/network`, { headers, timeout: 5000 }),
        axios.get(`${node.url}/data/cpu`, { headers, timeout: 5000 })
      ]);

      const metrics: MetricValue = {
        nodeId: node.id,
        nodeName: node.name,
        metrics: {}
      };

      // Process CPU usage
      if (cpuRes.status === 'fulfilled') {
        metrics.metrics.cpu_usage = cpuRes.value.data.usage || 0;
      }

      // Process memory usage
      if (memRes.status === 'fulfilled') {
        const memData = memRes.value.data;
        const totalMem = memData.total || 1;
        const usedMem = memData.used || 0;
        metrics.metrics.memory_usage = (usedMem / totalMem) * 100;
      }

      // Process disk usage
      if (diskRes.status === 'fulfilled') {
        const diskData = diskRes.value.data;
        if (Array.isArray(diskData) && diskData.length > 0) {
          // Get the highest disk usage percentage
          metrics.metrics.disk_usage = Math.max(...diskData.map((d: any) => d.use || 0));
        }
      }

      // Process network stats
      if (netRes.status === 'fulfilled') {
        const netData = netRes.value.data;
        if (Array.isArray(netData) && netData.length > 0) {
          const primaryInterface = netData[0];
          metrics.metrics.network_rx_sec = primaryInterface.rx_sec || 0;
          metrics.metrics.network_tx_sec = primaryInterface.tx_sec || 0;
        }
      }

      // Process load averages and temperature
      if (loadRes.status === 'fulfilled') {
        const cpuData = loadRes.value.data;
        if (cpuData.currentLoad) {
          metrics.metrics.load_1m = cpuData.currentLoad.avgLoad1 || 0;
          metrics.metrics.load_5m = cpuData.currentLoad.avgLoad5 || 0;
          metrics.metrics.load_15m = cpuData.currentLoad.avgLoad15 || 0;
        }
        if (cpuData.temperature) {
          metrics.metrics.temperature = cpuData.temperature.main || 0;
        }
      }

      return metrics;
    } catch (error) {
      console.error(`Failed to fetch metrics for node ${node.name}:`, error);
      return null;
    }
  }

  private async evaluateAlert(alert: any, metrics: MetricValue, nodeName: string) {
    try {
      const metricValue = metrics.metrics[alert.metric as keyof typeof metrics.metrics];
      
      if (metricValue === undefined) {
        return;
      }

      let shouldTrigger = false;
      
      switch (alert.condition) {
        case 'above':
          shouldTrigger = metricValue > alert.threshold;
          break;
        case 'below':
          shouldTrigger = metricValue < alert.threshold;
          break;
        case 'equals':
          shouldTrigger = Math.abs(metricValue - alert.threshold) < 0.01;
          break;
        case 'not_equals':
          shouldTrigger = Math.abs(metricValue - alert.threshold) >= 0.01;
          break;
      }

      if (shouldTrigger) {
        // Check cooldown period
        if (alert.lastTriggered) {
          const lastTriggeredTime = new Date(alert.lastTriggered).getTime();
          const cooldownMs = alert.cooldown * 60 * 1000; // Convert minutes to ms
          const now = Date.now();
          
          if (now - lastTriggeredTime < cooldownMs) {
            // Still in cooldown period
            return;
          }
        }

        // Trigger the alert
        await this.triggerAlert(alert, metricValue, nodeName);
      }
    } catch (error) {
      console.error(`Failed to evaluate alert ${alert.id}:`, error);
    }
  }

  private async triggerAlert(alert: any, value: number, nodeName: string) {
    try {
      // Create alert history record
      const message = this.formatAlertMessage(alert, value, nodeName);
      const history = alertModel.recordAlertTrigger(
        alert.id,
        alert.nodeId,
        value,
        message
      );

      console.log(`Alert triggered: ${message}`);

      // Get notification channels for this alert
      const channels = alertModel.getChannelsForAlert(alert.id);
      
      // Send notifications
      for (const channel of channels) {
        try {
          await notificationService.sendNotification(channel, alert, history, nodeName);
          console.log(`Notification sent via ${channel.name}`);
        } catch (error) {
          console.error(`Failed to send notification via ${channel.name}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to trigger alert ${alert.id}:`, error);
    }
  }

  private formatAlertMessage(alert: any, value: number, nodeName: string): string {
    const metricLabels: Record<string, string> = {
      cpu_usage: 'CPU Usage',
      memory_usage: 'Memory Usage',
      disk_usage: 'Disk Usage',
      network_rx_sec: 'Network RX',
      network_tx_sec: 'Network TX',
      load_1m: '1-minute Load Average',
      load_5m: '5-minute Load Average',
      load_15m: '15-minute Load Average',
      temperature: 'Temperature',
      processes_count: 'Process Count',
      uptime_hours: 'Uptime'
    };

    const metricLabel = metricLabels[alert.metric] || alert.metric;
    const formattedValue = this.formatMetricValue(alert.metric, value);
    const formattedThreshold = this.formatMetricValue(alert.metric, alert.threshold);

    return `${metricLabel} on ${nodeName} is ${alert.condition} threshold: ${formattedValue} (threshold: ${formattedThreshold})`;
  }

  private formatMetricValue(metric: string, value: number): string {
    switch (metric) {
      case 'cpu_usage':
      case 'memory_usage':
      case 'disk_usage':
        return `${value.toFixed(1)}%`;
      case 'network_rx_sec':
      case 'network_tx_sec':
        return this.formatBytes(value) + '/s';
      case 'load_1m':
      case 'load_5m':
      case 'load_15m':
        return value.toFixed(2);
      case 'temperature':
        return `${value.toFixed(1)}°C`;
      case 'processes_count':
        return value.toString();
      case 'uptime_hours':
        return `${value.toFixed(1)} hours`;
      default:
        return value.toString();
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default new AlertEngine();