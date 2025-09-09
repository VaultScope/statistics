# VaultScope Statistics

🚀 **Production-ready enterprise system monitoring platform with real-time metrics, secure API authentication, and comprehensive system information gathering.**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-lightgrey)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 🌟 Features

### Core Capabilities
- **🔐 Secure API Authentication** - 64-character entropy-generated API keys with permission-based access control
- **📊 Real-time System Monitoring** - CPU, Memory, Disk, Network, GPU, and Process statistics
- **💾 Persistent SQLite Database** - Production-ready storage with WAL mode for high concurrency
- **🚦 Advanced Rate Limiting** - Per-API-key request throttling and quota management
- **📝 Comprehensive Logging** - Request/response logging with performance metrics
- **🔌 RESTful API** - Well-documented endpoints for all system metrics
- **🛡️ Enterprise Security** - CORS, security headers, input validation, SQL injection protection

### System Information
- **CPU Metrics** - Real-time usage, cores, speed, temperature, cache details
- **Memory Statistics** - RAM/swap usage, available/total memory, memory pressure
- **Disk Information** - Storage usage, mount points, I/O statistics, SMART data
- **Network Monitoring** - Interface statistics, active connections, bandwidth usage
- **Process Management** - List, monitor, and terminate system processes
- **GPU Information** - Graphics card details, VRAM usage, temperature
- **System Details** - OS version, uptime, hostname, platform information

## 📋 Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **Git** for repository cloning
- **Linux/macOS** for full feature support (Windows via WSL)
- **Root/sudo access** for advanced features (network monitoring, power management)

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
npm run production:setup
```

### 3. Start Server
```bash
npm run production:start
```

Server runs on `http://localhost:4000` by default.

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

The installer will:
- Install Node.js 20.x
- Setup the application
- Initialize the database
- Create systemd services
- Generate an admin API key
- Configure Nginx (optional)
- Setup SSL certificates (optional)

### Manual Installation

#### Development Setup
```bash
# Install dependencies
npm install

# Initialize database with admin key
npm run db:init

# Start development server with hot reload
npm run dev:watch
```

#### Production Setup
```bash
# Complete production setup
npm run production:setup

# This runs:
# - npm run clean (cleanup old builds)
# - npm run build:all (build server and client)
# - npm run db:init (initialize database)

# Start production server
NODE_ENV=production npm start
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
| `/health` | GET | Server health check | None |
| `/data/cpu` | GET | CPU information and metrics | `viewStats` |
| `/data/gpu` | GET | GPU information | `viewStats` |
| `/data/memory` | GET | Memory statistics | `viewStats` |
| `/data/disk` | GET | Disk usage and I/O | `viewStats` |
| `/data/network` | GET | Network interfaces | `viewStats` |
| `/data/system` | GET | System information | `viewStats` |
| `/data/all` | GET | All system data | `viewStats` |

#### Process Management
| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/processes` | GET | List all processes | `viewStats` |
| `/processes/:pid` | GET | Get specific process | `viewStats` |
| `/processes/:pid` | DELETE | Terminate process | `usePowerCommands` |

#### Statistics
| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/stats/cpu` | GET | CPU usage statistics | `viewStats` |
| `/stats/memory` | GET | Memory usage over time | `viewStats` |
| `/stats/network` | GET | Network statistics | `viewStats` |
| `/stats/disk` | GET | Disk I/O statistics | `viewStats` |

#### API Key Management
| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/keys` | GET | List all API keys | `viewApiKeys` |
| `/keys` | POST | Create new API key | `createApiKey` |
| `/keys/:id` | GET | Get specific key details | `viewApiKeys` |
| `/keys/:id` | PUT | Update key permissions | `createApiKey` |
| `/keys/:id` | DELETE | Delete API key | `deleteApiKey` |

#### Power Management
| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/power/reboot` | POST | Reboot system | `usePowerCommands` |
| `/power/shutdown` | POST | Shutdown system | `usePowerCommands` |

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
Create a `.env` file:

```env
# Server Configuration
PORT=4000
HOST=0.0.0.0
NODE_ENV=production
TRUST_PROXY=true

# Database
DATABASE_PATH=./database.db
DATABASE_BACKUP_PATH=./backups
DATABASE_WAL_MODE=true

# Security
JWT_SECRET=your-secret-key-here
API_KEY_LENGTH=64
BCRYPT_ROUNDS=10
SESSION_SECRET=your-session-secret

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
RATE_LIMIT_SKIP_SUCCESSFUL=false

