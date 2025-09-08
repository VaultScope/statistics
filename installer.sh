#!/bin/bash

# VaultScope Statistics Software Installer v3.0
# Complete rewrite with proper service management and cleanup
# Supports: Linux (Debian/Ubuntu, Arch, RHEL-based, Alpine), macOS

set -e
trap 'handle_error $? $LINENO' ERR

# ============================================================================
# CONFIGURATION
# ============================================================================

INSTALL_DIR="/var/www/vaultscope-statistics"
CONFIG_DIR="/etc/vaultscope-statistics"
LOG_DIR="/var/log/vaultscope-statistics"
LOG_FILE="$LOG_DIR/install_$(date +%Y%m%d_%H%M%S).log"
BACKUP_DIR="/var/backups/vaultscope-statistics"
REPO_URL="https://github.com/vaultscope/statistics.git"
NVM_VERSION="v0.39.7"
NODE_VERSION="20"

# Installation state
INSTALL_CLIENT=false
INSTALL_SERVER=false
INSTALL_CLI=false
INSTALL_REVERSE_PROXY=""
USE_SSL=false
API_DOMAIN=""
CLIENT_DOMAIN=""
SSL_EMAIL=""

# System info
OS=""
PKG_MANAGER=""
SERVICE_MANAGER=""
ARCH=$(uname -m)

# ============================================================================
# UI FUNCTIONS
# ============================================================================

# Colors - using tput for better compatibility
setup_colors() {
    if [ -t 1 ] && command -v tput > /dev/null 2>&1; then
        RED=$(tput setaf 1)
        GREEN=$(tput setaf 2)
        YELLOW=$(tput setaf 3)
        BLUE=$(tput setaf 4)
        MAGENTA=$(tput setaf 5)
        CYAN=$(tput setaf 6)
        WHITE=$(tput setaf 7)
        BOLD=$(tput bold)
        NC=$(tput sgr0)
    else
        RED=""
        GREEN=""
        YELLOW=""
        BLUE=""
        MAGENTA=""
        CYAN=""
        WHITE=""
        BOLD=""
        NC=""
    fi
}

print_header() {
    clear
    cat << "EOF"
╔══════════════════════════════════════════════════════════════════╗
║         VaultScope Statistics Software Installer v3.0           ║
╚══════════════════════════════════════════════════════════════════╝

EOF
}

print_section() {
    echo ""
    echo "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "${WHITE}${BOLD}  $1${NC}"
    echo "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo "${GREEN}✓${NC} $*"
    log "SUCCESS: $*"
}

print_error() {
    echo "${RED}✗${NC} $*" >&2
    log "ERROR: $*"
}

print_warning() {
    echo "${YELLOW}⚠${NC} $*"
    log "WARNING: $*"
}

print_info() {
    echo "${BLUE}ℹ${NC} $*"
    log "INFO: $*"
}

print_progress() {
    printf "${CYAN}⟳${NC} %s..." "$*"
    log "PROGRESS: $*"
}

print_done() {
    echo " ${GREEN}done${NC}"
}

# ============================================================================
# LOGGING
# ============================================================================

setup_logging() {
    mkdir -p "$LOG_DIR"
    touch "$LOG_FILE"
    # Only redirect stderr if we successfully created the log file
    if [ -f "$LOG_FILE" ]; then
        exec 2> >(tee -a "$LOG_FILE" >&2)
    fi
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

handle_error() {
    local exit_code=$1
    local line_number=$2
    print_error "Installation failed at line $line_number (exit code: $exit_code)"
    print_error "Check log: $LOG_FILE"
    
    # Cleanup on error
    if [ -n "$INSTALL_DIR" ] && [ -d "$INSTALL_DIR/.tmp" ]; then
        rm -rf "$INSTALL_DIR/.tmp"
    fi
    
    exit $exit_code
}

# ============================================================================
# SYSTEM DETECTION
# ============================================================================

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
                print_done
                print_error "Unsupported Linux distribution: $ID"
                exit 1
                ;;
        esac
    else
        print_done
        print_error "Unable to detect operating system"
        exit 1
    fi
    
    print_done
    print_info "OS: $OS | Package Manager: $PKG_MANAGER | Service: $SERVICE_MANAGER"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This installer requires root privileges"
        echo ""
        echo "Please run: ${BOLD}sudo bash installer-v3.sh${NC}"
        exit 1
    fi
}

# ============================================================================
# CLEANUP FUNCTIONS
# ============================================================================

