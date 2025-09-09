import express from "express";
import { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import limiter from "./functions/rateLimit";
import authenticate, { AuthRequest } from "./functions/auth";
import createApiKey from "./functions/keys/createKey";
import { deleteApiKey } from "./functions/keys/deleteKey";
import listKeys from "./functions/keys/manageKey";
import { updateApiKeyPermissions, getApiKey } from "./functions/keys/updateKey";
import Permissions from "./types/api/keys/permissions";
import { getApiLogs, getApiKeyStats, clearApiLogs } from "./functions/logs/apiLogger";
import alertsRouter from "./routes/alerts";
import alertEngine from "./services/alertEngine";
import { compressionMiddleware } from "./middleware/compression";
import { performanceMiddleware, performanceMonitor } from "./middleware/performance";
import config, { validateConfig } from "./config/environment";
import databaseInitializer from "./services/databaseInitializer";

// Validate configuration on startup
try {
  validateConfig();
} catch (error) {
  console.error('Configuration error:', error);
  process.exit(1);
}

const app = express();
const port = config.server.port;

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m'
};

const log = {
    info: (msg: string) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    error: (msg: string) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    warn: (msg: string) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
    request: (method: string, path: string, status?: number) => {
        const methodColor = method === 'GET' ? colors.cyan : 
                           method === 'POST' ? colors.green :
                           method === 'PUT' ? colors.yellow :
                           method === 'DELETE' ? colors.red : colors.white;
        const statusColor = status ? (status < 300 ? colors.green : status < 400 ? colors.yellow : colors.red) : '';
        const statusText = status ? ` → ${statusColor}${status}${colors.reset}` : '';
        console.log(`${colors.magenta}[REQ]${colors.reset} ${methodColor}${method}${colors.reset} ${path}${statusText}`);
    }
};

app.set('trust proxy', 'loopback');
log.info('Trust proxy set to loopback');

// Apply compression middleware
app.use(compressionMiddleware);

// Apply performance monitoring middleware
app.use(performanceMiddleware);

// Security headers middleware
app.use((req: Request, res: Response, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Remove server header for security
    res.removeHeader('X-Powered-By');
    
    next();
});

// Configure CORS with environment settings
const corsOptions = {
    origin: config.security.corsOrigin === '*' ? true : config.security.corsOrigin.split(',').map(o => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-client-id'],
    maxAge: 86400 // 24 hours
};

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors(corsOptions));
app.use(limiter);

// Mount alerts router
app.use('/api', alertsRouter);

app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    const originalSend = res.send;
    res.send = function(data) {
        res.send = originalSend;
        const duration = Date.now() - start;
        log.request(req.method, req.path, res.statusCode);
        if (duration > 1000) {
            log.warn(`Slow response: ${duration}ms`);
        }
        return res.send(data);
    };
    next();
});

