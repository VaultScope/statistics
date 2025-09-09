import { ApiLog, ApiKeyStats } from '../../types/api/logs/apiLog';
import { apiKeyRepository } from '../../db/repositories/apiKeyRepositoryMock';

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
    try {
        await apiKeyRepository.logApiKeyUsage({
            apiKeyId,
            endpoint,
            method,
            statusCode,
            ipAddress,
            userAgent: userAgent || null,
            responseTime: responseTime || null
        });
    } catch (error) {
        console.error('Failed to log API request:', error);
    }
}

export async function getApiLogs(
    apiKeyId?: string,
    limit: number = 100
): Promise<ApiLog[]> {
    try {
        const logs = await apiKeyRepository.getApiKeyLogs(apiKeyId, limit);
        
        // Convert to ApiLog format
        return logs.map(log => ({
            id: log.id,
            apiKeyId: log.apiKeyId,
            apiKeyName: '', // We'll need to fetch this if needed
            endpoint: log.endpoint,
            method: log.method,
            statusCode: log.statusCode,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            timestamp: new Date(log.timestamp),
            responseTime: log.responseTime || undefined
        }));
    } catch (error) {
        console.error('Failed to get API logs:', error);
        return [];
    }
}

export async function getApiKeyStats(apiKeyId: string): Promise<ApiKeyStats | null> {
    try {
        const stats = await apiKeyRepository.getApiKeyStats(apiKeyId);
        
        return {
            totalRequests: stats.totalRequests,
            successfulRequests: Object.entries(stats.statusCodes)
                .filter(([code]) => parseInt(code) < 400)
                .reduce((sum, [_, count]) => sum + (count as number), 0),
            failedRequests: Object.entries(stats.statusCodes)
                .filter(([code]) => parseInt(code) >= 400)
                .reduce((sum, [_, count]) => sum + (count as number), 0),
            averageResponseTime: stats.avgResponseTime,
            requestsByEndpoint: stats.endpoints,
            requestsByStatusCode: stats.statusCodes,
            lastUsed: stats.lastUsed ? new Date(stats.lastUsed) : null
        };
    } catch (error) {
        console.error('Failed to get API key stats:', error);
        return null;
    }
}

export async function clearApiLogs(apiKeyId?: string): Promise<void> {
    try {
        await apiKeyRepository.clearApiLogs(apiKeyId);
    } catch (error) {
        console.error('Failed to clear API logs:', error);
        throw error;
    }
}