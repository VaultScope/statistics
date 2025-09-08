# VaultScope Statistics - Production Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Installation](#quick-installation)
3. [Manual Installation](#manual-installation)
4. [Configuration](#configuration)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance](#maintenance)

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+, Debian 11+, RHEL 8+, or compatible Linux distribution
- **Node.js**: v20.x or higher
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk**: 1GB free space
- **Network**: Port 4000 (server) and 4001 (client) available

### Required Software
```bash
# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install build essentials
sudo apt-get install -y build-essential git
```

## Quick Installation

### Using the Installer Script
```bash
# Download and run the installer
curl -fsSL https://raw.githubusercontent.com/vaultscope/statistics/main/installer.sh -o installer.sh
chmod +x installer.sh
sudo ./installer.sh
```

The installer will:
- Clone the repository to `/var/www/vaultscope-statistics`
- Install all dependencies
- Build both server and client for production
- Configure systemd services
- Start the services automatically

## Manual Installation

### 1. Clone Repository
```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/vaultscope/statistics.git vaultscope-statistics
cd vaultscope-statistics
```

### 2. Install Dependencies
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
sudo nano .env
```

Update the following critical settings:
- `JWT_SECRET`: Generate with `openssl rand -base64 32`
- `SESSION_SECRET`: Generate with `openssl rand -base64 32`
- `DATABASE_PATH`: Path to SQLite database
- `CORS_ORIGINS`: Add your domain

### 4. Build for Production
```bash
# Build both server and client
npm run build:all
```

### 5. Install Systemd Services
```bash
# Copy service files
sudo cp systemd/vaultscope-statistics-server.service /etc/systemd/system/
sudo cp systemd/vaultscope-statistics-client.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable vaultscope-statistics-server
sudo systemctl enable vaultscope-statistics-client

# Start services
sudo systemctl start vaultscope-statistics-server
sudo systemctl start vaultscope-statistics-client
```

### 6. Verify Installation
```bash
# Check service status
sudo systemctl status vaultscope-statistics-server
sudo systemctl status vaultscope-statistics-client

# Check logs
sudo journalctl -u vaultscope-statistics-server -f
sudo journalctl -u vaultscope-statistics-client -f
```

## Configuration

### Nginx Reverse Proxy
```nginx
# /etc/nginx/sites-available/vaultscope-statistics
server {
    listen 80;
    server_name your-domain.com;

    # API Server
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Next.js Client
    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/vaultscope-statistics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Let's Encrypt
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Firewall Configuration
```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow direct access (optional)
sudo ufw allow 4000/tcp
sudo ufw allow 4001/tcp
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Server Won't Start
```bash
# Check logs
sudo journalctl -u vaultscope-statistics-server -n 50

# Common fixes:
# - Check port availability: sudo lsof -i :4000
# - Check Node.js version: node --version
# - Rebuild: npm run build:server
```

#### 2. Client Build Errors
```bash
# Clear Next.js cache
cd client
rm -rf .next
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

#### 3. Database Issues
```bash
# Check database permissions
ls -la /var/www/vaultscope-statistics/database.sqlite

# Fix permissions
sudo chown www-data:www-data /var/www/vaultscope-statistics/database.sqlite
```

#### 4. Permission Errors
```bash
# Fix directory permissions
sudo chown -R www-data:www-data /var/www/vaultscope-statistics
sudo chmod -R 755 /var/www/vaultscope-statistics
```

### Debugging Commands
```bash
# View real-time logs
sudo journalctl -f

# Check service status
sudo systemctl status vaultscope-statistics-*

# Test API endpoint
curl http://localhost:4000/health

# Check process
ps aux | grep node
```

## Maintenance

### Updating the Application
```bash
cd /var/www/vaultscope-statistics

# Stop services
sudo systemctl stop vaultscope-statistics-server
sudo systemctl stop vaultscope-statistics-client

# Pull latest changes
git pull origin main

# Install new dependencies
npm install
cd client && npm install && cd ..

# Rebuild
npm run build:all

# Start services
sudo systemctl start vaultscope-statistics-server
sudo systemctl start vaultscope-statistics-client
```

### Backup
```bash
# Create backup script
cat > /usr/local/bin/backup-vaultscope.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/vaultscope-statistics"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp /var/www/vaultscope-statistics/database.sqlite "$BACKUP_DIR/database_$DATE.sqlite"
cp /var/www/vaultscope-statistics/.env "$BACKUP_DIR/env_$DATE"

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-vaultscope.sh

# Add to crontab
echo "0 2 * * * /usr/local/bin/backup-vaultscope.sh" | sudo crontab -
```

### Monitoring
```bash
# Create monitoring script
cat > /usr/local/bin/check-vaultscope.sh << 'EOF'
#!/bin/bash
if ! systemctl is-active --quiet vaultscope-statistics-server; then
    echo "Server is down, restarting..."
    systemctl restart vaultscope-statistics-server
fi

if ! systemctl is-active --quiet vaultscope-statistics-client; then
    echo "Client is down, restarting..."
    systemctl restart vaultscope-statistics-client
fi
EOF

chmod +x /usr/local/bin/check-vaultscope.sh

# Add to crontab (check every 5 minutes)
echo "*/5 * * * * /usr/local/bin/check-vaultscope.sh" | sudo crontab -
```

### Log Rotation
```bash
# Create logrotate config
cat > /etc/logrotate.d/vaultscope-statistics << EOF
/var/log/vaultscope-statistics/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 root root
    sharedscripts
    postrotate
        systemctl reload vaultscope-statistics-server
        systemctl reload vaultscope-statistics-client
    endscript
}
EOF
```

## Security Recommendations

1. **Change Default Secrets**: Always generate new JWT_SECRET and SESSION_SECRET values
2. **Use HTTPS**: Configure SSL/TLS with Let's Encrypt or your certificate
3. **Firewall**: Restrict access to necessary ports only
4. **Updates**: Keep Node.js and system packages updated
5. **Monitoring**: Set up monitoring and alerting for service health
6. **Backups**: Regular automated backups of database and configuration

## Support

For issues or questions:
- GitHub Issues: https://github.com/vaultscope/statistics/issues
- Documentation: https://github.com/vaultscope/statistics/wiki

## License

See LICENSE file in the repository root.