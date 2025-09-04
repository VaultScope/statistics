#!/bin/bash

# VaultScope Statistics Installer for Linux/Mac
# Supports Ubuntu, Debian, CentOS, RHEL, Fedora, macOS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Installation directory
INSTALL_PATH="/opt/vaultscope/statistics"

# Function to print colored output
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info() { echo -e "${CYAN}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macos"
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS="linux"
        DISTRO="${ID}"
    else
        print_error "Unsupported operating system"
        exit 1
    fi
    
    print_info "Detected OS: $OS ($DISTRO)"
}

# Check if running as root (Linux only)
check_root() {
    if [[ "$OS" == "linux" ]] && [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root on Linux"
        print_info "Try: sudo $0"
        exit 1
    fi
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Node.js
install_nodejs() {
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is already installed ($NODE_VERSION)"
        
        # Check version is 18+
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -lt 18 ]; then
            print_warning "Node.js version is less than 18. Updating..."
            INSTALL_NODE=true
        else
            return 0
        fi
    else
        INSTALL_NODE=true
    fi
    
    if [ "$INSTALL_NODE" = true ]; then
        print_info "Installing Node.js..."
        
        if [[ "$OS" == "macos" ]]; then
            # macOS installation
            if command_exists brew; then
                brew install node
            else
                print_info "Installing Homebrew first..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                brew install node
            fi
        else
            # Linux installation
            case "$DISTRO" in
                ubuntu|debian)
                    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                    apt-get install -y nodejs
                    ;;
                centos|rhel|fedora)
                    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
                    yum install -y nodejs
                    ;;
                *)
                    # Generic installation using NodeSource
                    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                    apt-get install -y nodejs
                    ;;
            esac
        fi
        
        print_success "Node.js installed successfully"
    fi
}

# Install Git
install_git() {
    if command_exists git; then
        GIT_VERSION=$(git --version)
        print_success "Git is already installed ($GIT_VERSION)"
    else
        print_info "Installing Git..."
        
        if [[ "$OS" == "macos" ]]; then
            brew install git
        else
            case "$DISTRO" in
                ubuntu|debian)
                    apt-get update && apt-get install -y git
                    ;;
                centos|rhel|fedora)
                    yum install -y git
                    ;;
                *)
                    apt-get update && apt-get install -y git
                    ;;
            esac
        fi
        
        print_success "Git installed successfully"
    fi
}

# Install PM2
install_pm2() {
    if command_exists pm2; then
        print_success "PM2 is already installed"
    else
        print_info "Installing PM2 globally..."
        npm install -g pm2
        print_success "PM2 installed successfully"
    fi
}

# Install Cloudflared
install_cloudflared() {
    CLOUDFLARED_PATH="$INSTALL_PATH/cloudflared"
    
    if [[ -f "$CLOUDFLARED_PATH/cloudflared" ]]; then
        print_success "Cloudflared is already installed"
    else
        print_info "Installing Cloudflared..."
        mkdir -p "$CLOUDFLARED_PATH"
        
        if [[ "$OS" == "macos" ]]; then
            brew install cloudflared
            ln -sf $(which cloudflared) "$CLOUDFLARED_PATH/cloudflared"
        else
            # Detect architecture
            ARCH=$(uname -m)
            case "$ARCH" in
                x86_64)
                    CF_ARCH="amd64"
                    ;;
                aarch64|arm64)
                    CF_ARCH="arm64"
                    ;;
                armv7l)
                    CF_ARCH="arm"
                    ;;
                *)
                    print_error "Unsupported architecture: $ARCH"
                    return 1
                    ;;
            esac
            
            wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH} \
                -O "$CLOUDFLARED_PATH/cloudflared"
            chmod +x "$CLOUDFLARED_PATH/cloudflared"
        fi
        
        print_success "Cloudflared installed successfully"
    fi
}

