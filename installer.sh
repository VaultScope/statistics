#!/bin/bash

# ============================================================================
# VaultScope Statistics Installer v7.0.0
# Actually working installer that handles all the bullshit
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# ============================================================================
# CONFIGURATION
# ============================================================================
readonly INSTALLER_VERSION="7.0.0"
readonly INSTALL_DIR="/var/www/vaultscope-statistics"
readonly CONFIG_DIR="/etc/vaultscope-statistics"
readonly LOG_DIR="/var/log/vaultscope-statistics"
readonly BACKUP_DIR="/var/backups/vaultscope-statistics"
readonly STATE_DIR="/var/lib/vaultscope-statistics"
readonly REPO_URL="https://github.com/vaultscope/statistics.git"
readonly NODE_VERSION="20"
readonly DEFAULT_BRANCH="main"
readonly LOG_FILE="/tmp/vaultscope_install_$(date +%Y%m%d_%H%M%S).log"

# Command line arguments
UNINSTALL_MODE=false
QUIET_MODE=false
AUTO_YES=false
SKIP_DEPS=false
BRANCH="$DEFAULT_BRANCH"

# Colors
if [[ -t 1 ]] && [[ "${NO_COLOR:-}" != "true" ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[1;33m'
    readonly BLUE='\033[0;34m'
    readonly BOLD='\033[1m'
    readonly NC='\033[0m'
else
    readonly RED=''
    readonly GREEN=''
    readonly YELLOW=''
    readonly BLUE=''
    readonly BOLD=''
    readonly NC=''
fi

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
print_header() {
    echo ""
    echo "========================================"
    echo "$1"
    echo "========================================"
    echo ""
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

confirm() {
    if [[ "$AUTO_YES" == true ]]; then
        return 0
    fi
    
    local prompt="${1:-Continue?}"
    echo -n "$prompt [y/N]: "
    
    # Read from terminal
    if [[ -t 0 ]]; then
        read -n 1 -r response
    else
        read -n 1 -r response < /dev/tty || response="n"
    fi
    echo
    
    [[ "$response" =~ ^[Yy]$ ]]
}

check_command() {
    command -v "$1" >/dev/null 2>&1
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
    else
        error "Cannot detect operating system"
        exit 1
    fi
    info "Detected OS: $OS"
}

# ============================================================================
# INSTALLATION FUNCTIONS
# ============================================================================
create_directories() {
    info "Creating required directories..."
    for dir in "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR" "$BACKUP_DIR" "$STATE_DIR"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            info "Created directory: $dir"
        else
            info "Directory exists: $dir"
        fi
    done
}

install_system_packages() {
    print_header "Installing System Packages"
    
    if [[ "$SKIP_DEPS" == true ]]; then
        info "Skipping system package installation"
        return
    fi
    
    info "Updating package lists..."
    case "$OS" in
        ubuntu|debian)
            apt-get update
            info "Installing required packages..."
            apt-get install -y git curl wget build-essential python3 sqlite3
            ;;
        fedora|rhel|centos)
            yum update -y
            info "Installing required packages..."
            yum install -y git curl wget gcc-c++ make python3 sqlite
            ;;
        *)
            error "Unsupported OS: $OS"
            exit 1
            ;;
    esac
    
    success "System packages installed"
}

install_nodejs() {
    print_header "Installing Node.js v${NODE_VERSION}"
    
    if check_command node && [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -ge ${NODE_VERSION} ]]; then
        success "Node.js v${NODE_VERSION} is already installed"
        return
    fi
    
    info "Installing Node.js v${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    
    success "Node.js installed: $(node -v)"
    success "npm installed: $(npm -v)"
}

clone_repository() {
    print_header "Cloning Repository"
    
    # Always clean clone to avoid git conflicts
    if [[ -d "$INSTALL_DIR" ]]; then
        info "Removing existing installation..."
        rm -rf "$INSTALL_DIR"
    fi
    
    info "Cloning fresh repository from $REPO_URL..."
    git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Mark as safe directory
    git config --global --add safe.directory "$INSTALL_DIR"
    
    success "Repository ready at $INSTALL_DIR"
}

