#!/bin/bash

# ============================================================================
# VaultScope Statistics Installer v5.0.0
# Clean, robust, and user-friendly installation script
# ============================================================================

set -euo pipefail  # Exit on error, undefined variables, and pipe failures
IFS=$'\n\t'       # Set secure Internal Field Separator

# ============================================================================
# CONFIGURATION
# ============================================================================
readonly INSTALLER_VERSION="5.2.0"
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

# ============================================================================
# SIMPLE COLOR DEFINITIONS (no complex UI)
# ============================================================================
if [[ -t 1 ]] && [[ "${NO_COLOR:-}" != "true" ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[1;33m'
    readonly BLUE='\033[0;34m'
    readonly BOLD='\033[1m'
    readonly NC='\033[0m'  # No Color
else
    readonly RED=''
    readonly GREEN=''
    readonly YELLOW=''
    readonly BLUE=''
    readonly BOLD=''
    readonly NC=''
fi

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE" 2>/dev/null || true
    
    # Display to user if not quiet
    if [[ "$QUIET_MODE" != true ]]; then
        case "$level" in
            ERROR)   echo -e "${RED}[ERROR]${NC} $message" >&2 ;;
            WARNING) echo -e "${YELLOW}[WARNING]${NC} $message" ;;
            SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
            INFO)    echo -e "${BLUE}[INFO]${NC} $message" ;;
            *)       echo "$message" ;;
        esac
    fi
}

error() { log ERROR "$@"; }
warning() { log WARNING "$@"; }
success() { log SUCCESS "$@"; }
info() { log INFO "$@"; }

# ============================================================================
# ERROR HANDLING
# ============================================================================
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        error "Installation failed with exit code $exit_code"
        error "Check the log file for details: $LOG_FILE"
    fi
}

trap cleanup EXIT

handle_error() {
    local line_no=$1
    local exit_code=$2
    error "An error occurred on line $line_no (exit code: $exit_code)"
    error "Last command: ${BASH_COMMAND}"
    exit $exit_code
}

trap 'handle_error ${LINENO} $?' ERR

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================
print_header() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
}

confirm() {
    if [[ "$AUTO_YES" == true ]]; then
        return 0
    fi
    
    local prompt="${1:-Continue?}"
    local response
    
    while true; do
        read -p "$prompt [y/N]: " -n 1 -r response
        echo
        case "$response" in
            [yY]) return 0 ;;
            [nN]|"") return 1 ;;
            *) echo "Please answer y or n" ;;
        esac
    done
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        info "Try: sudo $0 $*"
        exit 1
    fi
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        OS_NAME=$PRETTY_NAME
    elif [[ -f /etc/debian_version ]]; then
        OS="debian"
        OS_VERSION=$(cat /etc/debian_version)
        OS_NAME="Debian $OS_VERSION"
    elif [[ -f /etc/redhat-release ]]; then
        OS="rhel"
        OS_VERSION=$(rpm -q --qf "%{VERSION}" redhat-release)
        OS_NAME=$(cat /etc/redhat-release)
    else
        OS="unknown"
        OS_VERSION="unknown"
        OS_NAME="Unknown OS"
    fi
    
    info "Detected OS: $OS_NAME"
}

check_command() {
    local cmd="$1"
    if ! command -v "$cmd" &> /dev/null; then
        return 1
    fi
    return 0
}

create_directories() {
    info "Creating required directories..."
    
    local dirs=("$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR" "$BACKUP_DIR" "$STATE_DIR")
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            info "Created directory: $dir"
        else
            info "Directory exists: $dir"
        fi
    done
    
    # Set proper permissions
    chown -R www-data:www-data "$INSTALL_DIR" 2>/dev/null || true
    chown -R www-data:www-data "$LOG_DIR" 2>/dev/null || true
    chmod 755 "$INSTALL_DIR"
    chmod 755 "$LOG_DIR"
}