# Install Nginx
install_nginx() {
    if command_exists nginx; then
        print_success "Nginx is already installed"
    else
        print_info "Installing Nginx..."
        
        if [[ "$OS" == "macos" ]]; then
            brew install nginx
        else
            case "$DISTRO" in
                ubuntu|debian)
                    apt-get update && apt-get install -y nginx
                    ;;
                centos|rhel|fedora)
                    yum install -y nginx
                    ;;
                *)
                    apt-get update && apt-get install -y nginx
                    ;;
            esac
        fi
        
        print_success "Nginx installed successfully"
    fi
}

# Setup systemd service (Linux)
setup_systemd_service() {
    local SERVICE_NAME=$1
    local DISPLAY_NAME=$2
    local WORKING_DIR=$3
    local START_CMD=$4
    
    print_info "Setting up systemd service: $DISPLAY_NAME"
    
    cat > "/etc/systemd/system/vaultscope-$SERVICE_NAME.service" << EOF
[Unit]
Description=$DISPLAY_NAME
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$WORKING_DIR
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=vaultscope-$SERVICE_NAME
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "vaultscope-$SERVICE_NAME.service"
    systemctl start "vaultscope-$SERVICE_NAME.service"
    
    print_success "Service installed: $DISPLAY_NAME"
}

# Setup launchd service (macOS)
setup_launchd_service() {
    local SERVICE_NAME=$1
    local DISPLAY_NAME=$2
    local WORKING_DIR=$3
    local START_CMD=$4
    
    print_info "Setting up launchd service: $DISPLAY_NAME"
    
    PLIST_PATH="$HOME/Library/LaunchAgents/com.vaultscope.$SERVICE_NAME.plist"
    
    cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vaultscope.$SERVICE_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npm</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$WORKING_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/vaultscope-$SERVICE_NAME.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/vaultscope-$SERVICE_NAME.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
EOF
    
    launchctl load "$PLIST_PATH"
    
    print_success "Service installed: $DISPLAY_NAME"
}

# Setup service wrapper
setup_service() {
    local SERVICE_NAME=$1
    local DISPLAY_NAME=$2
    local WORKING_DIR=$3
    local START_CMD=$4
    
    if [[ "$OS" == "macos" ]]; then
        setup_launchd_service "$SERVICE_NAME" "$DISPLAY_NAME" "$WORKING_DIR" "$START_CMD"
    else
        setup_systemd_service "$SERVICE_NAME" "$DISPLAY_NAME" "$WORKING_DIR" "$START_CMD"
    fi
}

# Setup Nginx reverse proxy
setup_nginx_proxy() {
    local APP_TYPE=$1
    local PORT=$2
    local DOMAIN=$3
    
    print_info "Setting up Nginx reverse proxy for $APP_TYPE..."
    
    if [[ "$OS" == "macos" ]]; then
        NGINX_CONF_DIR="/usr/local/etc/nginx/servers"
        mkdir -p "$NGINX_CONF_DIR"
    else
        NGINX_CONF_DIR="/etc/nginx/sites-available"
        NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
        mkdir -p "$NGINX_CONF_DIR" "$NGINX_ENABLED_DIR"
    fi
    
    cat > "$NGINX_CONF_DIR/vaultscope-$APP_TYPE" << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
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
    
    if [[ "$OS" == "linux" ]]; then
        ln -sf "$NGINX_CONF_DIR/vaultscope-$APP_TYPE" "$NGINX_ENABLED_DIR/vaultscope-$APP_TYPE"
        systemctl reload nginx
    else
        brew services restart nginx
    fi
    
    print_success "Nginx configured for $DOMAIN -> localhost:$PORT"
}