install_dependencies() {
    print_header "Installing Node.js Dependencies"
    
    cd "$INSTALL_DIR"
    
    info "Installing server dependencies..."
    npm install 2>&1 | tee -a "$LOG_FILE"
    
    info "Installing TypeScript runtime..."
    npm install --save-dev ts-node typescript @types/node 2>&1 | tee -a "$LOG_FILE"
    
    if [[ -d "client" ]] && [[ -f "client/package.json" ]]; then
        cd client
        info "Installing client dependencies..."
        npm install 2>&1 | tee -a "$LOG_FILE"
        
        # Install missing dependencies for Next.js
        npm install --save-dev critters 2>&1 | tee -a "$LOG_FILE"
        
        # Fix Next.js config
        if [[ -f "next.config.js" ]]; then
            sed -i '/swcMinify/d' next.config.js
        fi
        
        cd ..
    fi
    
    success "Dependencies installed"
}

build_application() {
    print_header "Building Application"
    
    cd "$INSTALL_DIR"
    
    # Set memory limit
    export NODE_OPTIONS="--max-old-space-size=2048"
    
    info "Building server..."
    npm run build 2>&1 | tee -a "$LOG_FILE" || {
        warning "Server build failed - will run in development mode"
        touch .skip-build
    }
    
    # Try to build client
    if [[ -d "client" ]] && [[ -f "client/package.json" ]]; then
        info "Building client interface..."
        cd client
        
        export NODE_OPTIONS="--max-old-space-size=4096"
        npm run build 2>&1 | tee -a "$LOG_FILE" || {
            warning "Client build failed - interface will not be available"
            touch "$INSTALL_DIR/.client-build-failed"
        }
        cd ..
    fi
    
    success "Build process completed"
}

initialize_database() {
    print_header "Initializing Database"
    
    cd "$INSTALL_DIR"
    
    info "Creating database..."
    
    # Run database initialization and capture output
    if [[ -f "dist/server/services/databaseInitializer.js" ]]; then
        node dist/server/services/databaseInitializer.js 2>&1 | tee -a "$LOG_FILE"
    else
        npx ts-node server/services/databaseInitializer.ts 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # Set proper permissions
    if [[ -f "$INSTALL_DIR/database.db" ]]; then
        chown www-data:www-data "$INSTALL_DIR/database.db"
        chmod 644 "$INSTALL_DIR/database.db"
    fi
    
    success "Database initialized"
    warning "SAVE THE ADMIN API KEY SHOWN ABOVE!"
}

create_systemd_service() {
    print_header "Creating Systemd Services"
    
    # Set proper permissions for everything
    chown -R www-data:www-data "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"
    chown -R www-data:www-data "$LOG_DIR"
    chmod -R 755 "$LOG_DIR"
    
    # Determine execution mode
    local exec_command=""
    if [[ -f "$INSTALL_DIR/dist/server/index.js" ]]; then
        info "Creating server service in production mode..."
        exec_command="/usr/bin/node $INSTALL_DIR/dist/server/index.js"
    else
        info "Creating server service in development mode..."
        exec_command="cd $INSTALL_DIR && /usr/bin/npx ts-node server/index.ts"
    fi
    
    # Create server service that actually works
    cat > /etc/systemd/system/vaultscope-statistics-server.service << EOF
[Unit]
Description=VaultScope Statistics Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=4000"
Environment="NODE_OPTIONS=--max-old-space-size=2048"
Environment="PATH=/usr/bin:/usr/local/bin:/usr/local/lib/nodejs/node-v20.18.2-linux-x64/bin"
ExecStart=/bin/bash -c '$exec_command'
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/server.log
StandardError=append:$LOG_DIR/server-error.log

[Install]
WantedBy=multi-user.target
EOF
    
    # Client service only if build succeeded
    if [[ -d "$INSTALL_DIR/client/.next" ]] && [[ ! -f "$INSTALL_DIR/.client-build-failed" ]]; then
        info "Creating client service..."
        cat > /etc/systemd/system/vaultscope-statistics-client.service << EOF
[Unit]
Description=VaultScope Statistics Client
After=network.target vaultscope-statistics-server.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$INSTALL_DIR/client
Environment="NODE_ENV=production"
Environment="PORT=4001"
Environment="NODE_OPTIONS=--max-old-space-size=2048"
Environment="PATH=/usr/bin:/usr/local/bin:/usr/local/lib/nodejs/node-v20.18.2-linux-x64/bin"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/client.log
StandardError=append:$LOG_DIR/client-error.log

[Install]
WantedBy=multi-user.target
EOF
    fi
    
    systemctl daemon-reload
    systemctl enable vaultscope-statistics-server
    [[ -f /etc/systemd/system/vaultscope-statistics-client.service ]] && systemctl enable vaultscope-statistics-client
    
    success "Systemd services created and enabled"
}

