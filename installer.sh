#!/bin/bash

# Statistics Software Installer Script
# Supports: macOS, Linux (Debian/Ubuntu, Arch, and others)
# Features: Client/Server installation, CLI tool, Reverse Proxy setup, SSL certificates, Auto-start services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
INSTALL_DIR="/opt/statistics"
CONFIG_DIR="/etc/statistics"
LOG_FILE="/tmp/statistics_install_$(date +%Y%m%d_%H%M%S).log"
CURRENT_USER=$(whoami)
HOME_DIR=$HOME
NVM_VERSION="v0.39.7"
NODE_VERSION="20"

# Installation choices
INSTALL_CLIENT=false
INSTALL_SERVER=false
INSTALL_CLI=false
INSTALL_REVERSE_PROXY=""
USE_SSL=false
DOMAIN_NAME=""

# Function to print colored output
print_message() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_message $RED "This script must be run as root or with sudo"
        exit 1
    fi
}

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PKG_MANAGER="brew"
        SERVICE_MANAGER="launchd"
    elif [ -f /etc/debian_version ]; then
        OS="debian"
        PKG_MANAGER="apt-get"
        SERVICE_MANAGER="systemd"
    elif [ -f /etc/arch-release ]; then
        OS="arch"
        PKG_MANAGER="pacman"
        SERVICE_MANAGER="systemd"
    elif [ -f /etc/redhat-release ]; then
        OS="redhat"
        PKG_MANAGER="yum"
        SERVICE_MANAGER="systemd"
    elif [ -f /etc/fedora-release ]; then
        OS="fedora"
        PKG_MANAGER="dnf"
        SERVICE_MANAGER="systemd"
    elif [ -f /etc/alpine-release ]; then
        OS="alpine"
        PKG_MANAGER="apk"
        SERVICE_MANAGER="openrc"
    else
        print_message $RED "Unsupported operating system"
        exit 1
    fi
    
    print_message $GREEN "Detected OS: $OS"
    print_message $GREEN "Package Manager: $PKG_MANAGER"
    print_message $GREEN "Service Manager: $SERVICE_MANAGER"
    log_message "OS: $OS, Package Manager: $PKG_MANAGER, Service Manager: $SERVICE_MANAGER"
}

# Function to update package manager
update_package_manager() {
    print_message $BLUE "Updating package manager..."
    case $PKG_MANAGER in
        brew)
            brew update > /dev/null 2>&1 || true
            ;;
        apt-get)
            apt-get update -qq > /dev/null 2>&1
            ;;
        pacman)
            pacman -Syy --noconfirm > /dev/null 2>&1
            ;;
        yum)
            yum update -y -q > /dev/null 2>&1
            ;;
        dnf)
            dnf update -y -q > /dev/null 2>&1
            ;;
        apk)
            apk update > /dev/null 2>&1
            ;;
    esac
}

# Function to install package
install_package() {
    local package=$1
    print_message $BLUE "Installing $package..."
    log_message "Installing package: $package"
    
    case $PKG_MANAGER in
        brew)
            brew install "$package" > /dev/null 2>&1 || true
            ;;
        apt-get)
            apt-get install -y -qq "$package" > /dev/null 2>&1
            ;;
        pacman)
            pacman -S --noconfirm --needed "$package" > /dev/null 2>&1
            ;;
        yum)
            yum install -y -q "$package" > /dev/null 2>&1
            ;;
        dnf)
            dnf install -y -q "$package" > /dev/null 2>&1
            ;;
        apk)
            apk add --no-cache "$package" > /dev/null 2>&1
            ;;
    esac
}

# Function to install basic dependencies
install_basic_dependencies() {
    print_message $YELLOW "Installing basic dependencies..."
    
    local deps=("curl" "wget" "git" "build-essential" "python3")
    
    if [ "$OS" == "macos" ]; then
        deps=("curl" "wget" "git" "python3")
    elif [ "$OS" == "arch" ]; then
        deps=("curl" "wget" "git" "base-devel" "python")
    elif [ "$OS" == "alpine" ]; then
        deps=("curl" "wget" "git" "build-base" "python3")
    fi
    
    for dep in "${deps[@]}"; do
        install_package "$dep"
    done
}

