#!/bin/bash

# Statistics Software Installer Script v2.0
# Professional installer with proper functionality and error handling
# Supports: macOS, Linux (Debian/Ubuntu, Arch, RHEL-based, Alpine)

set -e
trap 'handle_error $? $LINENO' ERR

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'

# Installation configuration
INSTALL_DIR="/var/www/vaultscope-statistics"
CONFIG_DIR="/etc/vaultscope-statistics"
LOG_FILE="/var/log/statistics_install_$(date +%Y%m%d_%H%M%S).log"
BACKUP_DIR="/var/backups/vaultscope-statistics"
REPO_URL="https://github.com/vaultscope/statistics.git"
NVM_VERSION="v0.39.7"
NODE_VERSION="20"

# User configuration
INSTALL_CLIENT=false
INSTALL_SERVER=false
INSTALL_CLI=false
INSTALL_REVERSE_PROXY=""
USE_SSL=false
API_DOMAIN=""
CLIENT_DOMAIN=""
SSL_EMAIL=""
EXISTING_INSTALL=false
UPGRADE_MODE=false

# System detection
OS=""
PKG_MANAGER=""
SERVICE_MANAGER=""
ARCH=$(uname -m)

# Function to handle errors
handle_error() {
    local exit_code=$1
    local line_number=$2
    print_error "Installation failed at line $line_number with exit code $exit_code"
    print_error "Check the log file for details: $LOG_FILE"
    exit $exit_code
}

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

# Print functions with better formatting
print_header() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}${WHITE}${BOLD}         VaultScope Statistics Software Installer v2.0            ${NC}${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}${BOLD}  $1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $*"
    log "SUCCESS: $*"
}

print_error() {
    echo -e "${RED}✗${NC} $*"
    log "ERROR: $*"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $*"
    log "WARNING: $*"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $*"
    log "INFO: $*"
}

print_progress() {
    echo -ne "${CYAN}⟳${NC} $*..."
    log "PROGRESS: $*"
}

print_done() {
    echo -e " ${GREEN}done${NC}"
}

# Spinner function for long operations
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Check root privileges
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This installer must be run with root privileges"
        echo ""
        echo "Please run: sudo bash installer.sh"
        exit 1
    fi
}

# Detect operating system
detect_os() {
    print_progress "Detecting operating system"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PKG_MANAGER="brew"
        SERVICE_MANAGER="launchd"
    elif [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            debian|ubuntu|raspbian)
                OS="debian"
                PKG_MANAGER="apt"
                SERVICE_MANAGER="systemd"
                ;;
            arch|manjaro)
                OS="arch"
                PKG_MANAGER="pacman"
                SERVICE_MANAGER="systemd"
                ;;
            fedora)
                OS="fedora"
                PKG_MANAGER="dnf"
                SERVICE_MANAGER="systemd"
                ;;
            centos|rhel|rocky|almalinux)
                OS="rhel"
                PKG_MANAGER="yum"
                SERVICE_MANAGER="systemd"
                ;;
            alpine)
                OS="alpine"
                PKG_MANAGER="apk"
                SERVICE_MANAGER="openrc"
                ;;
            *)
                print_error "Unsupported Linux distribution: $ID"
                exit 1
                ;;
        esac
    else
        print_error "Unable to detect operating system"
        exit 1
    fi
    
    print_done
    print_info "Detected: $OS ($ARCH) | Package Manager: $PKG_MANAGER | Service Manager: $SERVICE_MANAGER"
}