start_services() {
    print_header "Starting Services"
    
    # Stop any existing services first
    systemctl stop vaultscope-statistics-server 2>/dev/null || true
    systemctl stop vaultscope-statistics-client 2>/dev/null || true
    
    info "Starting server..."
    systemctl start vaultscope-statistics-server
    
    # Wait for server to actually start
    sleep 10
    
    if systemctl is-active --quiet vaultscope-statistics-server; then
        success "Server is running"
        
        # Test API
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null | grep -q "200"; then
            success "Server API is responding correctly"
        else
            warning "Server is running but API health check failed"
            info "Checking server logs..."
            tail -n 50 "$LOG_DIR/server-error.log" 2>/dev/null || journalctl -u vaultscope-statistics-server -n 50 --no-pager
        fi
    else
        error "Server failed to start"
        info "Server logs:"
        tail -n 100 "$LOG_DIR/server-error.log" 2>/dev/null || journalctl -u vaultscope-statistics-server -n 100 --no-pager
        
        # Try to run manually to see the actual error
        info "Trying to run server manually to diagnose..."
        cd "$INSTALL_DIR"
        if [[ -f "dist/server/index.js" ]]; then
            timeout 5 node dist/server/index.js 2>&1 || true
        else
            timeout 5 npx ts-node server/index.ts 2>&1 || true
        fi
    fi
    
    if [[ -f /etc/systemd/system/vaultscope-statistics-client.service ]]; then
        info "Starting client..."
        systemctl start vaultscope-statistics-client
        sleep 5
        
        if systemctl is-active --quiet vaultscope-statistics-client; then
            success "Client is running"
        else
            warning "Client failed to start (this is optional)"
        fi
    fi
    
    success "Services started"
}