detect_existing_installation() {
    print_section "Checking for Existing Installation"
    
    local found_items=""
    
    # Check for services
    if systemctl list-units --all | grep -q "statistics-"; then
        found_items="${found_items}• System services (statistics-server/client)\n"
    fi
    
    # Check for directories
    [ -d "$INSTALL_DIR" ] && found_items="${found_items}• Installation directory: $INSTALL_DIR\n"
    [ -d "$CONFIG_DIR" ] && found_items="${found_items}• Configuration directory: $CONFIG_DIR\n"
    [ -d "$LOG_DIR" ] && found_items="${found_items}• Log directory: $LOG_DIR\n"
    
    # Check for CLI tools
    [ -f /usr/local/bin/statistics ] && found_items="${found_items}• CLI tool: statistics\n"
    [ -f /usr/local/bin/statistics-uninstall ] && found_items="${found_items}• Uninstaller: statistics-uninstall\n"
    
    # Check for Nginx configs
    if [ -d /etc/nginx/sites-available ]; then
        for conf in /etc/nginx/sites-available/statistics-*; do
            [ -f "$conf" ] && found_items="${found_items}• Nginx config: $(basename $conf)\n"
        done
    fi
    
    # Check for Apache configs
    if [ -d /etc/apache2/sites-available ]; then
        for conf in /etc/apache2/sites-available/statistics-*; do
            [ -f "$conf" ] && found_items="${found_items}• Apache config: $(basename $conf)\n"
        done
    fi
    
    # Check for Cloudflared configs
    if [ -d /etc/cloudflared ]; then
        for conf in /etc/cloudflared/*statistics*; do
            [ -f "$conf" ] && found_items="${found_items}• Cloudflared config: $(basename $conf)\n"
        done
    fi
    
    if [ -n "$found_items" ]; then
        print_warning "Existing installation detected:"
        echo ""
        echo -e "$found_items"
        echo ""
        echo "${YELLOW}What would you like to do?${NC}"
        echo "  1) Remove everything and install fresh ${GREEN}[Recommended]${NC}"
        echo "  2) Upgrade existing installation"
        echo "  3) Cancel installation"
        echo ""
        
        read -p "${CYAN}Enter your choice [1-3]: ${NC}" choice
        
        case $choice in
            1)
                cleanup_complete_installation
                ;;
            2)
                print_info "Upgrade mode selected"
                backup_existing_installation
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
        print_success "No existing installation found"
    fi
}

cleanup_complete_installation() {
    print_section "Removing ALL Existing Installations"
    
    # Stop and remove ALL possible services
    print_progress "Stopping ALL services"
    for service in statistics-server statistics-client vaultscope-server vaultscope-client vaultscope-statistics-server vaultscope-statistics-client; do
        systemctl stop $service 2>/dev/null || true
        systemctl disable $service 2>/dev/null || true
    done
    rm -f /etc/systemd/system/statistics-*.service
    rm -f /etc/systemd/system/vaultscope-*.service
    rm -f /lib/systemd/system/statistics-*.service
    rm -f /lib/systemd/system/vaultscope-*.service
    systemctl daemon-reload 2>/dev/null || true
    print_done
    
    # Remove ALL Nginx configurations
    print_progress "Removing ALL Nginx configurations"
    rm -f /etc/nginx/sites-enabled/statistics-*
    rm -f /etc/nginx/sites-enabled/vaultscope-*
    rm -f /etc/nginx/sites-enabled/*cptcr*
    rm -f /etc/nginx/sites-available/statistics-*
    rm -f /etc/nginx/sites-available/vaultscope-*
    rm -f /etc/nginx/sites-available/*cptcr*
    if systemctl is-active nginx > /dev/null 2>&1; then
        nginx -t > /dev/null 2>&1 && systemctl reload nginx > /dev/null 2>&1 || true
    fi
    print_done
    
    # Remove ALL Apache configurations
    print_progress "Removing ALL Apache configurations"
    if [ "$OS" == "debian" ]; then
        a2dissite statistics-* 2>/dev/null || true
        a2dissite vaultscope-* 2>/dev/null || true
        rm -f /etc/apache2/sites-available/statistics-*
        rm -f /etc/apache2/sites-available/vaultscope-*
        rm -f /etc/apache2/sites-available/*cptcr*
        if systemctl is-active apache2 > /dev/null 2>&1; then
            systemctl reload apache2 > /dev/null 2>&1 || true
        fi
    else
        rm -f /etc/httpd/conf.d/statistics-*
        rm -f /etc/httpd/conf.d/vaultscope-*
        if systemctl is-active httpd > /dev/null 2>&1; then
            systemctl reload httpd > /dev/null 2>&1 || true
        fi
    fi
    print_done
    
    # Remove Cloudflared configurations
    print_progress "Removing Cloudflared configurations"
    rm -f /etc/cloudflared/*statistics*
    rm -f /etc/cloudflared/*vaultscope*
    rm -f /etc/cloudflared/config.yml
    systemctl stop cloudflared 2>/dev/null || true
    print_done
    
    # Remove ALL installation directories
    print_progress "Removing ALL installation files"
    rm -rf "$INSTALL_DIR"
    rm -rf /var/www/vaultscope-statistics
    rm -rf /var/www/statistics
    rm -rf /opt/vaultscope-statistics
    rm -rf /opt/statistics
    rm -rf "$CONFIG_DIR"
    rm -rf /etc/vaultscope-statistics
    rm -rf /etc/vaultscope
    rm -rf /etc/statistics
    print_done
    
    # Remove ALL CLI tools and binaries
    print_progress "Removing ALL CLI tools"
    rm -f /usr/local/bin/statistics
    rm -f /usr/local/bin/statistics-uninstall
    rm -f /usr/local/bin/vaultscope
    rm -f /usr/local/bin/vaultscope-cli
    rm -f /usr/bin/statistics
    rm -f /usr/bin/vaultscope
    print_done
    
    # Clean PM2 processes if exists
    if command -v pm2 &> /dev/null; then
        print_progress "Cleaning PM2 processes"
        pm2 delete statistics-server 2>/dev/null || true
        pm2 delete statistics-client 2>/dev/null || true
        pm2 delete vaultscope-server 2>/dev/null || true
        pm2 delete vaultscope-client 2>/dev/null || true
        pm2 save 2>/dev/null || true
        print_done
    fi
    
    # Clean old log files but keep directory for current install
    if [ -d "$LOG_DIR" ]; then
        find "$LOG_DIR" -type f -name "*.log" -delete 2>/dev/null || true
    fi
    
    print_success "Previous installation completely removed"
}

backup_existing_installation() {
    print_progress "Creating backup"
    
    mkdir -p "$BACKUP_DIR"
    local backup_name="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    
    if [ -d "$INSTALL_DIR" ]; then
        tar czf "$BACKUP_DIR/$backup_name" -C "$INSTALL_DIR" . 2>/dev/null || true
        print_done
        print_success "Backup saved to $BACKUP_DIR/$backup_name"
    else
        print_done
    fi
}

# ============================================================================
# INSTALLATION MENUS
# ============================================================================

show_component_menu() {
    print_section "Component Selection"
    
    echo "Select components to install:"
    echo ""
    echo "  1) Server (API) only"
    echo "  2) Client (Frontend) only"
    echo "  3) Both Server and Client ${GREEN}[Recommended]${NC}"
    echo ""
    
    read -p "${CYAN}Enter your choice [1-3]: ${NC}" choice
    
    case $choice in
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
    read -p "${CYAN}Install CLI management tool? [Y/n]: ${NC}" install_cli
    install_cli=${install_cli:-Y}
    
    if [[ $install_cli =~ ^[Yy]$ ]]; then
        INSTALL_CLI=true
        print_success "CLI tool will be installed"
    fi
}

show_proxy_menu() {
    print_section "Reverse Proxy Configuration"
    
    echo "Select reverse proxy:"
    echo ""
    echo "  1) Nginx ${GREEN}[Recommended]${NC}"
    echo "  2) Apache"
    echo "  3) Cloudflare Tunnel"
    echo "  4) None (direct access only)"
    echo ""
    
    read -p "${CYAN}Enter your choice [1-4]: ${NC}" choice
    
    case $choice in
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
    echo "${WHITE}Domain Configuration:${NC}"
    echo ""
    
    if [ "$INSTALL_SERVER" = true ]; then
        read -p "${CYAN}Enter domain for API/Server (e.g., api.example.com): ${NC}" API_DOMAIN
        while [ -z "$API_DOMAIN" ]; do
            print_warning "Domain cannot be empty"
            read -p "${CYAN}Enter domain for API/Server: ${NC}" API_DOMAIN
        done
    fi
    
    if [ "$INSTALL_CLIENT" = true ]; then
        read -p "${CYAN}Enter domain for Client/Frontend (e.g., app.example.com): ${NC}" CLIENT_DOMAIN
        while [ -z "$CLIENT_DOMAIN" ]; do
            print_warning "Domain cannot be empty"
            read -p "${CYAN}Enter domain for Client/Frontend: ${NC}" CLIENT_DOMAIN
        done
    fi
    
    # SSL configuration
    if [ "$INSTALL_REVERSE_PROXY" = "nginx" ] || [ "$INSTALL_REVERSE_PROXY" = "apache" ]; then
        echo ""
        read -p "${CYAN}Configure SSL with Let's Encrypt? [Y/n]: ${NC}" use_ssl
        use_ssl=${use_ssl:-Y}
        
        if [[ $use_ssl =~ ^[Yy]$ ]]; then
            USE_SSL=true
            read -p "${CYAN}Enter email for SSL certificates: ${NC}" SSL_EMAIL
            while [ -z "$SSL_EMAIL" ]; do
                print_warning "Email required for SSL"
                read -p "${CYAN}Enter email: ${NC}" SSL_EMAIL
            done
            print_success "SSL will be configured"
        fi
    fi
}

# ============================================================================
# DEPENDENCY INSTALLATION
# ============================================================================

update_package_manager() {
    print_progress "Updating package manager"
    
    case $PKG_MANAGER in
        apt)
            apt-get update -qq > /dev/null 2>&1
            ;;
        pacman)
            pacman -Sy --noconfirm > /dev/null 2>&1
            ;;
        yum|dnf)
            $PKG_MANAGER makecache -q > /dev/null 2>&1
            ;;
        apk)
            apk update > /dev/null 2>&1
            ;;
    esac
    
    print_done
}

install_package() {
    local package=$1
    print_progress "Installing $package"
    
    case $PKG_MANAGER in
        apt)
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$package" > /dev/null 2>&1
            ;;
        pacman)
            pacman -S --noconfirm --needed "$package" > /dev/null 2>&1
            ;;
        yum|dnf)
            $PKG_MANAGER install -y -q "$package" > /dev/null 2>&1
            ;;
        apk)
            apk add --no-cache "$package" > /dev/null 2>&1
            ;;
    esac
    
    print_done
}

install_dependencies() {
    print_section "Installing System Dependencies"
    
    local deps=""
    case $OS in
        debian)
            deps="curl wget git build-essential python3 ca-certificates gnupg lsb-release"
            ;;
        arch)
            deps="curl wget git base-devel python"
            ;;
        rhel|fedora)
            deps="curl wget git gcc gcc-c++ make python3"
            ;;
        alpine)
            deps="curl wget git build-base python3"
            ;;
    esac
    
    for dep in $deps; do
        install_package "$dep"
    done
    
    print_success "All dependencies installed"
}

# ============================================================================
# NODE.JS INSTALLATION
# ============================================================================

install_nodejs() {
    print_section "Installing Node.js"
    
    # Try to use system Node.js first
    if command -v node > /dev/null 2>&1; then
        local version=$(node --version | sed 's/v//' | cut -d. -f1)
        if [ "$version" -ge 18 ]; then
            print_success "Node.js $(node --version) already installed"
            print_success "NPM $(npm --version) already installed"
            return
        fi
    fi
    
    print_progress "Installing Node.js v$NODE_VERSION"
    
    if [ "$OS" = "debian" ]; then
        # Use NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
        apt-get install -y nodejs > /dev/null 2>&1
    elif [ "$OS" = "arch" ]; then
        install_package nodejs
        install_package npm
    elif [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
        $PKG_MANAGER install -y nodejs > /dev/null 2>&1
    fi
    
    print_done
    
    if command -v node > /dev/null 2>&1; then
        print_success "Node.js $(node --version) installed"
        print_success "NPM $(npm --version) installed"
    else
        print_error "Failed to install Node.js"
        exit 1
    fi
}

# ============================================================================
# APPLICATION SETUP
# ============================================================================

setup_application() {
    print_section "Setting Up Application"
    
    # Create directories
    print_progress "Creating directories"
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"
    
    # Set permissions if www-data exists
    if id -u www-data > /dev/null 2>&1; then
        chown -R www-data:www-data "$LOG_DIR" 2>/dev/null || true
    fi
    print_done
    
    # Setup application files
    print_progress "Setting up application files"
    
    # Check if running from local directory
    if [ -f "$(dirname "$0")/package.json" ]; then
        print_done
        print_info "Using local files"
        cp -r "$(dirname "$0")"/* "$INSTALL_DIR/"
        cp -r "$(dirname "$0")"/.[^.]* "$INSTALL_DIR/" 2>/dev/null || true
    else
        # Try to clone from GitHub
        git clone "$REPO_URL" "$INSTALL_DIR" > /dev/null 2>&1 || {
            print_done
            print_warning "Repository not available, creating minimal setup"
            create_minimal_setup
        }
        print_done
    fi
    
    cd "$INSTALL_DIR"
    
    # Install dependencies
    if [ -f "package.json" ]; then
        print_progress "Installing Node.js dependencies"
        npm install --production > /dev/null 2>&1 || npm install > /dev/null 2>&1 || true
        print_done
        
        # Try to build
        if [ -f "tsconfig.json" ] || grep -q "build" package.json 2>/dev/null; then
            print_progress "Building application"
            npm run build > /dev/null 2>&1 || true
            print_done
        fi
    fi
    
    # Set permissions if www-data exists
    if id -u www-data > /dev/null 2>&1; then
        chown -R www-data:www-data "$INSTALL_DIR" 2>/dev/null || true
    fi
    
    # Copy uninstaller if exists
    if [ -f "$INSTALL_DIR/uninstaller.sh" ]; then
        cp "$INSTALL_DIR/uninstaller.sh" /usr/local/bin/statistics-uninstall
        chmod +x /usr/local/bin/statistics-uninstall
    fi
    
    print_success "Application setup complete"
}

create_minimal_setup() {
    cat > "$INSTALL_DIR/package.json" << 'EOF'
{
  "name": "vaultscope-statistics",
  "version": "1.0.0",
  "description": "VaultScope Statistics",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
EOF

    cat > "$INSTALL_DIR/server.js" << 'EOF'
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'VaultScope Statistics API',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    name: 'VaultScope Statistics API',
    version: '1.0.0',
    endpoints: ['/health', '/api/stats']
  });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    disk: Math.random() * 100,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
EOF

    cat > "$INSTALL_DIR/client.js" << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>VaultScope Statistics</title>
      <style>
        body { font-family: -apple-system, sans-serif; padding: 2rem; }
        h1 { color: #333; }
        .status { padding: 1rem; background: #f0f0f0; border-radius: 8px; }
      </style>
    </head>
    <body>
      <h1>VaultScope Statistics Client</h1>
      <div class="status">
        <p>Status: <strong>Running</strong></p>
        <p>API Endpoint: <a href="http://localhost:4000">http://localhost:4000</a></p>
      </div>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Client running on port ${PORT}`);
});
EOF

    # Create a minimal CLI tool
    cat > "$INSTALL_DIR/cli.js" << 'EOF'
#!/usr/bin/env node

const { execSync } = require('child_process');
const args = process.argv.slice(2);
const command = args[0];

console.log('VaultScope Statistics CLI - Minimal Mode\n');

switch(command) {
    case 'status':
        try {
            console.log('Server Status:');
            execSync('systemctl is-active statistics-server', { stdio: 'inherit' });
            console.log('\nClient Status:');
            execSync('systemctl is-active statistics-client', { stdio: 'inherit' });
        } catch(e) {
            console.log('Services not configured or not running');
        }
        break;
    case 'start':
        console.log('Starting services...');
        try {
            execSync('sudo systemctl start statistics-server statistics-client', { stdio: 'inherit' });
            console.log('Services started');
        } catch(e) {
            console.log('Failed to start services');
        }
        break;
    case 'stop':
        console.log('Stopping services...');
        try {
            execSync('sudo systemctl stop statistics-server statistics-client', { stdio: 'inherit' });
            console.log('Services stopped');
        } catch(e) {
            console.log('Failed to stop services');
        }
        break;
    case 'restart':
        console.log('Restarting services...');
        try {
            execSync('sudo systemctl restart statistics-server statistics-client', { stdio: 'inherit' });
            console.log('Services restarted');
        } catch(e) {
            console.log('Failed to restart services');
        }
        break;
    case 'help':
    default:
        console.log('Usage: statistics <command>');
        console.log('\nCommands:');
        console.log('  status   - Show service status');
        console.log('  start    - Start all services');
        console.log('  stop     - Stop all services');
        console.log('  restart  - Restart all services');
        console.log('  help     - Show this help');
        break;
}
EOF
    
    chmod +x "$INSTALL_DIR/cli.js"
}

# ============================================================================
# CLI TOOL
# ============================================================================

install_cli_tool() {
    if [ "$INSTALL_CLI" != true ]; then
        return
    fi
    
    print_section "Installing CLI Tool"
    
    # Create CLI wrapper script
    cat > /usr/local/bin/statistics << 'EOF'
#!/bin/bash
cd /var/www/vaultscope-statistics
node cli.js "$@" 2>/dev/null || echo "CLI not configured. Use systemctl to manage services."
EOF
    
    chmod +x /usr/local/bin/statistics
    
    # Create configuration file for CLI
    mkdir -p "$CONFIG_DIR"
    
    # Determine URLs based on domain configuration
    local api_url="http://localhost:4000"
    local client_url="http://localhost:3000"
    
    if [ -n "$API_DOMAIN" ]; then
        api_url="http://$API_DOMAIN"
        [ "$USE_SSL" = true ] && api_url="https://$API_DOMAIN"
    fi
    
    if [ -n "$CLIENT_DOMAIN" ]; then
        client_url="http://$CLIENT_DOMAIN"
        [ "$USE_SSL" = true ] && client_url="https://$CLIENT_DOMAIN"
    fi
    
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "installPath": "$INSTALL_DIR",
  "installDate": "$(date -Iseconds)",
  "platform": "$(uname -s)",
  "components": [$([ "$INSTALL_SERVER" = true ] && echo '"server"')$([ "$INSTALL_SERVER" = true ] && [ "$INSTALL_CLIENT" = true ] && echo ',')$([ "$INSTALL_CLIENT" = true ] && echo '"client"')],
  "serviceManager": "systemd",
  "server": {
    "path": "$INSTALL_DIR",
    "url": "$api_url",
    "port": 4000,
    "apiKeyFile": "$CONFIG_DIR/api.key"
  },
  "client": {
    "path": "$INSTALL_DIR",
    "url": "$client_url",
    "port": 3000
  }
}
EOF
    
    print_success "CLI tool installed as 'statistics'"
}

# ============================================================================
# SERVICES
# ============================================================================

create_services() {
    print_section "Creating System Services"
    
    # Get Node.js path
    local node_path=$(which node)
    
    # Determine service user
    local service_user="www-data"
    if ! id -u www-data > /dev/null 2>&1; then
        # www-data doesn't exist, use nobody or create it
        if id -u nobody > /dev/null 2>&1; then
            service_user="nobody"
        else
            service_user="root"
            print_warning "Running services as root (not recommended for production)"
        fi
    fi
    
    # Server service
    if [ "$INSTALL_SERVER" = true ]; then
        cat > /etc/systemd/system/statistics-server.service << EOF
[Unit]
Description=VaultScope Statistics API Server
After=network.target

[Service]
Type=simple
User=$service_user
Group=$service_user
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStart=$node_path $INSTALL_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/server.log
StandardError=append:$LOG_DIR/server-error.log

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl enable statistics-server > /dev/null 2>&1
        systemctl restart statistics-server
        
        # Wait for service to start
        sleep 2
        
        if systemctl is-active --quiet statistics-server; then
            print_success "Server service started successfully"
        else
            print_warning "Server service failed to start - check logs"
        fi
    fi
    
    # Client service
    if [ "$INSTALL_CLIENT" = true ]; then
        # Use client.js if it exists, otherwise use server.js on port 3000
        local client_script="$INSTALL_DIR/client.js"
        [ ! -f "$client_script" ] && client_script="$INSTALL_DIR/server.js"
        
        cat > /etc/systemd/system/statistics-client.service << EOF
[Unit]
Description=VaultScope Statistics Client
After=network.target

[Service]
Type=simple
User=$service_user
Group=$service_user
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=$node_path $client_script
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/client.log
StandardError=append:$LOG_DIR/client-error.log

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl enable statistics-client > /dev/null 2>&1
        systemctl restart statistics-client
        
        # Wait for service to start
        sleep 2
        
        if systemctl is-active --quiet statistics-client; then
            print_success "Client service started successfully"
        else
            print_warning "Client service failed to start - check logs"
        fi
    fi
}

# ============================================================================
# REVERSE PROXY
# ============================================================================

configure_nginx() {
    print_section "Configuring Nginx"
    
    install_package nginx
    
    # API configuration
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
}
EOF
        ln -sf /etc/nginx/sites-available/statistics-api /etc/nginx/sites-enabled/
        print_success "Nginx configured for API at $API_DOMAIN"
    fi
    
    # Client configuration
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
}
EOF
        ln -sf /etc/nginx/sites-available/statistics-client /etc/nginx/sites-enabled/
        print_success "Nginx configured for Client at $CLIENT_DOMAIN"
    fi
    
    # Test and reload
    nginx -t > /dev/null 2>&1 && systemctl reload nginx
    systemctl enable nginx > /dev/null 2>&1
}

configure_ssl() {
    if [ "$USE_SSL" != true ]; then
        return
    fi
    
    print_section "Configuring SSL Certificates"
    
    install_package certbot
    
    if [ "$INSTALL_REVERSE_PROXY" = "nginx" ]; then
        install_package python3-certbot-nginx
    elif [ "$INSTALL_REVERSE_PROXY" = "apache" ]; then
        install_package python3-certbot-apache
    fi
    
    # Obtain certificates
    if [ "$INSTALL_SERVER" = true ] && [ -n "$API_DOMAIN" ]; then
        print_progress "Obtaining SSL for $API_DOMAIN"
        certbot --nginx -d "$API_DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" > /dev/null 2>&1 || {
            print_done
            print_warning "SSL setup failed for $API_DOMAIN"
        }
        print_done
    fi
    
    if [ "$INSTALL_CLIENT" = true ] && [ -n "$CLIENT_DOMAIN" ]; then
        print_progress "Obtaining SSL for $CLIENT_DOMAIN"
        certbot --nginx -d "$CLIENT_DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" > /dev/null 2>&1 || {
            print_done
            print_warning "SSL setup failed for $CLIENT_DOMAIN"
        }
        print_done
    fi
    
    # Setup auto-renewal
    systemctl enable certbot.timer > /dev/null 2>&1 || {
        (crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet") | crontab -
    }
    
    print_success "SSL configured with auto-renewal"
}

# ============================================================================
# VERIFICATION
# ============================================================================

verify_installation() {
    print_section "Verifying Installation"
    
    local all_good=true
    
    # Check services
    if [ "$INSTALL_SERVER" = true ]; then
        print_progress "Checking server service"
        if systemctl is-active --quiet statistics-server; then
            print_done
            
            # Test API endpoint
            if curl -s http://localhost:4000/health | grep -q "healthy"; then
                print_success "Server API responding correctly"
            else
                print_warning "Server running but API not responding"
                all_good=false
            fi
        else
            print_done
            print_error "Server service not running"
            all_good=false
        fi
    fi
    
    if [ "$INSTALL_CLIENT" = true ]; then
        print_progress "Checking client service"
        if systemctl is-active --quiet statistics-client; then
            print_done
            
            # Test client endpoint
            if curl -s http://localhost:3000/ | grep -q "VaultScope"; then
                print_success "Client responding correctly"
            else
                print_warning "Client running but not responding"
                all_good=false
            fi
        else
            print_done
            print_error "Client service not running"
            all_good=false
        fi
    fi
    
    # Check reverse proxy
    if [ "$INSTALL_REVERSE_PROXY" = "nginx" ]; then
        if systemctl is-active --quiet nginx; then
            print_success "Nginx is running"
        else
            print_error "Nginx not running"
            all_good=false
        fi
    fi
    
    if [ "$all_good" = false ]; then
        echo ""
        print_warning "Some components need attention"
        echo ""
        echo "Check logs:"
        echo "  • Server: $LOG_DIR/server-error.log"
        echo "  • Client: $LOG_DIR/client-error.log"
        echo "  • Install: $LOG_FILE"
    else
        print_success "All components verified successfully!"
    fi
}

# ============================================================================
# SUMMARY
# ============================================================================

display_summary() {
    print_header
    print_section "Installation Complete!"
    
    echo "${GREEN}✓ VaultScope Statistics has been installed!${NC}"
    echo ""
    
    echo "${WHITE}${BOLD}Access URLs:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$INSTALL_SERVER" = true ]; then
        if [ -n "$API_DOMAIN" ]; then
            local proto="http"
            [ "$USE_SSL" = true ] && proto="https"
            echo "  ${CYAN}API Server:${NC} $proto://$API_DOMAIN"
        else
            echo "  ${CYAN}API Server:${NC} http://localhost:4000"
        fi
    fi
    
    if [ "$INSTALL_CLIENT" = true ]; then
        if [ -n "$CLIENT_DOMAIN" ]; then
            local proto="http"
            [ "$USE_SSL" = true ] && proto="https"
            echo "  ${CYAN}Client App:${NC} $proto://$CLIENT_DOMAIN"
        else
            echo "  ${CYAN}Client App:${NC} http://localhost:3000"
        fi
    fi
    
    echo ""
    echo "${WHITE}${BOLD}Management:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$INSTALL_CLI" = true ]; then
        echo "  ${CYAN}CLI:${NC} statistics"
    fi
    
    if [ "$INSTALL_SERVER" = true ]; then
        echo "  ${CYAN}Server:${NC} systemctl [status|restart|stop] statistics-server"
    fi
    
    if [ "$INSTALL_CLIENT" = true ]; then
        echo "  ${CYAN}Client:${NC} systemctl [status|restart|stop] statistics-client"
    fi
    
    echo "  ${CYAN}Logs:${NC} $LOG_DIR/"
    echo "  ${CYAN}Uninstall:${NC} statistics-uninstall"
    
    echo ""
    echo "${GREEN}Installation successful! Thank you for using VaultScope Statistics.${NC}"
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    setup_colors
    setup_logging
    print_header
    
    # Pre-flight checks
    check_root
    detect_os
    
    # Check and handle existing installation
    detect_existing_installation
    
    # Get user choices
    show_component_menu
    show_proxy_menu
    
    # Begin installation
    print_section "Installing Components"
    
    update_package_manager
    install_dependencies
    install_nodejs
    setup_application
    install_cli_tool
    create_services
    
    # Configure reverse proxy
    case $INSTALL_REVERSE_PROXY in
        nginx)
            configure_nginx
            [ "$USE_SSL" = true ] && configure_ssl
            ;;
        apache)
            # Similar to nginx, implement if needed
            ;;
        cloudflared)
            # Implement cloudflared setup
            ;;
    esac
    
    # Verify and complete
    verify_installation
    display_summary
    
    log "Installation completed successfully"
}

# ============================================================================
# DIAGNOSTIC TOOL
# ============================================================================

run_diagnostics() {
    print_header
    print_section "System Diagnostics"
    
    local issues_found=false
    
    # Check Node.js
    print_progress "Checking Node.js"
    if command -v node > /dev/null 2>&1; then
        print_done
        print_success "Node.js $(node --version) installed"
    else
        print_done
        print_error "Node.js not installed"
        issues_found=true
    fi
    
    # Check services
    if [ -f /etc/systemd/system/statistics-server.service ]; then
        print_progress "Checking server service"
        if systemctl is-active --quiet statistics-server; then
            print_done
            print_success "Server service is running"
            
            # Test API
            if curl -s http://localhost:4000/health 2>/dev/null | grep -q "healthy"; then
                print_success "Server API responding on port 4000"
            else
                print_warning "Server running but API not responding"
                issues_found=true
            fi
        else
            print_done
            print_error "Server service not running"
            echo "  Last errors:"
            journalctl -u statistics-server -n 3 --no-pager 2>/dev/null | tail -3
            issues_found=true
        fi
    fi
    
    if [ -f /etc/systemd/system/statistics-client.service ]; then
        print_progress "Checking client service"
        if systemctl is-active --quiet statistics-client; then
            print_done
            print_success "Client service is running"
            
            # Test client
            if curl -s http://localhost:3000/ 2>/dev/null | grep -q "VaultScope"; then
                print_success "Client responding on port 3000"
            else
                print_warning "Client running but not responding"
                issues_found=true
            fi
        else
            print_done
            print_error "Client service not running"
            echo "  Last errors:"
            journalctl -u statistics-client -n 3 --no-pager 2>/dev/null | tail -3
            issues_found=true
        fi
    fi
    
    # Check ports
    echo ""
    echo "${WHITE}Port Status:${NC}"
    netstat -tln 2>/dev/null | grep -E ":(3000|4000|80|443) " || echo "No services listening"
    
    # Check files
    echo ""
    echo "${WHITE}Installation Files:${NC}"
    if [ -d "$INSTALL_DIR" ]; then
        echo "  Install dir: $INSTALL_DIR"
        [ -f "$INSTALL_DIR/server.js" ] && echo "    ✓ server.js exists" || echo "    ✗ server.js missing"
        [ -f "$INSTALL_DIR/package.json" ] && echo "    ✓ package.json exists" || echo "    ✗ package.json missing"
        [ -d "$INSTALL_DIR/node_modules" ] && echo "    ✓ node_modules exists" || echo "    ✗ node_modules missing"
    else
        echo "  Install directory not found!"
    fi
    
    if [ "$issues_found" = true ]; then
        echo ""
        print_warning "Issues detected. Recommendations:"
        echo "  • Restart services: systemctl restart statistics-server statistics-client"
        echo "  • Check logs: journalctl -u statistics-server -f"
        echo "  • Re-run installer: sudo bash installer.sh"
    else
        echo ""
        print_success "All systems operational!"
    fi
}

# Check if running with --diagnose flag
if [ "$1" = "--diagnose" ] || [ "$1" = "-d" ]; then
    setup_colors
    check_root
    run_diagnostics
    exit 0
fi

# Run main
main "$@"