# Check for existing installation
check_existing_installation() {
    print_progress "Checking for existing installation"
    
    if [ -d "$INSTALL_DIR" ] || [ -f /usr/local/bin/statistics ] || \
       [ -f /etc/systemd/system/statistics-server.service ] || \
       [ -f /etc/systemd/system/statistics-client.service ]; then
        EXISTING_INSTALL=true
        print_done
        print_warning "Existing installation detected"
        
        echo ""
        echo -e "${YELLOW}An existing installation was found. What would you like to do?${NC}"
        echo ""
        echo "  1) Upgrade existing installation"
        echo "  2) Remove and reinstall fresh"
        echo "  3) Cancel installation"
        echo ""
        read -p "$(echo -e ${CYAN}"Enter your choice [1-3]: "${NC})" upgrade_choice
        
        case $upgrade_choice in
            1)
                UPGRADE_MODE=true
                backup_existing_installation
                ;;
            2)
                print_info "Removing existing installation..."
                remove_existing_installation
                ;;
            3)
                print_info "Installation cancelled"
                exit 0
                ;;
            *)
                print_error "Invalid choice"
                exit 1
                ;;
        esac
    else
        print_done
        print_success "No existing installation found"
    fi
}

# Backup existing installation
backup_existing_installation() {
    print_progress "Creating backup of existing installation"
    
    mkdir -p "$BACKUP_DIR"
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    
    if [ -d "$INSTALL_DIR" ]; then
        cp -r "$INSTALL_DIR" "$BACKUP_DIR/$backup_name" 2>/dev/null || true
    fi
    
    print_done
    print_success "Backup created at $BACKUP_DIR/$backup_name"
}

# Remove existing installation
remove_existing_installation() {
    # Stop services
    systemctl stop statistics-server 2>/dev/null || true
    systemctl stop statistics-client 2>/dev/null || true
    systemctl disable statistics-server 2>/dev/null || true
    systemctl disable statistics-client 2>/dev/null || true
    
    # Remove service files
    rm -f /etc/systemd/system/statistics-*.service
    
    # Remove installation directory
    rm -rf "$INSTALL_DIR"
    
    # Remove CLI tool
    rm -f /usr/local/bin/statistics
    
    # Remove configs
    rm -rf "$CONFIG_DIR"
    
    print_success "Existing installation removed"
}

# Update package manager
update_package_manager() {
    print_progress "Updating package manager"
    
    case $PKG_MANAGER in
        apt)
            apt-get update -qq > /dev/null 2>&1
            ;;
        pacman)
            pacman -Sy --noconfirm > /dev/null 2>&1
            ;;
        yum)
            yum makecache -q > /dev/null 2>&1
            ;;
        dnf)
            dnf makecache -q > /dev/null 2>&1
            ;;
        apk)
            apk update > /dev/null 2>&1
            ;;
        brew)
            brew update > /dev/null 2>&1
            ;;
    esac
    
    print_done
}

# Install package
install_package() {
    local package=$1
    local package_name=${2:-$package}
    
    print_progress "Installing $package_name"
    
    case $PKG_MANAGER in
        apt)
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$package" > /dev/null 2>&1
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
        brew)
            brew install "$package" > /dev/null 2>&1
            ;;
    esac
    
    print_done
}

# Install dependencies
install_dependencies() {
    print_section "Installing System Dependencies"
    
    local deps=""
    
    case $OS in
        debian)
            deps="curl wget git build-essential python3 python3-pip ca-certificates gnupg lsb-release"
            ;;
        arch)
            deps="curl wget git base-devel python python-pip"
            ;;
        rhel|fedora)
            deps="curl wget git gcc gcc-c++ make python3 python3-pip"
            ;;
        alpine)
            deps="curl wget git build-base python3 py3-pip"
            ;;
        macos)
            deps="curl wget git python3"
            ;;
    esac
    
    for dep in $deps; do
        install_package "$dep"
    done
    
    print_success "All system dependencies installed"
}

# Install NVM and Node.js
install_nvm_node() {
    print_section "Installing Node.js Environment"
    
    local NVM_DIR="/opt/nvm"
    
    if [ ! -d "$NVM_DIR" ]; then
        print_progress "Installing NVM"
        export NVM_DIR="$NVM_DIR"
        curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" 2>/dev/null | bash > /dev/null 2>&1
        print_done
    else
        print_info "NVM already installed"
    fi
    
    # Load NVM
    export NVM_DIR="$NVM_DIR"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    print_progress "Installing Node.js v$NODE_VERSION"
    nvm install "$NODE_VERSION" > /dev/null 2>&1
    nvm use "$NODE_VERSION" > /dev/null 2>&1
    nvm alias default "$NODE_VERSION" > /dev/null 2>&1
    print_done
    
    print_success "Node.js $(node --version) installed"
    print_success "NPM $(npm --version) installed"
}