# CORS
CORS_ORIGIN=https://your-domain.com
CORS_CREDENTIALS=true

# Monitoring
ENABLE_MONITORING=true
MONITORING_INTERVAL=60000
MEMORY_ALERT_THRESHOLD=90
CPU_ALERT_THRESHOLD=80
DISK_ALERT_THRESHOLD=95

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
LOG_MAX_SIZE=10485760
LOG_MAX_FILES=5
LOG_DATE_PATTERN=YYYY-MM-DD
```

## 📦 Available Scripts

### Production
```bash
npm run production:setup    # Complete production setup
npm run production:start    # Start in production mode
npm run deploy             # Full deployment pipeline
npm start                  # Start server
```

### Development
```bash
npm run dev                # Start development server
npm run dev:watch          # Development with hot reload
npm run build              # Build TypeScript
npm run clean              # Clean build artifacts
```

### Database
```bash
npm run db:init            # Initialize database
npm run db:migrate         # Run migrations
npm run db:generate        # Generate migration files
npm run db:push           # Push schema changes
npm run db:studio         # Open database GUI
```

### Testing
```bash
npm test                   # Run tests
npm run test:load         # Load testing
npm run test:api          # API endpoint tests
```

### Utilities
```bash
npm run apikey            # API key management
npm run sysinfo           # System information
npm run speed             # Network speed test
```

## 🏗️ Project Structure

```
statistics/
├── server/                 # Backend server
│   ├── index.ts           # Entry point
│   ├── config/            # Configuration
│   │   └── environment.ts # Environment config
│   ├── db/                # Database layer
│   │   ├── index.ts       # Database connection
│   │   ├── schema/        # Table schemas
│   │   └── repositories/  # Data access
│   ├── functions/         # Business logic
│   │   ├── auth.ts        # Authentication
│   │   ├── keys/          # API key management
│   │   ├── logs/          # Logging system
│   │   ├── stats/         # Statistics
│   │   └── power/         # Power management
│   ├── routes/            # API routes
│   ├── types/             # TypeScript types
│   ├── middleware/        # Express middleware
│   └── scripts/           # Utility scripts
├── client/                # Frontend (Next.js)
│   ├── app/              # App router
│   ├── components/       # React components
│   ├── lib/              # Utilities
│   └── public/           # Static assets
├── database.db          # SQLite database
├── .env.example          # Environment template
├── installer.sh          # Linux installer
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── drizzle.config.ts     # Database config
```

## 🔒 Security Features

### Authentication & Authorization
- **64-character API keys** with entropy-based generation
- **Permission-based access control** for fine-grained authorization
- **Rate limiting** per API key to prevent abuse
- **Request signing** support for additional security

### Data Protection
- **SQL injection protection** via Drizzle ORM parameterized queries
- **Input validation** on all endpoints
- **Output sanitization** to prevent XSS
- **Encrypted sensitive data** in database

### Network Security
- **CORS configuration** with origin whitelisting
- **Security headers** (CSP, HSTS, X-Frame-Options, etc.)
- **HTTPS support** via reverse proxy
- **IP whitelisting** support

### Monitoring & Auditing
- **Comprehensive request logging** with response times
- **Failed authentication tracking**
- **Rate limit violation logging**
- **Security event notifications**

## 🚢 Deployment

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["node", "dist/server/index.js"]
```

```bash
docker build -t vaultscope-statistics .
docker run -d -p 4000:4000 --name statistics vaultscope-statistics
```

### Systemd Service
```bash
sudo cp installer.sh /tmp/ && sudo bash /tmp/installer.sh
```

Or manually create `/etc/systemd/system/vaultscope-statistics.service`:
```ini
[Unit]
Description=VaultScope Statistics Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/statistics
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Nginx Configuration
```nginx
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
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.vaultscope.com](https://docs.vaultscope.com)
- **Issues**: [GitHub Issues](https://github.com/vaultscope/statistics/issues)
- **Discord**: [Join our community](https://discord.gg/vaultscope)
- **Email**: support@vaultscope.com

## 🙏 Acknowledgments

- Built with [Node.js](https://nodejs.org/) and [TypeScript](https://www.typescriptlang.org/)
- Database: [SQLite](https://sqlite.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- System info: [systeminformation](https://github.com/sebhildebrandt/systeminformation)
- Process management: [ps-list](https://github.com/sindresorhus/ps-list)
- API documentation: [Swagger/OpenAPI](https://swagger.io/)

---

**VaultScope Statistics** - Enterprise System Monitoring Made Simple 🚀

*Version 1.0.0 - Production Ready*