# VaultScope Statistics

Comprehensive system monitoring and management platform with real-time analytics, multi-node support, and enterprise-grade security.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [CLI Tools](#cli-tools)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

VaultScope Statistics is a full-stack monitoring solution built with TypeScript, Express.js, and Next.js. It provides real-time system insights through a REST API server and an intuitive web dashboard for infrastructure management.

### Key Benefits

- **Real-Time Monitoring** - Live metrics updates every 5 seconds
- **Multi-Node Support** - Monitor unlimited servers from a single dashboard
- **API Key Authentication** - Secure token-based access with role-based permissions
- **One-Command Installation** - Automated setup with OS detection
- **Cross-Platform** - Linux and macOS support
- **Production Ready** - Systemd integration, reverse proxy support, SSL/TLS automation

## Features

### System Monitoring
- CPU usage, cores, speed, temperature, and load averages
- Memory and swap usage with detailed layout information
- Disk I/O statistics, storage usage, and device information
- Network bandwidth monitoring and traffic analysis
- Process management with resource usage tracking
- Hardware detection and system specifications
- Network speed testing capabilities

### Security & Access Control
- API key authentication with secure token management
- Role-based permissions system (Admin, Manager, Operator, Viewer)
- Session management with JWT tokens
- Rate limiting protection (configurable per endpoint)
- CORS support with configurable policies
- Audit logging for all API requests

### Web Dashboard
- Modern Next.js 15 interface with responsive design
- Real-time data visualization using Recharts
- Dark mode support
- Multi-node management from single interface
- User and role management
- Profile customization
- Category-based node organization

### Management Tools
- Command-line interface for API key management
- Automated installer with OS detection and dependency management
- Systemd service integration
- Nginx reverse proxy auto-configuration
- Let's Encrypt SSL certificate automation
- Complete uninstaller with cleanup options

## Installation

### Quick Installation (Recommended)

```bash
# Download and run the installer
curl -fsSL https://raw.githubusercontent.com/vaultscope/statistics/main/installer.sh -o installer.sh
sudo bash installer.sh
```

The installer will:
- Detect your operating system (Linux/macOS)
- Check for existing installations
- Install Node.js v20 if needed
- Clone and build the application
- Create systemd services
- Configure Nginx reverse proxy (optional)
- Set up SSL certificates (optional)

### Manual Installation

#### Prerequisites
- Node.js 18.0 or higher
- npm 8.0 or higher
- Git
- Linux or macOS
- Root/sudo access for system monitoring features

#### Steps

1. Clone the repository:
```bash
git clone https://github.com/vaultscope/statistics.git
cd statistics
```

2. Install dependencies:
```bash
npm install
cd client && npm install && cd ..
```

3. Build the project:
```bash
npm run build
npm run client:build
```

4. Start services:
```bash
npm run server  # API server on port 4000
npm run client  # Web client on port 4001
```

## Configuration

### Default Ports
- **API Server**: 4000
- **Web Client**: 4001

### Directory Structure
- **Installation**: `/var/www/vaultscope-statistics`
- **Configuration**: `/etc/vaultscope-statistics`
- **Logs**: `/var/log/vaultscope-statistics`
- **Database**: `/var/www/vaultscope-statistics/database.json`
- **API Keys**: `/var/www/vaultscope-statistics/apiKeys.json`

### Service Management

```bash
# Start services
systemctl start vaultscope-statistics-server
systemctl start vaultscope-statistics-client

# Stop services
systemctl stop vaultscope-statistics-server
systemctl stop vaultscope-statistics-client

# View logs
journalctl -u vaultscope-statistics-server -f
journalctl -u vaultscope-statistics-client -f

# Enable auto-start
systemctl enable vaultscope-statistics-server
systemctl enable vaultscope-statistics-client
```

## Usage

### Web Dashboard

1. Access the dashboard:
   - Direct: `http://your-server:4001`
   - Via proxy: `https://your-domain.com`

2. First-time setup:
   - Navigate to `/register` to create admin account
   - First user automatically receives admin privileges

3. Node management:
   - Go to Settings > Nodes
   - Add nodes with their API endpoints and keys
   - Monitor multiple servers from one dashboard

### API Access

All endpoints require API key authentication except `/health`.

Authentication methods:
```bash
# Header (recommended)
curl -H "x-api-key: YOUR_API_KEY" http://localhost:4000/data

# Bearer token
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:4000/data

# Query parameter
curl "http://localhost:4000/data?apiKey=YOUR_API_KEY"
```

## API Documentation

### System Information

```
GET /health              - Health check (no auth required)
GET /data               - All system information
GET /data/cpu           - CPU information
GET /data/gpu           - GPU information
GET /data/ram           - Memory information
GET /data/disk          - Disk information
GET /data/mainboard     - Mainboard information
GET /data/os            - Operating system information
```

### Statistics

```
GET /stats/cpu          - Current CPU usage
GET /stats/memory       - Memory usage statistics
GET /stats/disk         - Disk usage statistics
GET /stats/network      - Network statistics
GET /stats/network/traffic - Real-time network traffic
GET /stats/time         - System uptime and time
GET /stats/speedtest    - Run network speed test
```

### Process Management

```
GET /processes          - List all processes
POST /processes/kill    - Terminate process (requires body: {pid: number})
```

### API Key Management

```
GET /api/keys           - List all API keys
POST /api/keys          - Create new API key
GET /api/keys/:id       - Get specific API key
PUT /api/keys/:id/permissions - Update key permissions
DELETE /api/keys/:id    - Delete API key
```

### Logs

```
GET /api/logs           - View API access logs
GET /api/logs/stats/:keyId - Get statistics for specific key
DELETE /api/logs        - Clear logs
```

### Network Monitoring (requires root)

```
POST /network/sniffer/start - Start packet capture
POST /network/sniffer/stop  - Stop packet capture
GET /network/sniffer/logs   - Get captured packets
DELETE /network/sniffer/logs - Clear packet logs
```

### Power Management (requires permission)

```
POST /power/reboot      - Reboot system
POST /power/shutdown    - Shutdown system
```

## CLI Tools

### API Key Management

```bash
cd /var/www/vaultscope-statistics

# Create API keys
npm run apikey create "Server Name" --admin
npm run apikey create "Monitor" --viewStats
npm run apikey create "Manager" --viewStats --createApiKey --viewApiKeys

# List keys
npm run apikey list

# Delete key
npm run apikey delete <uuid-or-key>
```

### Permissions
- `--admin` - All permissions
- `--viewStats` - View system statistics
- `--createApiKey` - Create new API keys
- `--deleteApiKey` - Delete API keys
- `--viewApiKeys` - List all API keys
- `--usePowerCommands` - System power control

### System Tools

```bash
# System information test
npm run sysinfo

# Network speed test
npm run speed

# Use CLI tool
statistics
```

## Development

### Setup

```bash
git clone https://github.com/vaultscope/statistics.git
cd statistics
npm install
```

### Development Mode

```bash
# Run both server and client with hot reload
npm run dev

# Run individually
npm run server      # API server with ts-node
npm run client      # Next.js with hot reload
```

### Build

```bash
# Build TypeScript server
npm run build

# Build Next.js client
npm run client:build
```

### Testing

```bash
# Run system info test
npm run sysinfo

# Run speed test
npm run speed
```

## Troubleshooting

### Services Not Starting

```bash
# Clear old services
systemctl stop statistics-server statistics-client
systemctl disable statistics-server statistics-client
systemctl daemon-reload

# Check correct services
systemctl status vaultscope-statistics-server
systemctl status vaultscope-statistics-client
```

### Module Not Found

```bash
cd /var/www/vaultscope-statistics
npm install
cd client && npm install && cd ..
npm run build
npm run client:build
systemctl restart vaultscope-statistics-server
systemctl restart vaultscope-statistics-client
```

### Permission Issues

```bash
# Fix ownership
chown -R www-data:www-data /var/www/vaultscope-statistics

# Fix permissions
chmod -R 755 /var/www/vaultscope-statistics
```

### API Key Issues

```bash
# Ensure apiKeys.json exists in correct location
ls -la /var/www/vaultscope-statistics/apiKeys.json

# Create new key
cd /var/www/vaultscope-statistics
npm run apikey create "test" --admin

# Restart server
systemctl restart vaultscope-statistics-server
```

### Complete Reinstallation

```bash
# Use installer with cleanup option
sudo bash installer.sh
# Select option 2 for complete removal and fresh install
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Maintain existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/vaultscope/statistics/issues)
- **Email**: cptcr@proton.me
- **Documentation**: [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions

## Credits

Built with:
- [Express.js](https://expressjs.com/) - Web framework
- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [SystemInformation](https://systeminformation.io/) - System monitoring
- [Better SQLite3](https://github.com/JoshuaWise/better-sqlite3) - Database
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Recharts](https://recharts.org/) - Data visualization

---

VaultScope Statistics - Enterprise System Monitoring Made Simple

[GitHub Repository](https://github.com/vaultscope/statistics)