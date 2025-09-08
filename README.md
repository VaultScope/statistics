# VaultScope Statistics

<div align="center">

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg?style=for-the-badge)
![License](https://img.shields.io/badge/license-ISC-green.svg?style=for-the-badge)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey.svg?style=for-the-badge)

**Enterprise-grade system monitoring and statistics platform with real-time analytics**

[🚀 Quick Start](#-quick-installation) • [✨ Features](#-features) • [📖 Documentation](#-usage) • [🔌 API](#-api-documentation) • [🤝 Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [CLI Tools](#-cli-tools)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)
- [License](#-license)

## 🌟 Overview

VaultScope Statistics is a comprehensive system monitoring solution that provides real-time insights into your infrastructure. Built with TypeScript, Express.js, and Next.js, it offers both a robust REST API server and an intuitive web dashboard for visualization and management.

### Why VaultScope Statistics?

- **Real-Time Monitoring** - Live updates every 5 seconds for critical metrics
- **Multi-Node Support** - Monitor unlimited servers from a single dashboard
- **Security First** - API key authentication with role-based permissions
- **Easy Deployment** - One-command installation with automatic configuration
- **Cross-Platform** - Works seamlessly on Linux, macOS, and Windows
- **Open Source** - Fully transparent and customizable

## ✨ Features

### 📊 System Monitoring
- **CPU Analytics** - Usage, cores, speed, temperature, load averages
- **Memory Tracking** - RAM/swap usage, detailed memory layout
- **Disk I/O** - Storage usage, read/write speeds, device information
- **Network Analysis** - Bandwidth monitoring, packet sniffing (requires root)
- **Process Management** - Live process list with resource usage
- **Hardware Detection** - Complete system specifications

### 🔐 Security & Access Control
- **API Key Authentication** - Secure token-based access
- **Role-Based Permissions** - Granular access control system
- **Audit Logging** - Complete API access and activity logs
- **Rate Limiting** - Protection against API abuse
- **CORS Support** - Configurable cross-origin policies

### 🎨 Web Dashboard
- **Modern UI** - Clean, responsive Next.js interface
- **Real-Time Charts** - Interactive graphs using Recharts
- **Dark Mode** - Eye-friendly dark theme support
- **Multi-Node View** - Manage multiple servers from one place
- **User Management** - Create and manage user accounts
- **Role System** - Admin, Operator, Viewer, and custom roles

### 🛠️ Management Tools
- **CLI Interface** - Powerful command-line tools
- **Auto-Installation** - Intelligent setup script with OS detection
- **Service Management** - Systemd/launchd integration
- **Reverse Proxy** - Built-in support for Nginx, Apache, Cloudflare
- **SSL/TLS** - Automatic Let's Encrypt certificate setup
- **Diagnostics** - Built-in troubleshooting tools

## 🏗️ Architecture

```
vaultscope-statistics/
├── server/                    # Backend API Server
│   ├── index.ts              # Express server entry point
│   ├── functions/            # Core functionality modules
│   │   ├── keys/            # API key management
│   │   ├── logs/            # Logging and monitoring
│   │   ├── stats/           # Statistics collection
│   │   │   ├── power/      # System power controls
│   │   │   ├── speedtest/  # Network speed testing
│   │   │   └── utils/      # Utility functions
│   │       ├── process/    # Process management
│   │       └── system/     # System information
│   ├── cli/                 # CLI tool implementations
│   └── types/               # TypeScript type definitions
│
├── client/                   # Frontend Web Application
│   ├── app/                 # Next.js 15 app directory
│   │   ├── api/            # API route handlers
│   │   │   ├── auth/      # Authentication endpoints
│   │   │   ├── nodes/     # Node management
│   │   │   ├── users/     # User management
│   │   │   └── roles/     # Role management
│   │   ├── components/     # React components
│   │   └── (dashboard)/   # Dashboard pages
│   ├── lib/                # Utility libraries
│   └── public/            # Static assets
│
├── installer.sh            # Linux/macOS installer
├── uninstaller.sh         # Clean uninstallation script
├── diagnose.sh           # Diagnostic tool
├── cli.js                # CLI entry point
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
└── CLAUDE.md            # AI assistance documentation
```

## 🚀 Installation

### 🎯 Quick Installation (Recommended)

#### Linux/macOS

```bash
# Download and run the installer
curl -fsSL https://raw.githubusercontent.com/vaultscope/statistics/main/installer.sh -o installer.sh
sudo bash installer.sh

# The installer will:
# ✅ Detect your operating system
# ✅ Check for existing installations
# ✅ Install Node.js if needed
# ✅ Set up the application
# ✅ Configure system services
# ✅ Set up reverse proxy (optional)
# ✅ Configure SSL certificates (optional)
```

#### Installation Options

During installation, you'll be prompted to:

1. **Choose Components**
   - Server only (API backend)
   - Client only (Web dashboard)
   - Both (Recommended)

2. **Configure Reverse Proxy** (Optional)
   - Nginx (Recommended)
   - Apache
   - Cloudflare Tunnel
   - None (direct access)

3. **Set Up Domains** (If using reverse proxy)
   - API domain (e.g., api.yourdomain.com)
   - Client domain (e.g., app.yourdomain.com)

4. **Configure SSL** (If using Nginx/Apache)
   - Automatic Let's Encrypt setup
   - Auto-renewal configuration

### 📦 Manual Installation

#### Prerequisites

- Node.js 18.0 or higher
- npm or yarn
- Git
- Linux/macOS/Windows
- Root/Administrator access (for system monitoring features)

#### Step-by-Step Guide

1. **Clone the repository**
```bash
git clone https://github.com/vaultscope/statistics.git
cd statistics
```

2. **Install dependencies**
```bash
npm install
```

3. **Build the project**
```bash
# Build TypeScript files
npm run build

# Build Next.js client
npm run client:build
```

4. **Configure environment**
```bash
# Copy example configurations
cp .env.example .env
cp client/.env.example client/.env

# Edit configuration files
nano .env
nano client/.env
```

5. **Start services**
```bash
# Start server (API)
npm run server

# In another terminal, start client (Web UI)
npm run client
```

6. **Access the application**
   - API Server: http://localhost:4000
   - Web Dashboard: http://localhost:3000

### 🐳 Docker Installation

```bash
# Using Docker Compose (Recommended)
docker-compose up -d

# Or using individual containers
docker run -d -p 4000:4000 --name vaultscope-server vaultscope/statistics:server
docker run -d -p 3000:3000 --name vaultscope-client vaultscope/statistics:client

# View logs
docker logs vaultscope-server
docker logs vaultscope-client
```

### ☁️ Cloud Deployment

<details>
<summary><b>Deploy to AWS</b></summary>

```bash
# Using AWS CLI
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name your-key \
  --user-data file://installer.sh
```
</details>

<details>
<summary><b>Deploy to DigitalOcean</b></summary>

```bash
# Using doctl
doctl compute droplet create vaultscope \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-4gb \
  --region nyc1 \
  --user-data-file installer.sh
```
</details>

## ⚙️ Configuration

### Environment Variables

#### Server Configuration (.env)
```env
# Server Settings
PORT=4000
NODE_ENV=production

# Security
API_KEY_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret

# Database
DB_PATH=./data/statistics.db

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_DIR=/var/log/vaultscope-statistics
```

#### Client Configuration (client/.env)
```env
# Application
NEXT_PUBLIC_APP_NAME=VaultScope Statistics
NEXT_PUBLIC_APP_URL=http://localhost:3000

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true
```

### Service Configuration

#### Systemd (Linux)
```bash
# Manage services
sudo systemctl start statistics-server
sudo systemctl stop statistics-server
sudo systemctl restart statistics-server
sudo systemctl status statistics-server

# Enable auto-start
sudo systemctl enable statistics-server
sudo systemctl enable statistics-client

# View logs
sudo journalctl -u statistics-server -f
sudo journalctl -u statistics-client -f
```

#### Reverse Proxy Configuration

<details>
<summary><b>Nginx Configuration</b></summary>

```nginx
# /etc/nginx/sites-available/statistics-api
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# /etc/nginx/sites-available/statistics-client
server {
    listen 80;
    server_name app.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
</details>

## 📖 Usage

### 🌐 Web Dashboard

1. **First Time Setup**
   - Navigate to http://localhost:3000
   - Create your admin account (first user gets admin privileges)
   - Configure your first node

2. **Adding Nodes**
   - Go to Settings → Nodes
   - Click "Add Node"
   - Enter server details and API key
   - Test connection

3. **Monitoring**
   - Click on any node to view real-time statistics
   - Use tabs to switch between different metrics
   - Export data using the export button

### 🔧 CLI Tools

#### API Key Management

```bash
# Create API keys
statistics apikey create "Production Server" --admin
statistics apikey create "Monitoring Only" --viewStats
statistics apikey create "Limited Access" --viewStats --viewApiKeys

# List all keys
statistics apikey list

# Delete a key
statistics apikey delete <uuid-or-key>

# Available permissions:
# --admin              All permissions
# --viewStats          View system statistics
# --createApiKey       Create new API keys
# --deleteApiKey       Delete API keys
# --viewApiKeys        List all API keys
# --usePowerCommands   System power control
```

#### System Information

```bash
# Display system info
statistics sysinfo

# Run speed test
statistics speed

# Monitor in real-time
statistics monitor

# Process management
statistics process list
statistics process kill <pid>
```

### 🔍 Diagnostics

```bash
# Run built-in diagnostics
sudo bash installer.sh --diagnose

# Or use standalone diagnostic tool
sudo bash diagnose.sh

# Manual checks
systemctl status statistics-server
systemctl status statistics-client
tail -f /var/log/vaultscope-statistics/server-error.log
```

## 🔌 API Documentation

### Authentication

All API endpoints (except `/health`) require authentication:

```bash
# Header authentication (Recommended)
curl -H "x-api-key: YOUR_API_KEY" http://localhost:4000/api/stats

# Bearer token
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:4000/api/stats

# Query parameter (Not recommended for production)
curl "http://localhost:4000/api/stats?apiKey=YOUR_API_KEY"
```

### Core Endpoints

#### System Statistics
```http
GET /api/stats
```

<details>
<summary>Response Example</summary>

```json
{
  "cpu": {
    "usage": 23.5,
    "cores": 8,
    "speed": 3.6,
    "temperature": 45,
    "loadAverage": [1.2, 1.5, 1.8]
  },
  "memory": {
    "total": 16777216,
    "used": 8388608,
    "free": 8388608,
    "percentage": 50,
    "swap": {
      "total": 8388608,
      "used": 0,
      "free": 8388608
    }
  },
  "disk": {
    "total": 512000000,
    "used": 256000000,
    "free": 256000000,
    "percentage": 50,
    "devices": [...]
  },
  "network": {
    "interfaces": [...],
    "bandwidth": {
      "download": 0,
      "upload": 0
    }
  }
}
```
</details>

#### Process Management
```http
GET /api/processes
POST /api/processes/:pid/kill
```

#### Hardware Information
```http
GET /api/hardware
GET /api/hardware/cpu
GET /api/hardware/gpu
GET /api/hardware/memory
GET /api/hardware/disk
```

#### Network Operations
```http
POST /api/speedtest
POST /api/network/sniffer/start
POST /api/network/sniffer/stop
GET /api/network/sniffer/logs
```

#### Power Management
```http
POST /api/power/reboot
POST /api/power/shutdown
```
*Requires `usePowerCommands` permission*

### Rate Limiting

- Default: 100 requests per minute
- Speedtest: 10 requests per minute
- Power commands: 5 requests per hour

## 🔧 Troubleshooting

### Common Issues & Solutions

<details>
<summary><b>Services Not Starting</b></summary>

```bash
# Check service status
sudo systemctl status statistics-server

# View detailed logs
sudo journalctl -u statistics-server -n 100

# Restart services
sudo systemctl restart statistics-server statistics-client

# Check if ports are in use
sudo lsof -i :4000
sudo lsof -i :3000
```
</details>

<details>
<summary><b>Bad Gateway Error</b></summary>

```bash
# Verify services are running
systemctl is-active statistics-server
systemctl is-active statistics-client

# Check if services are listening
netstat -tln | grep -E ":(3000|4000)"

# Test direct access
curl http://localhost:4000/health
curl http://localhost:3000/
```
</details>

<details>
<summary><b>Permission Denied</b></summary>

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/vaultscope-statistics

# Fix permissions
sudo chmod -R 755 /var/www/vaultscope-statistics

# Check user exists
id www-data
```
</details>

<details>
<summary><b>Dependencies Missing</b></summary>

```bash
# Reinstall dependencies
cd /var/www/vaultscope-statistics
npm install

# Rebuild
npm run build
npm run client:build

# Restart services
sudo systemctl restart statistics-server statistics-client
```
</details>

## 🚧 Development

### Setting Up Development Environment

```bash
# Clone repository
git clone https://github.com/vaultscope/statistics.git
cd statistics

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Project Scripts

```json
{
  "scripts": {
    "server": "ts-node ./server/index.ts",
    "client": "cd client && next dev",
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "build": "tsc && cd client && next build",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write ."
  }
}
```

### Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [SystemInformation](https://systeminformation.io/) - System monitoring
- [Better SQLite3](https://github.com/JoshuaWise/better-sqlite3) - Database
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Recharts](https://recharts.org/) - Charts

## 📞 Support
- **[Discord](https://discord.gg/vaultscope)**
- **Contact Developer:** cptcr@proton.me

---

<div align="center">

**VaultScope Statistics** - Enterprise System Monitoring Made Simple

Made with ❤️ by the VaultScope Team
[GitHub](https://github.com/vaultscope)
</div>