# Function to install NVM and Node.js
install_nvm_node() {
    print_message $YELLOW "Installing NVM and Node.js..."
    log_message "Installing NVM version $NVM_VERSION"
    
    # Install NVM
    if [ ! -d "$HOME_DIR/.nvm" ]; then
        curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" 2>/dev/null | bash > /dev/null 2>&1
        
        # Load NVM
        export NVM_DIR="$HOME_DIR/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    else
        print_message $GREEN "NVM already installed"
        export NVM_DIR="$HOME_DIR/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    
    # Install Node.js
    print_message $BLUE "Installing Node.js version $NODE_VERSION..."
    nvm install "$NODE_VERSION" > /dev/null 2>&1
    nvm use "$NODE_VERSION" > /dev/null 2>&1
    nvm alias default "$NODE_VERSION" > /dev/null 2>&1
    
    print_message $GREEN "Node.js $(node --version) installed"
    print_message $GREEN "NPM $(npm --version) installed"
}

# Function to show installation menu
show_menu() {
    clear
    print_message $BLUE "======================================"
    print_message $BLUE "   Statistics Software Installer"
    print_message $BLUE "======================================"
    echo ""
    
    # Component selection
    print_message $YELLOW "What would you like to install?"
    echo "1) Client only"
    echo "2) Server only"
    echo "3) Both Client and Server"
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            INSTALL_CLIENT=true
            ;;
        2)
            INSTALL_SERVER=true
            ;;
        3)
            INSTALL_CLIENT=true
            INSTALL_SERVER=true
            ;;
        *)
            print_message $RED "Invalid choice"
            exit 1
            ;;
    esac
    
    # CLI tool installation
    echo ""
    read -p "Install Statistics CLI tool? (y/n): " install_cli
    if [[ $install_cli =~ ^[Yy]$ ]]; then
        INSTALL_CLI=true
    fi
    
    # Reverse proxy selection
    echo ""
    print_message $YELLOW "Select reverse proxy (optional):"
    echo "1) Cloudflared (Cloudflare Tunnel)"
    echo "2) Nginx"
    echo "3) Apache"
    echo "4) None"
    read -p "Enter your choice (1-4): " proxy_choice
    
    case $proxy_choice in
        1)
            INSTALL_REVERSE_PROXY="cloudflared"
            ;;
        2)
            INSTALL_REVERSE_PROXY="nginx"
            ;;
        3)
            INSTALL_REVERSE_PROXY="apache"
            ;;
        4)
            INSTALL_REVERSE_PROXY=""
            ;;
        *)
            print_message $RED "Invalid choice"
            exit 1
            ;;
    esac
    
    # SSL configuration
    if [ "$INSTALL_REVERSE_PROXY" == "nginx" ] || [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
        echo ""
        read -p "Configure SSL with Let's Encrypt? (y/n): " use_ssl
        if [[ $use_ssl =~ ^[Yy]$ ]]; then
            USE_SSL=true
            read -p "Enter your domain name: " DOMAIN_NAME
        fi
    fi
}

