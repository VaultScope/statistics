#!/bin/bash

# VaultScope Statistics Installer v10.0
# Enhanced UI, selective installation, uninstall support
# Fixes API key path issues and provides better error handling

set +e  # Don't exit on errors - we handle them properly

# Check if uninstall mode
if [[ "$1" == "--uninstall" ]] || [[ "$1" == "-u" ]]; then
    UNINSTALL_MODE=true
else
    UNINSTALL_MODE=false
fi

# ============================================================================
# CONFIGURATION
# ============================================================================
INSTALL_DIR="/var/www/vaultscope-statistics"
CONFIG_DIR="/etc/vaultscope-statistics" 
LOG_DIR="/var/log/vaultscope-statistics"
BACKUP_DIR="/var/backups/vaultscope-statistics"
REPO_URL="https://github.com/vaultscope/statistics.git"
NODE_VERSION="20"
BRANCH="dev"  # Using dev branch for new features

# State tracking
INSTALLER_VERSION="9.0"
INSTALLER_PID=$$
LOG_FILE="/tmp/vaultscope_install_$(date +%Y%m%d_%H%M%S).log"

# ============================================================================
# COLORS AND UI
# ============================================================================
if [ -t 1 ]; then
    # Regular Colors
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    WHITE='\033[1;37m'
    GRAY='\033[0;90m'
    
    # Bold
    BOLD='\033[1m'
    DIM='\033[2m'
    
    # Background
    BG_RED='\033[41m'
    BG_GREEN='\033[42m'
    BG_BLUE='\033[44m'
    
    # Reset
    NC='\033[0m'
    
    # Unicode symbols
    CHECK="✓"
    CROSS="✗"
    ARROW="→"
    DOT="•"
    STAR="★"
else
    RED='' GREEN='' YELLOW='' BLUE='' MAGENTA='' CYAN='' WHITE='' GRAY='' 
    BOLD='' DIM='' BG_RED='' BG_GREEN='' BG_BLUE='' NC=''
    CHECK="[OK]" CROSS="[FAIL]" ARROW="->" DOT="*" STAR="*"
fi

# ============================================================================
# UI FUNCTIONS
# ============================================================================
print_banner() {
    clear
    if [[ "$UNINSTALL_MODE" == true ]]; then
        echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║${NC}                                                                              ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC}  ${BOLD}${WHITE}VaultScope Statistics${NC} - Uninstaller                                       ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC}  ${DIM}Safely Remove All Components${NC}                                               ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC}                                                                              ${CYAN}║${NC}"
        echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║${NC}                                                                              ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC}  ${BOLD}${WHITE}VaultScope Statistics${NC} - Enterprise System Monitoring                      ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC}  ${DIM}Installer v10.0 - Enhanced Edition${NC}                                        ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC}                                                                              ${CYAN}║${NC}"
        echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    fi
    echo ""
}

print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_subsection() {
    echo ""
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}  $(echo "$1" | sed 's/./-/g')${NC}"
}

print_progress() {
    echo -en "${YELLOW}  ⟳${NC} $1... "
}

print_done() {
    echo -e "${GREEN}${CHECK} done${NC}"
}

print_error() {
    echo -e "${RED}${CROSS} failed${NC}"
    echo -e "${RED}  Error: $1${NC}" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}  ⚠ Warning: $1${NC}"
}

print_info() {
    echo -e "${CYAN}  ℹ $1${NC}"
}

print_success() {
    echo -e "${GREEN}  ${CHECK} $1${NC}"
}

print_option() {
    local num=$1
    local text=$2
    local selected=$3
    
    if [ "$selected" = "true" ]; then
        echo -e "  ${GREEN}[${CHECK}]${NC} ${num}. ${text}"
    else
        echo -e "  ${GRAY}[ ]${NC} ${num}. ${text}"
    fi
}

