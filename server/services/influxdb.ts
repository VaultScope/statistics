import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';
import { BucketsAPI, OrgsAPI } from '@influxdata/influxdb-client-apis';

interface InfluxConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
  retentionDays?: number;
}

export class InfluxDBService {
  private client: InfluxDB;
  private writeApi: WriteApi;
  private queryApi: QueryApi;
  private config: InfluxConfig;
  private isConnected: boolean = false;

  constructor(config?: InfluxConfig) {
    this.config = config || {
      url: process.env.INFLUX_URL || 'http://localhost:8086',
      token: process.env.INFLUX_TOKEN || 'mytoken',
      org: process.env.INFLUX_ORG || 'vaultscope',
      bucket: process.env.INFLUX_BUCKET || 'metrics',
      retentionDays: parseInt(process.env.INFLUX_RETENTION_DAYS || '90')
    };

    this.client = new InfluxDB({
      url: this.config.url,
      token: this.config.token
    });

    this.writeApi = this.client.getWriteApi(
      this.config.org,
      this.config.bucket,
      'ms'
    );

    this.queryApi = this.client.getQueryApi(this.config.org);
    
    // Set default tags for all points
    this.writeApi.useDefaultTags({
      source: 'vaultscope',
      environment: process.env.NODE_ENV || 'development'
    });

    this.initialize();
  }

  private async initialize() {
    try {
      // Verify connection and create bucket if needed
      await this.ensureBucket();
      this.isConnected = true;
      console.log('InfluxDB connected successfully');
    } catch (error) {
      console.error('Failed to connect to InfluxDB:', error);
      this.isConnected = false;
    }
  }

  private async ensureBucket() {
    const bucketsAPI = new BucketsAPI(this.client);
    const orgsAPI = new OrgsAPI(this.client);

    try {
      // Get organization
      const organizations = await orgsAPI.getOrgs({ org: this.config.org });
      const orgID = organizations.orgs?.[0]?.id;

      if (!orgID) {
        throw new Error(`Organization ${this.config.org} not found`);
      }

      // Check if bucket exists
      const buckets = await bucketsAPI.getBuckets({ orgID, name: this.config.bucket });
      
      if (!buckets.buckets || buckets.buckets.length === 0) {
        // Create bucket with retention policy
        await bucketsAPI.postBuckets({
          body: {
            orgID,
            name: this.config.bucket,
            retentionRules: [{
              type: 'expire',
              everySeconds: this.config.retentionDays! * 24 * 60 * 60
            }]
          }
        });
        console.log(`Created InfluxDB bucket: ${this.config.bucket}`);
      }
    } catch (error) {
      console.error('Failed to ensure bucket:', error);
    }
  }

