import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiLog, ApiKeyStats } from '../../types/api/logs/apiLog';

const logsPath = path.resolve(__dirname, '../../apiLogs.json');

interface LogsData {
    logs: ApiLog[];
}

async function loadLogs(): Promise<LogsData> {
    try {
        const data = await fs.readFile(logsPath, 'utf-8');
        const parsed = JSON.parse(data);
        // Ensure logs array exists even if file is empty or malformed
        if (!parsed.logs || !Array.isArray(parsed.logs)) {
            return { logs: [] };
        }
        return parsed;
    } catch (err) {
        return { logs: [] };
    }
}

async function saveLogs(data: LogsData): Promise<void> {
    await fs.writeFile(logsPath, JSON.stringify(data, null, 2));
}

export async function logApiRequest(
    apiKeyId: string,
    apiKeyName: string,
    endpoint: string,
    method: string,
    statusCode: number,
    ipAddress: string,
    userAgent?: string,
    responseTime?: number
): Promise<void> {
    const logsData = await loadLogs();
    
    const newLog: ApiLog = {
        id: uuidv4(),
        apiKeyId,
        apiKeyName,
        endpoint,
        method,
        statusCode,
        ipAddress,
        userAgent,
        timestamp: new Date(),
        responseTime
    };
    
    logsData.logs.push(newLog);
    
    // Keep only last 10000 logs
    if (logsData.logs.length > 10000) {
        logsData.logs = logsData.logs.slice(-10000);
    }
    
    await saveLogs(logsData);
}

export async function getApiLogs(apiKeyId?: string, limit: number = 100): Promise<ApiLog[]> {
    const logsData = await loadLogs();
    
    let logs = logsData.logs;
    
    if (apiKeyId) {
        logs = logs.filter(log => log.apiKeyId === apiKeyId);
    }
    
    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return logs.slice(0, limit);
}

export async function getApiKeyStats(apiKeyId: string): Promise<ApiKeyStats> {
    const logsData = await loadLogs();
    const logs = logsData.logs.filter(log => log.apiKeyId === apiKeyId);
    
    const stats: ApiKeyStats = {
        totalRequests: logs.length,
        successfulRequests: logs.filter(log => log.statusCode >= 200 && log.statusCode < 300).length,
        failedRequests: logs.filter(log => log.statusCode >= 400).length,
        averageResponseTime: 0,
        lastUsed: null,
        requestsPerDay: {}
    };
    
    if (logs.length > 0) {
        // Calculate average response time
        const logsWithTime = logs.filter(log => log.responseTime !== undefined);
        if (logsWithTime.length > 0) {
            const totalTime = logsWithTime.reduce((sum, log) => sum + (log.responseTime || 0), 0);
            stats.averageResponseTime = totalTime / logsWithTime.length;
        }
        
        // Get last used timestamp
        const sortedLogs = logs.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        stats.lastUsed = new Date(sortedLogs[0].timestamp);
        
        // Calculate requests per day for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        logs.forEach(log => {
            const logDate = new Date(log.timestamp);
            if (logDate >= thirtyDaysAgo) {
                const dateStr = logDate.toISOString().split('T')[0];
                stats.requestsPerDay[dateStr] = (stats.requestsPerDay[dateStr] || 0) + 1;
            }
        });
    }
    
    return stats;
}

export async function clearApiLogs(apiKeyId?: string): Promise<void> {
    if (!apiKeyId) {
        // Clear all logs
        await saveLogs({ logs: [] });
    } else {
        // Clear logs for specific API key
        const logsData = await loadLogs();
        logsData.logs = logsData.logs.filter(log => log.apiKeyId !== apiKeyId);
        await saveLogs(logsData);
    }
}