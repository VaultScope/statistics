# VaultScope Statistics

<div align="center">
  
  ![VaultScope Statistics](https://img.shields.io/badge/VaultScope-Statistics-blue?style=for-the-badge)
  ![Version](https://img.shields.io/badge/version-2.0.0-green?style=for-the-badge)
  ![License](https://img.shields.io/badge/license-MIT-purple?style=for-the-badge)
  
  **Enterprise-grade server monitoring and statistics platform**
  
  [Features](#-features) • [Installation](#-installation) • [Documentation](#-api-documentation) • [Contributing](#-contributing)
  
</div>

---

## 🚀 Overview

VaultScope Statistics is a powerful, real-time server monitoring solution that provides comprehensive insights into your infrastructure. Built with modern technologies and designed for scalability, it offers both standalone server monitoring and centralized multi-node management through an intuitive web dashboard.

### Key Highlights

- **Real-time Monitoring** - Live updates every 5 seconds for critical metrics
- **Multi-Node Support** - Monitor unlimited servers from a single dashboard
- **Role-Based Access** - Granular permission system with custom roles
- **API-First Design** - RESTful API with authentication and rate limiting
- **Cross-Platform** - Works on Windows, Linux, and macOS
- **Easy Deployment** - One-click installers with automatic service configuration

## ✨ Features

### System Monitoring
- **CPU Metrics** - Usage, cores, speed, temperature, load averages
- **Memory Analysis** - RAM usage, swap, detailed memory layout
- **Network Traffic** - Real-time bandwidth monitoring, packet analysis
- **Disk I/O** - Storage usage, read/write speeds, device information
- **Process Management** - Live process list with CPU/memory usage
- **Hardware Info** - Complete system specifications and components

### User Management
- **Multiple Users** - Create and manage user accounts
- **Role System** - Admin, Operator, Viewer, and custom roles
- **Permissions** - 20+ granular permissions for fine-grained control
- **Profile Customization** - Personal settings and password management
- **Activity Logging** - Track user actions and API usage

### API Features
- **Authentication** - Secure API key-based authentication
- **Rate Limiting** - Configurable limits per API key
- **Usage Analytics** - Detailed API request logging and statistics
- **Multiple Keys** - Support for multiple API keys per server
- **CORS Support** - Cross-origin resource sharing enabled

### Interface
- **Modern Dashboard** - Clean, responsive web interface
- **Dark Mode** - Eye-friendly dark theme
- **Real-time Charts** - Interactive graphs for all metrics
- **Search & Filter** - Quick access to specific data
- **Export Options** - Download data in various formats

## 📋 Requirements

### System Requirements

**Client (Web Dashboard)**:
- Node.js 18.0 or higher
- 2GB RAM minimum
- 1GB disk space

**Server (Monitoring Agent)**:
- Node.js 18.0 or higher
- 512MB RAM minimum
- 500MB disk space
- Windows 10/11, Ubuntu 20.04+, macOS 12+

### Network Requirements
- Client Port: 3000 (configurable)
- Server Port: 4000 (configurable)
- HTTPS recommended for production

---

## 🛠 Installation

### Quick Install (Recommended)

#### Windows
```powershell
# Download installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/VaultScope/statistics/main/installer.ps1" -OutFile "installer.ps1"

# Run as Administrator
.\installer.ps1
```

#### Linux/macOS
```bash
# Download installer
curl -O https://raw.githubusercontent.com/VaultScope/statistics/main/installer.sh

# Make executable
chmod +x installer.sh

# Run installer
sudo ./installer.sh  # Linux
./installer.sh       # macOS
```

The installer will guide you through:
1. Choosing components (Client/Server/Both)
2. Setting up reverse proxy (Optional)
3. Configuring auto-start services
4. Generating API keys

### Manual Installation

#### Server Setup
```bash
# Clone repository
git clone https://github.com/VaultScope/statistics.git
cd statistics/server

# Install dependencies
npm install

# Build
npm run build

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start server
npm start
```

#### Client Setup
```bash
# Navigate to client directory
cd statistics/client

# Install dependencies
npm install

# Build
npm run build

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start client
npm start
```

### Docker Installation

```bash
# Using Docker Compose
docker-compose up -d

# Or individual containers
docker run -d -p 4000:4000 --name vaultscope-server vaultscope/statistics-server
docker run -d -p 3000:3000 --name vaultscope-client vaultscope/statistics-client
```

## 🔧 Configuration

### Server Configuration (.env)
```env
# Server Port
PORT=4000

# API Authentication
API_KEY=your-secure-api-key-here

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Environment
NODE_ENV=production

# Optional: Database
DB_PATH=./database.json
```

### Client Configuration (.env)
```env
# Client Port
PORT=3000

# API Endpoint (if server is remote)
NEXT_PUBLIC_API_URL=http://localhost:4000

# Session Secret
SESSION_SECRET=your-session-secret

# Environment
NODE_ENV=production
```

### Nginx Configuration (Optional)
```nginx
server {
    listen 80;
    server_name stats.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📖 Documentation

### First Time Setup

1. **Access the Dashboard**
   - Navigate to `http://localhost:3000`
   - You'll be redirected to registration

2. **Create Admin Account**
   - Enter your details
   - First user automatically gets admin privileges

3. **Add Your First Node**
   - Go to Settings → Nodes
   - Click "Add Node"
   - Enter server details and API key

4. **Start Monitoring**
   - Click on any node to view real-time stats
   - Navigate between different metrics tabs

### User Roles

| Role | Description | Default Permissions |
|------|-------------|-------------------|
| **Admin** | Full system access | All permissions |
| **Operator** | Manage nodes and monitoring | Nodes, monitoring, API keys |
| **Viewer** | Read-only access | View nodes and monitoring |
| **Custom** | User-defined | Configurable |

### Permission Categories

- **Nodes** - View, create, update, delete nodes
- **Users** - Manage user accounts
- **API Keys** - Manage API authentication
- **Monitoring** - Access monitoring features
- **System** - System configuration

---

# 🔐 Authentication & Security

<details>
<summary><b>Click to expand authentication details</b></summary>

## Authentication
All API endpoints (except `/health`) require authentication using API keys. Include your API key in requests using one of these methods:
- **Header**: `x-api-key: YOUR_API_KEY`
- **Bearer Token**: `Authorization: Bearer YOUR_API_KEY`
- **Query Parameter**: `?apiKey=YOUR_API_KEY`

## Permissions
The API uses a permission-based system. Each API key has specific permissions:

| Permission | Description |
|------------|-------------|
| `viewStats` | Access system statistics, speedtest, processes, and monitoring data |
| `createApiKey` | Create new API keys |
| `deleteApiKey` | Delete existing API keys |
| `viewApiKeys` | List all API keys |
| `usePowerCommands` | Execute system power commands (reboot/shutdown) |

## Security Notes
- Store API keys securely and never commit them to version control
- Use environment variables for API keys in production
- Regularly rotate API keys
- Grant minimum necessary permissions to each key
- The `usePowerCommands` permission is particularly sensitive - only grant to trusted keys
- Network sniffer requires root/administrator privileges to capture packets
- Network sniffer functionality depends on the `cap` native module being properly compiled for your system

</details>

---

# 🔑 API Key Management

<details>
<summary><b>Click to expand API key management</b></summary>

## Via CLI Commands

### Create an API Key
```bash
# Create a basic key with only viewStats permission
npm run apikey create "My API Key"

# Create an admin key with all permissions
npm run apikey create "Admin Key" --admin

# Create a key with specific permissions
npm run apikey create "Custom Key" --viewStats --createApiKey --viewApiKeys

# Available flags:
# --admin              Grant all permissions
# --viewStats          Grant viewStats permission (default: true)
# --createApiKey       Grant createApiKey permission
# --deleteApiKey       Grant deleteApiKey permission
# --viewApiKeys        Grant viewApiKeys permission
# --usePowerCommands   Grant usePowerCommands permission
```

### List API Keys
```bash
npm run apikey list
```

### Delete an API Key
```bash
# Delete by UUID
npm run apikey delete <uuid>

# Delete by key
npm run apikey delete <api-key>
```

## Via API Endpoints

### Create API Key
**POST** `/api/keys`
- **Required Permission**: `createApiKey`
- **Body**:
```json
{
  "name": "Key Name",
  "permissions": {
    "viewStats": true,
    "createApiKey": false,
    "deleteApiKey": false,
    "viewApiKeys": false,
    "usePowerCommands": false
  }
}
```
- **Response**: Returns the created key with UUID and generated key string

### List API Keys
**GET** `/api/keys`
- **Required Permission**: `viewApiKeys`
- **Response**: Array of API keys (without the actual key strings)

### Delete API Key
**DELETE** `/api/keys/:identifier`
- **Required Permission**: `deleteApiKey`
- **Parameters**: `identifier` can be either UUID or the API key string
- **Response**: Success or error message

</details>

---

# 📡 API Documentation

## Health Check
**GET** `/health`
- **Authentication**: Not required
- **Response**: `OK`

<details>
<summary><b>📊 System Information</b></summary>

### Get All System Data
**GET** `/data`
- **Required Permission**: `viewStats`
- **Response**: Combined CPU, GPU, disk, RAM, mainboard, and OS information

### Get CPU Information
**GET** `/data/cpu`
- **Required Permission**: `viewStats`
- **Response**: CPU details including cores, speed, cache, virtualization

### Get GPU Information
**GET** `/data/gpu`
- **Required Permission**: `viewStats`
- **Response**: Array of graphics cards with details

### Get Disk Information
**GET** `/data/disk`
- **Required Permission**: `viewStats`
- **Response**: Array of disk layouts with size and interface information

### Get RAM Information
**GET** `/data/ram`
- **Required Permission**: `viewStats`
- **Response**: Memory details including total, free, used, and layout

### Get Mainboard Information
**GET** `/data/mainboard`
- **Required Permission**: `viewStats`
- **Response**: Motherboard manufacturer, model, and version

### Get OS Information
**GET** `/data/os`
- **Required Permission**: `viewStats`
- **Response**: Operating system details, platform, kernel, architecture

</details>

<details>
<summary><b>⚡ Performance</b></summary>

### Run Speed Test
**GET** `/stats/speedtest`
- **Required Permission**: `viewStats`
- **Response**: Download/upload speeds, ping, and server information

</details>

<details>
<summary><b>⚙️ Process Management</b></summary>

### List Processes
**GET** `/processes`
- **Required Permission**: `viewStats`
- **Response**: Array of running processes with PID, name, CPU, and memory usage

### Kill Process
**POST** `/processes/kill`
- **Required Permission**: `viewStats`
- **Body**: `{ "pid": <process-id> }`
- **Response**: Success or error message

</details>

<details>
<summary><b>🔌 Power Management</b></summary>

### Reboot System
**POST** `/power/reboot`
- **Required Permission**: `usePowerCommands`
- **Response**: Confirmation message

### Shutdown System
**POST** `/power/shutdown`
- **Required Permission**: `usePowerCommands`
- **Response**: Confirmation message

</details>

<details>
<summary><b>🌐 Network Monitoring</b></summary>

### Start Network Sniffer
**POST** `/network/sniffer/start`
- **Required Permission**: `viewStats`
- **Body**: `{ "interface": "<network-interface-name>" }`
- **Response**: Success message with interface name
- **Note**: Only one sniffer can run at a time. Requires appropriate system permissions for packet capture.

### Stop Network Sniffer
**POST** `/network/sniffer/stop`
- **Required Permission**: `viewStats`
- **Response**: Success message

### Get Recent Network Packet Logs
**GET** `/network/sniffer/logs`
- **Required Permission**: `viewStats`
- **Response**: Array of captured network packets (last 1000 packets)
- **Packet Structure**:
```json
{
  "timestamp": "2025-01-01T12:00:00.000Z",
  "length": 1500,
  "linkType": "ETHERNET",
  "ethernet": {
    "srcMac": "00:11:22:33:44:55",
    "dstMac": "66:77:88:99:AA:BB",
    "ethertype": 2048,
    "payload": "<buffer-data>"
  }
}
```

### Get All Network Packet Logs
**GET** `/network/sniffer/logs/all`
- **Required Permission**: `viewStats`
- **Response**: Object containing total count and all captured packets (max 100,000)
- **Response Structure**:
```json
{
  "total": 45678,
  "packets": [
    {
      "timestamp": "2025-01-01T12:00:00.000Z",
      "length": 1500,
      "linkType": "ETHERNET",
      "ethernet": {
        "srcMac": "00:11:22:33:44:55",
        "dstMac": "66:77:88:99:AA:BB",
        "ethertype": 2048,
        "payload": "<buffer-data>"
      }
    }
  ]
}
```

### Clear Network Logs
**DELETE** `/network/sniffer/logs`
- **Required Permission**: `viewStats`
- **Response**: Success message
- **Note**: Clears both recent and all packet logs

</details>

---

# 💻 Usage Examples

<details>
<summary><b>Click to expand usage examples</b></summary>

## Using curl
```bash
# Get CPU information
curl -H "x-api-key: YOUR_API_KEY" http://localhost:4000/data/cpu

# Create a new API key
curl -X POST http://localhost:4000/api/keys \
  -H "x-api-key: ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Key","permissions":{"viewStats":true}}'

# Kill a process
curl -X POST http://localhost:4000/processes/kill \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pid":1234}'

# Start network sniffer on eth0
curl -X POST http://localhost:4000/network/sniffer/start \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"interface":"eth0"}'

# Get recent captured packets (last 1000)
curl -H "x-api-key: YOUR_API_KEY" http://localhost:4000/network/sniffer/logs

# Get all captured packets
curl -H "x-api-key: YOUR_API_KEY" http://localhost:4000/network/sniffer/logs/all

# Clear all network logs
curl -X DELETE http://localhost:4000/network/sniffer/logs \
  -H "x-api-key: YOUR_API_KEY"

# Stop network sniffer
curl -X POST http://localhost:4000/network/sniffer/stop \
  -H "x-api-key: YOUR_API_KEY"
```

## Using JavaScript/TypeScript
```javascript
// Example with fetch
const response = await fetch('http://localhost:4000/data', {
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});
const data = await response.json();
console.log(data);

// Start network sniffer
await fetch('http://localhost:4000/network/sniffer/start', {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ interface: 'eth0' })
});
```

</details>

---

# 🔧 Server Management

<details>
<summary><b>Click to expand server management</b></summary>

## Starting the Server
```bash
# Start the server
npm run start

# The server will run on http://localhost:4000
```

## Available NPM Scripts
```bash
npm run start          # Start the server
npm run apikey         # Manage API keys
npm run speed          # Run speedtest
npm run sysinfo        # Get system information
```

</details>

---

# 🔗 Panel Connection

<details>
<summary><b>Click to expand panel connection details</b></summary>

Documentation for connecting remote servers to the statistics panel will be added here.

</details>