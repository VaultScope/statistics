import { Registry, Gauge, Counter, Histogram, Summary } from 'prom-client';
import si from 'systeminformation';
import { db } from '../../db/index';
import { nodes, alerts } from '../../db/index';
import { eq } from 'drizzle-orm';

export class PrometheusExporter {
  private registry: Registry;
  private metrics: Map<string, any> = new Map();

  constructor() {
    this.registry = new Registry();
    this.initializeMetrics();
    this.startCollection();
  }

  private initializeMetrics() {
    // System metrics
    this.metrics.set('cpu_usage', new Gauge({
      name: 'vaultscope_cpu_usage_percent',
      help: 'CPU usage percentage',
      labelNames: ['node', 'core'],
      registers: [this.registry]
    }));

    this.metrics.set('memory_usage', new Gauge({
      name: 'vaultscope_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['node', 'type'],
      registers: [this.registry]
    }));

    this.metrics.set('disk_usage', new Gauge({
      name: 'vaultscope_disk_usage_bytes',
      help: 'Disk usage in bytes',
      labelNames: ['node', 'mount', 'filesystem'],
      registers: [this.registry]
    }));

    this.metrics.set('network_bytes', new Counter({
      name: 'vaultscope_network_bytes_total',
      help: 'Network bytes transferred',
      labelNames: ['node', 'interface', 'direction'],
      registers: [this.registry]
    }));

    this.metrics.set('network_errors', new Counter({
      name: 'vaultscope_network_errors_total',
      help: 'Network errors',
      labelNames: ['node', 'interface', 'direction'],
      registers: [this.registry]
    }));

    // Container metrics
    this.metrics.set('container_cpu', new Gauge({
      name: 'vaultscope_container_cpu_usage_percent',
      help: 'Container CPU usage percentage',
      labelNames: ['node', 'container', 'image'],
      registers: [this.registry]
    }));

    this.metrics.set('container_memory', new Gauge({
      name: 'vaultscope_container_memory_usage_bytes',
      help: 'Container memory usage',
      labelNames: ['node', 'container', 'image'],
      registers: [this.registry]
    }));

    // Process metrics
    this.metrics.set('process_count', new Gauge({
      name: 'vaultscope_process_count',
      help: 'Number of processes',
      labelNames: ['node', 'state'],
      registers: [this.registry]
    }));

    // Service metrics
    this.metrics.set('service_up', new Gauge({
      name: 'vaultscope_service_up',
      help: 'Service availability (1 = up, 0 = down)',
      labelNames: ['node', 'service', 'type'],
      registers: [this.registry]
    }));

    this.metrics.set('service_response_time', new Histogram({
      name: 'vaultscope_service_response_time_ms',
      help: 'Service response time in milliseconds',
      labelNames: ['node', 'service', 'endpoint'],
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry]
    }));

    // Alert metrics
    this.metrics.set('alerts_active', new Gauge({
      name: 'vaultscope_alerts_active',
      help: 'Number of active alerts',
      labelNames: ['severity', 'category'],
      registers: [this.registry]
    }));

    // Node metrics
    this.metrics.set('nodes_total', new Gauge({
      name: 'vaultscope_nodes_total',
      help: 'Total number of monitored nodes',
      labelNames: ['status'],
      registers: [this.registry]
    }));

    // Application metrics
    this.metrics.set('api_requests', new Counter({
      name: 'vaultscope_api_requests_total',
      help: 'Total API requests',
      labelNames: ['method', 'endpoint', 'status'],
      registers: [this.registry]
    }));