# ============================================================================
# DEPENDENCY INSTALLATION
# ============================================================================
install_system_packages() {
    if [[ "$SKIP_DEPS" == true ]]; then
        info "Skipping system package installation"
        return 0
    fi
    
    print_header "Installing System Packages"
    
    local packages=("git" "curl" "wget" "build-essential" "python3")
    
    case "$OS" in
        ubuntu|debian)
            info "Updating package lists..."
            apt-get update -qq
            
            info "Installing required packages..."
            apt-get install -y "${packages[@]}" sqlite3
            ;;
            
        fedora|rhel|centos)
            info "Installing required packages..."
            yum install -y git curl wget gcc-c++ make python3 sqlite
            ;;
            
        arch)
            info "Installing required packages..."
            pacman -Sy --noconfirm git curl wget base-devel python sqlite
            ;;
            
        *)
            warning "Unknown OS. Please install the following packages manually:"
            printf '%s\n' "${packages[@]}"
            if ! confirm "Have you installed these packages?"; then
                exit 1
            fi
            ;;
    esac
    
    success "System packages installed"
}

install_nodejs() {
    if [[ "$SKIP_DEPS" == true ]]; then
        info "Skipping Node.js installation"
        return 0
    fi
    
    print_header "Installing Node.js v${NODE_VERSION}"
    
    if check_command node; then
        local current_version=$(node --version | sed 's/v//' | cut -d. -f1)
        if [[ "$current_version" -ge "$NODE_VERSION" ]]; then
            success "Node.js v$current_version is already installed"
            return 0
        else
            warning "Node.js v$current_version is installed but v$NODE_VERSION is required"
        fi
    fi
    
    info "Installing Node.js using NodeSource repository..."
    
    case "$OS" in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
            apt-get install -y nodejs
            ;;
            
        fedora|rhel|centos)
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
            yum install -y nodejs
            ;;
            
        *)
            warning "Please install Node.js v${NODE_VERSION} manually from https://nodejs.org"
            if ! confirm "Have you installed Node.js v${NODE_VERSION}?"; then
                exit 1
            fi
            ;;
    esac
    
    # Verify installation
    if check_command node; then
        local installed_version=$(node --version)
        success "Node.js $installed_version installed successfully"
    else
        error "Failed to install Node.js"
        exit 1
    fi
}

# ============================================================================
# APPLICATION INSTALLATION
# ============================================================================
clone_repository() {
    print_header "Cloning Repository"
    
    # Add directory to Git safe list to prevent ownership issues
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        info "Adding $INSTALL_DIR to Git safe directories..."
        git config --global --add safe.directory "$INSTALL_DIR"
    fi
    
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        info "Repository already exists, pulling latest changes..."
        cd "$INSTALL_DIR"
        git fetch origin
        git checkout "$BRANCH"
        git pull origin "$BRANCH"
    else
        info "Cloning repository from $REPO_URL..."
        if [[ -d "$INSTALL_DIR" ]]; then
            # Backup existing directory if it's not empty
            if [[ "$(ls -A $INSTALL_DIR)" ]]; then
                local backup_name="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S)"
                warning "Directory $INSTALL_DIR exists and is not empty"
                info "Creating backup at $backup_name"
                mv "$INSTALL_DIR" "$backup_name"
                mkdir -p "$INSTALL_DIR"
            fi
        fi
        
        git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
        
        # Add the newly cloned directory to Git safe list
        info "Adding $INSTALL_DIR to Git safe directories..."
        git config --global --add safe.directory "$INSTALL_DIR"
    fi
    
    cd "$INSTALL_DIR"
    success "Repository ready at $INSTALL_DIR"
}