show_spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while ps -p $pid > /dev/null 2>&1; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# ============================================================================
# SYSTEM DETECTION
# ============================================================================
detect_system() {
    print_progress "Detecting operating system"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        OS_NAME=$PRETTY_NAME
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
        OS_VERSION=$(rpm -E %{rhel})
        OS_NAME=$(cat /etc/redhat-release)
    else
        OS=$(uname -s | tr '[:upper:]' '[:lower:]')
        OS_VERSION=$(uname -r)
        OS_NAME="$(uname -s) $(uname -r)"
    fi
    
    # Package manager detection
    if command -v apt-get &>/dev/null; then
        PKG_MANAGER="apt"
    elif command -v yum &>/dev/null; then
        PKG_MANAGER="yum"
    elif command -v dnf &>/dev/null; then
        PKG_MANAGER="dnf"
    elif command -v pacman &>/dev/null; then
        PKG_MANAGER="pacman"
    elif command -v brew &>/dev/null; then
        PKG_MANAGER="brew"
    else
        PKG_MANAGER="unknown"
    fi
    
    # Service manager detection
    if command -v systemctl &>/dev/null; then
        SERVICE_MANAGER="systemd"
    elif command -v service &>/dev/null; then
        SERVICE_MANAGER="sysv"
    else
        SERVICE_MANAGER="none"
    fi
    
    print_done
    print_info "OS: ${BOLD}$OS_NAME${NC}"
    print_info "Package Manager: ${BOLD}$PKG_MANAGER${NC}"
    print_info "Service Manager: ${BOLD}$SERVICE_MANAGER${NC}"
    
    # Check for Ubuntu 24.04 specific requirements
    if [[ "$OS" == "ubuntu" && "$OS_VERSION" == "24.04" ]]; then
        print_info "Ubuntu 24.04 LTS detected - applying specific configurations"
        UBUNTU_2404=true
    else
        UBUNTU_2404=false
    fi
}

# ============================================================================
# INSTALLATION OPTIONS
# ============================================================================
declare -A INSTALL_OPTIONS=(
    ["server"]=true
    ["client"]=true
    ["nginx"]=false
    ["ssl"]=false
    ["cli"]=true
    ["systemd"]=true
    ["apikey"]=true
    ["categories"]=true
)

show_installation_menu() {
    local finished=false
    
    while [ "$finished" = false ]; do
        print_banner
        print_section "Installation Options"
        echo ""
        echo -e "${BOLD}  Select components to install:${NC}"
        echo ""
        
        print_option "1" "API Server (Backend)" "${INSTALL_OPTIONS[server]}"
        print_option "2" "Web Client (Frontend)" "${INSTALL_OPTIONS[client]}"
        print_option "3" "Nginx Reverse Proxy" "${INSTALL_OPTIONS[nginx]}"
        print_option "4" "SSL Certificates (Let's Encrypt)" "${INSTALL_OPTIONS[ssl]}"
        print_option "5" "CLI Tools" "${INSTALL_OPTIONS[cli]}"
        print_option "6" "Systemd Services" "${INSTALL_OPTIONS[systemd]}"
        print_option "7" "Create Initial API Key" "${INSTALL_OPTIONS[apikey]}"
        print_option "8" "Setup Default Categories" "${INSTALL_OPTIONS[categories]}"
        
        echo ""
        echo -e "${GRAY}  ────────────────────────────────────────────${NC}"
        echo -e "  ${BOLD}9${NC}. Select All"
        echo -e "  ${BOLD}0${NC}. Deselect All"
        echo -e "  ${BOLD}P${NC}. Proceed with installation"
        echo -e "  ${BOLD}Q${NC}. Quit installer"
        echo ""
        
        read -p "  Enter your choice: " choice
        
        case $choice in
            1) INSTALL_OPTIONS["server"]=$([ "${INSTALL_OPTIONS[server]}" = true ] && echo false || echo true) ;;
            2) INSTALL_OPTIONS["client"]=$([ "${INSTALL_OPTIONS[client]}" = true ] && echo false || echo true) ;;
            3) INSTALL_OPTIONS["nginx"]=$([ "${INSTALL_OPTIONS[nginx]}" = true ] && echo false || echo true) ;;
            4) INSTALL_OPTIONS["ssl"]=$([ "${INSTALL_OPTIONS[ssl]}" = true ] && echo false || echo true) ;;
            5) INSTALL_OPTIONS["cli"]=$([ "${INSTALL_OPTIONS[cli]}" = true ] && echo false || echo true) ;;
            6) INSTALL_OPTIONS["systemd"]=$([ "${INSTALL_OPTIONS[systemd]}" = true ] && echo false || echo true) ;;
            7) INSTALL_OPTIONS["apikey"]=$([ "${INSTALL_OPTIONS[apikey]}" = true ] && echo false || echo true) ;;
            8) INSTALL_OPTIONS["categories"]=$([ "${INSTALL_OPTIONS[categories]}" = true ] && echo false || echo true) ;;
            9) 
                for key in "${!INSTALL_OPTIONS[@]}"; do
                    INSTALL_OPTIONS[$key]=true
                done
                ;;
            0)
                for key in "${!INSTALL_OPTIONS[@]}"; do
                    INSTALL_OPTIONS[$key]=false
                done
                ;;
            [Pp]) finished=true ;;
            [Qq]) 
                echo ""
                print_info "Installation cancelled"
                exit 0
                ;;
            *) print_warning "Invalid option" ;;
        esac
    done
}