  // Write node metrics
  async writeNodeMetrics(nodeId: string, metrics: any) {
    if (!this.isConnected) {
      console.warn('InfluxDB not connected, metrics not written');
      return;
    }

    try {
      // CPU metrics
      if (metrics.cpu) {
        const cpuPoint = new Point('cpu')
          .tag('node_id', nodeId)
          .floatField('usage', metrics.cpu.usage || 0)
          .floatField('temperature', metrics.cpu.temperature || 0)
          .floatField('load_1m', metrics.cpu.loadAverage?.[0] || 0)
          .floatField('load_5m', metrics.cpu.loadAverage?.[1] || 0)
          .floatField('load_15m', metrics.cpu.loadAverage?.[2] || 0)
          .timestamp(new Date());
        
        this.writeApi.writePoint(cpuPoint);
      }

      // Memory metrics
      if (metrics.memory) {
        const memPoint = new Point('memory')
          .tag('node_id', nodeId)
          .intField('total', metrics.memory.total || 0)
          .intField('used', metrics.memory.used || 0)
          .intField('free', metrics.memory.free || 0)
          .floatField('usage', metrics.memory.usage || 0)
          .intField('swap_total', metrics.memory.swap?.total || 0)
          .intField('swap_used', metrics.memory.swap?.used || 0)
          .timestamp(new Date());
        
        this.writeApi.writePoint(memPoint);
      }

      // Disk metrics
      if (metrics.disk?.filesystems) {
        for (const fs of metrics.disk.filesystems) {
          const diskPoint = new Point('disk')
            .tag('node_id', nodeId)
            .tag('mount', fs.mount)
            .tag('filesystem', fs.fs)
            .intField('size', fs.size || 0)
            .intField('used', fs.used || 0)
            .intField('available', fs.available || 0)
            .floatField('usage', fs.use || 0)
            .timestamp(new Date());
          
          this.writeApi.writePoint(diskPoint);
        }
      }

      // Network metrics
      if (metrics.network?.stats) {
        for (const stat of metrics.network.stats) {
          const netPoint = new Point('network')
            .tag('node_id', nodeId)
            .tag('interface', stat.iface)
            .intField('rx_bytes', stat.rx_bytes || 0)
            .intField('tx_bytes', stat.tx_bytes || 0)
            .intField('rx_sec', stat.rx_sec || 0)
            .intField('tx_sec', stat.tx_sec || 0)
            .intField('rx_errors', stat.rx_errors || 0)
            .intField('tx_errors', stat.tx_errors || 0)
            .timestamp(new Date());
          
          this.writeApi.writePoint(netPoint);
        }
      }

      // Process metrics
      if (metrics.processes) {
        const processPoint = new Point('processes')
          .tag('node_id', nodeId)
          .intField('total', metrics.processes.all || 0)
          .intField('running', metrics.processes.running || 0)
          .intField('sleeping', metrics.processes.sleeping || 0)
          .intField('blocked', metrics.processes.blocked || 0)
          .timestamp(new Date());
        
        this.writeApi.writePoint(processPoint);
      }

      // Docker metrics
      if (metrics.docker) {
        const dockerPoint = new Point('docker')
          .tag('node_id', nodeId)
          .intField('containers', metrics.docker.containers || 0)
          .intField('containers_running', metrics.docker.containersRunning || 0)
          .intField('containers_stopped', metrics.docker.containersStopped || 0)
          .intField('images', metrics.docker.images || 0)
          .timestamp(new Date());
        
        this.writeApi.writePoint(dockerPoint);

        // Container-specific metrics
        if (metrics.docker.containerList) {
          for (const container of metrics.docker.containerList) {
            const containerPoint = new Point('docker_container')
              .tag('node_id', nodeId)
              .tag('container_id', container.id)
              .tag('container_name', container.name)
              .tag('image', container.image)
              .tag('state', container.state)
              .floatField('cpu', container.cpu || 0)
              .floatField('memory', container.memory || 0)
              .intField('net_rx', container.netIO?.rx || 0)
              .intField('net_tx', container.netIO?.tx || 0)
              .intField('block_r', container.blockIO?.r || 0)
              .intField('block_w', container.blockIO?.w || 0)
              .timestamp(new Date());
            
            this.writeApi.writePoint(containerPoint);
          }
        }
      }

      // Flush writes
      await this.writeApi.flush();
    } catch (error) {
      console.error('Failed to write metrics to InfluxDB:', error);
    }
  }

  // Write alert events
  async writeAlertEvent(alert: any, value: number) {
    if (!this.isConnected) return;

    try {
      const alertPoint = new Point('alerts')
        .tag('alert_id', alert.id.toString())
        .tag('node_id', alert.nodeId.toString())
        .tag('metric', alert.metric)
        .tag('severity', alert.severity)
        .tag('condition', alert.condition)
        .floatField('value', value)
        .floatField('threshold', alert.threshold)
        .stringField('message', `Alert triggered: ${alert.metric} ${alert.condition} ${alert.threshold}`)
        .timestamp(new Date());
      
      this.writeApi.writePoint(alertPoint);
      await this.writeApi.flush();
    } catch (error) {
      console.error('Failed to write alert event:', error);
    }
  }