install_dependencies() {
    print_header "Installing Node.js Dependencies"
    
    cd "$INSTALL_DIR"
    
    # Always use npm install to ensure lock file is in sync
    info "Installing server dependencies (this may take a few minutes)..."
    npm install 2>&1 | tee -a "$LOG_FILE" || {
        error "Failed to install server dependencies"
        return 1
    }
    
    # Install ts-node globally for development mode fallback
    info "Installing TypeScript runtime..."
    npm install -g ts-node typescript 2>&1 | tee -a "$LOG_FILE" || {
        warning "Failed to install ts-node globally"
    }
    
    if [[ -d "client" ]]; then
        info "Installing client dependencies..."
        cd client
        npm install 2>&1 | tee -a "$LOG_FILE" || {
            warning "Failed to install client dependencies"
        }
        cd ..
    fi
    
    success "Dependencies installed"
}

build_application() {
    print_header "Building Application"
    
    cd "$INSTALL_DIR"
    
    # Check available memory
    local available_mem=$(free -m | awk 'NR==2{print $7}')
    local node_mem_limit=2048
    
    if [[ $available_mem -lt 1024 ]]; then
        warning "Low memory detected (${available_mem}MB available)"
        node_mem_limit=1024
        info "Setting Node.js memory limit to ${node_mem_limit}MB"
    else
        info "Setting Node.js memory limit to ${node_mem_limit}MB"
    fi
    
    # Export memory limit for Node.js
    export NODE_OPTIONS="--max-old-space-size=${node_mem_limit}"
    
    info "Building server (this may take several minutes)..."
    npm run build 2>&1 | tee -a "$LOG_FILE" || {
        error "Server build failed - trying with development mode"
        warning "Server will run in development mode without compilation"
        touch .skip-build
        return 0
    }
    
    # Try to build client with React 18 fallback
    if [[ -d "client" ]] && [[ -f "client/package.json" ]]; then
        info "Building client interface..."
        cd client
        
        # First try to build as-is
        export NODE_OPTIONS="--max-old-space-size=4096"
        npm run build 2>&1 | tee -a "$LOG_FILE" || {
            warning "Client build failed with React 19, attempting fallback to React 18..."
            
            # Downgrade to React 18 for compatibility
            npm install react@18.3.1 react-dom@18.3.1 @types/react@18.3.3 @types/react-dom@18.3.0 --save 2>&1 | tee -a "$LOG_FILE"
            
            # Try build again
            npm run build 2>&1 | tee -a "$LOG_FILE" || {
                error "Client build failed even with React 18"
                warning "Client interface will not be available"
                warning "You can try building manually: cd $INSTALL_DIR/client && npm run build"
                # Mark client as failed
                touch "$INSTALL_DIR/.client-build-failed"
            }
        }
        cd ..
    fi
    
    success "Build process completed"
}

initialize_database() {
    print_header "Initializing Database"
    
    cd "$INSTALL_DIR"
    
    info "Running database initialization..."
    npm run db:init 2>&1 | tee -a "$LOG_FILE" || {
        warning "Database initialization failed - may already be initialized"
    }
    
    # Save admin key if displayed
    if [[ -f "database.db" ]]; then
        success "Database initialized"
        info "Check the output above for admin API key"
    else
        warning "Database file not found - initialization may have failed"
    fi
}