app.get("/health", (req, res) => {
    const health = performanceMonitor.getHealthStatus();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

app.get("/metrics", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
    const metrics = performanceMonitor.getMetrics();
    res.status(200).json(metrics);
});

app.post("/api/keys", authenticate(["createApiKey"]), async (req: AuthRequest, res: Response) => {
    const { name, permissions } = req.body;
    
    if (!name || typeof name !== "string") {
        log.error(`Invalid API key creation request - missing or invalid name`);
        return res.status(400).json({ error: "Name is required" });
    }
    
    log.info(`Creating API key: ${name}`);
    
    const defaultPermissions: Permissions = {
        viewStats: true,
        createApiKey: false,
        deleteApiKey: false,
        viewApiKeys: false,
        usePowerCommands: false
    };
    
    const finalPermissions = { ...defaultPermissions, ...(permissions || {}) };
    
    try {
        const key = await createApiKey(name, finalPermissions);
        log.success(`API key created: ${name} (UUID: ${key.uuid})`);
        res.status(201).json(key);
    } catch (error) {
        log.error(`Failed to create API key: ${name} - ${error}`);
        res.status(500).json({ error: "Failed to create API key" });
    }
});

app.get("/api/keys", authenticate(["viewApiKeys"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching all API keys');
    try {
        const keys = await listKeys.list();
        const sanitizedKeys = keys.map(k => ({
            uuid: k.uuid,
            name: k.name,
            permissions: k.permissions,
            createdAt: k.createdAt
        }));
        log.success(`Retrieved ${keys.length} API keys`);
        res.status(200).json(sanitizedKeys);
    } catch (error) {
        log.error(`Failed to list API keys: ${error}`);
        res.status(500).json({ error: "Failed to list API keys" });
    }
});

app.get("/api/keys/:identifier", authenticate(["viewApiKeys"]), async (req: AuthRequest, res: Response) => {
    const { identifier } = req.params;
    
    if (!identifier) {
        log.error('API key fetch attempted without identifier');
        return res.status(400).json({ error: "Key identifier is required" });
    }
    
    log.info(`Fetching API key: ${identifier}`);
    
    try {
        const key = await getApiKey(identifier);
        if (key) {
            const sanitizedKey = {
                uuid: key.uuid,
                name: key.name,
                permissions: key.permissions,
                createdAt: key.createdAt
            };
            log.success(`API key found: ${key.name}`);
            res.status(200).json(sanitizedKey);
        } else {
            log.warn(`API key not found: ${identifier}`);
            res.status(404).json({ error: "API key not found" });
        }
    } catch (error) {
        log.error(`Failed to get API key ${identifier}: ${error}`);
        res.status(500).json({ error: "Failed to get API key" });
    }
});

app.put("/api/keys/:identifier/permissions", authenticate(["createApiKey"]), async (req: AuthRequest, res: Response) => {
    const { identifier } = req.params;
    const { permissions } = req.body;
    
    if (!identifier) {
        log.error('Permission update attempted without identifier');
        return res.status(400).json({ error: "Key identifier is required" });
    }
    
    if (!permissions || typeof permissions !== "object") {
        log.error(`Invalid permissions object for key ${identifier}`);
        return res.status(400).json({ error: "Valid permissions object is required" });
    }
    
    log.info(`Updating permissions for API key: ${identifier}`);
    
    try {
        const success = await updateApiKeyPermissions(identifier, permissions);
        if (success) {
            log.success(`Permissions updated for API key: ${identifier}`);
            res.status(200).json({ message: "API key permissions updated successfully" });
        } else {
            log.warn(`API key not found for permission update: ${identifier}`);
            res.status(404).json({ error: "API key not found" });
        }
    } catch (error) {
        log.error(`Failed to update permissions for ${identifier}: ${error}`);
        res.status(500).json({ error: "Failed to update API key permissions" });
    }
});

app.delete("/api/keys/:identifier", authenticate(["deleteApiKey"]), async (req: AuthRequest, res: Response) => {
    const { identifier } = req.params;
    
    if (!identifier) {
        log.error('Delete attempted without identifier');
        return res.status(400).json({ error: "Key identifier is required" });
    }
    
    log.warn(`Deleting API key: ${identifier}`);
    
    try {
        const success = await deleteApiKey(identifier);
        if (success) {
            log.success(`API key deleted: ${identifier}`);
            res.status(200).json({ message: "API key deleted successfully" });
        } else {
            log.warn(`API key not found for deletion: ${identifier}`);
            res.status(404).json({ error: "API key not found" });
        }
    } catch (error) {
        log.error(`Failed to delete API key ${identifier}: ${error}`);
        res.status(500).json({ error: "Failed to delete API key" });
    }
});

app.get("/api/logs", authenticate(["viewApiKeys"]), async (req: AuthRequest, res: Response) => {
    const { apiKeyId, limit } = req.query;
    const logLimit = limit ? parseInt(limit as string) : 100;
    log.info(`Fetching API logs${apiKeyId ? ` for key ${apiKeyId}` : ''} (limit: ${logLimit})`);
    
    try {
        const logs = await getApiLogs(
            apiKeyId as string | undefined, 
            logLimit
        );
        log.success(`Retrieved ${logs.length} log entries`);
        res.status(200).json(logs);
    } catch (error) {
        log.error(`Failed to fetch API logs: ${error}`);
        res.status(500).json({ error: "Failed to fetch API logs" });
    }
});

app.get("/api/logs/stats/:apiKeyId", authenticate(["viewApiKeys"]), async (req: AuthRequest, res: Response) => {
    const { apiKeyId } = req.params;
    log.info(`Fetching statistics for API key: ${apiKeyId}`);
    
    try {
        const stats = await getApiKeyStats(apiKeyId);
        log.success(`Statistics retrieved for API key: ${apiKeyId}`);
        res.status(200).json(stats);
    } catch (error) {
        log.error(`Failed to fetch stats for ${apiKeyId}: ${error}`);
        res.status(500).json({ error: "Failed to fetch API key statistics" });
    }
});

app.delete("/api/logs", authenticate(["deleteApiKey"]), async (req: AuthRequest, res: Response) => {
    const { apiKeyId } = req.query;
    log.warn(`Clearing logs${apiKeyId ? ` for API key ${apiKeyId}` : ' (all logs)'}`);
    
    try {
        await clearApiLogs(apiKeyId as string | undefined);
        const message = apiKeyId ? `Logs cleared for API key ${apiKeyId}` : "All logs cleared";
        log.success(message);
        res.status(200).json({ message });
    } catch (error) {
        log.error(`Failed to clear logs: ${error}`);
        res.status(500).json({ error: "Failed to clear logs" });
    }
});

import runSpeedtest from "./functions/stats/speedtest";
import { SpeedtestResult } from "./types/statistics/speedtest";
app.get("/stats/speedtest", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
    log.info('Starting network speed test');
    runSpeedtest()
        .then((result: SpeedtestResult) => {
            log.success(`Speed test completed - Down: ${result.download}Mbps, Up: ${result.upload}Mbps`);
            res.status(200).json(result);
        })
        .catch((error) => {
            log.error(`Speed test failed: ${error.message}`);
            res.status(500).json({ error: error.message });
        });
});

import * as SYSTEM from "./types/statistics/system";
import * as systeminfo from "./functions/stats/utils/system";
import si from 'systeminformation';

app.get("/data", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching complete system information');
    try {
        const data = {
            cpu: await systeminfo.getCPUInfo(), 
            gpu: await systeminfo.getGPUInfo(),
            disk: await systeminfo.getDiskInfo(),
            ram: await systeminfo.getRAMInfo(),
            mainboard: await systeminfo.getMainboardInfo(),
            os: await systeminfo.getOSInfo()
        };
        log.success('System information retrieved');
        res.status(200).json(data);
    } catch (error) {
        log.error(`Failed to fetch system information: ${error}`);
        res.status(500).json({ error: 'Failed to fetch system information' });
    }
});

