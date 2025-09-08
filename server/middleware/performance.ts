import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import os from 'os';
import v8 from 'v8';

interface PerformanceMetrics {
  requests: {
    total: number;
    active: number;
    avgResponseTime: number;
    p50: number;
    p95: number;
    p99: number;
  };
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
    percent: number;
  };
  gc: {
    count: number;
    pauseMs: number;
    reclaimed: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private responseTimes: number[] = [];
  private gcMetrics = { count: 0, pauseMs: 0, reclaimed: 0 };
  private lastCpuUsage = process.cpuUsage();
  private metricsInterval?: NodeJS.Timeout;

  constructor() {
    this.metrics = this.initMetrics();
    this.setupGCTracking();
    this.startMetricsCollection();
  }

  private initMetrics(): PerformanceMetrics {
    return {
      requests: {
        total: 0,
        active: 0,
        avgResponseTime: 0,
        p50: 0,
        p95: 0,
        p99: 0
      },
      memory: {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0
      },
      cpu: {
        user: 0,
        system: 0,
        percent: 0
      },
      gc: {
        count: 0,
        pauseMs: 0,
        reclaimed: 0
      }
    };
  }

  private setupGCTracking() {
    // GC tracking disabled due to type constraints
    // Would require --expose-gc flag and custom types
  }

  private startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 5000); // Update every 5 seconds
  }

  private updateMetrics() {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0
    };

    // CPU metrics
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / 1000000 * 100;
    this.metrics.cpu = {
      user: currentCpuUsage.user,
      system: currentCpuUsage.system,
      percent: Math.min(100, cpuPercent / os.cpus().length)
    };
    this.lastCpuUsage = process.cpuUsage();

    // Response time percentiles
    if (this.responseTimes.length > 0) {
      this.responseTimes.sort((a, b) => a - b);
      this.metrics.requests.p50 = this.percentile(this.responseTimes, 50);
      this.metrics.requests.p95 = this.percentile(this.responseTimes, 95);
      this.metrics.requests.p99 = this.percentile(this.responseTimes, 99);
      this.metrics.requests.avgResponseTime = 
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    // GC metrics
    this.metrics.gc = { ...this.gcMetrics };

    // Keep only recent response times (last 1000)
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  private percentile(arr: number[], p: number): number {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = performance.now();
      this.metrics.requests.total++;
      this.metrics.requests.active++;

      // Track response
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]): Response {
        const duration = performance.now() - start;
        performanceMonitor.responseTimes.push(duration);
        performanceMonitor.metrics.requests.active--;

        // Add performance headers
        res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
        res.setHeader('X-Server-Id', process.env.SERVER_ID || 'vaultscope-1');

        return originalEnd.apply(this, args as any);
      } as any;

      next();
    };
  }

  getMetrics(): PerformanceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  getHealthStatus() {
    const metrics = this.getMetrics();
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    
    return {
      status: memoryUsagePercent < 90 && metrics.cpu.percent < 80 ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      metrics: {
        memory: {
          used: metrics.memory.heapUsed,
          total: metrics.memory.heapTotal,
          percent: memoryUsagePercent
        },
        cpu: {
          percent: metrics.cpu.percent
        },
        requests: {
          total: metrics.requests.total,
          active: metrics.requests.active,
          avgResponseTime: metrics.requests.avgResponseTime,
          p95: metrics.requests.p95
        }
      }
    };
  }

  // Memory leak detection
  detectMemoryLeaks() {
    const heapSnapshots: number[] = [];
    
    return setInterval(() => {
      const heapUsed = process.memoryUsage().heapUsed;
      heapSnapshots.push(heapUsed);
      
      // Keep last 10 snapshots
      if (heapSnapshots.length > 10) {
        heapSnapshots.shift();
      }
      
      // Check for consistent growth
      if (heapSnapshots.length === 10) {
        const increasing = heapSnapshots.every((val, i) => 
          i === 0 || val > heapSnapshots[i - 1]
        );
        
        if (increasing) {
          console.warn('Potential memory leak detected!');
          console.warn('Heap snapshots:', heapSnapshots);
          
          // Take heap snapshot for analysis
          if (v8.writeHeapSnapshot) {
            const filename = `heap-${Date.now()}.heapsnapshot`;
            v8.writeHeapSnapshot(filename);
            console.warn(`Heap snapshot written to ${filename}`);
          }
        }
      }
    }, 60000); // Check every minute
  }

  destroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export middleware and monitor
export const performanceMiddleware = performanceMonitor.middleware();
export { performanceMonitor };