# Function to clone repository
clone_repository() {
    print_message $YELLOW "Setting up Statistics software..."
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CONFIG_DIR"
    
    # Clone or copy the repository
    if [ -d "./server" ] && [ -d "./client" ]; then
        print_message $BLUE "Copying local files to $INSTALL_DIR..."
        cp -r ./* "$INSTALL_DIR/" 2>/dev/null || true
    else
        print_message $BLUE "Cloning repository..."
        git clone https://github.com/yourusername/statistics.git "$INSTALL_DIR" > /dev/null 2>&1
    fi
    
    cd "$INSTALL_DIR"
}

# Function to install Node.js dependencies
install_node_dependencies() {
    print_message $YELLOW "Installing Node.js dependencies..."
    cd "$INSTALL_DIR"
    
    # Install dependencies silently
    npm install --silent > /dev/null 2>&1
    
    # Build TypeScript
    if [ "$INSTALL_CLIENT" = true ]; then
        print_message $BLUE "Building client..."
        npm run client:build > /dev/null 2>&1 || true
    fi
    
    # Build CSS
    print_message $BLUE "Building CSS..."
    npm run css:build > /dev/null 2>&1 || true
}

# Function to install CLI tool
install_cli_tool() {
    if [ "$INSTALL_CLI" = true ]; then
        print_message $YELLOW "Installing Statistics CLI tool..."
        
        # Create symbolic link for CLI
        ln -sf "$INSTALL_DIR/cli.js" /usr/local/bin/statistics
        chmod +x /usr/local/bin/statistics
        
        # Make CLI executable with node
        cat > /usr/local/bin/statistics << EOF
#!/bin/bash
cd $INSTALL_DIR
node cli.js "\$@"
EOF
        chmod +x /usr/local/bin/statistics
        
        print_message $GREEN "CLI tool installed. Use 'statistics' command to manage the application"
    fi
}

# Function to install Cloudflared
install_cloudflared() {
    print_message $YELLOW "Installing Cloudflared..."
    
    if [ "$OS" == "macos" ]; then
        brew install cloudflare/cloudflare/cloudflared > /dev/null 2>&1
    elif [ "$OS" == "debian" ] || [ "$OS" == "ubuntu" ]; then
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        dpkg -i cloudflared-linux-amd64.deb > /dev/null 2>&1
        rm cloudflared-linux-amd64.deb
    elif [ "$OS" == "arch" ]; then
        install_package cloudflared
    else
        # Generic Linux installation
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
        mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
        chmod +x /usr/local/bin/cloudflared
    fi
    
    print_message $GREEN "Cloudflared installed"
}

# Function to install and configure Nginx
install_nginx() {
    print_message $YELLOW "Installing Nginx..."
    install_package nginx
    
    # Configure Nginx
    local port=4000
    if [ "$INSTALL_SERVER" = true ]; then
        port=4000
    elif [ "$INSTALL_CLIENT" = true ]; then
        port=3000
    fi
    
    cat > /etc/nginx/sites-available/statistics << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME:-localhost};
    
    location / {
        proxy_pass http://localhost:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/statistics /etc/nginx/sites-enabled/statistics
    
    # Remove default site if exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    nginx -t > /dev/null 2>&1
    systemctl reload nginx > /dev/null 2>&1
    
    print_message $GREEN "Nginx configured"
}

# Function to install and configure Apache
install_apache() {
    print_message $YELLOW "Installing Apache..."
    
    if [ "$OS" == "debian" ]; then
        install_package apache2
        a2enmod proxy proxy_http > /dev/null 2>&1
        SERVICE_NAME="apache2"
    elif [ "$OS" == "arch" ]; then
        install_package apache
        SERVICE_NAME="httpd"
    else
        install_package httpd
        SERVICE_NAME="httpd"
    fi
    
    # Configure Apache
    local port=4000
    if [ "$INSTALL_SERVER" = true ]; then
        port=4000
    elif [ "$INSTALL_CLIENT" = true ]; then
        port=3000
    fi
    
    cat > /etc/apache2/sites-available/statistics.conf << EOF
<VirtualHost *:80>
    ServerName ${DOMAIN_NAME:-localhost}
    
    ProxyRequests Off
    ProxyPreserveHost On
    
    <Proxy *>
        Order deny,allow
        Allow from all
    </Proxy>
    
    ProxyPass / http://localhost:$port/
    ProxyPassReverse / http://localhost:$port/
</VirtualHost>
EOF
    
    # Enable site
    a2ensite statistics > /dev/null 2>&1
    a2dissite 000-default > /dev/null 2>&1
    
    # Reload Apache
    systemctl reload $SERVICE_NAME > /dev/null 2>&1
    
    print_message $GREEN "Apache configured"
}

# Function to configure SSL with Let's Encrypt
configure_ssl() {
    if [ "$USE_SSL" = true ] && [ -n "$DOMAIN_NAME" ]; then
        print_message $YELLOW "Configuring SSL with Let's Encrypt..."
        
        # Install Certbot
        if [ "$OS" == "debian" ]; then
            install_package certbot
            if [ "$INSTALL_REVERSE_PROXY" == "nginx" ]; then
                install_package python3-certbot-nginx
            elif [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
                install_package python3-certbot-apache
            fi
        elif [ "$OS" == "arch" ]; then
            install_package certbot
            if [ "$INSTALL_REVERSE_PROXY" == "nginx" ]; then
                install_package certbot-nginx
            elif [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
                install_package certbot-apache
            fi
        fi
        
        # Obtain certificate
        if [ "$INSTALL_REVERSE_PROXY" == "nginx" ]; then
            certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos --email admin@$DOMAIN_NAME > /dev/null 2>&1
        elif [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
            certbot --apache -d "$DOMAIN_NAME" --non-interactive --agree-tos --email admin@$DOMAIN_NAME > /dev/null 2>&1
        fi
        
        # Setup auto-renewal
        cat > /etc/systemd/system/certbot-renewal.service << EOF
[Unit]
Description=Certbot Renewal
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet

[Install]
WantedBy=multi-user.target
EOF

        cat > /etc/systemd/system/certbot-renewal.timer << EOF
[Unit]
Description=Twice daily renewal of Let's Encrypt certificates

[Timer]
OnCalendar=0/12:00:00
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF
        
        systemctl enable certbot-renewal.timer > /dev/null 2>&1
        systemctl start certbot-renewal.timer > /dev/null 2>&1
        
        print_message $GREEN "SSL configured with auto-renewal"
    fi
}

# Function to create systemd service
create_systemd_service() {
    print_message $YELLOW "Creating systemd services..."
    
    # Create service for server
    if [ "$INSTALL_SERVER" = true ]; then
        cat > /etc/systemd/system/statistics-server.service << EOF
[Unit]
Description=Statistics Server
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
Environment="PATH=$HOME_DIR/.nvm/versions/node/v$NODE_VERSION.*/bin:/usr/bin"
ExecStart=$HOME_DIR/.nvm/versions/node/v$NODE_VERSION.*/bin/node $INSTALL_DIR/dist/server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload > /dev/null 2>&1
        systemctl enable statistics-server > /dev/null 2>&1
        systemctl start statistics-server > /dev/null 2>&1
        print_message $GREEN "Statistics server service created and started"
    fi
    
    # Create service for client
    if [ "$INSTALL_CLIENT" = true ]; then
        cat > /etc/systemd/system/statistics-client.service << EOF
[Unit]
Description=Statistics Client
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
Environment="PATH=$HOME_DIR/.nvm/versions/node/v$NODE_VERSION.*/bin:/usr/bin"
ExecStart=$HOME_DIR/.nvm/versions/node/v$NODE_VERSION.*/bin/node $INSTALL_DIR/dist/client/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload > /dev/null 2>&1
        systemctl enable statistics-client > /dev/null 2>&1
        systemctl start statistics-client > /dev/null 2>&1
        print_message $GREEN "Statistics client service created and started"
    fi
    
    # Create service for cloudflared if selected
    if [ "$INSTALL_REVERSE_PROXY" == "cloudflared" ]; then
        cat > /etc/systemd/system/statistics-cloudflared.service << EOF
[Unit]
Description=Statistics Cloudflared Tunnel
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
ExecStart=/usr/local/bin/cloudflared tunnel run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload > /dev/null 2>&1
        systemctl enable statistics-cloudflared > /dev/null 2>&1
        print_message $YELLOW "Cloudflared service created. Configure your tunnel before starting the service."
    fi
}