app.get("/data/cpu", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching CPU information');
    try {
        const data: SYSTEM.CPU = await systeminfo.getCPUInfo();
        log.success(`CPU info retrieved: ${data.manufacturer} ${data.brand}`);
        res.status(200).json(data);
    } catch (error) {
        log.error(`Failed to fetch CPU information: ${error}`);
        res.status(500).json({ error: 'Failed to fetch CPU information' });
    }
});

app.get("/data/gpu", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching GPU information');
    try {
        const data: SYSTEM.Graphics[] = await systeminfo.getGPUInfo();
        log.success(`GPU info retrieved: ${data.length} GPU(s) found`);
        res.status(200).json(data);
    } catch (error) {
        log.error(`Failed to fetch GPU information: ${error}`);
        res.status(500).json({ error: 'Failed to fetch GPU information' });
    }
});

app.get("/data/disk", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching disk information');
    try {
        const data: SYSTEM.DiskLayout[] = await systeminfo.getDiskInfo();
        log.success(`Disk info retrieved: ${data.length} disk(s) found`);
        res.status(200).json(data);
    } catch (error) {
        log.error(`Failed to fetch disk information: ${error}`);
        res.status(500).json({ error: 'Failed to fetch disk information' });
    }
});

app.get("/data/ram", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching RAM information');
    try {
        const data: SYSTEM.RAM = await systeminfo.getRAMInfo();
        log.success(`RAM info retrieved: ${(data.total / 1073741824).toFixed(2)}GB total`);
        res.status(200).json(data);
    } catch (error) {
        log.error(`Failed to fetch RAM information: ${error}`);
        res.status(500).json({ error: 'Failed to fetch RAM information' });
    }
});

