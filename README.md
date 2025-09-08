# VaultScope Statistics

<div align="center">

![Version](https://img.shields.io/badge/version-4.0.0-blue.svg?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS-lightgrey.svg?style=for-the-badge)

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
- **Cross-Platform** - Works seamlessly on Linux and macOS
- **Open Source** - Fully transparent and customizable

## ✨ Features

### 📊 System Monitoring
- **CPU Analytics** - Usage, cores, speed, temperature, load averages
- **Memory Tracking** - RAM/swap usage, detailed memory layout
- **Disk I/O** - Storage usage, read/write speeds, device information
- **Network Analysis** - Bandwidth monitoring, packet sniffing (requires root)
- **Process Management** - Live process list with resource usage
- **Hardware Detection** - Complete system specifications
- **Speed Testing** - Network bandwidth testing capabilities

### 🔐 Security & Access Control
- **API Key Authentication** - Secure token-based access
- **Role-Based Permissions** - Granular access control system
- **Session Management** - Secure session handling
- **Rate Limiting** - Protection against API abuse
- **CORS Support** - Configurable cross-origin policies

### 🎨 Web Dashboard
- **Modern UI** - Clean, responsive Next.js 15 interface
- **Real-Time Charts** - Interactive graphs using Recharts
- **Dark Mode** - Eye-friendly dark theme support
- **Multi-Node View** - Manage multiple servers from one place
- **User Management** - Create and manage user accounts
- **Profile Management** - User profile customization

### 🛠️ Management Tools
- **CLI Interface** - Powerful command-line tools
- **Auto-Installation** - Bulletproof v4.0 installer with OS detection
- **Service Management** - Systemd integration
- **Reverse Proxy** - Built-in support for Nginx with auto-configuration
- **SSL/TLS** - Automatic Let's Encrypt certificate setup
- **Complete Uninstaller** - Nuclear cleanup option removes all traces

## 🏗️ Architecture

```
vaultscope-statistics/
├── server/                    # Backend API Server
│   ├── index.ts              # Express server entry point
│   ├── functions/            # Core functionality modules
│   │   ├── keys/            # API key management
│   │   ├── logs/            # Logging and monitoring
│   │   │   └── network/    # Network packet sniffing
│   │   └── stats/          # Statistics collection
│   │       ├── power/      # System power controls
│   │       ├── speedtest.ts # Network speed testing
│   │       └── utils/      # Utility functions
│   │           ├── process/    # Process management
│   │           └── system/     # System information
│   ├── cli/                 # CLI tool implementations
│   │   └── apikey.ts       # API key management CLI
│   ├── database/           # Database management
│   │   └── db.ts          # Better-SQLite3 database
│   └── types/             # TypeScript type definitions
│
├── client/                   # Frontend Web Application
│   ├── app/                 # Next.js 15 app directory
│   │   ├── api/            # API route handlers
│   │   │   ├── auth/      # Authentication endpoints
│   │   │   ├── nodes/     # Node management
│   │   │   ├── profile/   # User profile management
│   │   │   └── users/     # User management
│   │   ├── components/     # React components
│   │   │   ├── dashboard/ # Dashboard components
│   │   │   └── ui/       # UI components
│   │   ├── (dashboard)/   # Dashboard pages
│   │   └── login/        # Authentication pages
│   ├── lib/               # Utility libraries
│   │   ├── auth.ts       # Authentication helpers
│   │   ├── db-json.ts    # JSON database for client
│   │   └── api.ts        # API client utilities
│   └── public/           # Static assets
│
├── dist/                    # Compiled TypeScript output
│   └── server/             # Compiled server code
│       └── index.js       # Main server entry
│
├── installer.sh            # v4.0 Bulletproof installer
├── cli.js                 # CLI entry point
├── package.json          # Root dependencies
├── tsconfig.json        # TypeScript configuration
└── CLAUDE.md           # AI assistance documentation
```

## 🚀 Installation

### 🎯 Quick Installation (Recommended)

#### One-Command Installation

```bash
# Download and run the v4.0 installer
curl -fsSL https://raw.githubusercontent.com/vaultscope/statistics/main/installer.sh -o installer.sh
sudo bash installer.sh
```

#### What the Installer Does

The v4.0 Bulletproof installer will:
- ✅ Detect your operating system (Linux/macOS)
- ✅ Check for existing installations with uninstall option
- ✅ Perform nuclear cleanup if requested
- ✅ Install Node.js v20 if needed
- ✅ Clone and build the application
- ✅ Compile TypeScript to JavaScript
- ✅ Build Next.js client application
- ✅ Create systemd services with correct paths
- ✅ Configure Nginx reverse proxy (optional)
- ✅ Set up SSL certificates with Let's Encrypt (optional)
- ✅ Configure proper file permissions

#### Installation Menu Options

```
What would you like to do?
  1) COMPLETELY UNINSTALL and exit
  2) Remove everything and install fresh [Recommended]
  3) Cancel
```

#### Service Configuration

During installation, you'll be prompted for:

1. **Reverse Proxy Setup** (Optional)
   - API domain (e.g., api.yourdomain.com)
   - Client domain (e.g., app.yourdomain.com)

2. **SSL Configuration** (Optional)
   - Email for Let's Encrypt certificates
   - Automatic HTTPS setup

### Default Ports

- **API Server**: Port 4000
- **Web Client**: Port 4001

### 📦 Manual Installation

#### Prerequisites

- Node.js 18.0 or higher
- npm 8.0 or higher
- Git
- Linux or macOS
- Root/sudo access (for system monitoring features)

#### Step-by-Step Guide

1. **Clone the repository**
```bash
git clone https://github.com/vaultscope/statistics.git
cd statistics
```

2. **Install dependencies**
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Install server dependencies (if separate)
cd server && npm install && cd ..
```

3. **Build the project**
```bash
# Build TypeScript server
npm run build

# Build Next.js client
npm run client:build
```

4. **Start services**
```bash
# Production mode
npm run server:prod  # Start API server on port 4000
npm run client:prod  # Start web client on port 4001

# Development mode
npm run dev  # Starts both server and client concurrently
```

## ⚙️ Configuration

### Service Paths

- **Installation Directory**: `/var/www/vaultscope-statistics`
- **Configuration Directory**: `/etc/vaultscope-statistics`
- **Log Directory**: `/var/log/vaultscope-statistics`
- **Database Path**: `/var/www/vaultscope-statistics/data/`

### Systemd Services

Services created by installer:
- `vaultscope-statistics-server.service` - API server
- `vaultscope-statistics-client.service` - Web dashboard

### Service Management

```bash
# Start services
sudo systemctl start vaultscope-statistics-server
sudo systemctl start vaultscope-statistics-client

# Stop services
sudo systemctl stop vaultscope-statistics-server
sudo systemctl stop vaultscope-statistics-client

# Restart services
sudo systemctl restart vaultscope-statistics-server
sudo systemctl restart vaultscope-statistics-client

# Check status
sudo systemctl status vaultscope-statistics-server
sudo systemctl status vaultscope-statistics-client

# View logs
sudo journalctl -u vaultscope-statistics-server -f
sudo journalctl -u vaultscope-statistics-client -f

# Enable auto-start on boot
sudo systemctl enable vaultscope-statistics-server
sudo systemctl enable vaultscope-statistics-client
```

### Nginx Configuration

The installer automatically creates Nginx configurations:

- `/etc/nginx/sites-available/vaultscope-api` - API proxy
- `/etc/nginx/sites-available/vaultscope-client` - Client proxy

## 📖 Usage

### 🌐 Web Dashboard

1. **Access the Dashboard**
   - Direct: `http://your-server:4001`
   - Via proxy: `https://client.yourdomain.com`

2. **First Time Setup**
   - Create your admin account
   - The first user automatically gets admin privileges

3. **Managing Nodes**
   - Navigate to Settings → Nodes
   - Add new nodes with API endpoints
   - Monitor multiple servers from one dashboard

### 🔧 CLI Tools

#### API Key Management

```bash
# Navigate to installation directory
cd /var/www/vaultscope-statistics

# Create API keys with permissions
npm run apikey create "Server Name" -- --admin
npm run apikey create "Monitor Only" -- --viewStats
npm run apikey create "Power User" -- --viewStats --usePowerCommands

# List all API keys
npm run apikey list

# Delete an API key
npm run apikey delete <uuid-or-key>

# Available permissions:
# --admin              All permissions
# --viewStats          View system statistics
# --createApiKey       Create new API keys
# --deleteApiKey       Delete API keys
# --viewApiKeys        List all API keys
# --usePowerCommands   System power control (reboot/shutdown)
```

#### System Tools

```bash
# Run system info test
npm run sysinfo

# Run speed test
npm run speed

# Use the CLI tool
statistics
```

## 🔌 API Documentation

### Authentication

All API endpoints (except `/health`) require authentication via API key.

#### Authentication Methods

```bash
# Header authentication (Recommended)
curl -H "x-api-key: YOUR_API_KEY" http://localhost:4000/api/stats

# Bearer token
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:4000/api/stats

# Query parameter (Not recommended)
curl "http://localhost:4000/api/stats?apiKey=YOUR_API_KEY"
```

### Core Endpoints

#### Health Check
```http
GET /health
```
No authentication required. Returns server status.

#### System Statistics
```http
GET /api/stats
```
Returns comprehensive system statistics including CPU, memory, disk, and network.

#### Hardware Information
```http
GET /api/hardware
GET /api/hardware/cpu
GET /api/hardware/gpu
GET /api/hardware/ram
GET /api/hardware/disk
GET /api/hardware/mainboard
GET /api/hardware/os
```

#### Process Management
```http
GET /api/processes
POST /api/processes/:pid/kill
```
Requires appropriate permissions for process termination.

#### Network Operations
```http
POST /api/speedtest
POST /api/network/sniffer/start
POST /api/network/sniffer/stop
GET /api/network/sniffer/logs
```
Network sniffer requires root privileges.

#### Power Management
```http
POST /api/power/reboot
POST /api/power/shutdown
```
Requires `usePowerCommands` permission.

### Rate Limiting

- Default: 100 requests per minute per IP
- Speedtest: 10 requests per minute
- Power commands: 5 requests per hour

## 🔧 Troubleshooting

### Common Issues

#### Services Not Starting

```bash
# Check for old cached services
sudo systemctl stop statistics-server statistics-client
sudo systemctl disable statistics-server statistics-client
sudo systemctl daemon-reload

# Verify correct services
sudo systemctl status vaultscope-statistics-server
sudo systemctl status vaultscope-statistics-client
```

#### Module Not Found Errors

```bash
# Reinstall dependencies
cd /var/www/vaultscope-statistics
npm install
cd client && npm install && cd ..

# Rebuild
npm run build
npm run client:build

# Restart services
sudo systemctl restart vaultscope-statistics-server
sudo systemctl restart vaultscope-statistics-client
```

#### Permission Issues

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/vaultscope-statistics

# Fix permissions
sudo chmod -R 755 /var/www/vaultscope-statistics
```

#### Complete Reinstallation

```bash
# Use the installer's nuclear cleanup option
sudo bash installer.sh
# Select option 1 or 2 for complete removal and fresh install
```

## 🚧 Development

### Development Setup

```bash
# Clone and install
git clone https://github.com/vaultscope/statistics.git
cd statistics
npm install

# Run in development mode
npm run dev

# Run individual services
npm run server      # API server with TypeScript
npm run client:dev  # Next.js client with hot reload
```

### Available Scripts

```json
{
  "server": "ts-node ./server/index.ts",
  "server:prod": "node dist/server/index.js",
  "client": "cd client && next dev -p 4001",
  "client:build": "cd client && next build",
  "client:prod": "cd client && next start -p 4001",
  "build": "tsc",
  "dev": "concurrently \"npm run server\" \"npm run client\"",
  "apikey": "ts-node ./server/cli/apikey.ts",
  "speed": "ts-node ./server/__tests__/speedtest.ts",
  "sysinfo": "ts-node ./server/__tests__/sysinfo.ts"
}
```

### Project Structure

- **TypeScript** server compiles to `dist/` directory
- **Next.js** client runs from `client/` directory
- **Database** stored in `data/` directory
- **Logs** written to `/var/log/vaultscope-statistics/`

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [SystemInformation](https://systeminformation.io/) - System monitoring
- [Better SQLite3](https://github.com/JoshuaWise/better-sqlite3) - Database
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Recharts](https://recharts.org/) - Charts

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/vaultscope/statistics/issues)
- **Contact Developer**: cptcr@proton.me

---

<div align="center">

**VaultScope Statistics v4.0** - Enterprise System Monitoring Made Simple

Made with ❤️ by the VaultScope Team

[GitHub](https://github.com/vaultscope/statistics)

</div>