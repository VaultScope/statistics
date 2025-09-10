# VaultScope Statistics

🚀 **A powerful, real-time system monitoring and statistics dashboard with automatic database initialization**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)

## 🎯 Quick Start

### One-Line Installation (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/vaultscope/statistics/main/installer.sh | sudo bash
```

Or clone and install:

```bash
git clone https://github.com/vaultscope/statistics.git && cd statistics && sudo bash installer.sh
```

The installer will:
✅ Install Node.js 20+ (if not present)  
✅ Set up server and client applications  
✅ **Automatically create and initialize databases**  
✅ Configure systemd services  
✅ Set up Nginx reverse proxy (optional)  
✅ Configure SSL certificates (optional)  
✅ Generate admin API keys  

## 📋 Prerequisites

- **Operating System**: Linux (Ubuntu/Debian preferred), macOS, or WSL2
- **Node.js**: Version 20.0.0 or higher
- **Memory**: Minimum 1GB RAM
- **Disk Space**: 500MB free space
- **Permissions**: Root/sudo access for installation

## 🏗️ Architecture

This project consists of **two standalone applications** that work together:

### 📡 Server Application (`/server`)
- **Port**: 4000
- **Database**: SQLite with WAL mode
- **Auto-initialization**: Creates 17 tables on first run
- **API**: RESTful with token authentication
- **Features**: 
  - Real-time system metrics collection
  - Alert engine with notifications
  - API key management with permissions
  - Process and network monitoring

### 💻 Client Application (`/client`)
- **Port**: 4001
- **Framework**: Next.js 15 + React 19
- **Database**: JSON file (lightweight)
- **Auto-initialization**: Creates structure with defaults
- **Features**:
  - Modern responsive dashboard
  - Real-time data visualization
  - User and role management
  - Node monitoring interface

## 🚀 Installation Methods

### Method 1: Automated Installer (Production Ready)

```bash
# Download and run installer
wget https://raw.githubusercontent.com/vaultscope/statistics/main/installer.sh
chmod +x installer.sh
sudo ./installer.sh

# Follow the interactive prompts:
# 1. Choose installation type (full/server/client)
# 2. Configure domains (optional)
# 3. Set up SSL (optional)
# 4. Configure Nginx (optional)
```

### Method 2: Docker Deployment

```bash
# Clone the repository
git clone https://github.com/vaultscope/statistics.git
cd statistics

# Start with Docker Compose
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Method 3: Manual Installation

#### Step 1: Clone Repository
```bash
git clone https://github.com/vaultscope/statistics.git
cd statistics
```

#### Step 2: Install Dependencies
```bash
# Install dependencies for both applications
npm run install:all

# Or install separately
cd server && npm install && cd ..
cd client && npm install && cd ..
```

#### Step 3: Build Applications
```bash
# Build both applications
npm run build:all

# Or build separately
npm run build:server
npm run build:client
```

#### Step 4: Start Applications

**Development Mode:**
```bash
# Run both in development mode with hot reload
npm run dev

# Or run separately in different terminals
npm run server:dev  # Server on http://localhost:4000
npm run client:dev  # Client on http://localhost:4001
```

**Production Mode:**
```bash
# Start both in production
npm run start:all

# Or use PM2 for process management
npm install -g pm2
pm2 start ecosystem.config.js
```

## 🗄️ Database Information

### Automatic Database Initialization

**Both applications automatically create their databases on first startup!** No manual setup required.

#### Server Database (`server/database.db`)
Automatically creates 17 tables:
- `users` - User accounts
- `roles` - Permission roles
- `sessions` - Active sessions
- `audit_logs` - Audit trail
- `nodes` - Monitored servers
- `node_metrics` - Performance data
- `node_events` - System events
- `categories` - Node categories
- `api_keys` - API authentication
- `api_key_logs` - API usage logs
- `alerts` - Alert definitions
- `alert_history` - Alert triggers
- `notification_channels` - Alert destinations
- Plus supporting tables

#### Client Database (`client/database.json`)
Automatically creates structure with:
- 5 default categories (Production, Development, Testing, Backup, Monitoring)
- 2 default roles (Administrator, Viewer)
- Ready for user and node registration

## 🔑 API Authentication

### Generate Admin API Key

After installation, generate your first admin key:

```bash
cd server
npm run apikey create "Admin Key" -- --admin --viewStats --createApiKey --deleteApiKey --viewApiKeys --usePowerCommands

# Output will show:
# ✅ API Key created successfully!
# 🔑 API Key: 64-character-key-here
# Save this key securely!
```

### Using API Keys

Include in requests:
```bash
# Header method
curl -H "x-api-key: YOUR_API_KEY" http://localhost:4000/api/stats

# Bearer token
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:4000/api/stats

# Query parameter
curl "http://localhost:4000/api/stats?apiKey=YOUR_API_KEY"
```

## 📊 Available Endpoints

### Public Endpoints
- `GET /health` - Health check (no auth required)
- `GET /api` - API information