# Setup Cloudflared tunnel
setup_cloudflared_tunnel() {
    local APP_TYPE=$1
    local PORT=$2
    local DOMAIN=$3
    
    print_info "Setting up Cloudflare tunnel for $APP_TYPE..."
    
    CLOUDFLARED_PATH="$INSTALL_PATH/cloudflared"
    CONFIG_FILE="$CLOUDFLARED_PATH/config-$APP_TYPE.yml"
    
    # Create tunnel configuration
    cat > "$CONFIG_FILE" << EOF
url: http://localhost:$PORT
tunnel: vaultscope-$APP_TYPE
credentials-file: $CLOUDFLARED_PATH/credentials.json
EOF
    
    print_info "Please authenticate with Cloudflare..."
    "$CLOUDFLARED_PATH/cloudflared" tunnel login
    
    print_info "Creating tunnel..."
    "$CLOUDFLARED_PATH/cloudflared" tunnel create "vaultscope-$APP_TYPE"
    
    print_info "Routing traffic to $DOMAIN..."
    "$CLOUDFLARED_PATH/cloudflared" tunnel route dns "vaultscope-$APP_TYPE" "$DOMAIN"
    
    # Setup service for cloudflared
    if [[ "$OS" == "linux" ]]; then
        "$CLOUDFLARED_PATH/cloudflared" service install
    fi
    
    "$CLOUDFLARED_PATH/cloudflared" tunnel run --config "$CONFIG_FILE" "vaultscope-$APP_TYPE" &
    
    print_success "Cloudflare tunnel configured for $DOMAIN"
}

# Install client
install_client() {
    print_info "Installing VaultScope Statistics Client..."
    
    CLIENT_PATH="$INSTALL_PATH/client"
    
    # Clone repository
    print_info "Cloning repository..."
    if [[ -d "$CLIENT_PATH" ]]; then
        rm -rf "$CLIENT_PATH"
    fi
    
    git clone https://github.com/VaultScope/statistics.git "$INSTALL_PATH/temp"
    mv "$INSTALL_PATH/temp/client" "$CLIENT_PATH"
    
    # Install dependencies
    print_info "Installing dependencies..."
    cd "$CLIENT_PATH"
    npm install
    
    # Build the client
    print_info "Building client..."
    npm run build
    
    # Setup environment variables
    cat > "$CLIENT_PATH/.env.production" << EOF
# Client Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=production
EOF
    
    # Setup reverse proxy if requested
    echo
    print_info "Would you like to setup a reverse proxy?"
    echo "1. No reverse proxy (localhost only)"
    echo "2. Cloudflare Tunnel (recommended)"
    echo "3. Nginx"
    echo "4. Both Cloudflare and Nginx"
    read -p "Enter your choice (1-4): " PROXY_CHOICE
    
    CLIENT_PORT=3000
    
    case $PROXY_CHOICE in
        2)
            install_cloudflared
            read -p "Enter your domain for the client (e.g., stats.yourdomain.com): " DOMAIN
            setup_cloudflared_tunnel "client" "$CLIENT_PORT" "$DOMAIN"
            ;;
        3)
            install_nginx
            read -p "Enter your domain for the client (e.g., stats.yourdomain.com): " DOMAIN
            setup_nginx_proxy "client" "$CLIENT_PORT" "$DOMAIN"
            ;;
        4)
            install_cloudflared
            install_nginx
            read -p "Enter your domain for the client (e.g., stats.yourdomain.com): " DOMAIN
            setup_cloudflared_tunnel "client" "$CLIENT_PORT" "$DOMAIN"
            setup_nginx_proxy "client" "$CLIENT_PORT" "$DOMAIN"
            ;;
    esac
    
    # Setup service
    setup_service "statistics-client" \
                  "VaultScope Statistics Client" \
                  "$CLIENT_PATH" \
                  "npm start"
    
    print_success "Client installed successfully!"
    print_info "Client is running on http://localhost:$CLIENT_PORT"
}