configure_nginx() {
    print_header "Configuring Nginx"
    
    # Install nginx if needed
    if ! check_command nginx; then
        info "Installing Nginx..."
        apt-get install -y nginx
    fi
    
    # Ask for domains - ALWAYS interactive
    local api_domain=""
    local app_domain=""
    
    echo ""
    echo "Configure domain names for Nginx:"
    echo -n "Enter domain for API (e.g., api.example.com) or press Enter to skip: "
    if [[ -t 0 ]]; then
        read api_domain
    else
        read api_domain < /dev/tty || true
    fi
    
    if [[ -d "$INSTALL_DIR/client/.next" ]]; then
        echo -n "Enter domain for Web App (e.g., app.example.com) or press Enter to skip: "
        if [[ -t 0 ]]; then
            read app_domain
        else
            read app_domain < /dev/tty || true
        fi
    fi
    
    # Configure API domain
    if [[ -n "$api_domain" ]]; then
        info "Configuring Nginx for API: $api_domain"
        cat > /etc/nginx/sites-available/vaultscope-api << EOF
server {
    listen 80;
    server_name $api_domain;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 100M;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
        ln -sf /etc/nginx/sites-available/vaultscope-api /etc/nginx/sites-enabled/
        success "API Nginx configuration created"
    fi
    
    # Configure App domain
    if [[ -n "$app_domain" ]]; then
        info "Configuring Nginx for Web App: $app_domain"
        cat > /etc/nginx/sites-available/vaultscope-app << EOF
server {
    listen 80;
    server_name $app_domain;
    
    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
        ln -sf /etc/nginx/sites-available/vaultscope-app /etc/nginx/sites-enabled/
        success "App Nginx configuration created"
    fi
    
    # Test and reload
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        success "Nginx configured and reloaded"
    else
        error "Nginx configuration test failed"
    fi
    
    # Store domains for SSL
    echo "$api_domain" > "$STATE_DIR/api_domain"
    echo "$app_domain" > "$STATE_DIR/app_domain"
}

configure_ssl() {
    print_header "Configuring SSL Certificates"
    
    # Install certbot if needed
    if ! check_command certbot; then
        info "Installing Certbot..."
        apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Get domains
    local api_domain=""
    local app_domain=""
    
    [[ -f "$STATE_DIR/api_domain" ]] && api_domain=$(cat "$STATE_DIR/api_domain")
    [[ -f "$STATE_DIR/app_domain" ]] && app_domain=$(cat "$STATE_DIR/app_domain")
    
    if [[ -z "$api_domain" ]] && [[ -z "$app_domain" ]]; then
        warning "No domains configured. Skipping SSL setup."
        return
    fi
    
    # Ask for email - ALWAYS interactive
    local email=""
    echo -n "Enter email for SSL notifications (or press Enter to skip): "
    if [[ -t 0 ]]; then
        read email
    else
        read email < /dev/tty || true
    fi
    
    local email_arg=""
    if [[ -z "$email" ]]; then
        email_arg="--register-unsafely-without-email"
    else
        email_arg="--email $email"
    fi
    
    # Configure SSL for domains
    if [[ -n "$api_domain" ]]; then
        info "Configuring SSL for $api_domain..."
        certbot --nginx -d "$api_domain" $email_arg --non-interactive --agree-tos --redirect || {
            warning "Failed to configure SSL for $api_domain"
        }
    fi
    
    if [[ -n "$app_domain" ]]; then
        info "Configuring SSL for $app_domain..."
        certbot --nginx -d "$app_domain" $email_arg --non-interactive --agree-tos --redirect || {
            warning "Failed to configure SSL for $app_domain"
        }
    fi
    
    success "SSL configuration complete"
}

uninstall_application() {
    print_header "Uninstalling VaultScope Statistics"
    
    if ! confirm "Are you sure you want to uninstall VaultScope Statistics?"; then
        info "Uninstall cancelled"
        return
    fi
    
    info "Stopping services..."
    systemctl stop vaultscope-statistics-server 2>/dev/null || true
    systemctl stop vaultscope-statistics-client 2>/dev/null || true
    
    info "Disabling services..."
    systemctl disable vaultscope-statistics-server 2>/dev/null || true
    systemctl disable vaultscope-statistics-client 2>/dev/null || true
    
    info "Removing service files..."
    rm -f /etc/systemd/system/vaultscope-statistics-*.service
    systemctl daemon-reload
    
    info "Removing Nginx configuration..."
    rm -f /etc/nginx/sites-enabled/vaultscope-*
    rm -f /etc/nginx/sites-available/vaultscope-*
    
    if confirm "Remove application files?"; then
        rm -rf "$INSTALL_DIR"
    fi
    
    if confirm "Remove configuration files?"; then
        rm -rf "$CONFIG_DIR"
    fi
    
    if confirm "Remove log files?"; then
        rm -rf "$LOG_DIR"
    fi
    
    success "Uninstallation complete"
}

show_summary() {
    print_header "Installation Summary"
    
    echo "✓ VaultScope Statistics Installation Complete!"
    echo ""
    echo "Installation Details:"
    echo "  • Location: $INSTALL_DIR"
    echo "  • Logs: $LOG_DIR"
    echo "  • Config: $CONFIG_DIR"
    echo ""
    
    # Check actual service status
    echo "Service Status:"
    if systemctl is-active --quiet vaultscope-statistics-server; then
        echo "  • Server: ${GREEN}Running${NC} on http://localhost:4000"
    else
        echo "  • Server: ${RED}Not Running${NC}"
    fi
    
    if [[ -f /etc/systemd/system/vaultscope-statistics-client.service ]]; then
        if systemctl is-active --quiet vaultscope-statistics-client; then
            echo "  • Client: ${GREEN}Running${NC} on http://localhost:4001"
        else
            echo "  • Client: ${YELLOW}Not Running${NC}"
        fi
    fi
    
    echo ""
    echo "Useful Commands:"
    echo "  • Check status: systemctl status vaultscope-statistics-server"
    echo "  • View logs: journalctl -u vaultscope-statistics-server -f"
    echo "  • Server logs: tail -f $LOG_DIR/server-error.log"
    echo "  • Restart: systemctl restart vaultscope-statistics-server"
    echo "  • API keys: cd $INSTALL_DIR && npm run apikey"
    echo ""
    
    if [[ -f "$STATE_DIR/api_domain" ]]; then
        local api_domain=$(cat "$STATE_DIR/api_domain")
        [[ -n "$api_domain" ]] && echo "  • API URL: https://$api_domain"
    fi
    
    if [[ -f "$STATE_DIR/app_domain" ]]; then
        local app_domain=$(cat "$STATE_DIR/app_domain")
        [[ -n "$app_domain" ]] && echo "  • App URL: https://$app_domain"
    fi
    
    echo ""
    success "Installation complete!"
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --uninstall|-u)
                UNINSTALL_MODE=true
                shift
                ;;
            --quiet|-q)
                QUIET_MODE=true
                shift
                ;;
            --yes|-y)
                AUTO_YES=true
                shift
                ;;
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --branch|-b)
                BRANCH="$2"
                shift 2
                ;;
            --help|-h)
                cat << EOF