app.get("/data/mainboard", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching mainboard information');
    try {
        const data: SYSTEM.Mainboard = await systeminfo.getMainboardInfo();
        log.success(`Mainboard info retrieved: ${data.manufacturer} ${data.model}`);
        res.status(200).json(data);
    } catch (error) {
        log.error(`Failed to fetch mainboard information: ${error}`);
        res.status(500).json({ error: 'Failed to fetch mainboard information' });
    }
}); 

app.get("/data/os", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching OS information');
    try {
        const data: SYSTEM.OS = await systeminfo.getOSInfo();
        log.success(`OS info retrieved: ${data.platform} ${data.distro}`);
        res.status(200).json(data);
    } catch (error) {
        log.error(`Failed to fetch OS information: ${error}`);
        res.status(500).json({ error: 'Failed to fetch OS information' });
    }
});

app.get("/stats/cpu", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching current CPU usage');
    try {
        const currentLoad = await si.currentLoad();
        const cpuData = await si.cpu();
        const cpuTemp = await si.cpuTemperature();
        
        const usage = currentLoad.currentLoad;
        log.success(`CPU usage: ${usage.toFixed(2)}%`);
        
        res.status(200).json({
            usage: usage,
            cores: cpuData.cores,
            speed: cpuData.speed,
            temperature: cpuTemp.main,
            currentLoadUser: currentLoad.currentLoadUser,
            currentLoadSystem: currentLoad.currentLoadSystem
        });
    } catch (error) {
        log.error(`Failed to get CPU stats: ${error}`);
        res.status(500).json({ error: 'Failed to get CPU stats' });
    }
});

app.get("/stats/memory", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching memory usage statistics');
    try {
        const mem = await si.mem();
        const memLayout = await si.memLayout();
        
        const usagePercentage = (mem.used / mem.total) * 100;
        log.success(`Memory usage: ${usagePercentage.toFixed(2)}%`);
        
        res.status(200).json({
            total: mem.total,
            free: mem.free,
            used: mem.used,
            active: mem.active,
            available: mem.available,
            usagePercentage: usagePercentage,
            swapTotal: mem.swaptotal,
            swapUsed: mem.swapused,
            swapFree: mem.swapfree,
            swapPercentage: mem.swaptotal > 0 ? (mem.swapused / mem.swaptotal) * 100 : 0
        });
    } catch (error) {
        log.error(`Failed to get memory stats: ${error}`);
        res.status(500).json({ error: 'Failed to get memory stats' });
    }
});

import { NetworkStats, NetworkStatsCache, NetworkInterfaceTraffic, NetworkTrafficData } from "../types/network";

const networkStatsHistory = new Map<string, NetworkStatsCache>();
const MAX_NETWORK_STATS_ENTRIES = parseInt(process.env.MAX_NETWORK_STATS_ENTRIES || '100');

// Cleanup old network stats entries periodically
setInterval(() => {
  if (networkStatsHistory.size > MAX_NETWORK_STATS_ENTRIES) {
    const entriesToDelete = networkStatsHistory.size - MAX_NETWORK_STATS_ENTRIES;
    const keysToDelete = Array.from(networkStatsHistory.keys()).slice(0, entriesToDelete);
    keysToDelete.forEach(key => networkStatsHistory.delete(key));
  }
}, 60000); // Run every minute

app.get("/stats/network", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching network statistics');
    try {
        const networkInterfaces = await si.networkInterfaces();
        const networkStats = await si.networkStats();
        log.success(`Network stats retrieved: ${networkInterfaces.length} interface(s)`);
        res.status(200).json({
            interfaces: networkInterfaces,
            stats: networkStats
        });
    } catch (error) {
        log.error(`Failed to get network stats: ${error}`);
        res.status(500).json({ error: 'Failed to get network stats' });
    }
});