  // Query methods
  async queryMetrics(
    nodeId: string,
    measurement: string,
    timeRange: string = '-1h',
    aggregation?: string
  ): Promise<any[]> {
    if (!this.isConnected) return [];

    const aggregationFunc = aggregation || 'mean';
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r["_measurement"] == "${measurement}")
        |> filter(fn: (r) => r["node_id"] == "${nodeId}")
        |> aggregateWindow(every: 1m, fn: ${aggregationFunc}, createEmpty: false)
        |> yield(name: "result")
    `;

    try {
      const results: any[] = [];
      await this.queryApi.collectRows(query, (row: any, tableMeta: any) => {
        const o = tableMeta.toObject(row);
        results.push(o);
      });
      return results;
    } catch (error) {
      console.error('Failed to query metrics:', error);
      return [];
    }
  }

  async queryAggregatedMetrics(
    nodeId: string,
    measurement: string,
    field: string,
    timeRange: string = '-1h',
    window: string = '5m',
    aggregation: string = 'mean'
  ): Promise<any[]> {
    if (!this.isConnected) return [];

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r["_measurement"] == "${measurement}")
        |> filter(fn: (r) => r["node_id"] == "${nodeId}")
        |> filter(fn: (r) => r["_field"] == "${field}")
        |> aggregateWindow(every: ${window}, fn: ${aggregation}, createEmpty: false)
        |> yield(name: "aggregated")
    `;

    try {
      const results: any[] = [];
      await this.queryApi.collectRows(query, (row: any, tableMeta: any) => {
        const o = tableMeta.toObject(row);
        results.push({
          time: o._time,
          value: o._value,
          field: o._field,
          measurement: o._measurement
        });
      });
      return results;
    } catch (error) {
      console.error('Failed to query aggregated metrics:', error);
      return [];
    }
  }

  async queryTopProcesses(nodeId: string, limit: number = 10): Promise<any[]> {
    if (!this.isConnected) return [];

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: -5m)
        |> filter(fn: (r) => r["_measurement"] == "processes")
        |> filter(fn: (r) => r["node_id"] == "${nodeId}")
        |> last()
        |> top(n: ${limit}, columns: ["_value"])
    `;

    try {
      const results: any[] = [];
      await this.queryApi.collectRows(query, (row: any, tableMeta: any) => {
        results.push(tableMeta.toObject(row));
      });
      return results;
    } catch (error) {
      console.error('Failed to query top processes:', error);
      return [];
    }
  }

  // Get historical data for charts
  async getHistoricalData(
    nodeId: string,
    metrics: string[],
    timeRange: string = '-24h',
    resolution: string = '5m'
  ): Promise<Record<string, any[]>> {
    if (!this.isConnected) return {};

    const data: Record<string, any[]> = {};

    for (const metric of metrics) {
      const [measurement, field] = metric.split('.');
      const results = await this.queryAggregatedMetrics(
        nodeId,
        measurement,
        field,
        timeRange,
        resolution,
        'mean'
      );
      data[metric] = results;
    }

    return data;
  }

  // Calculate SLA metrics
  async calculateSLA(
    nodeId: string,
    timeRange: string = '-30d'
  ): Promise<{
    uptime: number;
    availability: number;
    mtbf: number;
    mttr: number;
  }> {
    if (!this.isConnected) {
      return { uptime: 0, availability: 0, mtbf: 0, mttr: 0 };
    }

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r["_measurement"] == "cpu")
        |> filter(fn: (r) => r["node_id"] == "${nodeId}")
        |> filter(fn: (r) => r["_field"] == "usage")
        |> aggregateWindow(every: 1m, fn: mean, createEmpty: true)
        |> map(fn: (r) => ({ r with _value: if r._value > 0.0 then 1.0 else 0.0 }))
        |> sum()
    `;

    try {
      let totalPoints = 0;
      let availablePoints = 0;

      await this.queryApi.collectRows(query, (row: any, tableMeta: any) => {
        const o = tableMeta.toObject(row);
        totalPoints++;
        if (o._value > 0) availablePoints++;
      });

      const availability = totalPoints > 0 ? (availablePoints / totalPoints) * 100 : 0;
      const uptime = availability; // Simplified for now

      return {
        uptime,
        availability,
        mtbf: 720, // Mean time between failures (hours) - placeholder
        mttr: 4    // Mean time to repair (hours) - placeholder
      };
    } catch (error) {
      console.error('Failed to calculate SLA:', error);
      return { uptime: 0, availability: 0, mtbf: 0, mttr: 0 };
    }
  }

  // Cleanup and close connections
  async close() {
    try {
      await this.writeApi.close();
      console.log('InfluxDB connection closed');
    } catch (error) {
      console.error('Error closing InfluxDB connection:', error);
    }
  }
}

// Export singleton instance
export default new InfluxDBService();