# Component selection menu
show_component_menu() {
    print_section "Component Selection"
    
    echo -e "${WHITE}Select components to install:${NC}"
    echo ""
    echo "  1) Server (API) only"
    echo "  2) Client (Frontend) only"
    echo "  3) Both Server and Client ${GREEN}[Recommended]${NC}"
    echo ""
    
    read -p "$(echo -e ${CYAN}"Enter your choice [1-3]: "${NC})" component_choice
    
    case $component_choice in
        1)
            INSTALL_SERVER=true
            print_success "Server component selected"
            ;;
        2)
            INSTALL_CLIENT=true
            print_success "Client component selected"
            ;;
        3)
            INSTALL_SERVER=true
            INSTALL_CLIENT=true
            print_success "Both components selected"
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    echo ""
    read -p "$(echo -e ${CYAN}"Install CLI management tool? [Y/n]: "${NC})" install_cli
    install_cli=${install_cli:-Y}
    
    if [[ $install_cli =~ ^[Yy]$ ]]; then
        INSTALL_CLI=true
        print_success "CLI tool will be installed"
    fi
}

# Reverse proxy selection
show_proxy_menu() {
    print_section "Reverse Proxy Configuration"
    
    echo -e "${WHITE}Select reverse proxy:${NC}"
    echo ""
    echo "  1) Nginx ${GREEN}[Recommended]${NC}"
    echo "  2) Apache"
    echo "  3) Cloudflare Tunnel (cloudflared)"
    echo "  4) None (direct access only)"
    echo ""
    
    read -p "$(echo -e ${CYAN}"Enter your choice [1-4]: "${NC})" proxy_choice
    
    case $proxy_choice in
        1)
            INSTALL_REVERSE_PROXY="nginx"
            print_success "Nginx selected"
            ;;
        2)
            INSTALL_REVERSE_PROXY="apache"
            print_success "Apache selected"
            ;;
        3)
            INSTALL_REVERSE_PROXY="cloudflared"
            print_success "Cloudflare Tunnel selected"
            ;;
        4)
            INSTALL_REVERSE_PROXY=""
            print_info "No reverse proxy selected"
            return
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    # Get domain configuration
    echo ""
    echo -e "${WHITE}Domain Configuration:${NC}"
    echo ""
    
    if [ "$INSTALL_SERVER" = true ]; then
        read -p "$(echo -e ${CYAN}"Enter domain for API/Server (e.g., api.example.com): "${NC})" API_DOMAIN
        while [ -z "$API_DOMAIN" ]; do
            print_warning "Domain cannot be empty"
            read -p "$(echo -e ${CYAN}"Enter domain for API/Server: "${NC})" API_DOMAIN
        done
    fi
    
    if [ "$INSTALL_CLIENT" = true ]; then
        read -p "$(echo -e ${CYAN}"Enter domain for Client/Frontend (e.g., app.example.com): "${NC})" CLIENT_DOMAIN
        while [ -z "$CLIENT_DOMAIN" ]; do
            print_warning "Domain cannot be empty"
            read -p "$(echo -e ${CYAN}"Enter domain for Client/Frontend: "${NC})" CLIENT_DOMAIN
        done
    fi
    
    # SSL configuration for Nginx/Apache
    if [ "$INSTALL_REVERSE_PROXY" == "nginx" ] || [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
        echo ""
        read -p "$(echo -e ${CYAN}"Configure SSL with Let's Encrypt? [Y/n]: "${NC})" use_ssl
        use_ssl=${use_ssl:-Y}
        
        if [[ $use_ssl =~ ^[Yy]$ ]]; then
            USE_SSL=true
            read -p "$(echo -e ${CYAN}"Enter email for SSL certificates: "${NC})" SSL_EMAIL
            while [ -z "$SSL_EMAIL" ]; do
                print_warning "Email cannot be empty for SSL setup"
                read -p "$(echo -e ${CYAN}"Enter email for SSL certificates: "${NC})" SSL_EMAIL
            done
            print_success "SSL will be configured"
        fi
    fi
}