# ============================================================================
# SERVICE CONFIGURATION
# ============================================================================
create_systemd_service() {
    print_header "Creating Systemd Services"
    
    # Determine if we should run in dev mode (if build failed)
    local exec_command="/usr/bin/node dist/server/index.js"
    local node_env="production"
    
    if [[ -f "$INSTALL_DIR/.skip-build" ]] || [[ ! -f "$INSTALL_DIR/dist/server/index.js" ]]; then
        warning "Running in development mode"
        exec_command="/usr/bin/npx ts-node server/index.ts"
        node_env="development"
        
        # Ensure ts-node is available
        cd "$INSTALL_DIR"
        npm install --save-dev ts-node 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # Server service
    cat > /etc/systemd/system/vaultscope-statistics-server.service << EOF
[Unit]
Description=VaultScope Statistics Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=${node_env}"
Environment="PORT=4000"
Environment="NODE_OPTIONS=--max-old-space-size=1024"
ExecStart=${exec_command}
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/server.log
StandardError=append:$LOG_DIR/server-error.log
LimitNOFILE=65536
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

    # Client service (only if client built successfully)
    if [[ -d "$INSTALL_DIR/client/.next" ]] && [[ ! -f "$INSTALL_DIR/.client-build-failed" ]]; then
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
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/client.log
StandardError=append:$LOG_DIR/client-error.log

[Install]
WantedBy=multi-user.target
EOF
    fi
    
    info "Reloading systemd daemon..."
    systemctl daemon-reload
    
    info "Enabling services..."
    systemctl enable vaultscope-statistics-server
    [[ -f /etc/systemd/system/vaultscope-statistics-client.service ]] && systemctl enable vaultscope-statistics-client
    
    success "Systemd services created and enabled"
}

start_services() {
    print_header "Starting Services"
    
    info "Starting server..."
    systemctl restart vaultscope-statistics-server
    
    # Wait for server to start
    sleep 5
    
    # Check if server is running
    if systemctl is-active --quiet vaultscope-statistics-server; then
        success "Server is running"
        
        # Test API health endpoint
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null | grep -q "200"; then
            success "Server API is responding correctly"
        else
            warning "Server is running but API health check failed"
            info "Checking server logs..."
            journalctl -u vaultscope-statistics-server -n 20 --no-pager
        fi
    else
        error "Server failed to start"
        info "Server logs:"
        journalctl -u vaultscope-statistics-server -n 50 --no-pager
        
        # Try to diagnose common issues
        if journalctl -u vaultscope-statistics-server | grep -q "Cannot find module"; then
            error "Missing dependencies. Try: cd $INSTALL_DIR && npm install"
        elif journalctl -u vaultscope-statistics-server | grep -q "EADDRINUSE"; then
            error "Port 4000 is already in use"
        fi
    fi
    
    if [[ -f /etc/systemd/system/vaultscope-statistics-client.service ]]; then
        info "Starting client..."
        systemctl start vaultscope-statistics-client
    fi
    
    # Wait a moment for services to start
    sleep 3
    
    # Check status
    if systemctl is-active --quiet vaultscope-statistics-server; then
        success "Server is running"
    else
        error "Server failed to start"
        info "Check logs: journalctl -u vaultscope-statistics-server -n 50"
    fi
    
    if [[ -f /etc/systemd/system/vaultscope-statistics-client.service ]]; then
        if systemctl is-active --quiet vaultscope-statistics-client; then
            success "Client is running"
        else
            warning "Client failed to start"
            info "Check logs: journalctl -u vaultscope-statistics-client -n 50"
        fi
    fi
}

# ============================================================================
# NGINX CONFIGURATION
# ============================================================================
configure_nginx() {
    print_header "Configuring Nginx"
    
    # Check if nginx is installed
    if ! check_command nginx; then
        info "Installing Nginx..."
        case "$OS" in
            ubuntu|debian)
                apt-get install -y nginx
                ;;
            fedora|rhel|centos)
                yum install -y nginx
                ;;
            *)
                warning "Please install Nginx manually"
                return 1
                ;;
        esac
    fi
    
    # Ask for domain names
    local api_domain=""
    local app_domain=""
    
    if [[ "$AUTO_YES" != true ]]; then
        echo ""
        read -p "Enter domain for API (e.g., api.example.com) or press Enter to skip: " api_domain
        read -p "Enter domain for Web App (e.g., app.example.com) or press Enter to skip: " app_domain
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
        
        # Timeouts
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
    if [[ -n "$app_domain" ]] && [[ -d "$INSTALL_DIR/client" ]]; then
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
    
    # Test and reload nginx
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        success "Nginx configured and reloaded"
    else
        error "Nginx configuration test failed"
        return 1
    fi
    
    # Store domains for SSL configuration
    echo "$api_domain" > "$STATE_DIR/api_domain"
    echo "$app_domain" > "$STATE_DIR/app_domain"
}

