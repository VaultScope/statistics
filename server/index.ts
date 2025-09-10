import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { performance } from 'perf_hooks';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import database and initializer
import { db } from './db';
import { DatabaseInitializer } from './services/databaseInitializer';

// Import middleware
import authMiddleware from './functions/auth';
import rateLimitMiddleware from './functions/rateLimit';
// import { compressionMiddleware } from './middleware/compression';
// import { performanceMiddleware } from './middleware/performance';

// Import routes
import alertsRoutes from './routes/alerts';
import authRoutes from './routes/auth';
import statsRoutes from './routes/stats-simple';

// Import services
import { AlertEngine } from './services/alertEngine';

const app = express();
const PORT = process.env.PORT || 4000;
const startTime = performance.now();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Custom middleware
// app.use(compressionMiddleware);
// app.use(performanceMiddleware);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  const uptime = Math.floor((performance.now() - startTime) / 1000);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${uptime} seconds`,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API info endpoint (no auth required)
app.get('/api', (req, res) => {
  res.json({
    name: 'VaultScope Statistics Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      stats: '/api/stats',
      keys: '/api/keys',
      power: '/api/power',
      alerts: '/api/alerts',
      nodes: '/api/nodes',
      users: '/api/users',
    },
    documentation: 'https://github.com/yourusername/vaultscope-statistics',
  });
});

// Auth routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/stats', authMiddleware, rateLimitMiddleware, statsRoutes);
app.use('/api/alerts', authMiddleware, rateLimitMiddleware, alertsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  if (err.code === 'SQLITE_ERROR') {
    return res.status(500).json({
      error: 'Database error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message,
    });
  }
  
  res.status(err.status || 500).json({
    error: err.name || 'Error',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting VaultScope Statistics Server...');
    
    // Initialize database
    const dbInitializer = DatabaseInitializer.getInstance();
    const initialized = await dbInitializer.initialize();
    
    if (!initialized) {
      console.error('❌ Failed to initialize database');
      process.exit(1);
    }
    
    // Initialize alert engine
    const alertEngine = new AlertEngine();
    alertEngine.start();
    console.log('📊 Alert engine started');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API info: http://localhost:${PORT}/api`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
    async function shutdown() {
      console.log('\n📦 Shutting down gracefully...');
      alertEngine.stop();
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;