# Clone and setup repository
setup_repository() {
    print_section "Setting Up Application"
    
    # Create directories
    print_progress "Creating installation directories"
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "/var/log/vaultscope-statistics"
    print_done
    
    # Clone repository
    print_progress "Cloning repository from GitHub"
    if [ -d "$INSTALL_DIR/.git" ]; then
        cd "$INSTALL_DIR"
        git pull origin main > /dev/null 2>&1
    else
        git clone "$REPO_URL" "$INSTALL_DIR" > /dev/null 2>&1
    fi
    print_done
    
    cd "$INSTALL_DIR"
    
    # Install Node dependencies
    print_progress "Installing Node.js dependencies"
    export NVM_DIR="/opt/nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    npm install --production --silent > /dev/null 2>&1 &
    spinner $!
    print_done
    
    # Build TypeScript
    if [ -f "tsconfig.json" ]; then
        print_progress "Building TypeScript files"
        npm run build > /dev/null 2>&1 &
        spinner $!
        print_done
    fi
    
    # Build client if needed
    if [ "$INSTALL_CLIENT" = true ] && [ -d "client" ]; then
        print_progress "Building client application"
        npm run client:build > /dev/null 2>&1 &
        spinner $!
        print_done
    fi
    
    # Copy uninstaller
    if [ -f "$INSTALL_DIR/uninstaller.sh" ]; then
        cp "$INSTALL_DIR/uninstaller.sh" /usr/local/bin/statistics-uninstall
        chmod +x /usr/local/bin/statistics-uninstall
        print_success "Uninstaller available at: statistics-uninstall"
    fi
    
    print_success "Application setup complete"
}

# Install CLI tool
install_cli_tool() {
    if [ "$INSTALL_CLI" != true ]; then
        return
    fi
    
    print_section "Installing CLI Tool"
    
    cat > /usr/local/bin/statistics << 'EOF'
#!/bin/bash
export NVM_DIR="/opt/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /var/www/vaultscope-statistics
node cli.js "$@"
EOF
    
    chmod +x /usr/local/bin/statistics
    print_success "CLI tool installed as 'statistics'"
}

# Configure Nginx
configure_nginx() {
    print_section "Configuring Nginx"
    
    install_package nginx
    
    # Configure API/Server
    if [ "$INSTALL_SERVER" = true ] && [ -n "$API_DOMAIN" ]; then
        cat > /etc/nginx/sites-available/statistics-api << EOF
server {
    listen 80;
    server_name $API_DOMAIN;
    
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    access_log /var/log/nginx/statistics-api.access.log;
    error_log /var/log/nginx/statistics-api.error.log;
}
EOF
        ln -sf /etc/nginx/sites-available/statistics-api /etc/nginx/sites-enabled/
        print_success "Nginx configured for API at $API_DOMAIN"
    fi
    
    # Configure Client/Frontend
    if [ "$INSTALL_CLIENT" = true ] && [ -n "$CLIENT_DOMAIN" ]; then
        cat > /etc/nginx/sites-available/statistics-client << EOF
server {
    listen 80;
    server_name $CLIENT_DOMAIN;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    access_log /var/log/nginx/statistics-client.access.log;
    error_log /var/log/nginx/statistics-client.error.log;
}
EOF
        ln -sf /etc/nginx/sites-available/statistics-client /etc/nginx/sites-enabled/
        print_success "Nginx configured for Client at $CLIENT_DOMAIN"
    fi
    
    # Test and reload
    nginx -t > /dev/null 2>&1
    systemctl reload nginx
    systemctl enable nginx > /dev/null 2>&1
}