    this.metrics.set('api_duration', new Histogram({
      name: 'vaultscope_api_duration_seconds',
      help: 'API request duration',
      labelNames: ['method', 'endpoint'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry]
    }));
  }

  private async startCollection() {
    // Collect metrics every 15 seconds
    setInterval(async () => {
      await this.collectSystemMetrics();
      await this.collectNodeMetrics();
      await this.collectAlertMetrics();
    }, 15000);

    // Initial collection
    await this.collectSystemMetrics();
    await this.collectNodeMetrics();
    await this.collectAlertMetrics();
  }

  private async collectSystemMetrics() {
    try {
      // CPU metrics
      const cpuLoad = await si.currentLoad();
      const cpuCores = cpuLoad.cpus;
      
      this.metrics.get('cpu_usage').set(
        { node: process.env.NODE_NAME || 'localhost', core: 'all' },
        cpuLoad.currentLoad
      );

      cpuCores.forEach((core, index) => {
        this.metrics.get('cpu_usage').set(
          { node: process.env.NODE_NAME || 'localhost', core: `${index}` },
          core.load
        );
      });

      // Memory metrics
      const memory = await si.mem();
      this.metrics.get('memory_usage').set(
        { node: process.env.NODE_NAME || 'localhost', type: 'used' },
        memory.used
      );
      this.metrics.get('memory_usage').set(
        { node: process.env.NODE_NAME || 'localhost', type: 'free' },
        memory.free
      );
      this.metrics.get('memory_usage').set(
        { node: process.env.NODE_NAME || 'localhost', type: 'cached' },
        memory.cached
      );

      // Disk metrics
      const disks = await si.fsSize();
      disks.forEach(disk => {
        this.metrics.get('disk_usage').set(
          { 
            node: process.env.NODE_NAME || 'localhost',
            mount: disk.mount,
            filesystem: disk.fs
          },
          disk.used
        );
      });

      // Network metrics
      const networkStats = await si.networkStats();
      networkStats.forEach(iface => {
        this.metrics.get('network_bytes').inc(
          {
            node: process.env.NODE_NAME || 'localhost',
            interface: iface.iface,
            direction: 'rx'
          },
          iface.rx_bytes
        );
        this.metrics.get('network_bytes').inc(
          {
            node: process.env.NODE_NAME || 'localhost',
            interface: iface.iface,
            direction: 'tx'
          },
          iface.tx_bytes
        );
        this.metrics.get('network_errors').inc(
          {
            node: process.env.NODE_NAME || 'localhost',
            interface: iface.iface,
            direction: 'rx'
          },
          iface.rx_errors
        );
        this.metrics.get('network_errors').inc(
          {
            node: process.env.NODE_NAME || 'localhost',
            interface: iface.iface,
            direction: 'tx'
          },
          iface.tx_errors
        );
      });

      // Process metrics
      const processes = await si.processes();
      this.metrics.get('process_count').set(
        { node: process.env.NODE_NAME || 'localhost', state: 'running' },
        processes.running
      );
      this.metrics.get('process_count').set(
        { node: process.env.NODE_NAME || 'localhost', state: 'sleeping' },
        processes.sleeping
      );
      this.metrics.get('process_count').set(
        { node: process.env.NODE_NAME || 'localhost', state: 'blocked' },
        processes.blocked
      );

      // Docker metrics if available
      try {
        const dockerContainers = await si.dockerContainers();
        dockerContainers.forEach(container => {
          this.metrics.get('container_cpu').set(
            {
              node: process.env.NODE_NAME || 'localhost',
              container: container.name,
              image: container.image
            },
            container.cpuPercent
          );
          this.metrics.get('container_memory').set(
            {
              node: process.env.NODE_NAME || 'localhost',
              container: container.name,
              image: container.image
            },
            container.memUsage
          );
        });
      } catch (error) {
        // Docker not available
      }
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  private async collectNodeMetrics() {
    try {
      const allNodes = await db.select().from(nodes);
      
      const onlineNodes = allNodes.filter(n => n.status === 'online').length;
      const offlineNodes = allNodes.filter(n => n.status === 'offline').length;
      
      this.metrics.get('nodes_total').set({ status: 'online' }, onlineNodes);
      this.metrics.get('nodes_total').set({ status: 'offline' }, offlineNodes);
      
      // Service availability
      allNodes.forEach(node => {
        this.metrics.get('service_up').set(
          {
            node: node.name,
            service: node.name,
            type: node.type
          },
          node.status === 'online' ? 1 : 0
        );
      });
    } catch (error) {
      console.error('Error collecting node metrics:', error);
    }
  }

  private async collectAlertMetrics() {
    try {
      const activeAlerts = await db.select().from(alerts).where(eq(alerts.status, 'active'));
      
      const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
      const warningAlerts = activeAlerts.filter(a => a.severity === 'warning').length;
      const infoAlerts = activeAlerts.filter(a => a.severity === 'info').length;
      
      this.metrics.get('alerts_active').set({ severity: 'critical', category: 'all' }, criticalAlerts);
      this.metrics.get('alerts_active').set({ severity: 'warning', category: 'all' }, warningAlerts);
      this.metrics.get('alerts_active').set({ severity: 'info', category: 'all' }, infoAlerts);
    } catch (error) {
      console.error('Error collecting alert metrics:', error);
    }
  }

  public recordApiRequest(method: string, endpoint: string, status: number, duration: number) {
    this.metrics.get('api_requests').inc({
      method,
      endpoint,
      status: `${Math.floor(status / 100)}xx`
    });
    
    this.metrics.get('api_duration').observe(
      { method, endpoint },
      duration / 1000 // Convert to seconds
    );
  }

  public recordServiceResponseTime(node: string, service: string, endpoint: string, responseTime: number) {
    this.metrics.get('service_response_time').observe(
      { node, service, endpoint },
      responseTime
    );
  }

  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  public getContentType(): string {
    return this.registry.contentType;
  }
}

export const prometheusExporter = new PrometheusExporter();