app.get("/stats/network/traffic", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Calculating network traffic speeds');
    try {
        const currentStats = await si.networkStats();
        const clientId = req.headers['x-client-id'] as string || 'default';
        const previousData = networkStatsHistory.get(clientId);
        const currentTime = Date.now();
        
        let trafficData: NetworkTrafficData = {
            rx_sec: 0,
            tx_sec: 0,
            rx_mbps: 0,
            tx_mbps: 0,
            interfaces: [] as NetworkInterfaceTraffic[]
        };
        
        if (currentStats && currentStats.length > 0) {
            const mainInterface = currentStats[0];
            
            if (mainInterface.rx_sec !== undefined && mainInterface.rx_sec !== null && mainInterface.rx_sec > 0) {
                trafficData.rx_sec = mainInterface.rx_sec;
                trafficData.tx_sec = mainInterface.tx_sec || 0;
                trafficData.rx_mbps = (mainInterface.rx_sec * 8) / 1000000;
                trafficData.tx_mbps = (mainInterface.tx_sec * 8) / 1000000;
            } 
            else if (previousData && previousData.stats) {
                const timeDiff = (currentTime - previousData.timestamp) / 1000;
                
                if (timeDiff > 0) {
                    const previousMainInterface = previousData.stats[0];
                    
                    if (previousMainInterface && mainInterface) {
                        const rxBytesDiff = mainInterface.rx_bytes - previousMainInterface.rx_bytes;
                        const txBytesDiff = mainInterface.tx_bytes - previousMainInterface.tx_bytes;
                        
                        trafficData.rx_sec = Math.max(0, rxBytesDiff / timeDiff);
                        trafficData.tx_sec = Math.max(0, txBytesDiff / timeDiff);
                        
                        trafficData.rx_mbps = (trafficData.rx_sec * 8) / 1000000;
                        trafficData.tx_mbps = (trafficData.tx_sec * 8) / 1000000;
                    }
                }
            }
            
            trafficData.interfaces = currentStats.map((iface: NetworkStats, index: number) => {
                let ifaceData: NetworkInterfaceTraffic = {
                    iface: iface.iface,
                    rx_bytes: iface.rx_bytes,
                    tx_bytes: iface.tx_bytes,
                    rx_sec: 0,
                    tx_sec: 0,
                    rx_mbps: 0,
                    tx_mbps: 0
                };
                
                if (iface.rx_sec !== undefined && iface.rx_sec !== null && iface.rx_sec > 0) {
                    ifaceData.rx_sec = iface.rx_sec;
                    ifaceData.tx_sec = iface.tx_sec || 0;
                    ifaceData.rx_mbps = (iface.rx_sec * 8) / 1000000;
                    ifaceData.tx_mbps = ((iface.tx_sec || 0) * 8) / 1000000;
                }
                else if (previousData && previousData.stats && previousData.stats[index]) {
                    const timeDiff = (currentTime - previousData.timestamp) / 1000;
                    const prevIface = previousData.stats[index];
                    
                    if (timeDiff > 0 && prevIface) {
                        const rxDiff = iface.rx_bytes - prevIface.rx_bytes;
                        const txDiff = iface.tx_bytes - prevIface.tx_bytes;
                        
                        ifaceData.rx_sec = Math.max(0, rxDiff / timeDiff);
                        ifaceData.tx_sec = Math.max(0, txDiff / timeDiff);
                        ifaceData.rx_mbps = (ifaceData.rx_sec * 8) / 1000000;
                        ifaceData.tx_mbps = (ifaceData.tx_sec * 8) / 1000000;
                    }
                }
                
                return ifaceData;
            });
        }
        
        networkStatsHistory.set(clientId, {
            stats: currentStats,
            timestamp: currentTime
        });
        
        if (networkStatsHistory.size > 100) {
            const firstKey = networkStatsHistory.keys().next().value;
            if (firstKey !== undefined) {
                networkStatsHistory.delete(firstKey);
            }
        }
        
        log.success(`Traffic data calculated: RX ${trafficData.rx_mbps.toFixed(2)}Mbps, TX ${trafficData.tx_mbps.toFixed(2)}Mbps`);
        res.status(200).json(trafficData);
    } catch (error) {
        log.error(`Network traffic calculation failed: ${error}`);
        res.status(500).json({ error: 'Failed to get network traffic data' });
    }
});