### Authenticated Endpoints
- `GET /api/stats` - System statistics
- `GET /api/stats/cpu` - CPU information
- `GET /api/stats/ram` - Memory statistics
- `GET /api/stats/disk` - Disk usage
- `GET /api/stats/network` - Network interfaces
- `GET /api/stats/process` - Process list
- `POST /api/nodes` - Register new node
- `GET /api/nodes` - List all nodes
- `GET /api/alerts` - Active alerts
- `POST /api/alerts` - Create alert rule

## ⚙️ Configuration

### Environment Variables

Create `.env` files in respective directories:

**Server Configuration** (`server/.env`):
```env
NODE_ENV=production
PORT=4000
DATABASE_PATH=./database.db
JWT_SECRET=your-secret-key-here
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
CORS_ORIGIN=http://localhost:4001
```

**Client Configuration** (`client/.env`):
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=VaultScope Statistics
NEXT_PUBLIC_APP_VERSION=2.0.0
```

### Systemd Service Configuration

Services are automatically created by installer at:
- `/etc/systemd/system/vss-server.service`
- `/etc/systemd/system/vss-client.service`

Manual service management:
```bash
# Start services
sudo systemctl start vss-server
sudo systemctl start vss-client

# Enable on boot
sudo systemctl enable vss-server
sudo systemctl enable vss-client

# Check status
sudo systemctl status vss-server
sudo systemctl status vss-client

# View logs
sudo journalctl -u vss-server -f
sudo journalctl -u vss-client -f
```

## 🛠️ Development

### Project Structure
```
statistics/
├── server/                 # Backend API server
│   ├── db/                # Database schemas & migrations
│   │   ├── schema/        # Drizzle ORM schemas
│   │   ├── migrations/    # SQL migrations
│   │   └── init.sql       # Initial database setup
│   ├── functions/         # Core functionality
│   │   ├── auth.ts        # Authentication middleware
│   │   ├── keys/          # API key management
│   │   └── stats/         # System statistics
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic
│   │   ├── alertEngine.ts # Alert monitoring
│   │   └── databaseInitializer.ts
│   ├── types/             # TypeScript definitions
│   └── index.ts           # Server entry point
│
├── client/                # Frontend dashboard
│   ├── app/              # Next.js app router
│   │   ├── api/          # API routes
│   │   ├── (dashboard)/  # Dashboard pages
│   │   └── layout.tsx    # Root layout
│   ├── components/       # React components
│   │   ├── dashboard/    # Dashboard widgets
│   │   └── ui/           # UI components
│   ├── lib/              # Utilities
│   │   └── db-json.ts    # JSON database handler
│   └── next.config.js    # Next.js configuration
│
├── installer.sh          # Automated installer script
├── docker-compose.yml    # Docker configuration
├── package.json          # Root package scripts
└── README.md            # This file
```

### Available Scripts

**Root Level:**
```bash
npm run install:all    # Install all dependencies
npm run dev            # Run both in dev mode
npm run build:all      # Build both applications
npm run start:all      # Start both in production
npm run clean          # Clean all build artifacts
```

**Server Scripts:**
```bash
cd server
npm run dev            # Development with hot reload
npm run build          # Build TypeScript
npm run start          # Start production server
npm run apikey         # API key management CLI
npm run speed          # Run speed test
npm run sysinfo        # Display system info
```

**Client Scripts:**
```bash
cd client
npm run dev            # Next.js development
npm run build          # Build for production
npm run start          # Start production server
npm run lint           # Run ESLint
```

## 🔒 Security Features

- **Token Authentication**: Secure API key system
- **Rate Limiting**: Per-key request throttling
- **SQL Injection Protection**: Parameterized queries via Drizzle ORM
- **XSS Protection**: Content Security Policy headers
- **CORS Configuration**: Controlled cross-origin access
- **Session Management**: Secure session handling
- **Audit Logging**: Complete activity trail
- **Input Validation**: Comprehensive request validation
- **HTTPS Support**: SSL/TLS encryption ready

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Find process using port
sudo lsof -i :4000
sudo lsof -i :4001

# Kill process
sudo kill -9 <PID>
```

**Database Permission Issues:**
```bash
# Fix server database permissions
sudo chown -R $USER:$USER server/database.db*

# Fix client database permissions
sudo chown -R $USER:$USER client/database.json
```

**Node.js Version Issues:**
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Build Errors:**
```bash
# Clear caches and rebuild
npm run clean
rm -rf node_modules package-lock.json
rm -rf server/node_modules server/package-lock.json
rm -rf client/node_modules client/package-lock.json
npm run install:all
npm run build:all
```

## 📚 Additional Resources

- [API Documentation](./docs/API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/vaultscope/statistics/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vaultscope/statistics/discussions)
- **Security**: Report vulnerabilities to security@vaultscope.com

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org) and [Express](https://expressjs.com)
- Database powered by [SQLite](https://sqlite.org) and [Drizzle ORM](https://orm.drizzle.team)
- System information via [systeminformation](https://github.com/sebhildebrandt/systeminformation)
- Process monitoring with [ps-list](https://github.com/sindresorhus/ps-list)

---

**VaultScope Statistics** - Enterprise-grade monitoring made simple 🚀