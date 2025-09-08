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

const app = express();
const port = 4000;

// Trust proxy when running behind reverse proxy (nginx, apache, etc)
// Use 'loopback' to only trust localhost proxy (nginx on same server)
app.set('trust proxy', 'loopback');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(limiter);

app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// API Key Management Endpoints
app.post("/api/keys", authenticate(["createApiKey"]), async (req: AuthRequest, res: Response) => {
    const { name, permissions } = req.body;
    
    if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Name is required" });
    }
    
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
        res.status(201).json(key);
    } catch (error) {
        res.status(500).json({ error: "Failed to create API key" });
    }
});

app.get("/api/keys", authenticate(["viewApiKeys"]), async (req: AuthRequest, res: Response) => {
    try {
        const keys = await listKeys.list();
        const sanitizedKeys = keys.map(k => ({
            uuid: k.uuid,
            name: k.name,
            permissions: k.permissions,
            createdAt: k.createdAt
        }));
        res.status(200).json(sanitizedKeys);
    } catch (error) {
        res.status(500).json({ error: "Failed to list API keys" });
    }
});

app.get("/api/keys/:identifier", authenticate(["viewApiKeys"]), async (req: AuthRequest, res: Response) => {
    const { identifier } = req.params;
    
    if (!identifier) {
        return res.status(400).json({ error: "Key identifier is required" });
    }
    
    try {
        const key = await getApiKey(identifier);
        if (key) {
            const sanitizedKey = {
                uuid: key.uuid,
                name: key.name,
                permissions: key.permissions,
                createdAt: key.createdAt
            };
            res.status(200).json(sanitizedKey);
        } else {
            res.status(404).json({ error: "API key not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to get API key" });
    }
});

app.put("/api/keys/:identifier/permissions", authenticate(["createApiKey"]), async (req: AuthRequest, res: Response) => {
    const { identifier } = req.params;
    const { permissions } = req.body;
    
    if (!identifier) {
        return res.status(400).json({ error: "Key identifier is required" });
    }
    
    if (!permissions || typeof permissions !== "object") {
        return res.status(400).json({ error: "Valid permissions object is required" });
    }
    
    try {
        const success = await updateApiKeyPermissions(identifier, permissions);
        if (success) {
            res.status(200).json({ message: "API key permissions updated successfully" });
        } else {
            res.status(404).json({ error: "API key not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to update API key permissions" });
    }
});

app.delete("/api/keys/:identifier", authenticate(["deleteApiKey"]), async (req: AuthRequest, res: Response) => {
    const { identifier } = req.params;
    
    if (!identifier) {
        return res.status(400).json({ error: "Key identifier is required" });
    }
    
    try {
        const success = await deleteApiKey(identifier);
        if (success) {
            res.status(200).json({ message: "API key deleted successfully" });
        } else {
            res.status(404).json({ error: "API key not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to delete API key" });
    }
});

// API Logs Endpoints
app.get("/api/logs", authenticate(["viewApiKeys"]), async (req: AuthRequest, res: Response) => {
    try {
        const { apiKeyId, limit } = req.query;
        const logs = await getApiLogs(
            apiKeyId as string | undefined, 
            limit ? parseInt(limit as string) : 100
        );
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch API logs" });
    }
});

app.get("/api/logs/stats/:apiKeyId", authenticate(["viewApiKeys"]), async (req: AuthRequest, res: Response) => {
    try {
        const { apiKeyId } = req.params;
        const stats = await getApiKeyStats(apiKeyId);
        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch API key statistics" });
    }
});

app.delete("/api/logs", authenticate(["deleteApiKey"]), async (req: AuthRequest, res: Response) => {
    try {
        const { apiKeyId } = req.query;
        await clearApiLogs(apiKeyId as string | undefined);
        res.status(200).json({ 
            message: apiKeyId ? `Logs cleared for API key ${apiKeyId}` : "All logs cleared" 
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to clear logs" });
    }
});

import runSpeedtest from "./functions/stats/speedtest";
import { SpeedtestResult } from "./types/statistics/speedtest";
app.get("/stats/speedtest", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
    runSpeedtest()
        .then((result: SpeedtestResult) => {
            res.status(200).json(result);
        })
        .catch((error) => {
            res.status(500).json({ error: error.message });
        });
});

import * as SYSTEM from "./types/statistics/system";
import * as systeminfo from "./functions/stats/utils/system";
import si from 'systeminformation';

// Get all system information
app.get("/data", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const data = {
        cpu: await systeminfo.getCPUInfo(), 
        gpu: await systeminfo.getGPUInfo(),
        disk: await systeminfo.getDiskInfo(),
        ram: await systeminfo.getRAMInfo(),
        mainboard: await systeminfo.getMainboardInfo(),
        os: await systeminfo.getOSInfo()
    };
    res.status(200).json(data);
});
// Get individual system information
// Get CPU information
app.get("/data/cpu", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const data: SYSTEM.CPU = await systeminfo.getCPUInfo();
    res.status(200).json(data);
});
// Get GPU information
app.get("/data/gpu", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const data: SYSTEM.Graphics[] = await systeminfo.getGPUInfo();
    res.status(200).json(data);
});
// Get Disk information
app.get("/data/disk", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const data: SYSTEM.DiskLayout[] = await systeminfo.getDiskInfo();
    res.status(200).json(data);
});
// Get RAM information
app.get("/data/ram", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const data: SYSTEM.RAM = await systeminfo.getRAMInfo();
    res.status(200).json(data);
});
// Get Mainboard information
app.get("/data/mainboard", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const data: SYSTEM.Mainboard = await systeminfo.getMainboardInfo();
    res.status(200).json(data);
}); 
// Get OS information
app.get("/data/os", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const data: SYSTEM.OS = await systeminfo.getOSInfo();
    res.status(200).json(data);
});

