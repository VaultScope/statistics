# VaultScope Statistics

A comprehensive system monitoring and statistics dashboard with separate server and client applications.

## Architecture

This project consists of two standalone applications:

### Server (`/server`)
- **Port**: 4000
- **Database**: SQLite with WAL mode (auto-initialized)
- **API**: RESTful API with token authentication
- **Features**: Real-time system monitoring, alerts, API key management

### Client (`/client`)  
- **Port**: 4001
- **Framework**: Next.js 15 with React 19
- **Database**: JSON file (auto-initialized)
- **Features**: Web dashboard, user management, node monitoring

## Installation

### Quick Install (Recommended)

```bash
sudo bash installer.sh
```

The installer will:
- Install Node.js 20+ if needed
- Set up both server and client
- Initialize databases automatically
- Configure systemd services
- Set up Nginx reverse proxy (optional)
- Configure SSL certificates (optional)

### Manual Installation

#### Prerequisites
- Node.js 20+
- npm 8+
- Linux/macOS/WSL

#### Server Setup
```bash
cd server
npm install
npm run build
npm start
```

#### Client Setup
```bash
cd client
npm install
npm run build
npm start
```

## Database Initialization

Both applications **automatically create and initialize their databases** on first run:

### Server Database
- **File**: `server/database.db`
- **Tables**: 17 tables including users, roles, nodes, alerts, etc.
- **Default Data**: System roles and initial configuration

### Client Database
- **File**: `client/database.json`
- **Structure**: Users, nodes, categories, roles
- **Default Data**: 5 categories, 2 roles

## Development

```bash
# Install dependencies for both
npm run install:all

# Run both in development mode
npm run dev

# Or run separately
npm run server:dev
npm run client:dev
```

## Production Deployment

### Using Installer
```bash
sudo bash installer.sh
# Follow prompts for full installation
```

### Using Docker
```bash
docker-compose up -d
```

### Using Kubernetes
```bash
kubectl apply -f k8s/
```

## API Documentation

### Authentication
All API endpoints require an API key:
```
x-api-key: YOUR_API_KEY
```

### Key Endpoints
- `GET /health` - Health check (no auth required)
- `GET /api/stats` - System statistics
- `POST /api/nodes` - Register new node
- `GET /api/alerts` - Get active alerts

## Configuration

### Environment Variables
Create `.env` files in server/client directories:

```env
# Server
NODE_ENV=production
PORT=4000
DATABASE_PATH=./database.db

# Client  
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Project Structure

```
├── server/               # Backend API server
│   ├── db/              # Database schemas and migrations
│   ├── functions/       # Core functionality
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── index.ts         # Entry point
├── client/              # Frontend dashboard
│   ├── app/            # Next.js app router
│   ├── components/     # React components
│   ├── lib/           # Utilities
│   └── next.config.js # Next.js config
├── installer.sh        # Automated installer
├── docker-compose.yml  # Docker configuration
└── k8s/               # Kubernetes manifests
```

## Features

- **Real-time Monitoring**: CPU, RAM, disk, network statistics
- **Alert System**: Configurable alerts with multiple notification channels
- **API Key Management**: Granular permission system
- **User Management**: Role-based access control
- **Node Management**: Monitor multiple servers
- **Process Monitoring**: Track running processes
- **Network Analysis**: Traffic monitoring and analysis
- **Historical Data**: Metrics storage and visualization

## Security

- Token-based authentication
- Rate limiting per API key
- SQL injection protection
- XSS protection
- CORS configuration
- Session management
- Audit logging

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) file.

## Support

For issues and feature requests, please use the GitHub issue tracker.