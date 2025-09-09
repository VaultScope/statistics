#!/bin/bash

echo "VaultScope Statistics Diagnostic Script"
echo "======================================="

# Check installation directory
echo -e "\n1. Checking installation directory..."
if [ -d "/var/www/vaultscope-statistics" ]; then
    echo "✓ Installation directory exists"
    cd /var/www/vaultscope-statistics
    
    # Check if built files exist
    echo -e "\n2. Checking build files..."
    if [ -f "dist/server/index.js" ]; then
        echo "✓ Server build exists"
    else
        echo "✗ Server build missing - Running build..."
        npm run build
    fi
    
    # Check database
    echo -e "\n3. Checking database..."
    if [ -f "database.db" ]; then
        echo "✓ Database exists"
    else
        echo "✗ Database missing - Initializing..."
        npm run db:init
    fi
    
    # Check .env file
    echo -e "\n4. Checking environment configuration..."
    if [ -f ".env" ]; then
        echo "✓ .env file exists"
    else
        echo "✗ .env missing - Creating from example..."
        cp .env.example .env
    fi
    
    # Test direct server start
    echo -e "\n5. Testing direct server start..."
    timeout 5 node dist/server/index.js 2>&1 | head -20
    
    # Check systemd service files
    echo -e "\n6. Checking systemd services..."
    if [ -f "/etc/systemd/system/vaultscope-statistics-server.service" ]; then
        echo "✓ Server service file exists"
        echo "Content:"
        cat /etc/systemd/system/vaultscope-statistics-server.service
    else
        echo "✗ Server service file missing"
    fi
    
    # Show recent errors
    echo -e "\n7. Recent service errors..."
    journalctl -u vaultscope-statistics-server -n 20 --no-pager
    
else
    echo "✗ Installation directory not found at /var/www/vaultscope-statistics"
fi

echo -e "\n8. Node.js version:"
node --version

echo -e "\n9. NPM version:"
npm --version

echo -e "\nDiagnostic complete!"