app.get("/stats/disk", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching disk usage statistics');
    try {
        const fsSize = await si.fsSize();
        log.success(`Disk stats retrieved: ${fsSize.length} filesystem(s)`);
        res.status(200).json(fsSize);
    } catch (error) {
        log.error(`Failed to get disk stats: ${error}`);
        res.status(500).json({ error: 'Failed to get disk stats' });
    }
});

app.get("/stats/time", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching system time and uptime');
    try {
        const time = await si.time();
        log.success(`System uptime: ${Math.floor(time.uptime / 3600)} hours`);
        res.status(200).json(time);
    } catch (error) {
        log.error(`Failed to get time stats: ${error}`);
        res.status(500).json({ error: 'Failed to get time stats' });
    }
});

import * as PROCESS from "./functions/stats/utils/process";
import ProcessInfo from "./types/statistics/process";

app.get("/processes", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    log.info('Fetching process list');
    const processes: ProcessInfo[] = await PROCESS.listProcesses();
    log.success(`Retrieved ${processes.length} processes`);
    res.status(200).json(processes);
});

app.post("/processes/kill", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const pid: number = req.body.pid;
    if (typeof pid !== 'number') {
        log.error('Invalid PID provided for kill request');
        return res.status(400).json({ error: "Invalid PID" });
    }
    
    log.warn(`Attempting to kill process: PID ${pid}`);
    const success: boolean = await PROCESS.killProcess(pid);
    if (success) {
        log.success(`Process ${pid} terminated successfully`);
        res.status(200).json({ message: `Process ${pid} killed successfully` });
    }
    else {
        log.error(`Failed to kill process ${pid}`);
        res.status(500).json({ error: `Failed to kill process ${pid}` });
    }
});

import * as POWER from "./functions/stats/power";

app.post("/power/reboot", authenticate(["usePowerCommands"]), async (req: AuthRequest, res: Response) => {
    log.warn(`${colors.bgYellow}${colors.bright} SYSTEM REBOOT INITIATED ${colors.reset}`);
    try {
        await POWER.rebootSystem();
        res.status(200).json({ message: "System reboot initiated" });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`Reboot failed: ${message}`);
        res.status(500).json({ error: message });
    }
});

app.post("/power/shutdown", authenticate(["usePowerCommands"]), async (req: AuthRequest, res: Response) => {
    log.warn(`${colors.bgRed}${colors.bright} SYSTEM SHUTDOWN INITIATED ${colors.reset}`);
    try {
        await POWER.shutdownSystem();
        res.status(200).json({ message: "System shutdown initiated" });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`Shutdown failed: ${message}`);
        res.status(500).json({ error: message });
    }
});

import { NetworkSniffer } from "./functions/logs/network/sniffer";
import { NetworkPacket } from "./types/logs/network";
let sniffer: NetworkSniffer | null = null;
const packetLogs: NetworkPacket[] = [];
let allPacketLogs: NetworkPacket[] = [];
const MAX_PACKET_LOGS = parseInt(process.env.MAX_PACKET_LOGS || '1000');
const MAX_ALL_PACKET_LOGS = parseInt(process.env.MAX_ALL_PACKET_LOGS || '100000');