# ============================================================================
# SSL CONFIGURATION
# ============================================================================
configure_ssl() {
    print_header "Configuring SSL Certificates"
    
    # Check if certbot is installed
    if ! check_command certbot; then
        info "Installing Certbot..."
        case "$OS" in
            ubuntu|debian)
                apt-get install -y certbot python3-certbot-nginx
                ;;
            fedora|rhel|centos)
                yum install -y certbot python3-certbot-nginx
                ;;
            *)
                warning "Please install Certbot manually"
                return 1
                ;;
        esac
    fi
    
    # Get domains from state files or ask
    local api_domain=""
    local app_domain=""
    
    if [[ -f "$STATE_DIR/api_domain" ]]; then
        api_domain=$(cat "$STATE_DIR/api_domain")
    fi
    
    if [[ -f "$STATE_DIR/app_domain" ]]; then
        app_domain=$(cat "$STATE_DIR/app_domain")
    fi
    
    if [[ -z "$api_domain" ]] && [[ -z "$app_domain" ]]; then
        warning "No domains configured. Skipping SSL setup."
        info "You can run 'certbot --nginx' later to configure SSL"
        return 0
    fi
    
    # Ask for email
    local email=""
    if [[ "$AUTO_YES" != true ]]; then
        read -p "Enter email for SSL certificate notifications: " email
    fi
    
    if [[ -z "$email" ]]; then
        warning "No email provided. Using --register-unsafely-without-email"
        local email_arg="--register-unsafely-without-email"
    else
        local email_arg="--email $email"
    fi
    
    # Configure SSL for API domain
    if [[ -n "$api_domain" ]]; then
        info "Configuring SSL for $api_domain..."
        certbot --nginx -d "$api_domain" $email_arg --non-interactive --agree-tos --redirect || {
            warning "Failed to configure SSL for $api_domain"
        }
    fi
    
    # Configure SSL for App domain
    if [[ -n "$app_domain" ]]; then
        info "Configuring SSL for $app_domain..."
        certbot --nginx -d "$app_domain" $email_arg --non-interactive --agree-tos --redirect || {
            warning "Failed to configure SSL for $app_domain"
        }
    fi
    
    # Setup auto-renewal
    if [[ -f /etc/systemd/system/snap.certbot.renew.timer ]] || systemctl list-timers | grep -q certbot; then
        success "SSL auto-renewal is already configured"
    else
        info "Setting up SSL auto-renewal..."
        cat > /etc/systemd/system/certbot-renew.service << EOF
[Unit]
Description=Certbot Renewal
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF

        cat > /etc/systemd/system/certbot-renew.timer << EOF
[Unit]
Description=Run certbot twice daily

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF
        
        systemctl daemon-reload
        systemctl enable certbot-renew.timer
        systemctl start certbot-renew.timer
        success "SSL auto-renewal configured"
    fi
}

# ============================================================================
# UNINSTALL FUNCTIONS
# ============================================================================
uninstall_application() {
    print_header "Uninstalling VaultScope Statistics"
    
    if ! confirm "This will remove VaultScope Statistics completely. Are you sure?"; then
        info "Uninstall cancelled"
        exit 0
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
    
    info "Creating backup..."
    local backup_name="$BACKUP_DIR/final_backup_$(date +%Y%m%d_%H%M%S)"
    if [[ -d "$INSTALL_DIR" ]]; then
        cp -r "$INSTALL_DIR" "$backup_name"
        info "Backup created at $backup_name"
    fi
    
    info "Removing installation directory..."
    rm -rf "$INSTALL_DIR"
    
    info "Removing log directory..."
    rm -rf "$LOG_DIR"
    
    success "VaultScope Statistics has been uninstalled"
    info "Configuration and backups are preserved in:"
    info "  - $CONFIG_DIR"
    info "  - $BACKUP_DIR"
}