# ============================================================================
# DEPENDENCY INSTALLATION
# ============================================================================
install_dependencies() {
    print_section "Installing System Dependencies"
    
    # Update package manager
    print_progress "Updating package manager"
    case $PKG_MANAGER in
        apt)
            apt-get update &>/dev/null
            ;;
        yum|dnf)
            $PKG_MANAGER makecache &>/dev/null
            ;;
    esac
    print_done
    
    # Install required packages
    local packages="curl wget git build-essential"
    
    for package in $packages; do
        print_progress "Installing $package"
        case $PKG_MANAGER in
            apt)
                apt-get install -y $package &>/dev/null
                ;;
            yum|dnf)
                $PKG_MANAGER install -y $package &>/dev/null
                ;;
        esac
        print_done
    done
}

# ============================================================================
# NODE.JS INSTALLATION
# ============================================================================
install_nodejs() {
    print_section "Installing Node.js"
    
    if command -v node &>/dev/null; then
        local current_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$current_version" -ge "$NODE_VERSION" ]; then
            print_success "Node.js v$current_version already installed"
            return
        fi
    fi
    
    print_progress "Installing Node.js v$NODE_VERSION"
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - &>/dev/null
        apt-get install -y nodejs &>/dev/null
    elif [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash - &>/dev/null
        $PKG_MANAGER install -y nodejs &>/dev/null
    fi
    
    print_done
    print_info "Node.js $(node -v) installed"
}

# ============================================================================
# APPLICATION INSTALLATION
# ============================================================================
install_application() {
    print_section "Installing VaultScope Statistics"
    
    # Create installation directory
    print_progress "Creating installation directory"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    print_done
    
    # Clone repository
    print_progress "Cloning repository (branch: $BRANCH)"
    if [ -d ".git" ]; then
        git fetch origin &>/dev/null
        git checkout $BRANCH &>/dev/null
        git pull origin $BRANCH &>/dev/null
    else
        git clone -b $BRANCH "$REPO_URL" . &>/dev/null 2>&1
    fi
    print_done
    
    # Install dependencies
    if [ "${INSTALL_OPTIONS[server]}" = true ]; then
        print_progress "Installing server dependencies"
        npm install &>/dev/null 2>&1
        print_done
        
        print_progress "Building TypeScript server"
        npm run build &>/dev/null 2>&1
        print_done
    fi
    
    if [ "${INSTALL_OPTIONS[client]}" = true ]; then
        print_progress "Installing client dependencies"
        cd client
        npm install &>/dev/null 2>&1
        print_done
        
        print_progress "Building Next.js client"
        npm run build &>/dev/null 2>&1
        print_done
        cd ..
    fi
    
    # Fix permissions
    print_progress "Setting permissions"
    chown -R www-data:www-data "$INSTALL_DIR" 2>/dev/null || \
    chown -R $(whoami):$(whoami) "$INSTALL_DIR"
    print_done
}

# ============================================================================
# DATABASE SETUP
# ============================================================================
setup_databases() {
    print_section "Setting Up Database"
    
    # Create SQLite database directory if needed
    print_progress "Creating database directory"
    mkdir -p "$INSTALL_DIR"
    print_done
    
    # Generate drizzle migration files first
    print_progress "Generating database migration files"
    cd "$INSTALL_DIR"
    npm run db:generate &>/dev/null 2>&1 || true
    print_done
    
    # Run database migrations and seed default data
    print_progress "Running database migrations and seeding data"
    npm run db:migrate &>/dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_done
        print_success "Database initialized with default data including roles and categories"
    else
        print_warning "Database migration encountered issues - will retry on first start"
    fi
    
    # Set proper permissions for database file
    print_progress "Setting database permissions"
    if [ -f "$INSTALL_DIR/database.db" ]; then
        chmod 660 "$INSTALL_DIR/database.db"
        chown www-data:www-data "$INSTALL_DIR/database.db" 2>/dev/null || \
        chown $(whoami):$(whoami) "$INSTALL_DIR/database.db"
    fi
    print_done
    
    # Setup initial admin API key if requested
    if [ "${INSTALL_OPTIONS[apikey]}" = true ]; then
        setup_initial_apikey
    fi
}

# ============================================================================
# API KEY SETUP
# ============================================================================
setup_initial_apikey() {
    print_progress "Creating initial admin API key"
    
    cd "$INSTALL_DIR"
    
    # Use the existing npm run apikey command to create an admin key
    API_KEY_OUTPUT=$(npm run apikey create "Initial Admin Key" --admin 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_done
        # Extract the API key from the output
        GENERATED_API_KEY=$(echo "$API_KEY_OUTPUT" | grep "Key:" | cut -d' ' -f2)
        print_success "Initial admin API key created successfully"
    else
        print_warning "Could not create initial API key - you can create one manually later with: npm run apikey create \"Admin Key\" --admin"
    fi
}

# ============================================================================
# SYSTEMD SERVICES
# ============================================================================
setup_services() {
    if [ "${INSTALL_OPTIONS[systemd]}" != true ]; then
        return
    fi
    
    print_section "Creating System Services"
    
    # Create log directories
    print_progress "Creating log directories"
    mkdir -p "$LOG_DIR"
    chown -R www-data:www-data "$LOG_DIR" 2>/dev/null || \
    chown -R $(whoami):$(whoami) "$LOG_DIR"
    print_done
    
    # Create server service
    if [ "${INSTALL_OPTIONS[server]}" = true ]; then
        print_progress "Creating server service"
        
        cat > /etc/systemd/system/vaultscope-statistics-server.service << EOF
[Unit]
Description=VaultScope Statistics Server
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStart=/usr/bin/node $INSTALL_DIR/dist/server/index.js
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=30
Restart=always
RestartSec=10
StartLimitInterval=60s
StartLimitBurst=3
StandardOutput=append:$LOG_DIR/server.log
StandardError=append:$LOG_DIR/server-error.log

# Security settings
NoNewPrivileges=false
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$INSTALL_DIR $LOG_DIR
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
        print_done
    fi
    
    # Create client service
    if [ "${INSTALL_OPTIONS[client]}" = true ]; then
        print_progress "Creating client service"
        
        cat > /etc/systemd/system/vaultscope-statistics-client.service << EOF
[Unit]
Description=VaultScope Statistics Client
After=network.target network-online.target vaultscope-statistics-server.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/client
Environment="NODE_ENV=production"
Environment="PORT=4001"
ExecStart=/usr/bin/npx next start -p 4001
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always
RestartSec=10
StartLimitInterval=60s
StartLimitBurst=3
StandardOutput=append:$LOG_DIR/client.log
StandardError=append:$LOG_DIR/client-error.log

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$INSTALL_DIR/client $LOG_DIR
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
        print_done
    fi
    
    # Reload and start services
    print_progress "Starting services"
    systemctl daemon-reload
    
    if [ "${INSTALL_OPTIONS[server]}" = true ]; then
        systemctl enable vaultscope-statistics-server &>/dev/null
        systemctl restart vaultscope-statistics-server
    fi
    
    if [ "${INSTALL_OPTIONS[client]}" = true ]; then
        systemctl enable vaultscope-statistics-client &>/dev/null
        systemctl restart vaultscope-statistics-client
    fi
    
    print_done
}

# ============================================================================
# NGINX CONFIGURATION
# ============================================================================
configure_nginx() {
    if [ "${INSTALL_OPTIONS[nginx]}" != true ]; then
        return
    fi
    
    print_section "Configuring Nginx Reverse Proxy"
    
    # Install nginx if not present
    if ! command -v nginx &>/dev/null; then
        print_progress "Installing Nginx"
        case $PKG_MANAGER in
            apt)
                apt-get install -y nginx &>/dev/null
                ;;
            yum|dnf)
                $PKG_MANAGER install -y nginx &>/dev/null
                ;;
        esac
        print_done
    fi
    
    # Get domain names
    echo ""
    read -p "  Enter your API domain (e.g., api.example.com): " API_DOMAIN
    read -p "  Enter your client domain (e.g., app.example.com): " CLIENT_DOMAIN
    
    # Create nginx configurations
    print_progress "Creating Nginx configurations"
    
    cat > /etc/nginx/sites-available/vaultscope-api << EOF
server {
    listen 80;
    server_name $API_DOMAIN;
    
    location / {
        proxy_pass http://localhost:4000;
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
    
    cat > /etc/nginx/sites-available/vaultscope-client << EOF
server {
    listen 80;
    server_name $CLIENT_DOMAIN;
    
    location / {
        proxy_pass http://localhost:4001;
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
    
    # Enable sites
    ln -sf /etc/nginx/sites-available/vaultscope-api /etc/nginx/sites-enabled/
    ln -sf /etc/nginx/sites-available/vaultscope-client /etc/nginx/sites-enabled/
    
    # Test and reload nginx
    nginx -t &>/dev/null && systemctl reload nginx
    
    print_done
    
    # SSL Configuration
    if [ "${INSTALL_OPTIONS[ssl]}" = true ]; then
        configure_ssl "$API_DOMAIN" "$CLIENT_DOMAIN"
    fi
}

configure_ssl() {
    local API_DOMAIN=$1
    local CLIENT_DOMAIN=$2
    
    print_subsection "SSL Certificate Setup"
    
    # Install certbot if not present
    if ! command -v certbot &>/dev/null; then
        print_progress "Installing Certbot"
        case $PKG_MANAGER in
            apt)
                apt-get install -y certbot python3-certbot-nginx &>/dev/null
                ;;
            yum|dnf)
                $PKG_MANAGER install -y certbot python3-certbot-nginx &>/dev/null
                ;;
        esac
        print_done
    fi
    
    # Get email for SSL
    echo ""
    read -p "  Enter your email for SSL certificates: " SSL_EMAIL
    
    # Obtain certificates
    print_progress "Obtaining SSL certificates"
    certbot --nginx -d "$API_DOMAIN" -d "$CLIENT_DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" &>/dev/null
    print_done
    
    # Setup auto-renewal
    print_progress "Setting up auto-renewal"
    echo "0 0,12 * * * root python3 -c 'import random; import time; time.sleep(random.randint(0,3600))' && certbot renew -q" | tee -a /etc/crontab > /dev/null
    print_done
}

# ============================================================================
# CLI TOOLS
# ============================================================================
create_cli_tool() {
    if [ "${INSTALL_OPTIONS[cli]}" != true ]; then
        return
    fi
    
    print_section "Installing CLI Tools"
    
    print_progress "Creating CLI tool wrapper"
    
    cat > /usr/local/bin/vaultscope-statistics << 'EOF'
#!/bin/bash
# VaultScope Statistics CLI Tool
# This script provides easy access to the statistics CLI commands

INSTALL_DIR="/var/www/vaultscope-statistics"

# Check if installation directory exists
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Error: VaultScope Statistics not found in $INSTALL_DIR"
    exit 1
fi

cd "$INSTALL_DIR"

case "$1" in
    "apikey")
        shift
        npm run apikey "$@"
        ;;
    "speed")
        npm run speed
        ;;
    "sysinfo")
        npm run sysinfo
        ;;
    "server")
        shift
        case "$1" in
            "start"|"")
                systemctl start vaultscope-statistics-server
                ;;
            "stop")
                systemctl stop vaultscope-statistics-server
                ;;
            "restart")
                systemctl restart vaultscope-statistics-server
                ;;
            "status")
                systemctl status vaultscope-statistics-server
                ;;
            "logs")
                journalctl -u vaultscope-statistics-server -f
                ;;
            *)
                echo "Usage: vaultscope-statistics server [start|stop|restart|status|logs]"
                exit 1
                ;;
        esac
        ;;
    "client")
        shift
        case "$1" in
            "start"|"")
                systemctl start vaultscope-statistics-client
                ;;
            "stop")
                systemctl stop vaultscope-statistics-client
                ;;
            "restart")
                systemctl restart vaultscope-statistics-client
                ;;
            "status")
                systemctl status vaultscope-statistics-client
                ;;
            "logs")
                journalctl -u vaultscope-statistics-client -f
                ;;
            *)
                echo "Usage: vaultscope-statistics client [start|stop|restart|status|logs]"
                exit 1
                ;;
        esac
        ;;
    "help"|"--help"|"-h"|"")
        echo "VaultScope Statistics CLI Tool"
        echo "=============================="
        echo ""
        echo "Usage: vaultscope-statistics <command> [options]"
        echo ""
        echo "Commands:"
        echo "  apikey <action>     Manage API keys"
        echo "    create <name>     Create a new API key"
        echo "    list              List all API keys"
        echo "    delete <id>       Delete an API key"
        echo ""
        echo "  speed               Run speed test"
        echo "  sysinfo             Show system information"
        echo ""
        echo "  server <action>     Manage server service"
        echo "    start             Start the server"
        echo "    stop              Stop the server"
        echo "    restart           Restart the server"
        echo "    status            Show server status"
        echo "    logs              View server logs"
        echo ""
        echo "  client <action>     Manage client service"
        echo "    start             Start the client"
        echo "    stop              Stop the client"
        echo "    restart           Restart the client"
        echo "    status            Show client status"
        echo "    logs              View client logs"
        echo ""
        echo "Examples:"
        echo "  vaultscope-statistics apikey create \"My Key\" --admin"
        echo "  vaultscope-statistics server restart"
        echo "  vaultscope-statistics speed"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use 'vaultscope-statistics help' for available commands"
        exit 1
        ;;