# Configure Apache
configure_apache() {
    print_section "Configuring Apache"
    
    if [ "$OS" == "debian" ]; then
        install_package apache2
        a2enmod proxy proxy_http headers > /dev/null 2>&1
        APACHE_SITES="/etc/apache2/sites-available"
        APACHE_SERVICE="apache2"
    else
        install_package httpd
        APACHE_SITES="/etc/httpd/conf.d"
        APACHE_SERVICE="httpd"
    fi
    
    # Configure API/Server
    if [ "$INSTALL_SERVER" = true ] && [ -n "$API_DOMAIN" ]; then
        cat > "$APACHE_SITES/statistics-api.conf" << EOF
<VirtualHost *:80>
    ServerName $API_DOMAIN
    
    ProxyRequests Off
    ProxyPreserveHost On
    
    ProxyPass / http://127.0.0.1:4000/
    ProxyPassReverse / http://127.0.0.1:4000/
    
    ErrorLog /var/log/apache2/statistics-api.error.log
    CustomLog /var/log/apache2/statistics-api.access.log combined
</VirtualHost>
EOF
        if [ "$OS" == "debian" ]; then
            a2ensite statistics-api > /dev/null 2>&1
        fi
        print_success "Apache configured for API at $API_DOMAIN"
    fi
    
    # Configure Client/Frontend
    if [ "$INSTALL_CLIENT" = true ] && [ -n "$CLIENT_DOMAIN" ]; then
        cat > "$APACHE_SITES/statistics-client.conf" << EOF
<VirtualHost *:80>
    ServerName $CLIENT_DOMAIN
    
    ProxyRequests Off
    ProxyPreserveHost On
    
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    
    ErrorLog /var/log/apache2/statistics-client.error.log
    CustomLog /var/log/apache2/statistics-client.access.log combined
</VirtualHost>
EOF
        if [ "$OS" == "debian" ]; then
            a2ensite statistics-client > /dev/null 2>&1
        fi
        print_success "Apache configured for Client at $CLIENT_DOMAIN"
    fi
    
    systemctl reload $APACHE_SERVICE
    systemctl enable $APACHE_SERVICE > /dev/null 2>&1
}

# Configure Cloudflared
configure_cloudflared() {
    print_section "Configuring Cloudflare Tunnel"
    
    # Install cloudflared
    print_progress "Installing cloudflared"
    
    if [ "$OS" == "debian" ]; then
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb > /dev/null 2>&1
        dpkg -i /tmp/cloudflared.deb > /dev/null 2>&1
        rm /tmp/cloudflared.deb
    elif [ "$OS" == "arch" ]; then
        install_package cloudflared
    else
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared > /dev/null 2>&1
        chmod +x /usr/local/bin/cloudflared
    fi
    
    print_done
    
    # Create config directory
    mkdir -p /etc/cloudflared
    
    print_warning "Cloudflare Tunnel requires manual configuration:"
    echo ""
    echo "  1. Run: cloudflared tunnel login"
    echo "  2. Run: cloudflared tunnel create statistics"
    echo "  3. Configure your tunnel with the domains:"
    if [ "$INSTALL_SERVER" = true ]; then
        echo "     - API: $API_DOMAIN → http://localhost:4000"
    fi
    if [ "$INSTALL_CLIENT" = true ]; then
        echo "     - Client: $CLIENT_DOMAIN → http://localhost:3000"
    fi
    echo ""
}

