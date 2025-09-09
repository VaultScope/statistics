import * as dns from 'dns';
import * as net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { db } from '../../db/index';
import { nodes } from '../../db/index';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);
const dnsResolve = promisify(dns.resolve4);

interface ServiceEndpoint {
  id: string;
  name: string;
  type: 'http' | 'https' | 'tcp' | 'udp' | 'grpc' | 'database' | 'custom';
  host: string;
  port: number;
  protocol?: string;
  path?: string;
  healthCheck?: {
    enabled: boolean;
    interval: number;
    timeout: number;
    path?: string;
    method?: string;
  };
  metadata?: Record<string, any>;
  discovered: boolean;
  lastSeen: Date;
  status: 'healthy' | 'unhealthy' | 'unknown';
}

interface DiscoveryConfig {
  methods: Array<'dns' | 'kubernetes' | 'consul' | 'docker' | 'static' | 'network-scan'>;
  scanInterval: number;
  networkRanges?: string[];
  dnsServers?: string[];
  consulUrl?: string;
  kubernetesNamespace?: string;
  dockerSocket?: string;
  staticEndpoints?: ServiceEndpoint[];
}

export class ServiceDiscovery {
  private services: Map<string, ServiceEndpoint> = new Map();
  private config: DiscoveryConfig;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<DiscoveryConfig>) {
    this.config = {
      methods: config?.methods || ['dns', 'docker', 'static'],
      scanInterval: config?.scanInterval || 300000, // 5 minutes
      networkRanges: config?.networkRanges || ['192.168.0.0/16', '10.0.0.0/8'],
      dnsServers: config?.dnsServers,
      consulUrl: config?.consulUrl || process.env.CONSUL_URL,
      kubernetesNamespace: config?.kubernetesNamespace || 'default',
      dockerSocket: config?.dockerSocket || '/var/run/docker.sock',
      staticEndpoints: config?.staticEndpoints || []
    };

    this.initialize();
  }

  private async initialize() {
    // Load static endpoints
    if (this.config.staticEndpoints) {
      for (const endpoint of this.config.staticEndpoints) {
        this.services.set(endpoint.id, {
          ...endpoint,
          discovered: false,
          lastSeen: new Date(),
          status: 'unknown'
        });
      }
    }

    // Start discovery
    await this.discover();
    
    // Schedule periodic discovery
    this.discoveryInterval = setInterval(() => {
      this.discover();
    }, this.config.scanInterval);
  }

  public async discover(): Promise<void> {
    console.log('Starting service discovery...');
    
    const discoveryPromises = [];

    for (const method of this.config.methods) {
      switch (method) {
        case 'dns':
          discoveryPromises.push(this.discoverDNS());
          break;
        case 'kubernetes':
          discoveryPromises.push(this.discoverKubernetes());
          break;
        case 'consul':
          discoveryPromises.push(this.discoverConsul());
          break;
        case 'docker':
          discoveryPromises.push(this.discoverDocker());
          break;
        case 'network-scan':
          discoveryPromises.push(this.discoverNetworkScan());
          break;
      }
    }

    await Promise.allSettled(discoveryPromises);
    
    // Update database with discovered services
    await this.updateDatabase();
    
    // Start health checks for new services
    this.startHealthChecks();
    
    console.log(`Service discovery complete. Found ${this.services.size} services.`);
  }

  private async discoverDNS(): Promise<void> {
    try {
      // DNS-SD (Service Discovery)
      const domains = process.env.DISCOVERY_DOMAINS?.split(',') || ['local'];
      
      for (const domain of domains) {
        // Look for common service records
        const serviceTypes = [
          '_http._tcp',
          '_https._tcp',
          '_postgresql._tcp',
          '_mysql._tcp',
          '_mongodb._tcp',
          '_redis._tcp',
          '_elasticsearch._tcp',
          '_prometheus._tcp',
          '_grafana._tcp'
        ];

        for (const serviceType of serviceTypes) {
          try {
            const fullDomain = `${serviceType}.${domain}`;
            const records = await this.resolveSRV(fullDomain);
            
            for (const record of records) {
              const serviceId = `dns-${record.name}-${record.port}`;
              this.services.set(serviceId, {
                id: serviceId,
                name: record.name,
                type: this.inferServiceType(serviceType),
                host: record.target,
                port: record.port,
                discovered: true,
                lastSeen: new Date(),
                status: 'unknown',
                metadata: {
                  discoveryMethod: 'dns',
                  priority: record.priority,
                  weight: record.weight
                }
              });
            }
          } catch (error) {
            // DNS record not found, continue
          }
        }
      }
    } catch (error) {
      console.error('DNS discovery error:', error);
    }
  }

  private async discoverKubernetes(): Promise<void> {
    try {
      // Check if running in Kubernetes
      const { stdout: services } = await execAsync(
        `kubectl get services -n ${this.config.kubernetesNamespace} -o json`
      );
      
      const servicesData = JSON.parse(services);
      
      for (const service of servicesData.items) {
        const serviceName = service.metadata.name;
        const namespace = service.metadata.namespace;
        
        for (const port of service.spec.ports || []) {
          const serviceId = `k8s-${namespace}-${serviceName}-${port.port}`;
          
          this.services.set(serviceId, {
            id: serviceId,
            name: serviceName,
            type: this.inferServiceType(port.name || port.protocol),
            host: `${serviceName}.${namespace}.svc.cluster.local`,
            port: port.port,
            discovered: true,
            lastSeen: new Date(),
            status: 'unknown',
            metadata: {
              discoveryMethod: 'kubernetes',
              namespace,
              labels: service.metadata.labels,
              selector: service.spec.selector,
              targetPort: port.targetPort,
              protocol: port.protocol
            }
          });
        }
      }

      // Discover pods with direct pod IPs
      const { stdout: pods } = await execAsync(
        `kubectl get pods -n ${this.config.kubernetesNamespace} -o json`
      );
      
      const podsData = JSON.parse(pods);
      
      for (const pod of podsData.items) {
        if (pod.status.phase === 'Running' && pod.status.podIP) {
          const podId = `k8s-pod-${pod.metadata.name}`;
          
          for (const container of pod.spec.containers || []) {
            for (const port of container.ports || []) {
              const serviceId = `${podId}-${port.containerPort}`;
              
              this.services.set(serviceId, {
                id: serviceId,
                name: pod.metadata.name,
                type: this.inferServiceType(port.name || port.protocol),
                host: pod.status.podIP,
                port: port.containerPort,
                discovered: true,
                lastSeen: new Date(),
                status: 'unknown',
                metadata: {
                  discoveryMethod: 'kubernetes-pod',
                  namespace: pod.metadata.namespace,
                  labels: pod.metadata.labels,
                  containerName: container.name,
                  protocol: port.protocol
                }
              });
            }
          }
        }
      }
    } catch (error) {
      // Kubernetes not available or not configured
    }
  }

  private async discoverConsul(): Promise<void> {
    if (!this.config.consulUrl) return;

    try {
      const response = await axios.get(`${this.config.consulUrl}/v1/catalog/services`);
      const services = Object.keys(response.data);

      for (const serviceName of services) {
        const serviceResponse = await axios.get(
          `${this.config.consulUrl}/v1/catalog/service/${serviceName}`
        );

        for (const instance of serviceResponse.data) {
          const serviceId = `consul-${serviceName}-${instance.ServiceID}`;
          
          this.services.set(serviceId, {
            id: serviceId,
            name: serviceName,
            type: this.inferServiceType(serviceName),
            host: instance.ServiceAddress || instance.Address,
            port: instance.ServicePort,
            discovered: true,
            lastSeen: new Date(),
            status: 'unknown',
            metadata: {
              discoveryMethod: 'consul',
              node: instance.Node,
              datacenter: instance.Datacenter,
              tags: instance.ServiceTags,
              meta: instance.ServiceMeta
            },
            healthCheck: {
              enabled: true,
              interval: 30000,
              timeout: 5000,
              path: '/health'
            }
          });
        }
      }
    } catch (error) {
      console.error('Consul discovery error:', error);
    }
  }

  private async discoverDocker(): Promise<void> {
    try {
      const { stdout } = await execAsync('docker ps --format "{{json .}}"');
      const lines = stdout.trim().split('\n').filter(line => line);

      for (const line of lines) {
        const container = JSON.parse(line);
        const ports = container.Ports || '';
        
        // Parse port mappings
        const portRegex = /(\d+)\/tcp/g;
        let match;
        
        while ((match = portRegex.exec(ports)) !== null) {
          const port = parseInt(match[1]);
          const serviceId = `docker-${container.Names}-${port}`;
          
          // Get container IP
          const { stdout: inspectOutput } = await execAsync(
            `docker inspect ${container.ID} --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'`
          );
          const containerIP = inspectOutput.trim();

          if (containerIP) {
            this.services.set(serviceId, {
              id: serviceId,
              name: container.Names,
              type: this.inferServiceType(container.Image),
              host: containerIP,
              port,
              discovered: true,
              lastSeen: new Date(),
              status: container.State === 'running' ? 'unknown' : 'unhealthy',
              metadata: {
                discoveryMethod: 'docker',
                containerId: container.ID,
                image: container.Image,
                state: container.State,
                labels: container.Labels
              }
            });
          }
        }
      }
    } catch (error) {
      // Docker not available
    }
  }

  private async discoverNetworkScan(): Promise<void> {
    if (!this.config.networkRanges) return;

    for (const range of this.config.networkRanges) {
      // Scan common ports
      const commonPorts = [
        { port: 22, type: 'tcp', name: 'ssh' },
        { port: 80, type: 'http', name: 'http' },
        { port: 443, type: 'https', name: 'https' },
        { port: 3000, type: 'http', name: 'app' },
        { port: 3306, type: 'database', name: 'mysql' },
        { port: 5432, type: 'database', name: 'postgresql' },
        { port: 6379, type: 'tcp', name: 'redis' },
        { port: 8080, type: 'http', name: 'http-alt' },
        { port: 9090, type: 'http', name: 'prometheus' },
        { port: 9200, type: 'http', name: 'elasticsearch' },
        { port: 27017, type: 'database', name: 'mongodb' }
      ];

      // Parse network range
      const hosts = this.expandNetworkRange(range);
      
      for (const host of hosts) {
        for (const portInfo of commonPorts) {
          const isOpen = await this.isPortOpen(host, portInfo.port);
          
          if (isOpen) {
            const serviceId = `scan-${host}-${portInfo.port}`;
            
            this.services.set(serviceId, {
              id: serviceId,
              name: `${portInfo.name}-${host}`,
              type: portInfo.type as any,
              host,
              port: portInfo.port,
              discovered: true,
              lastSeen: new Date(),
              status: 'unknown',
              metadata: {
                discoveryMethod: 'network-scan',
                serviceName: portInfo.name
              }
            });
          }
        }
      }
    }
  }

  private async resolveSRV(domain: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      dns.resolveSrv(domain, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
  }

  private inferServiceType(identifier: string): ServiceEndpoint['type'] {
    const lower = identifier.toLowerCase();
    
    if (lower.includes('http')) return 'http';
    if (lower.includes('https')) return 'https';
    if (lower.includes('grpc')) return 'grpc';
    if (lower.includes('postgres') || lower.includes('mysql') || 
        lower.includes('mongo') || lower.includes('redis')) return 'database';
    if (lower.includes('tcp')) return 'tcp';
    if (lower.includes('udp')) return 'udp';
    
    return 'custom';
  }

  private expandNetworkRange(range: string): string[] {
    // Simple implementation for /24 networks
    const hosts: string[] = [];
    
    if (range.includes('/24')) {
      const base = range.split('/')[0];
      const parts = base.split('.');
      const prefix = parts.slice(0, 3).join('.');
      
      for (let i = 1; i <= 254; i++) {
        hosts.push(`${prefix}.${i}`);
      }
    } else if (range.includes('/16')) {
      // Limit scan for /16 to avoid too many hosts
      const base = range.split('/')[0];
      const parts = base.split('.');
      const prefix = parts.slice(0, 2).join('.');
      
      // Only scan first 10 hosts of each subnet for demo
      for (let i = 1; i <= 3; i++) {
        for (let j = 1; j <= 10; j++) {
          hosts.push(`${prefix}.${i}.${j}`);
        }
      }
    } else {
      hosts.push(range);
    }
    
    return hosts;
  }

  private async isPortOpen(host: string, port: number, timeout = 1000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  }

  private async updateDatabase(): Promise<void> {
    for (const [id, service] of this.services) {
      try {
        const existingNode = await db.select()
          .from(nodes)
          .where(eq(nodes.id, id))
          .get();

        if (existingNode) {
          await db.update(nodes)
            .set({
              name: service.name,
              host: service.host,
              port: service.port,
              status: service.status === 'healthy' ? 'online' : 'offline',
              lastSeen: service.lastSeen.toISOString(),
              metadata: JSON.stringify(service.metadata),
              updatedAt: new Date().toISOString()
            })
            .where(eq(nodes.id, id));
        } else {
          await db.insert(nodes).values({
            id,
            name: service.name,
            type: service.type,
            host: service.host,
            port: service.port,
            status: service.status === 'healthy' ? 'online' : 'offline',
            lastSeen: service.lastSeen.toISOString(),
            metadata: JSON.stringify(service.metadata),
            tags: JSON.stringify([]),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Failed to update database for service ${id}:`, error);
      }
    }
  }

  private startHealthChecks(): void {
    for (const [id, service] of this.services) {
      if (service.healthCheck?.enabled && !this.healthCheckIntervals.has(id)) {
        const interval = setInterval(() => {
          this.checkHealth(service);
        }, service.healthCheck.interval);
        
        this.healthCheckIntervals.set(id, interval);
        
        // Initial health check
        this.checkHealth(service);
      }
    }
  }

  private async checkHealth(service: ServiceEndpoint): Promise<void> {
    try {
      if (service.type === 'http' || service.type === 'https') {
        const url = `${service.type}://${service.host}:${service.port}${service.healthCheck?.path || '/health'}`;
        const response = await axios.get(url, {
          timeout: service.healthCheck?.timeout || 5000,
          validateStatus: () => true
        });
        
        service.status = response.status < 400 ? 'healthy' : 'unhealthy';
      } else {
        // TCP health check
        const isOpen = await this.isPortOpen(
          service.host, 
          service.port, 
          service.healthCheck?.timeout || 5000
        );
        service.status = isOpen ? 'healthy' : 'unhealthy';
      }
      
      service.lastSeen = new Date();
    } catch (error) {
      service.status = 'unhealthy';
    }
  }

  public getServices(): ServiceEndpoint[] {
    return Array.from(this.services.values());
  }

  public getService(id: string): ServiceEndpoint | undefined {
    return this.services.get(id);
  }

  public async addStaticService(service: Omit<ServiceEndpoint, 'discovered' | 'lastSeen' | 'status'>): Promise<void> {
    this.services.set(service.id, {
      ...service,
      discovered: false,
      lastSeen: new Date(),
      status: 'unknown'
    });
    
    await this.updateDatabase();
    
    if (service.healthCheck?.enabled) {
      this.startHealthChecks();
    }
  }

  public async removeService(id: string): Promise<void> {
    this.services.delete(id);
    
    const interval = this.healthCheckIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(id);
    }
    
    await db.delete(nodes).where(eq(nodes.id, id));
  }

  public stop(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
  }
}

export const serviceDiscovery = new ServiceDiscovery();