esac
EOF
    
    chmod +x /usr/local/bin/vaultscope-statistics
    
    # Create a shorter alias
    ln -sf /usr/local/bin/vaultscope-statistics /usr/local/bin/statistics
    
    print_done
    print_success "CLI tool installed: 'vaultscope-statistics' and 'statistics'"
}

# ============================================================================
# COMPLETION
# ============================================================================
show_completion() {
    print_banner
    print_section "Installation Complete!"
    
    echo ""
    print_success "VaultScope Statistics has been installed successfully!"
    echo ""
    
    if [ "${INSTALL_OPTIONS[server]}" = true ]; then
        print_info "API Server: ${BOLD}http://localhost:4000${NC}"
    fi
    
    if [ "${INSTALL_OPTIONS[client]}" = true ]; then
        print_info "Web Client: ${BOLD}http://localhost:4001${NC}"
    fi
    
    if [ "${INSTALL_OPTIONS[nginx]}" = true ] && [ -n "$API_DOMAIN" ]; then
        print_info "API Domain: ${BOLD}http://$API_DOMAIN${NC}"
        print_info "Client Domain: ${BOLD}http://$CLIENT_DOMAIN${NC}"
    fi
    
    if [ "${INSTALL_OPTIONS[apikey]}" = true ] && [ -n "$GENERATED_API_KEY" ]; then
        echo ""
        echo -e "${BG_GREEN}${WHITE}${BOLD} Initial API Key Generated ${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}API Key:${NC} ${YELLOW}$GENERATED_API_KEY${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}${BOLD}⚠ IMPORTANT: Save this key securely! It won't be shown again.${NC}"
    fi
    
    if [ "${INSTALL_OPTIONS[systemd]}" = true ]; then
        echo ""
        print_subsection "Service Management Commands"
        echo -e "  ${DOT} Start server: ${CYAN}systemctl start vaultscope-statistics-server${NC}"
        echo -e "  ${DOT} Stop server: ${CYAN}systemctl stop vaultscope-statistics-server${NC}"
        echo -e "  ${DOT} View logs: ${CYAN}journalctl -u vaultscope-statistics-server -f${NC}"
        
        if [ "${INSTALL_OPTIONS[client]}" = true ]; then
            echo -e "  ${DOT} Start client: ${CYAN}systemctl start vaultscope-statistics-client${NC}"
            echo -e "  ${DOT} Stop client: ${CYAN}systemctl stop vaultscope-statistics-client${NC}"
            echo -e "  ${DOT} View client logs: ${CYAN}journalctl -u vaultscope-statistics-client -f${NC}"
        fi
    fi
    
    if [ "${INSTALL_OPTIONS[cli]}" = true ]; then
        echo ""
        print_subsection "CLI Commands"
        echo -e "  ${DOT} Create API key: ${CYAN}statistics apikey create \"name\" --admin${NC}"
        echo -e "  ${DOT} List API keys: ${CYAN}statistics apikey list${NC}"
        echo -e "  ${DOT} Delete API key: ${CYAN}statistics apikey delete <uuid|key>${NC}"
        echo -e "  ${DOT} System info: ${CYAN}statistics sysinfo${NC}"
        echo -e "  ${DOT} Speed test: ${CYAN}statistics speed${NC}"
        echo -e "  ${DOT} Server control: ${CYAN}statistics server [start|stop|restart|status|logs]${NC}"
        echo -e "  ${DOT} Client control: ${CYAN}statistics client [start|stop|restart|status|logs]${NC}"
        echo -e "  ${DOT} Show help: ${CYAN}statistics help${NC}"
    fi
    
    echo ""
    print_info "Installation log: ${BOLD}$LOG_FILE${NC}"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ============================================================================
# ERROR HANDLING
# ============================================================================
trap 'handle_error $? $LINENO' ERR

handle_error() {
    local exit_code=$1
    local line_number=$2
    
    echo ""
    print_error "Installation failed at line $line_number (exit code: $exit_code)"
    print_info "Check the log file for details: $LOG_FILE"
    exit $exit_code
}

# ============================================================================
# UNINSTALL FUNCTIONS
# ============================================================================
uninstall_confirm() {
    echo -e "${YELLOW}⚠ WARNING: This will remove VaultScope Statistics and all its data!${NC}"
    echo ""
    echo "The following will be removed:"
    echo "  ${DOT} Application directory: $INSTALL_DIR"
    echo "  ${DOT} Configuration directory: $CONFIG_DIR"
    echo "  ${DOT} Log directory: $LOG_DIR"
    echo "  ${DOT} Backup directory: $BACKUP_DIR"
    echo "  ${DOT} Systemd services"
    echo "  ${DOT} Nginx configurations (if exist)"
    echo "  ${DOT} CLI command symlink"
    echo ""
    
    read -p "Do you want to create a backup before uninstalling? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        uninstall_backup
    fi
    
    echo ""
    read -p "Are you sure you want to uninstall VaultScope Statistics? (yes/no): " -r
    if [[ ! $REPLY == "yes" ]]; then
        print_warning "Uninstallation cancelled."
        exit 0
    fi
}

uninstall_backup() {
    print_progress "Creating backup"
    
    BACKUP_FILE="/tmp/vaultscope-statistics-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    # Create list of files to backup
    FILES_TO_BACKUP=""
    
    if [ -d "$INSTALL_DIR" ]; then
        FILES_TO_BACKUP="$FILES_TO_BACKUP $INSTALL_DIR"
    fi
    
    if [ -d "$CONFIG_DIR" ]; then
        FILES_TO_BACKUP="$FILES_TO_BACKUP $CONFIG_DIR"
    fi
    
    if [ -d "$LOG_DIR" ]; then
        FILES_TO_BACKUP="$FILES_TO_BACKUP $LOG_DIR"
    fi
    
    if [ -n "$FILES_TO_BACKUP" ]; then
        tar -czf "$BACKUP_FILE" $FILES_TO_BACKUP 2>/dev/null || true
        print_success "Backup created: $BACKUP_FILE"
        
        # Also save API keys if database exists
        if [ -f "$INSTALL_DIR/database.db" ]; then
            sqlite3 "$INSTALL_DIR/database.db" "SELECT name, key FROM api_keys;" > /tmp/vaultscope-api-keys-backup.txt 2>/dev/null || true
            if [ -f "/tmp/vaultscope-api-keys-backup.txt" ]; then
                print_success "API keys saved to: /tmp/vaultscope-api-keys-backup.txt"
            fi
        fi
    else
        print_warning "No files found to backup"
    fi
}

uninstall_services() {
    print_subsection "Stopping and removing services"
    
    # Stop server service
    if systemctl list-units --full -all | grep -Fq "vaultscope-statistics-server.service"; then
        print_progress "Stopping server service"
        systemctl stop vaultscope-statistics-server 2>/dev/null || true
        systemctl disable vaultscope-statistics-server 2>/dev/null || true
        print_success "Stopped server service"
    fi
    
    # Stop client service
    if systemctl list-units --full -all | grep -Fq "vaultscope-statistics-client.service"; then
        print_progress "Stopping client service"
        systemctl stop vaultscope-statistics-client 2>/dev/null || true
        systemctl disable vaultscope-statistics-client 2>/dev/null || true
        print_success "Stopped client service"
    fi
    
    # Remove service files
    rm -f /etc/systemd/system/vaultscope-statistics-server.service
    rm -f /etc/systemd/system/vaultscope-statistics-client.service
    
    # Reload systemd
    systemctl daemon-reload
    
    # Kill any remaining node processes
    pkill -f "vaultscope-statistics" 2>/dev/null || true
    
    print_success "Services removed"
}

uninstall_nginx() {
    print_subsection "Removing nginx configurations"
    
    # Remove nginx site configurations
    rm -f /etc/nginx/sites-enabled/vaultscope-statistics-api
    rm -f /etc/nginx/sites-enabled/vaultscope-statistics-client
    rm -f /etc/nginx/sites-available/vaultscope-statistics-api
    rm -f /etc/nginx/sites-available/vaultscope-statistics-client
    
    # Test and reload nginx if it's running
    if systemctl is-active --quiet nginx; then
        nginx -t 2>/dev/null && systemctl reload nginx
        print_success "Removed nginx configurations"
    fi
}

uninstall_files() {
    print_subsection "Removing application files"
    
    # Remove installation directory
    if [ -d "$INSTALL_DIR" ]; then
        print_progress "Removing $INSTALL_DIR"
        rm -rf "$INSTALL_DIR"
        print_success "Removed application directory"
    fi
    
    # Remove configuration directory
    if [ -d "$CONFIG_DIR" ]; then
        rm -rf "$CONFIG_DIR"
        print_success "Removed configuration directory"
    fi
    
    # Remove log directory
    if [ -d "$LOG_DIR" ]; then
        rm -rf "$LOG_DIR"
        print_success "Removed log directory"
    fi
    
    # Remove backup directory
    if [ -d "$BACKUP_DIR" ]; then
        rm -rf "$BACKUP_DIR"
        print_success "Removed backup directory"
    fi
    
    # Remove CLI symlink
    if [ -L "/usr/local/bin/statistics" ]; then
        rm -f "/usr/local/bin/statistics"
        print_success "Removed CLI command"
    fi
}

uninstall_complete() {
    print_section "Uninstallation Complete!"
    
    echo -e "${GREEN}VaultScope Statistics has been removed from your system.${NC}"
    
    if [ -f "$BACKUP_FILE" ]; then
        echo -e "${YELLOW}Backup saved at: $BACKUP_FILE${NC}"
    fi
    
    if [ -f "/tmp/vaultscope-api-keys-backup.txt" ]; then
        echo -e "${YELLOW}API keys backup: /tmp/vaultscope-api-keys-backup.txt${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Thank you for using VaultScope Statistics!${NC}"
    exit 0
}

perform_uninstall() {
    print_banner
    print_section "Uninstallation Process"
    
    uninstall_confirm
    uninstall_services
    uninstall_nginx
    uninstall_files
    
    # Clean npm cache
    npm cache clean --force 2>/dev/null || true
    
    uninstall_complete
}

# ============================================================================
# MAIN INSTALLATION FLOW
# ============================================================================
main() {
    # Initial setup
    exec 2> >(tee -a "$LOG_FILE" >&2)
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        echo "This installer must be run as root"
        exit 1
    fi
    
    # Check if uninstall mode
    if [[ "$UNINSTALL_MODE" == true ]]; then
        perform_uninstall
        exit 0
    fi
    
    # Show banner
    print_banner
    
    # Detect system
    detect_system
    
    # Show installation menu
    show_installation_menu
    
    # Confirm installation
    print_banner
    print_section "Installation Summary"
    echo ""
    echo -e "${BOLD}  Components to install:${NC}"
    for key in "${!INSTALL_OPTIONS[@]}"; do
        if [ "${INSTALL_OPTIONS[$key]}" = true ]; then
            echo -e "    ${GREEN}${CHECK}${NC} $key"
        fi
    done
    echo ""
    read -p "  Proceed with installation? (y/n): " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled"
        exit 0
    fi
    
    # Run installation
    install_dependencies
    install_nodejs
    install_application
    setup_databases  # This sets up SQLite database with all required tables
    
    setup_services
    configure_nginx
    create_cli_tool
    
    # Show completion
    show_completion
}

# ============================================================================
# RUN INSTALLER
# ============================================================================
main "$@"