# Function to create launchd service (macOS)
create_launchd_service() {
    print_message $YELLOW "Creating launchd services..."
    
    # Create service for server
    if [ "$INSTALL_SERVER" = true ]; then
        cat > /Library/LaunchDaemons/com.statistics.server.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.statistics.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$HOME_DIR/.nvm/versions/node/v$NODE_VERSION.*/bin/node</string>
        <string>$INSTALL_DIR/dist/server/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/var/log/statistics-server.err</string>
    <key>StandardOutPath</key>
    <string>/var/log/statistics-server.log</string>
</dict>
</plist>
EOF
        
        launchctl load /Library/LaunchDaemons/com.statistics.server.plist > /dev/null 2>&1
        print_message $GREEN "Statistics server service created and started"
    fi
    
    # Create service for client
    if [ "$INSTALL_CLIENT" = true ]; then
        cat > /Library/LaunchDaemons/com.statistics.client.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.statistics.client</string>
    <key>ProgramArguments</key>
    <array>
        <string>$HOME_DIR/.nvm/versions/node/v$NODE_VERSION.*/bin/node</string>
        <string>$INSTALL_DIR/dist/client/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/var/log/statistics-client.err</string>
    <key>StandardOutPath</key>
    <string>/var/log/statistics-client.log</string>
</dict>
</plist>
EOF
        
        launchctl load /Library/LaunchDaemons/com.statistics.client.plist > /dev/null 2>&1
        print_message $GREEN "Statistics client service created and started"
    fi
}