app.post("/network/sniffer/start", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  const interfaceName: unknown = req.body.interface;

  if (typeof interfaceName !== "string" || interfaceName.trim().length === 0) {
    log.error('Invalid network interface specified');
    return res.status(400).json({ error: "Invalid network interface" });
  }

  if (sniffer) {
    log.warn('Sniffer already running');
    return res.status(400).json({ error: "Sniffer is already running" });
  }

  log.info(`Starting network sniffer on interface: ${interfaceName.trim()}`);
  
  try {
    sniffer = new NetworkSniffer(interfaceName.trim());
    sniffer.start();

    sniffer.onPacket((packet: NetworkPacket) => {
      packetLogs.push(packet);
      allPacketLogs.push(packet);
      // Use configured limits to prevent memory leaks
      while (packetLogs.length > MAX_PACKET_LOGS) {
        packetLogs.shift();
      }
      while (allPacketLogs.length > MAX_ALL_PACKET_LOGS) {
        allPacketLogs.shift();
      }
    });

    log.success(`Network sniffer started on ${interfaceName.trim()}`);
    res
      .status(200)
      .json({ message: `Network sniffer started on ${interfaceName.trim()}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to start sniffer: ${message}`);
    if (message.includes("not available on this platform")) {
      res.status(503).json({ 
        error: "Network sniffer is not available on this platform. This feature requires Linux or macOS." 
      });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

app.post("/network/sniffer/stop", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  if (!sniffer) {
    log.warn('Attempted to stop sniffer when not running');
    return res.status(400).json({ error: "Sniffer is not running" });
  }

  log.info('Stopping network sniffer');
  
  try {
    sniffer.stop();
    sniffer = null;
    log.success('Network sniffer stopped');
    res.status(200).json({ message: "Network sniffer stopped" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to stop sniffer: ${message}`);
    res.status(500).json({ error: message });
  }
});

app.get("/network/sniffer/logs", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  log.info(`Fetching recent packet logs (${packetLogs.length} packets)`);
  res.json(packetLogs);
});

app.get("/network/sniffer/logs/all", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  log.info(`Fetching all packet logs (${allPacketLogs.length} total packets)`);
  res.json({
    total: allPacketLogs.length,
    packets: allPacketLogs
  });
});

app.delete("/network/sniffer/logs", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  const previousCount = allPacketLogs.length;
  packetLogs.length = 0;
  allPacketLogs.length = 0;
  log.success(`Cleared ${previousCount} network packet logs`);
  res.status(200).json({ message: "All network logs cleared" });
});

// Initialize database before starting server
async function startServer() {
    try {
        // Initialize database
        console.log(`${colors.cyan}[STARTUP]${colors.reset} Initializing database...`);
        const dbResult = await databaseInitializer.initialize();
        
        if (!dbResult.success) {
            console.error(`${colors.bgRed}${colors.bright} DATABASE INITIALIZATION FAILED ${colors.reset}`);
            console.error(`${colors.red}[ERROR]${colors.reset} ${dbResult.message}`);
            process.exit(1);
        }
        
        // Check database health
        const isHealthy = await databaseInitializer.checkHealth();
        if (!isHealthy) {
            console.error(`${colors.bgRed}${colors.bright} DATABASE HEALTH CHECK FAILED ${colors.reset}`);
            console.error(`${colors.red}[ERROR]${colors.reset} Database is not responding properly`);
            process.exit(1);
        }
        
        // Start the server
        app.listen(port, () => {
            console.log(`${colors.bgGreen}${colors.bright} SERVER STARTED ${colors.reset}`);
            console.log(`${colors.cyan}[SERVER]${colors.reset} Running at ${colors.bright}http://localhost:${port}${colors.reset}`);
            console.log(`${colors.yellow}[INFO]${colors.reset} Trust proxy: ${config.server.trustProxy} | CORS: enabled | Rate limiting: active`);
            console.log(`${colors.blue}[PERF]${colors.reset} Compression: enabled | Performance monitoring: active`);
            console.log(`${colors.green}[SECURITY]${colors.reset} Security headers enabled | CORS origin: ${config.security.corsOrigin}`);
            
            // Log database initialization details
            if (dbResult.details?.firstTimeSetup) {
                console.log(`${colors.bright}${colors.yellow}[DATABASE]${colors.reset} First-time setup completed - check above for admin credentials`);
            } else {
                console.log(`${colors.green}[DATABASE]${colors.reset} Database ready - using existing data`);
            }
            
            // Start the alert engine
            alertEngine.start();
            console.log(`${colors.green}[ALERTS]${colors.reset} Alert engine started - monitoring active`);
            
            // Start memory leak detection
            performanceMonitor.detectMemoryLeaks();
            console.log(`${colors.magenta}[MONITOR]${colors.reset} Memory leak detection: enabled`);
        });
    } catch (error) {
        console.error(`${colors.bgRed}${colors.bright} STARTUP FAILED ${colors.reset}`);
        console.error(`${colors.red}[ERROR]${colors.reset}`, error);
        process.exit(1);
    }
}

// Start the server with database initialization
startServer();