export interface ApiLog {
    id: string;
    apiKeyId: string;
    apiKeyName: string;
    endpoint: string;
    method: string;
    statusCode: number;
    ipAddress: string;
    userAgent?: string;
    timestamp: Date;
    responseTime?: number;
}

export interface ApiKeyStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastUsed: Date | null;
    requestsByEndpoint?: { [endpoint: string]: number };
    requestsByStatusCode?: { [code: string]: number };
    requestsPerDay?: { [date: string]: number };
}