// Get current CPU usage stats
app.get("/stats/cpu", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    try {
        const currentLoad = await si.currentLoad();
        const cpuData = await si.cpu();
        const cpuTemp = await si.cpuTemperature();
        
        res.status(200).json({
            usage: currentLoad.currentLoad,
            cores: cpuData.cores,
            speed: cpuData.speed,
            temperature: cpuTemp.main,
            currentLoadUser: currentLoad.currentLoadUser,
            currentLoadSystem: currentLoad.currentLoadSystem
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get CPU stats' });
    }
});

// Get RAM usage stats
app.get("/stats/memory", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    try {
        const mem = await si.mem();
        const memLayout = await si.memLayout();
        
        res.status(200).json({
            total: mem.total,
            free: mem.free,
            used: mem.used,
            active: mem.active,
            available: mem.available,
            usagePercentage: (mem.used / mem.total) * 100,
            swapTotal: mem.swaptotal,
            swapUsed: mem.swapused,
            swapFree: mem.swapfree,
            swapPercentage: mem.swaptotal > 0 ? (mem.swapused / mem.swaptotal) * 100 : 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get memory stats' });
    }
});

// Store previous network stats for speed calculation
interface NetworkStatsCache {
    stats: any;
    timestamp: number;
}
const networkStatsHistory = new Map<string, NetworkStatsCache>();

// Get network stats
app.get("/stats/network", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    try {
        const networkInterfaces = await si.networkInterfaces();
        const networkStats = await si.networkStats();
        
        res.status(200).json({
            interfaces: networkInterfaces,
            stats: networkStats
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get network stats' });
    }
});

// Get network traffic speeds (in Mbps)
app.get("/stats/network/traffic", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    try {
        const currentStats = await si.networkStats();
        const clientId = req.headers['x-client-id'] as string || 'default';
        const previousData = networkStatsHistory.get(clientId);
        const currentTime = Date.now();
        
        let trafficData = {
            rx_sec: 0,  // Receive speed in bytes/sec
            tx_sec: 0,  // Transmit speed in bytes/sec
            rx_mbps: 0, // Receive speed in Mbps
            tx_mbps: 0, // Transmit speed in Mbps
            interfaces: [] as any[]
        };
        
        if (currentStats && currentStats.length > 0) {
            // First, try to use built-in rx_sec/tx_sec from systeminformation
            const mainInterface = currentStats[0];
            
            // Check if systeminformation provides rx_sec and tx_sec
            if (mainInterface.rx_sec !== undefined && mainInterface.rx_sec !== null && mainInterface.rx_sec > 0) {
                trafficData.rx_sec = mainInterface.rx_sec;
                trafficData.tx_sec = mainInterface.tx_sec || 0;
                trafficData.rx_mbps = (mainInterface.rx_sec * 8) / 1000000;
                trafficData.tx_mbps = (mainInterface.tx_sec * 8) / 1000000;
            } 
            // Otherwise, calculate manually from byte differences
            else if (previousData && previousData.stats) {
                const timeDiff = (currentTime - previousData.timestamp) / 1000; // Convert to seconds
                
                if (timeDiff > 0) {
                    const previousMainInterface = previousData.stats[0];
                    
                    if (previousMainInterface) {
                        const rxBytesDiff = mainInterface.rx_bytes - previousMainInterface.rx_bytes;
                        const txBytesDiff = mainInterface.tx_bytes - previousMainInterface.tx_bytes;
                        
                        // Calculate bytes per second
                        trafficData.rx_sec = Math.max(0, rxBytesDiff / timeDiff);
                        trafficData.tx_sec = Math.max(0, txBytesDiff / timeDiff);
                        
                        // Convert to Mbps
                        trafficData.rx_mbps = (trafficData.rx_sec * 8) / 1000000;
                        trafficData.tx_mbps = (trafficData.tx_sec * 8) / 1000000;
                    }
                }
            }
            
            // Include all interfaces data with calculated speeds
            trafficData.interfaces = currentStats.map((iface: any, index: number) => {
                let ifaceData: any = {
                    iface: iface.iface,
                    rx_bytes: iface.rx_bytes,
                    tx_bytes: iface.tx_bytes,
                    rx_sec: 0,
                    tx_sec: 0,
                    rx_mbps: 0,
                    tx_mbps: 0
                };
                
                // Use built-in values if available
                if (iface.rx_sec !== undefined && iface.rx_sec !== null && iface.rx_sec > 0) {
                    ifaceData.rx_sec = iface.rx_sec;
                    ifaceData.tx_sec = iface.tx_sec || 0;
                    ifaceData.rx_mbps = (iface.rx_sec * 8) / 1000000;
                    ifaceData.tx_mbps = (iface.tx_sec * 8) / 1000000;
                }
                // Calculate from previous stats
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
        
        // Store current stats with timestamp for next calculation
        networkStatsHistory.set(clientId, {
            stats: currentStats,
            timestamp: currentTime
        });
        
        // Clean up old entries (keep only last 100 clients)
        if (networkStatsHistory.size > 100) {
            const firstKey = networkStatsHistory.keys().next().value;
            if (firstKey !== undefined) {
                networkStatsHistory.delete(firstKey);
            }
        }
        
        res.status(200).json(trafficData);
    } catch (error) {
        console.error('Network traffic error:', error);
        res.status(500).json({ error: 'Failed to get network traffic data' });
    }
});

// Get disk usage stats
app.get("/stats/disk", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    try {
        const fsSize = await si.fsSize();
        res.status(200).json(fsSize);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get disk stats' });
    }
});

// Get system time and uptime
app.get("/stats/time", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    try {
        const time = await si.time();
        res.status(200).json(time);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get time stats' });
    }
});

import * as PROCESS from "./functions/stats/utils/process";
import ProcessInfo from "./types/statistics/process";
// List processes
app.get("/processes", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const processes: ProcessInfo[] = await PROCESS.listProcesses();
    res.status(200).json(processes);
});
// Kill a process by PID
app.post("/processes/kill", authenticate(["viewStats"]), async (req: AuthRequest, res: Response) => {
    const pid: number = req.body.pid;
    if (typeof pid !== 'number') {
        return res.status(400).json({ error: "Invalid PID" });
    }  
    const success: boolean = await PROCESS.killProcess(pid);
    if (success) {
        res.status(200).json({ message: `Process ${pid} killed successfully` });
    }
    else {
        res.status(500).json({ error: `Failed to kill process ${pid}` });
    }
});

import * as POWER from "./functions/stats/power";
// Reboot the system
app.post("/power/reboot", authenticate(["usePowerCommands"]), async (req: AuthRequest, res: Response) => {
    try {
        await POWER.rebootSystem();
        res.status(200).json({ message: "System reboot initiated" });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
    }
});
// Shutdown the system
app.post("/power/shutdown", authenticate(["usePowerCommands"]), async (req: AuthRequest, res: Response) => {
    try {
        await POWER.shutdownSystem();
        res.status(200).json({ message: "System shutdown initiated" });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
    }
});

// Network sniffer endpoints
import { NetworkSniffer } from "./functions/logs/network/sniffer";
import { NetworkPacket } from "./types/logs/network";
let sniffer: NetworkSniffer | null = null;
const packetLogs: NetworkPacket[] = [];
let allPacketLogs: NetworkPacket[] = []; // Store all packets without limit

// Start Sniffer
app.post("/network/sniffer/start", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  const interfaceName: unknown = req.body.interface;

  if (typeof interfaceName !== "string" || interfaceName.trim().length === 0) {
    return res.status(400).json({ error: "Invalid network interface" });
  }

  if (sniffer) {
    return res.status(400).json({ error: "Sniffer is already running" });
  }

  try {
    sniffer = new NetworkSniffer(interfaceName.trim());
    sniffer.start();

    sniffer.onPacket((packet: NetworkPacket) => {
      packetLogs.push(packet);
      allPacketLogs.push(packet);
      if (packetLogs.length > 1000) packetLogs.shift(); // max 1000 for recent logs
      // Optional: Limit all logs to prevent memory issues (e.g., 100k packets)
      if (allPacketLogs.length > 100000) allPacketLogs.shift();
    });

    res
      .status(200)
      .json({ message: `Network sniffer started on ${interfaceName.trim()}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to start sniffer:", message);
    if (message.includes("not available on this platform")) {
      res.status(503).json({ 
        error: "Network sniffer is not available on this platform. This feature requires Linux or macOS." 
      });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// Stop Sniffer
app.post("/network/sniffer/stop", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  if (!sniffer) {
    return res.status(400).json({ error: "Sniffer is not running" });
  }

  try {
    sniffer.stop();
    sniffer = null;
    res.status(200).json({ message: "Network sniffer stopped" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to stop sniffer:", message);
    res.status(500).json({ error: message });
  }
});

// Get last packets (recent 1000)
app.get("/network/sniffer/logs", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  res.json(packetLogs);
});

// Get all packets
app.get("/network/sniffer/logs/all", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  res.json({
    total: allPacketLogs.length,
    packets: allPacketLogs
  });
});

// Clear all logs
app.delete("/network/sniffer/logs", authenticate(["viewStats"]), (req: AuthRequest, res: Response) => {
  packetLogs.length = 0;
  allPacketLogs.length = 0;
  res.status(200).json({ message: "All network logs cleared" });
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});