#!/usr/bin/env node

import si from 'systeminformation';
import axios from 'axios';
import { program } from 'commander';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MetricsData } from '../types/network';

const execAsync = promisify(exec);

interface AgentConfig {
  serverUrl: string;
  apiKey: string;
  interval: number;
  nodeName: string;
  tags: Record<string, string>;
  features: {
    docker: boolean;
    kubernetes: boolean;
    processes: boolean;
    network: boolean;
    services: boolean;
  };
}

class VaultScopeAgent {
  private config: AgentConfig;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async start() {
    if (this.isRunning) {
      console.log('Agent is already running');
      return;
    }

    console.log(`Starting VaultScope Agent...`);
    console.log(`Server: ${this.config.serverUrl}`);
    console.log(`Node: ${this.config.nodeName}`);
    console.log(`Interval: ${this.config.interval}s`);

    this.isRunning = true;
    
    // Initial collection
    await this.collectAndSend();
    
    // Schedule periodic collection with error handling
    this.intervalId = setInterval(async () => {
      try {
        await this.collectAndSend();
      } catch (error) {
        console.error('Error in periodic collection:', error);
      }
    }, this.config.interval * 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping VaultScope Agent...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    process.exit(0);
  }

  private async collectAndSend() {
    try {
      const metrics = await this.collectMetrics();
      await this.sendMetrics(metrics);
    } catch (error) {
      console.error('Failed to collect or send metrics:', error);
    }
  }

  private async collectMetrics() {
    const [
      cpu,
      memory,
      disk,
      network,
      processes,
      docker,
      kubernetes,
      services
    ] = await Promise.allSettled([
      this.collectCPU(),
      this.collectMemory(),
      this.collectDisk(),
      this.collectNetwork(),
      this.config.features.processes ? this.collectProcesses() : Promise.resolve(null),
      this.config.features.docker ? this.collectDocker() : Promise.resolve(null),
      this.config.features.kubernetes ? this.collectKubernetes() : Promise.resolve(null),
      this.config.features.services ? this.collectServices() : Promise.resolve(null)
    ]);

    return {
      timestamp: new Date().toISOString(),
      node: this.config.nodeName,
      tags: this.config.tags,
      cpu: cpu.status === 'fulfilled' ? cpu.value : null,
      memory: memory.status === 'fulfilled' ? memory.value : null,
      disk: disk.status === 'fulfilled' ? disk.value : null,
      network: network.status === 'fulfilled' ? network.value : null,
      processes: processes.status === 'fulfilled' ? processes.value : null,
      docker: docker.status === 'fulfilled' ? docker.value : null,
      kubernetes: kubernetes.status === 'fulfilled' ? kubernetes.value : null,
      services: services.status === 'fulfilled' ? services.value : null
    };
  }

  private async collectCPU() {
    const cpuData = await si.cpu();
    const cpuLoad = await si.currentLoad();
    const cpuTemp = await si.cpuTemperature();
    
    return {
      manufacturer: cpuData.manufacturer,
      brand: cpuData.brand,
      speed: cpuData.speed,
      cores: cpuData.cores,
      physicalCores: cpuData.physicalCores,
      usage: cpuLoad.currentLoad,
      user: cpuLoad.currentLoadUser,
      system: cpuLoad.currentLoadSystem,
      idle: cpuLoad.currentLoadIdle,
      temperature: cpuTemp.main,
      loadAverage: os.loadavg()
    };
  }

  private async collectMemory() {
    const mem = await si.mem();
    
    return {
      total: mem.total,
      free: mem.free,
      used: mem.used,
      active: mem.active,
      available: mem.available,
      buffers: mem.buffers,
      cached: mem.cached,
      swap: {
        total: mem.swaptotal,
        used: mem.swapused,
        free: mem.swapfree
      },
      usage: (mem.used / mem.total) * 100
    };
  }

  private async collectDisk() {
    const diskLayout = await si.diskLayout();
    const blockDevices = await si.blockDevices();
    const fsSize = await si.fsSize();
    const diskIO = await si.disksIO();
    
    return {
      devices: diskLayout.map(disk => ({
        device: disk.device,
        type: disk.type,
        name: disk.name,
        vendor: disk.vendor,
        size: disk.size,
        interfaceType: disk.interfaceType
      })),
      filesystems: fsSize.map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        use: fs.use,
        mount: fs.mount
      })),
      io: {
        rIO: diskIO.rIO,
        wIO: diskIO.wIO,
        tIO: diskIO.tIO,
        rIO_sec: diskIO.rIO_sec,
        wIO_sec: diskIO.wIO_sec,
        tIO_sec: diskIO.tIO_sec
      }
    };
  }

  private async collectNetwork() {
    const networkInterfaces = await si.networkInterfaces();
    const networkStats = await si.networkStats();
    const networkConnections = await si.networkConnections();
    
    return {
      interfaces: networkInterfaces.map(iface => ({
        iface: iface.iface,
        ip4: iface.ip4,
        ip6: iface.ip6,
        mac: iface.mac,
        internal: iface.internal,
        virtual: iface.virtual,
        type: iface.type,
        speed: iface.speed,
        dhcp: iface.dhcp
      })),
      stats: networkStats.map(stat => ({
        iface: stat.iface,
        rx_bytes: stat.rx_bytes,
        rx_dropped: stat.rx_dropped,
        rx_errors: stat.rx_errors,
        tx_bytes: stat.tx_bytes,
        tx_dropped: stat.tx_dropped,
        tx_errors: stat.tx_errors,
        rx_sec: stat.rx_sec,
        tx_sec: stat.tx_sec
      })),
      connections: networkConnections.length
    };
  }

  private async collectProcesses() {
    const processes = await si.processes();
    
    // Get top 10 processes by CPU usage
    const topCPU = processes.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 10)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu,
        mem: p.mem,
        state: p.state,
        started: p.started,
        user: p.user
      }));
    
    // Get top 10 processes by memory usage
    const topMem = processes.list
      .sort((a, b) => b.mem - a.mem)
      .slice(0, 10)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu,
        mem: p.mem,
        state: p.state,
        started: p.started,
        user: p.user
      }));
    
    return {
      all: processes.all,
      running: processes.running,
      blocked: processes.blocked,
      sleeping: processes.sleeping,
      unknown: processes.unknown,
      topCPU,
      topMem
    };
  }

  private async collectDocker() {
    try {
      const dockerInfo = await si.dockerInfo();
      const dockerContainers = await si.dockerContainers();
      
      return {
        version: dockerInfo.version,
        containers: dockerInfo.containers,
        containersRunning: dockerInfo.containersRunning,
        containersPaused: dockerInfo.containersPaused,
        containersStopped: dockerInfo.containersStopped,
        images: dockerInfo.images,
        memTotal: dockerInfo.memTotal,
        memLimit: dockerInfo.memLimit,
        containerList: dockerContainers.map(c => ({
          id: c.id,
          name: c.name,
          image: c.image,
          state: c.state,
          status: c.status,
          cpu: c.cpuPercent,
          memory: c.memPercent,
          netIO: {
            rx: c.netIO.rx,
            tx: c.netIO.tx
          },
          blockIO: {
            r: c.blockIO.r,
            w: c.blockIO.w
          }
        }))
      };
    } catch (error) {
      return null;
    }
  }

  private async collectKubernetes() {
    try {
      // Check if kubectl is available
      const { stdout: kubectlVersion } = await execAsync('kubectl version --client --output=json');
      const version = JSON.parse(kubectlVersion);
      
      // Get node info
      const { stdout: nodeInfo } = await execAsync('kubectl get nodes -o json');
      const nodes = JSON.parse(nodeInfo);
      
      // Get pod info
      const { stdout: podInfo } = await execAsync('kubectl get pods --all-namespaces -o json');
      const pods = JSON.parse(podInfo);
      
      return {
        version: version.clientVersion,
        nodes: nodes.items.length,
        pods: {
          total: pods.items.length,
          running: pods.items.filter((p: any) => p.status.phase === 'Running').length,
          pending: pods.items.filter((p: any) => p.status.phase === 'Pending').length,
          failed: pods.items.filter((p: any) => p.status.phase === 'Failed').length
        }
      };
    } catch (error) {
      return null;
    }
  }

  private async collectServices() {
    const services = await si.services('*');
    
    // Filter for important services
    const importantServices = services.filter(s => 
      s.name.includes('docker') ||
      s.name.includes('kubelet') ||
      s.name.includes('nginx') ||
      s.name.includes('apache') ||
      s.name.includes('mysql') ||
      s.name.includes('postgres') ||
      s.name.includes('redis') ||
      s.name.includes('mongo') ||
      s.name.includes('elastic')
    );
    
    return importantServices.map(s => ({
      name: s.name,
      running: s.running,
      startmode: s.startmode,
      cpu: s.cpu,
      mem: s.mem
    }));
  }

  private async sendMetrics(metrics: MetricsData) {
    try {
      const response = await axios.post(
        `${this.config.serverUrl}/api/agent/metrics`,
        metrics,
        {
          headers: {
            'x-api-key': this.config.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      console.log(`Metrics sent successfully at ${new Date().toISOString()}`);
    } catch (error: any) {
      console.error('Failed to send metrics:', error.message);
    }
  }
}

// CLI
program
  .name('vaultscope-agent')
  .description('VaultScope Monitoring Agent')
  .version('1.0.0');

program
  .option('-s, --server <url>', 'VaultScope server URL', 'http://localhost:4000')
  .option('-k, --key <apikey>', 'API key for authentication')
  .option('-i, --interval <seconds>', 'Collection interval in seconds', '30')
  .option('-n, --name <name>', 'Node name', os.hostname())
  .option('-t, --tags <tags>', 'Comma-separated tags (key=value)', '')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--docker', 'Enable Docker monitoring', false)
  .option('--kubernetes', 'Enable Kubernetes monitoring', false)
  .option('--processes', 'Enable process monitoring', false)
  .option('--services', 'Enable service monitoring', false)
  .action((options) => {
    let config: AgentConfig;
    
    if (options.config) {
      // Load from config file
      const configPath = path.resolve(options.config);
      if (!fs.existsSync(configPath)) {
        console.error(`Config file not found: ${configPath}`);
        process.exit(1);
      }
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } else {
      // Build from CLI options
      if (!options.key) {
        console.error('API key is required. Use -k or --key option.');
        process.exit(1);
      }
      
      const tags: Record<string, string> = {};
      if (options.tags) {
        options.tags.split(',').forEach((tag: string) => {
          const [key, value] = tag.split('=');
          if (key && value) {
            tags[key.trim()] = value.trim();
          }
        });
      }
      
      config = {
        serverUrl: options.server,
        apiKey: options.key,
        interval: parseInt(options.interval),
        nodeName: options.name,
        tags,
        features: {
          docker: options.docker,
          kubernetes: options.kubernetes,
          processes: options.processes,
          network: true,
          services: options.services
        }
      };
    }
    
    const agent = new VaultScopeAgent(config);
    agent.start();
  });

program.parse();

export { VaultScopeAgent, AgentConfig };