# Function to setup reverse proxy
setup_reverse_proxy() {
    if [ -n "$INSTALL_REVERSE_PROXY" ]; then
        case $INSTALL_REVERSE_PROXY in
            cloudflared)
                install_cloudflared
                ;;
            nginx)
                install_nginx
                ;;
            apache)
                install_apache
                ;;
        esac
        
        # Configure SSL if requested
        configure_ssl
    fi
}

# Function to create services
create_services() {
    if [ "$SERVICE_MANAGER" == "systemd" ]; then
        create_systemd_service
    elif [ "$SERVICE_MANAGER" == "launchd" ]; then
        create_launchd_service
    fi
}

# Function to display completion message
display_completion() {
    print_message $GREEN "======================================"
    print_message $GREEN "   Installation Complete!"
    print_message $GREEN "======================================"
    echo ""
    
    if [ "$INSTALL_SERVER" = true ]; then
        print_message $BLUE "Server: http://localhost:4000"
    fi
    
    if [ "$INSTALL_CLIENT" = true ]; then
        print_message $BLUE "Client: http://localhost:3000"
    fi
    
    if [ "$INSTALL_CLI" = true ]; then
        print_message $BLUE "CLI: Use 'statistics' command"
    fi
    
    if [ -n "$INSTALL_REVERSE_PROXY" ]; then
        print_message $BLUE "Reverse Proxy: $INSTALL_REVERSE_PROXY configured"
        if [ "$USE_SSL" = true ]; then
            print_message $BLUE "SSL: Configured with Let's Encrypt"
        fi
    fi
    
    echo ""
    print_message $YELLOW "Services will start automatically on reboot"
    print_message $YELLOW "Installation log: $LOG_FILE"
    echo ""
    
    # Service management commands
    if [ "$SERVICE_MANAGER" == "systemd" ]; then
        print_message $YELLOW "Service Management Commands:"
        if [ "$INSTALL_SERVER" = true ]; then
            echo "  Server: systemctl [start|stop|restart|status] statistics-server"
        fi
        if [ "$INSTALL_CLIENT" = true ]; then
            echo "  Client: systemctl [start|stop|restart|status] statistics-client"
        fi
    elif [ "$SERVICE_MANAGER" == "launchd" ]; then
        print_message $YELLOW "Service Management Commands:"
        if [ "$INSTALL_SERVER" = true ]; then
            echo "  Server: launchctl [start|stop] com.statistics.server"
        fi
        if [ "$INSTALL_CLIENT" = true ]; then
            echo "  Client: launchctl [start|stop] com.statistics.client"
        fi
    fi
}

# Main installation flow
main() {
    # Initial setup
    print_message $BLUE "Starting Statistics Software Installation..."
    log_message "Installation started"
    
    # Check root privileges
    check_root
    
    # Detect operating system
    detect_os
    
    # Show installation menu
    show_menu
    
    # Update package manager
    update_package_manager
    
    # Install basic dependencies
    install_basic_dependencies
    
    # Install NVM and Node.js
    install_nvm_node
    
    # Clone or copy repository
    clone_repository
    
    # Install Node.js dependencies
    install_node_dependencies
    
    # Install CLI tool
    install_cli_tool
    
    # Setup reverse proxy
    setup_reverse_proxy
    
    # Create and enable services
    create_services
    
    # Display completion message
    display_completion
    
    log_message "Installation completed successfully"
}

# Run main function
main "$@"