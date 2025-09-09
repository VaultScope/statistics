# VaultScope Statistics

🚀 **Production-ready enterprise system monitoring platform with real-time metrics, secure API authentication, and comprehensive system information gathering.**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black)](https://nextjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-lightgrey)](https://sqlite.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle_ORM-0.44.x-orange)](https://orm.drizzle.team/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 🌟 Features

### Core Capabilities
- **🔐 Secure API Authentication** - 64-character entropy-generated API keys with bcrypt hashing and permission-based access control
- **📊 Real-time System Monitoring** - CPU, Memory, Disk, Network, GPU, and Process statistics via systeminformation library
- **💾 Persistent SQLite Database** - Production-ready storage with WAL mode, Drizzle ORM, and automatic migrations
- **🚦 Advanced Rate Limiting** - Per-API-key request throttling with configurable limits
- **📝 Comprehensive Logging** - API request/response logging with performance metrics and audit trails
- **🎨 Modern Web Interface** - Next.js 15 client with React 19, TypeScript, and Tailwind CSS
- **🔌 RESTful API** - Well-documented Express.js endpoints with compression and performance monitoring
- **🛡️ Enterprise Security** - CORS configuration, security headers, input validation, SQL injection protection via Drizzle ORM
- **📈 Performance Monitoring** - Built-in performance tracking, memory leak detection, and health checks
- **🔔 Alert System** - Configurable alerts with multiple notification channels (Email, Slack, Webhooks)

### System Information
- **CPU Metrics** - Real-time usage, cores, speed, temperature, cache details, per-core statistics
- **Memory Statistics** - RAM/swap usage, available/total memory, memory layout, usage percentage
- **Disk Information** - Storage usage, mount points, filesystem statistics, disk layout
- **Network Monitoring** - Interface statistics, real-time traffic monitoring, bandwidth calculations (Mbps)
- **Network Packet Sniffer** - Optional packet capture using cap module (Linux/macOS only, requires root)
- **Process Management** - List all processes with CPU/memory usage, terminate processes by PID
- **GPU Information** - Graphics card details, VRAM usage, vendor information, display outputs
- **System Details** - OS version, uptime, hostname, platform, mainboard information
- **Speed Testing** - Built-in network speed test functionality
- **Power Management** - System reboot and shutdown capabilities (protected by permissions)

## 📋 Prerequisites

- **Node.js** 20.x or higher (LTS recommended)
- **npm** 10.x or higher
- **Git** for repository cloning
- **Linux/macOS** for full feature support (Windows supported via WSL)
- **Root/sudo access** for advanced features (network packet sniffing, power management)
- **Modern browser** for web interface (Chrome, Firefox, Safari, Edge)

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/vaultscope/statistics.git
cd statistics
cp .env.example .env
```

### 2. Install and Initialize
```bash
npm install
npm run db:init  # Initialize database with admin key
npm run build:all  # Build server and client
```

### 3. Start Application
```bash
# Production mode
npm run production:start  # Server only on port 4000
# OR
npm run start:all  # Both server (4000) and client (4001)

# Development mode with hot reload
npm run dev:watch
```

Server runs on `http://localhost:4000`
Client runs on `http://localhost:4001`

### 4. Initial Admin API Key
The setup process creates an admin API key. Find it in the console output or run:
```bash
npm run apikey list
```

## 🔧 Installation

### Automated Installation (Linux/macOS)
```bash
curl -sSL https://raw.githubusercontent.com/vaultscope/statistics/main/installer.sh | sudo bash
```

The installer (v4.0.5) features:
- Interactive installation with progress tracking
- Automatic Node.js 20.x installation
- Database initialization with admin key generation
- Systemd service configuration
- Nginx reverse proxy setup (optional)
- SSL certificate configuration (optional)
- Uninstall mode: `installer.sh --uninstall`
- Recovery mode: `installer.sh --recovery`
- Quiet mode: `installer.sh --quiet`
- Auto-yes mode: `installer.sh --yes`

### Manual Installation

#### Development Setup
```bash
# Install dependencies
npm install

# Initialize database with admin key
npm run db:init

# Start development servers with hot reload
npm run dev:watch  # Server and client with file watching
# OR separately:
npm run server:watch  # Server only with nodemon
npm run client:dev  # Next.js client with hot reload
```

#### Production Setup
```bash
# Complete production setup
npm run production:setup

# This runs:
# - npm run clean (cleanup dist and .next directories)
# - npm run build:all (TypeScript server and Next.js client builds)
# - Database initialization is handled by server startup

# Start production servers
NODE_ENV=production npm run start:all  # Both server and client
# OR
NODE_ENV=production npm run server:prod  # Server only
NODE_ENV=production npm run client:prod  # Client only
```

## 🔑 API Key Management

### Create API Keys
```bash
# Admin key with all permissions
npm run apikey create "Admin Key" -- --admin

# Read-only key
npm run apikey create "Monitoring" -- --viewStats

# Custom permissions
npm run apikey create "DevOps" -- --viewStats --viewApiKeys --usePowerCommands
```

### List Keys
```bash
npm run apikey list
```

### Delete Keys
```bash
npm run apikey delete <uuid-or-key>
```

### Available Permissions
| Permission | Description |
|------------|-------------|
| `viewStats` | View system statistics and metrics |
| `createApiKey` | Create new API keys |
| `deleteApiKey` | Delete existing API keys |
| `viewApiKeys` | List and view API key details |
| `usePowerCommands` | Execute system commands (reboot/shutdown) |

## 📡 API Documentation

### Authentication
All endpoints except `/health` require authentication:

```bash
# Header authentication (recommended)
curl -H "x-api-key: YOUR_API_KEY" http://localhost:4000/endpoint

# Bearer token
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:4000/endpoint

# Query parameter (not recommended)
curl "http://localhost:4000/endpoint?apiKey=YOUR_API_KEY"
```

### Core Endpoints

#### System Information
| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/health` | GET | Server health check with metrics | None |
| `/metrics` | GET | Performance metrics | `viewStats` |
| `/data` | GET | All system information combined | `viewStats` |
| `/data/cpu` | GET | CPU information and metrics | `viewStats` |
| `/data/gpu` | GET | GPU information array | `viewStats` |
| `/data/ram` | GET | RAM statistics | `viewStats` |
| `/data/disk` | GET | Disk layout and usage | `viewStats` |
| `/data/mainboard` | GET | Mainboard information | `viewStats` |
| `/data/os` | GET | Operating system details | `viewStats` |

#### Process Management
| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/processes` | GET | List all processes with details | `viewStats` |
| `/processes/kill` | POST | Terminate process by PID | `viewStats` |

#### Statistics & Monitoring
| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/stats/cpu` | GET | Current CPU usage and temperature | `viewStats` |
| `/stats/memory` | GET | Memory and swap usage percentages | `viewStats` |
| `/stats/network` | GET | Network interfaces and statistics | `viewStats` |
| `/stats/network/traffic` | GET | Real-time network traffic (Mbps) | `viewStats` |
| `/stats/disk` | GET | Filesystem usage statistics | `viewStats` |
| `/stats/time` | GET | System time and uptime | `viewStats` |
| `/stats/speedtest` | GET | Run network speed test | `viewStats` |

#### API Key Management
| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/api/keys` | GET | List all API keys | `viewApiKeys` |
| `/api/keys` | POST | Create new API key | `createApiKey` |
| `/api/keys/:identifier` | GET | Get specific key by UUID/key | `viewApiKeys` |
| `/api/keys/:identifier/permissions` | PUT | Update key permissions | `createApiKey` |
| `/api/keys/:identifier` | DELETE | Delete API key | `deleteApiKey` |
| `/api/logs` | GET | Get API request logs | `viewApiKeys` |
| `/api/logs/stats/:apiKeyId` | GET | Get API key statistics | `viewApiKeys` |
| `/api/logs` | DELETE | Clear API logs | `deleteApiKey` |

#### Power Management & Network Sniffer
| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/power/reboot` | POST | Reboot system | `usePowerCommands` |
| `/power/shutdown` | POST | Shutdown system | `usePowerCommands` |
| `/network/sniffer/start` | POST | Start packet capture | `viewStats` |
| `/network/sniffer/stop` | POST | Stop packet capture | `viewStats` |
| `/network/sniffer/logs` | GET | Get recent packets (1000 max) | `viewStats` |
| `/network/sniffer/logs/all` | GET | Get all packets (100k max) | `viewStats` |
| `/network/sniffer/logs` | DELETE | Clear packet logs | `viewStats` |

### Example Responses

#### Health Check
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2025-01-09T12:00:00.000Z",
  "metrics": {
    "memory": {
      "used": 104857600,
      "total": 8589934592,
      "percent": 1.22
    },
    "cpu": {
      "percent": 15.5
    },
    "requests": {
      "total": 1234,
      "active": 5,
      "avgResponseTime": 45.2,
      "p95": 120.5
    }
  }
}
```

#### CPU Information
```json
{
  "manufacturer": "AMD",
  "brand": "Ryzen 7 7700 8-Core Processor",
  "speed": 3800,
  "cores": 16,
  "physicalCores": 8,
  "temperature": 45.5,
  "usage": {
    "current": 23.4,
    "average": 18.2,
    "cores": [15.2, 20.1, 18.5, ...]
  }
}
```

## 🛠️ Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=4000
HOST=0.0.0.0
NODE_ENV=production
TRUST_PROXY=loopback

# Database
DATABASE_URL=./database.db
DATABASE_WAL_MODE=true

# Security
JWT_SECRET=your-secret-key-here
API_KEY_LENGTH=64
BCRYPT_ROUNDS=10
SESSION_SECRET=your-session-secret

# Rate Limiting (per 15 minutes)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=*
CORS_CREDENTIALS=true

# Monitoring
MEMORY_LEAK_CHECK_INTERVAL=300000
MEMORY_GROWTH_THRESHOLD=100
MAX_NETWORK_STATS_ENTRIES=100
MAX_PACKET_LOGS=1000
MAX_ALL_PACKET_LOGS=100000

# Performance
COMPRESSION_ENABLED=true
COMPRESSION_LEVEL=6
PERF_MONITORING_ENABLED=true

# Alert System
ALERT_CHECK_INTERVAL=60000
CPU_ALERT_THRESHOLD=80
MEMORY_ALERT_THRESHOLD=90
DISK_ALERT_THRESHOLD=95
```

## 📦 Available Scripts

### Production
```bash
npm run production:setup    # Clean, build, and setup
npm run production:start    # Start server in production
npm run start:all          # Start both server and client
npm run deploy             # Full deployment pipeline
npm start                  # Start server only
```

### Development
```bash
npm run dev                # Start server and client concurrently
npm run dev:watch          # Development with hot reload
npm run server:watch       # Server with nodemon
npm run client:dev         # Next.js client development
npm run build              # Build TypeScript server
npm run build:all          # Build server and client
npm run clean              # Clean dist and .next directories
npm run clean:db           # Remove database files
```

### Database
```bash
npm run db:init            # Initialize database with admin key
npm run db:setup           # Alias for db:init
npm run db:reset           # Reset database (dev only)
npm run db:migrate         # Run Drizzle migrations
npm run db:generate        # Generate SQLite migrations
npm run db:push            # Push schema changes
npm run db:studio          # Open Drizzle Studio GUI
npm run db:init-tables     # Initialize tables only
```

### Testing & Utilities
```bash
npm test                   # Run tests (not configured)
npm run speed              # Run speed test utility
npm run sysinfo            # Display system information
npm run lint               # Run linter (not configured)
```

### API Key Management CLI
```bash
npm run apikey create "Key Name"              # Create with default permissions
npm run apikey create "Admin" -- --admin      # Create admin key
npm run apikey list                           # List all keys
npm run apikey delete <uuid|key>              # Delete specific key

# Custom permissions:
npm run apikey create "Custom" -- \
  --viewStats \
  --createApiKey \
  --deleteApiKey \
  --viewApiKeys \
  --usePowerCommands
```

## 🏗️ Project Structure

```
statistics/
├── server/                    # Express.js backend server
│   ├── index.ts              # Entry point with all routes
│   ├── config/               # Configuration
│   │   └── environment.ts    # Environment config with validation
│   ├── db/                   # Database layer
│   │   ├── index.ts          # SQLite connection with WAL mode
│   │   ├── schema/           # Drizzle schemas
│   │   │   ├── apikeys.ts    # API keys and logs
│   │   │   ├── users.ts      # User accounts
│   │   │   ├── nodes.ts      # Node configuration
│   │   │   └── alerts.ts     # Alert definitions
│   │   └── repositories/     # Data access patterns
│   │       ├── apiKeyRepository.ts
│   │       └── userRepository.ts
│   ├── functions/            # Core business logic
│   │   ├── auth.ts           # API key authentication
│   │   ├── keys/             # API key CRUD operations
│   │   ├── logs/             # API logging and network sniffer
│   │   ├── stats/            # System statistics
│   │   │   ├── speedtest.ts  # Speed test implementation
│   │   │   ├── usage.ts      # Usage tracking
│   │   │   ├── utils/        # Utility functions
│   │   │   │   ├── system/   # System info (CPU, GPU, RAM, etc.)
│   │   │   │   └── process/  # Process management
│   │   │   └── power/        # Power management
│   │   └── rateLimit.ts      # Per-key rate limiting
│   ├── services/             # Service layer
│   │   ├── databaseInitializer.ts  # DB setup and migrations
│   │   ├── alertEngine.ts    # Alert monitoring
│   │   ├── cache.ts          # Redis caching
│   │   ├── notifications.ts  # Multi-channel notifications
│   │   └── influxdb.ts       # Time-series storage
│   ├── middleware/           # Express middleware
│   │   ├── compression.ts    # Response compression
│   │   └── performance.ts    # Performance monitoring
│   ├── routes/               # Additional route modules
│   │   ├── alerts.ts         # Alert management
│   │   └── auth.ts           # Authentication routes
│   ├── types/                # TypeScript definitions
│   ├── cli/                  # CLI tools
│   │   └── apikey.ts         # API key management CLI
│   └── __tests__/            # Test files
├── client/                   # Next.js 15 frontend
│   ├── app/                  # App router pages
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Dashboard
│   │   ├── login/            # Authentication
│   │   ├── node/[id]/        # Node details
│   │   └── settings/         # Settings page
│   ├── components/           # React components
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Client utilities
│   ├── utils/                # Helper functions
│   ├── middleware.ts         # Next.js middleware
│   └── next.config.js        # Next.js configuration
├── dist/                     # Compiled server code
├── database.db               # SQLite database file
├── .env                      # Environment variables
├── .env.example              # Environment template
├── installer.sh              # Linux/macOS installer v4.0.5
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── drizzle.config.ts         # Drizzle ORM configuration
├── CLAUDE.md                 # AI assistant instructions
└── README.md                 # This file
```

## 🔒 Security Features

### Authentication & Authorization
- **64-character API keys** with crypto.randomBytes generation
- **Bcrypt hashing** for secure key storage (configurable rounds)
- **Permission-based access control** with 5 granular permissions
- **Per-key rate limiting** using express-rate-limit
- **Multiple auth methods** - Header, Bearer token, Query parameter

### Data Protection
- **SQL injection protection** via Drizzle ORM parameterized queries
- **Input validation** and type checking on all endpoints
- **Request body size limits** (10MB default)
- **Secure database** with SQLite WAL mode for concurrency

### Network Security
- **CORS configuration** with flexible origin control
- **Security headers** - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Referrer Policy** and Permissions Policy enforcement
- **Trust proxy** configuration for reverse proxy setups
- **Compression** middleware with configurable levels

### Monitoring & Auditing
- **API request logging** with method, path, status, response time
- **Performance monitoring** with memory leak detection
- **Health checks** with detailed metrics
- **Per-key usage statistics** and audit trails
- **Configurable log retention** and cleanup

## 🚢 Deployment

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --production
RUN cd client && npm ci --production

# Copy source code
COPY . .

# Build application
RUN npm run build:all

# Initialize database
RUN npm run db:init

# Expose ports
EXPOSE 4000 4001

# Start application
CMD ["npm", "run", "start:all"]
```

```bash
docker build -t vaultscope-statistics .
docker run -d -p 4000:4000 -p 4001:4001 \
  --name statistics \
  -v $(pwd)/database.db:/app/database.db \
  vaultscope-statistics
```

### Systemd Service
```bash
# Use the installer for automatic setup
sudo bash installer.sh
```

Or manually create services:

`/etc/systemd/system/vaultscope-statistics-server.service`:
```ini
[Unit]
Description=VaultScope Statistics Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/vaultscope-statistics
Environment=NODE_ENV=production
Environment=PORT=4000
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/vaultscope-statistics/server.log
StandardError=append:/var/log/vaultscope-statistics/server-error.log

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/vaultscope-statistics-client.service`:
```ini
[Unit]
Description=VaultScope Statistics Client
After=network.target vaultscope-statistics-server.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/vaultscope-statistics/client
Environment=NODE_ENV=production
Environment=PORT=4001
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable vaultscope-statistics-server
sudo systemctl enable vaultscope-statistics-client
sudo systemctl start vaultscope-statistics-server
sudo systemctl start vaultscope-statistics-client
```

### Nginx Configuration
```nginx
# API Server
server {
    listen 80;
    server_name api.example.com;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Web Client
server {
    listen 80;
    server_name app.example.com;
    
    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Monitoring & Maintenance

### Health Monitoring
```bash
# Check server health
curl http://localhost:4000/health

# Monitor logs
tail -f logs/server.log

# Check database size
du -h database.db

# View active connections
npm run apikey list
```

### Database Maintenance
```bash
# Backup database
cp database.db database.backup.$(date +%Y%m%d)

# Vacuum database (reduce size)
sqlite3 database.db "VACUUM;"

# Check integrity
sqlite3 database.db "PRAGMA integrity_check;"
```

### Performance Tuning
- Adjust `RATE_LIMIT_MAX` based on load
- Configure `DATABASE_WAL_MODE` for better concurrency
- Set appropriate `LOG_LEVEL` (error/warn for production)
- Tune `MONITORING_INTERVAL` based on requirements

## 🧪 Testing

```bash
# Test API endpoint
curl -H "x-api-key: YOUR_KEY" http://localhost:4000/data/cpu

# Load testing with Apache Bench
ab -n 1000 -c 10 -H "x-api-key: YOUR_KEY" http://localhost:4000/health

# Test all endpoints
npm run test:api
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Install dependencies (`npm install`)
4. Make your changes
5. Test your changes:
   - Run development server: `npm run dev:watch`
   - Test API endpoints manually
   - Ensure no TypeScript errors: `npm run build`
6. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
7. Push to the branch (`git push origin feature/AmazingFeature`)
8. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add TypeScript types for new features
- Update CLAUDE.md if adding new commands or architecture changes
- Test on both Linux and macOS if possible
- Document new API endpoints in README

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.vaultscope.com](https://docs.vaultscope.com)
- **Issues**: [GitHub Issues](https://github.com/vaultscope/statistics/issues)
- **Discord**: [Join our community](https://discord.gg/vaultscope)
- **Email**: support@vaultscope.com

## 🙏 Acknowledgments

### Core Technologies
- **Runtime**: [Node.js](https://nodejs.org/) v20+ and [TypeScript](https://www.typescriptlang.org/) v5
- **Backend**: [Express.js](https://expressjs.com/) v5 with middleware ecosystem
- **Frontend**: [Next.js](https://nextjs.org/) v15 with [React](https://react.dev/) v19
- **Database**: [SQLite](https://sqlite.org/) with [Drizzle ORM](https://orm.drizzle.team/) v0.44
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v3 with PostCSS

### Key Libraries
- **System Monitoring**: [systeminformation](https://github.com/sebhildebrandt/systeminformation) v5
- **Process Management**: [ps-list](https://github.com/sindresorhus/ps-list) v8
- **Authentication**: [bcryptjs](https://github.com/dcodeIO/bcrypt.js) for secure hashing
- **Rate Limiting**: [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) v8
- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js) v14
- **Charts**: [Recharts](https://recharts.org/) v3 for data visualization
- **Icons**: [Lucide React](https://lucide.dev/) for UI icons

## 📋 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 4000
lsof -i :4000
# Kill the process
kill -9 <PID>
```

#### Database Locked Error
```bash
# Stop all services
sudo systemctl stop vaultscope-statistics-server
# Remove lock files
rm -f database.db-wal database.db-shm
# Restart services
sudo systemctl start vaultscope-statistics-server
```

#### Network Sniffer Not Working
- Requires Linux or macOS (not supported on Windows)
- Must run with sudo/root privileges
- Install cap module: `npm install cap --save-optional`

#### Memory Leak Detection
- Check logs for memory warnings
- Adjust `MEMORY_LEAK_CHECK_INTERVAL` and `MEMORY_GROWTH_THRESHOLD`
- Monitor with: `curl -H "x-api-key: KEY" http://localhost:4000/metrics`

#### API Key Not Working
- Verify key exists: `npm run apikey list`
- Check permissions match endpoint requirements
- Ensure rate limit not exceeded
- Check API logs: `curl -H "x-api-key: ADMIN_KEY" http://localhost:4000/api/logs`

---

**VaultScope Statistics** - Enterprise System Monitoring Made Simple 🚀

*Version 1.0.0 - Production Ready*

Built with ❤️ by the VaultScope Team