# Install server
install_server() {
    print_info "Installing VaultScope Statistics Server..."
    
    SERVER_PATH="$INSTALL_PATH/server"
    
    # Clone repository
    print_info "Cloning repository..."
    if [[ -d "$SERVER_PATH" ]]; then
        rm -rf "$SERVER_PATH"
    fi
    
    git clone https://github.com/VaultScope/statistics.git "$INSTALL_PATH/temp"
    mv "$INSTALL_PATH/temp/server" "$SERVER_PATH"
    
    # Install dependencies
    print_info "Installing dependencies..."
    cd "$SERVER_PATH"
    npm install
    
    # Build the server
    print_info "Building server..."
    npm run build
    
    # Generate API key
    API_KEY=$(openssl rand -hex 24)
    
    # Setup environment variables
    cat > "$SERVER_PATH/.env" << EOF
# Server Configuration
PORT=4000
API_KEY=$API_KEY
NODE_ENV=production
EOF
    
    echo
    print_warning "Your server API key is: $API_KEY"
    print_warning "Please save this key securely!"
    echo
    
    # Setup reverse proxy if requested
    print_info "Would you like to setup a reverse proxy?"
    echo "1. No reverse proxy (localhost only)"
    echo "2. Cloudflare Tunnel (recommended)"
    echo "3. Nginx"
    echo "4. Both Cloudflare and Nginx"
    read -p "Enter your choice (1-4): " PROXY_CHOICE
    
    SERVER_PORT=4000
    
    case $PROXY_CHOICE in
        2)
            install_cloudflared
            read -p "Enter your domain for the server API (e.g., api.yourdomain.com): " DOMAIN
            setup_cloudflared_tunnel "server" "$SERVER_PORT" "$DOMAIN"
            ;;
        3)
            install_nginx
            read -p "Enter your domain for the server API (e.g., api.yourdomain.com): " DOMAIN
            setup_nginx_proxy "server" "$SERVER_PORT" "$DOMAIN"
            ;;
        4)
            install_cloudflared
            install_nginx
            read -p "Enter your domain for the server API (e.g., api.yourdomain.com): " DOMAIN
            setup_cloudflared_tunnel "server" "$SERVER_PORT" "$DOMAIN"
            setup_nginx_proxy "server" "$SERVER_PORT" "$DOMAIN"
            ;;
    esac
    
    # Setup service
    setup_service "statistics-server" \
                  "VaultScope Statistics Server" \
                  "$SERVER_PATH" \
                  "npm start"
    
    print_success "Server installed successfully!"
    print_info "Server is running on http://localhost:$SERVER_PORT"
    print_info "API Key: $API_KEY"
}

# Cleanup function
cleanup() {
    if [[ -d "$INSTALL_PATH/temp" ]]; then
        rm -rf "$INSTALL_PATH/temp"
    fi
}

# Main menu
show_menu() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           VaultScope Statistics Installer               ║${NC}"
    echo -e "${CYAN}║                    Version 1.0.0                        ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo
    print_info "What would you like to install?"
    echo "1. Client only"
    echo "2. Server only"
    echo "3. Both Client and Server"
    echo "4. Exit"
    echo
    read -p "Enter your choice (1-4): " CHOICE
    return $CHOICE
}

# Main execution
main() {
    # Detect OS
    detect_os
    
    # Check root permissions
    check_root
    
    # Install prerequisites
    print_info "Checking prerequisites..."
    install_nodejs
    install_git
    install_pm2
    
    # Create installation directory
    if [[ ! -d "$INSTALL_PATH" ]]; then
        mkdir -p "$INSTALL_PATH"
    fi
    
    # Show menu and process choice
    show_menu
    CHOICE=$?
    
    case $CHOICE in
        1)
            install_client
            ;;
        2)
            install_server
            ;;
        3)
            install_server
            echo
            install_client
            ;;
        4)
            print_info "Installation cancelled."
            exit 0
            ;;
        *)
            print_warning "Invalid choice. Exiting."
            exit 1
            ;;
    esac
    
    # Cleanup
    cleanup
    
    echo
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    print_success "Installation completed successfully!"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo
    
    if [[ "$OS" == "linux" ]]; then
        print_info "Services have been configured to start automatically on boot."
        print_info "You can manage services using systemctl:"
        echo "  systemctl status vaultscope-statistics-client"
        echo "  systemctl status vaultscope-statistics-server"
        echo "  systemctl restart vaultscope-statistics-client"
        echo "  systemctl restart vaultscope-statistics-server"
    else
        print_info "Services have been configured to start automatically on boot."
        print_info "You can manage services using launchctl:"
        echo "  launchctl list | grep vaultscope"
    fi
    
    echo
    print_info "You can also use PM2 commands:"
    echo "  pm2 list      - Show all services"
    echo "  pm2 restart   - Restart services"
    echo "  pm2 logs      - View logs"
    echo
}

# Trap errors
trap cleanup EXIT

# Run main function
main "$@"