VaultScope Statistics Installer v${INSTALLER_VERSION}

Usage: $0 [OPTIONS]

Options:
  -u, --uninstall     Uninstall VaultScope Statistics
  -q, --quiet         Suppress output (skips Nginx/SSL)
  -y, --yes           Auto-answer yes to installation only
                      (Nginx/SSL prompts still appear)
  --skip-deps         Skip system dependencies
  -b, --branch BRANCH Use specific git branch
  -h, --help          Show this help

Examples:
  $0                  Interactive installation
  $0 --yes            Auto-install with Nginx prompts
  $0 --uninstall      Remove installation
  $0 --branch dev     Install from dev branch

Log file: $LOG_FILE
EOF
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

main() {
    echo "VaultScope Statistics Installer v${INSTALLER_VERSION}" > "$LOG_FILE"
    echo "Started at $(date)" >> "$LOG_FILE"
    
    parse_arguments "$@"
    check_root
    detect_os
    
    if [[ "$UNINSTALL_MODE" == true ]]; then
        uninstall_application
        exit 0
    fi
    
    if [[ "$QUIET_MODE" != true ]]; then
        clear
        print_header "VaultScope Statistics Installer v${INSTALLER_VERSION}"
        
        echo "This installer will:"
        echo "  1. Install system dependencies"
        echo "  2. Install Node.js v${NODE_VERSION}"
        echo "  3. Clone/update the repository"
        echo "  4. Install npm dependencies"
        echo "  5. Build the application"
        echo "  6. Initialize the database"
        echo "  7. Create systemd services"
        echo "  8. Start the services"
        echo "  9. Configure Nginx (optional)"
        echo " 10. Configure SSL (optional)"
        echo ""
        
        if ! confirm "Do you want to proceed with installation?"; then
            info "Installation cancelled"
            exit 0
        fi
    fi
    
    # Core installation
    create_directories
    install_system_packages
    install_nodejs
    clone_repository
    install_dependencies
    build_application
    initialize_database
    create_systemd_service
    start_services
    
    # ALWAYS ask for Nginx/SSL configuration
    if [[ "$QUIET_MODE" != true ]]; then
        echo ""
        echo "========================================" 
        echo "Optional: Nginx & SSL Configuration"
        echo "========================================"
        echo ""
        echo -n "Do you want to configure Nginx reverse proxy? [y/N]: "
        
        local nginx_response=""
        if [[ -t 0 ]]; then
            read -n 1 -r nginx_response
        else
            read -n 1 -r nginx_response < /dev/tty || nginx_response="n"
        fi
        echo ""
        
        if [[ "$nginx_response" =~ ^[Yy]$ ]]; then
            configure_nginx
            
            echo ""
            echo -n "Do you want to configure SSL certificates (Let's Encrypt)? [y/N]: "
            
            local ssl_response=""
            if [[ -t 0 ]]; then
                read -n 1 -r ssl_response
            else
                read -n 1 -r ssl_response < /dev/tty || ssl_response="n"
            fi
            echo ""
            
            if [[ "$ssl_response" =~ ^[Yy]$ ]]; then
                configure_ssl
            fi
        fi
    fi
    
    show_summary
    info "Full installation log: $LOG_FILE"
}

# Entry point
main "$@"