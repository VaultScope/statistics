import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '4000'),
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development',
    serverId: process.env.SERVER_ID || 'vaultscope-1',
    trustProxy: process.env.TRUST_PROXY || 'loopback',
  },
  
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || (
      process.env.NODE_ENV === 'production' 
        ? '/var/www/vaultscope-statistics/database.db'
        : './database.db'
    ),
    poolMin: parseInt(process.env.DB_POOL_MIN || '2'),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10'),
    poolIdleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
    walMode: process.env.DB_WAL_MODE !== 'false',
  },
  
  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.CACHE_TTL || '300'), // 5 minutes default
    prefix: process.env.CACHE_PREFIX || 'vaultscope:',
  },
  
  // InfluxDB Configuration
  influxdb: {
    url: process.env.INFLUXDB_URL || 'http://localhost:8086',
    token: process.env.INFLUXDB_TOKEN || '',
    org: process.env.INFLUXDB_ORG || 'vaultscope',
    bucket: process.env.INFLUXDB_BUCKET || 'metrics',
    retentionDays: parseInt(process.env.INFLUXDB_RETENTION_DAYS || '30'),
  },
  
  // Security Configuration
  security: {
    sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    jwtSecret: process.env.JWT_SECRET || 'change-this-jwt-secret',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10'),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },
  
  // Monitoring Configuration
  monitoring: {
    alertCheckInterval: parseInt(process.env.ALERT_CHECK_INTERVAL_MS || '30000'), // 30 seconds
    metricsInterval: parseInt(process.env.METRICS_INTERVAL_MS || '5000'), // 5 seconds
    memoryLeakCheckInterval: parseInt(process.env.MEMORY_LEAK_CHECK_INTERVAL_MS || '60000'), // 1 minute
    maxPacketLogs: parseInt(process.env.MAX_PACKET_LOGS || '1000'),
    maxAllPacketLogs: parseInt(process.env.MAX_ALL_PACKET_LOGS || '100000'),
    performanceStatsHistorySize: parseInt(process.env.PERF_STATS_HISTORY_SIZE || '100'),
  },
  
  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@vaultscope.com',
  },
  
  // Agent Configuration
  agent: {
    serverUrl: process.env.AGENT_SERVER_URL || 'http://localhost:4000',
    apiKey: process.env.AGENT_API_KEY || '',
    collectInterval: parseInt(process.env.AGENT_COLLECT_INTERVAL_MS || '60000'), // 1 minute
    sendInterval: parseInt(process.env.AGENT_SEND_INTERVAL_MS || '5000'), // 5 seconds
    maxQueueSize: parseInt(process.env.AGENT_MAX_QUEUE_SIZE || '1000'),
  },
  
  // Feature Flags
  features: {
    enableDocker: process.env.ENABLE_DOCKER !== 'false',
    enableKubernetes: process.env.ENABLE_KUBERNETES === 'true',
    enableNetworkSniffer: process.env.ENABLE_NETWORK_SNIFFER !== 'false',
    enablePowerCommands: process.env.ENABLE_POWER_COMMANDS !== 'false',
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false',
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    colorize: process.env.LOG_COLORIZE !== 'false',
  },
};

// Validate required configuration
export function validateConfig() {
  const errors: string[] = [];
  
  if (config.server.nodeEnv === 'production') {
    if (config.security.sessionSecret === 'change-this-secret-in-production') {
      errors.push('SESSION_SECRET must be set in production');
    }
    if (config.security.jwtSecret === 'change-this-jwt-secret') {
      errors.push('JWT_SECRET must be set in production');
    }
    if (!config.influxdb.token && config.features.enableDocker) {
      errors.push('INFLUXDB_TOKEN should be set when using InfluxDB');
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Export as default
export default config;