# ============================================================================
# MAIN INSTALLATION FLOW
# ============================================================================
show_summary() {
    print_header "Installation Summary"
    
    echo -e "${GREEN}✓${NC} VaultScope Statistics has been successfully installed!"
    echo ""
    echo "Installation Details:"
    echo "  • Location: $INSTALL_DIR"
    echo "  • Logs: $LOG_DIR"
    echo "  • Config: $CONFIG_DIR"
    echo ""
    echo "Services:"
    echo "  • Server: http://localhost:4000"
    if [[ -f /etc/systemd/system/vaultscope-statistics-client.service ]]; then
        echo "  • Client: http://localhost:4001"
    fi
    
    # Show configured domains
    if [[ -f "$STATE_DIR/api_domain" ]]; then
        local api_domain=$(cat "$STATE_DIR/api_domain")
        [[ -n "$api_domain" ]] && echo "  • API Domain: https://$api_domain"
    fi
    if [[ -f "$STATE_DIR/app_domain" ]]; then
        local app_domain=$(cat "$STATE_DIR/app_domain")
        [[ -n "$app_domain" ]] && echo "  • App Domain: https://$app_domain"
    fi
    
    echo ""
    echo "Useful Commands:"
    echo "  • Check status: systemctl status vaultscope-statistics-server"
    echo "  • View logs: journalctl -u vaultscope-statistics-server -f"
    echo "  • Restart: systemctl restart vaultscope-statistics-server"
    echo "  • API keys: cd $INSTALL_DIR && npm run apikey list"
    echo "  • SSL renewal: certbot renew"
    echo ""
    echo -e "${YELLOW}⚠${NC} Don't forget to save the admin API key shown above!"
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
  -q, --quiet         Suppress output (log to file only)
  -y, --yes           Automatically answer yes to all prompts
  --skip-deps         Skip system dependency installation
  -b, --branch BRANCH Use specific git branch (default: $DEFAULT_BRANCH)
  -h, --help          Show this help message

Examples:
  $0                  Interactive installation
  $0 --yes            Automatic installation with defaults
  $0 --uninstall      Remove VaultScope Statistics
  $0 --branch dev     Install from dev branch

Log file: $LOG_FILE
EOF
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

main() {
    # Initialize log file
    echo "VaultScope Statistics Installer v${INSTALLER_VERSION}" > "$LOG_FILE"
    echo "Started at $(date)" >> "$LOG_FILE"
    echo "Arguments: $*" >> "$LOG_FILE"
    
    # Parse command line arguments
    parse_arguments "$@"
    
    # Check for root privileges
    check_root "$@"
    
    # Detect operating system
    detect_os
    
    # Handle uninstall mode
    if [[ "$UNINSTALL_MODE" == true ]]; then
        uninstall_application
        exit 0
    fi
    
    # Print welcome message
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
        echo ""
        
        if ! confirm "Do you want to proceed with the installation?"; then
            info "Installation cancelled"
            exit 0
        fi
    fi
    
    # Run installation steps
    create_directories
    install_system_packages
    install_nodejs
    clone_repository
    install_dependencies
    build_application
    initialize_database
    create_systemd_service
    start_services
    
    # Configure Nginx if not in quiet mode
    if [[ "$QUIET_MODE" != true ]]; then
        if confirm "Do you want to configure Nginx reverse proxy?"; then
            configure_nginx
            
            # Configure SSL if Nginx was configured
            if confirm "Do you want to configure SSL certificates (Let's Encrypt)?"; then
                configure_ssl
            fi
        fi
    fi
    
    # Show summary
    show_summary
    
    info "Full installation log available at: $LOG_FILE"
}

# ============================================================================
# ENTRY POINT
# ============================================================================
main "$@"