# Configure SSL
configure_ssl() {
    if [ "$USE_SSL" != true ]; then
        return
    fi
    
    print_section "Configuring SSL Certificates"
    
    # Install certbot
    print_progress "Installing Certbot"
    
    if [ "$OS" == "debian" ]; then
        install_package certbot
        if [ "$INSTALL_REVERSE_PROXY" == "nginx" ]; then
            install_package python3-certbot-nginx "Certbot Nginx plugin"
        elif [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
            install_package python3-certbot-apache "Certbot Apache plugin"
        fi
    elif [ "$OS" == "arch" ]; then
        install_package certbot
        if [ "$INSTALL_REVERSE_PROXY" == "nginx" ]; then
            install_package certbot-nginx "Certbot Nginx plugin"
        elif [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
            install_package certbot-apache "Certbot Apache plugin"
        fi
    fi
    
    print_done
    
    # Obtain certificates
    local domains=""
    
    if [ "$INSTALL_SERVER" = true ] && [ -n "$API_DOMAIN" ]; then
        print_progress "Obtaining SSL certificate for $API_DOMAIN"
        if [ "$INSTALL_REVERSE_PROXY" == "nginx" ]; then
            certbot --nginx -d "$API_DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" > /dev/null 2>&1
        elif [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
            certbot --apache -d "$API_DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" > /dev/null 2>&1
        fi
        print_done
    fi
    
    if [ "$INSTALL_CLIENT" = true ] && [ -n "$CLIENT_DOMAIN" ]; then
        print_progress "Obtaining SSL certificate for $CLIENT_DOMAIN"
        if [ "$INSTALL_REVERSE_PROXY" == "nginx" ]; then
            certbot --nginx -d "$CLIENT_DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" > /dev/null 2>&1
        elif [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
            certbot --apache -d "$CLIENT_DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" > /dev/null 2>&1
        fi
        print_done
    fi
    
    # Setup auto-renewal
    print_progress "Setting up auto-renewal"
    
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
    
    print_done
    print_success "SSL certificates configured with auto-renewal"
}

# Create systemd services
create_systemd_services() {
    print_section "Creating System Services"
    
    # Server service
    if [ "$INSTALL_SERVER" = true ]; then
        cat > /etc/systemd/system/statistics-server.service << EOF
[Unit]
Description=VaultScope Statistics API Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="NVM_DIR=/opt/nvm"
ExecStart=/opt/nvm/versions/node/v$NODE_VERSION.*/bin/node $INSTALL_DIR/dist/server/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/vaultscope-statistics/server.log
StandardError=append:/var/log/vaultscope-statistics/server-error.log

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl enable statistics-server > /dev/null 2>&1
        systemctl start statistics-server
        
        print_success "Server service created and started"
    fi
    
    # Client service
    if [ "$INSTALL_CLIENT" = true ]; then
        cat > /etc/systemd/system/statistics-client.service << EOF
[Unit]
Description=VaultScope Statistics Client Frontend
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="NVM_DIR=/opt/nvm"
ExecStart=/opt/nvm/versions/node/v$NODE_VERSION.*/bin/node $INSTALL_DIR/dist/client/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/vaultscope-statistics/client.log
StandardError=append:/var/log/vaultscope-statistics/client-error.log

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl enable statistics-client > /dev/null 2>&1
        systemctl start statistics-client
        
        print_success "Client service created and started"
    fi
    
    # Set permissions
    chown -R www-data:www-data "$INSTALL_DIR"
    chown -R www-data:www-data "/var/log/vaultscope-statistics"
}

# Verify installation
verify_installation() {
    print_section "Verifying Installation"
    
    local all_good=true
    
    # Check services
    if [ "$INSTALL_SERVER" = true ]; then
        if systemctl is-active --quiet statistics-server; then
            print_success "Server service is running"
        else
            print_error "Server service is not running"
            all_good=false
        fi
    fi
    
    if [ "$INSTALL_CLIENT" = true ]; then
        if systemctl is-active --quiet statistics-client; then
            print_success "Client service is running"
        else
            print_error "Client service is not running"
            all_good=false
        fi
    fi
    
    # Check CLI
    if [ "$INSTALL_CLI" = true ]; then
        if [ -x /usr/local/bin/statistics ]; then
            print_success "CLI tool is installed"
        else
            print_error "CLI tool is not installed"
            all_good=false
        fi
    fi
    
    # Check reverse proxy
    if [ "$INSTALL_REVERSE_PROXY" == "nginx" ]; then
        if systemctl is-active --quiet nginx; then
            print_success "Nginx is running"
        else
            print_error "Nginx is not running"
            all_good=false
        fi
    elif [ "$INSTALL_REVERSE_PROXY" == "apache" ]; then
        if systemctl is-active --quiet apache2 || systemctl is-active --quiet httpd; then
            print_success "Apache is running"
        else
            print_error "Apache is not running"
            all_good=false
        fi
    fi
    
    if [ "$all_good" = true ]; then
        print_success "All components verified successfully"
    else
        print_warning "Some components need attention"
    fi
}

# Display completion summary
display_summary() {
    print_header
    print_section "Installation Complete!"
    
    echo -e "${GREEN}✓ VaultScope Statistics has been successfully installed!${NC}"
    echo ""
    echo -e "${WHITE}${BOLD}Access Information:${NC}"
    echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$INSTALL_SERVER" = true ]; then
        if [ -n "$API_DOMAIN" ]; then
            if [ "$USE_SSL" = true ]; then
                echo -e "${CYAN}API Server:${NC} https://$API_DOMAIN"
            else
                echo -e "${CYAN}API Server:${NC} http://$API_DOMAIN"
            fi
        else
            echo -e "${CYAN}API Server:${NC} http://localhost:4000"
        fi
    fi
    
    if [ "$INSTALL_CLIENT" = true ]; then
        if [ -n "$CLIENT_DOMAIN" ]; then
            if [ "$USE_SSL" = true ]; then
                echo -e "${CYAN}Client App:${NC} https://$CLIENT_DOMAIN"
            else
                echo -e "${CYAN}Client App:${NC} http://$CLIENT_DOMAIN"
            fi
        else
            echo -e "${CYAN}Client App:${NC} http://localhost:3000"
        fi
    fi
    
    echo ""
    echo -e "${WHITE}${BOLD}Management Commands:${NC}"
    echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$INSTALL_CLI" = true ]; then
        echo -e "${CYAN}CLI Tool:${NC} statistics"
    fi
    
    if [ "$INSTALL_SERVER" = true ]; then
        echo -e "${CYAN}Server:${NC} systemctl [start|stop|restart|status] statistics-server"
    fi
    
    if [ "$INSTALL_CLIENT" = true ]; then
        echo -e "${CYAN}Client:${NC} systemctl [start|stop|restart|status] statistics-client"
    fi
    
    echo -e "${CYAN}Uninstall:${NC} statistics-uninstall"
    
    echo ""
    echo -e "${WHITE}${BOLD}Important Locations:${NC}"
    echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Installation:${NC} $INSTALL_DIR"
    echo -e "${CYAN}Configuration:${NC} $CONFIG_DIR"
    echo -e "${CYAN}Logs:${NC} /var/log/vaultscope-statistics/"
    echo -e "${CYAN}Install Log:${NC} $LOG_FILE"
    
    if [ "$INSTALL_REVERSE_PROXY" == "cloudflared" ]; then
        echo ""
        echo -e "${YELLOW}⚠ Cloudflare Tunnel requires manual configuration${NC}"
        echo "  Please follow the instructions provided earlier"
    fi
    
    echo ""
    echo -e "${GREEN}Thank you for installing VaultScope Statistics!${NC}"
    echo ""
}

# Main installation process
main() {
    # Initialize log
    mkdir -p $(dirname "$LOG_FILE")
    touch "$LOG_FILE"
    log "Installation started"
    
    # Display header
    print_header
    
    # Pre-installation checks
    check_root
    detect_os
    check_existing_installation
    
    # Get user preferences
    show_component_menu
    show_proxy_menu
    
    # Installation
    print_section "Beginning Installation"
    
    update_package_manager
    install_dependencies
    install_nvm_node
    setup_repository
    install_cli_tool
    
    # Configure reverse proxy
    case $INSTALL_REVERSE_PROXY in
        nginx)
            configure_nginx
            ;;
        apache)
            configure_apache
            ;;
        cloudflared)
            configure_cloudflared
            ;;
    esac
    
    # Configure SSL if requested
    if [ "$USE_SSL" = true ]; then
        configure_ssl
    fi
    
    # Create services
    if [ "$SERVICE_MANAGER" == "systemd" ]; then
        create_systemd_services
    fi
    
    # Verify installation
    verify_installation
    
    # Display summary
    display_summary
    
    log "Installation completed successfully"
}

# Run main function
main "$@"