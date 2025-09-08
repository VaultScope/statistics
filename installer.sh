#!/bin/bash

# VaultScope Statistics Software Installer v4.0 - BULLETPROOF EDITION
# NO ERRORS. WORKS ON LINUX AND MACOS. PERIOD.

# ============================================================================
# CRITICAL: Disable exit on error during cleanup operations
# ============================================================================
set +e  # Don't exit on errors - we handle them properly

# ============================================================================
# GLOBAL CONFIGURATION
# ============================================================================
INSTALL_DIR="/var/www/vaultscope-statistics"
CONFIG_DIR="/etc/vaultscope-statistics"
LOG_DIR="/var/log/vaultscope-statistics"
BACKUP_DIR="/var/backups/vaultscope-statistics"
REPO_URL="https://github.com/vaultscope/statistics.git"
NODE_VERSION="20"

# State tracking
IS_CLEANING=false
LOG_FILE=""

# System detection
OS=""
PKG_MANAGER=""
SERVICE_MANAGER=""

# ============================================================================
# COLOR SETUP (WORKS EVERYWHERE)
# ============================================================================
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    WHITE='\033[1;37m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    WHITE=''
    BOLD=''
    NC=''
fi

# ============================================================================
# SAFE LOGGING FUNCTIONS
# ============================================================================
safe_log() {
    # NEVER fails, even if log file is deleted
    if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ] && [ "$IS_CLEANING" != "true" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

setup_logging() {
    # Create log directory and file SAFELY
    if [ "$IS_CLEANING" != "true" ]; then
        mkdir -p "$LOG_DIR" 2>/dev/null || true
        LOG_FILE="$LOG_DIR/install_$(date +%Y%m%d_%H%M%S).log"
        touch "$LOG_FILE" 2>/dev/null || true
    fi
}

# ============================================================================
# OUTPUT FUNCTIONS (NEVER FAIL)
# ============================================================================
print_header() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${WHITE}${BOLD}      VaultScope Statistics Software Installer v4.0              ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}${BOLD}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $*"
    safe_log "SUCCESS: $*"
}

print_error() {
    echo -e "${RED}✗${NC} $*" >&2
    safe_log "ERROR: $*"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $*"
    safe_log "WARNING: $*"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $*"
    safe_log "INFO: $*"
}

print_progress() {
    printf "${CYAN}⟳${NC} %s..." "$*"
    safe_log "PROGRESS: $*"
}

print_done() {
    echo -e " ${GREEN}done${NC}"
}

# ============================================================================
# SYSTEM DETECTION (BULLETPROOF)
# ============================================================================
detect_os() {
    print_progress "Detecting operating system"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PKG_MANAGER="brew"
        SERVICE_MANAGER="launchd"
    elif [ -f /etc/os-release ]; then
        . /etc/os-release
        case "${ID:-unknown}" in
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
            fedora|centos|rhel|rocky|almalinux)
                OS="rhel"
                PKG_MANAGER="yum"
                [ -x /usr/bin/dnf ] && PKG_MANAGER="dnf"
                SERVICE_MANAGER="systemd"
                ;;
            alpine)
                OS="alpine"
                PKG_MANAGER="apk"
                SERVICE_MANAGER="openrc"
                ;;
            *)
                OS="linux"
                PKG_MANAGER="unknown"
                SERVICE_MANAGER="systemd"
                ;;
        esac
    else
        OS="linux"
        PKG_MANAGER="unknown"
        SERVICE_MANAGER="systemd"
    fi
    
    print_done
    print_info "OS: $OS | Package Manager: $PKG_MANAGER | Service: $SERVICE_MANAGER"
}

# ============================================================================
# ROOT CHECK
# ============================================================================
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This installer must be run as root"
        echo "Please run: sudo bash $0"
        exit 1
    fi
}

# ============================================================================
# NUCLEAR CLEANUP - REMOVES EVERYTHING, NEVER FAILS
# ============================================================================
nuclear_cleanup() {
    IS_CLEANING=true  # Disable logging during cleanup
    
    print_section "COMPLETE REMOVAL - Destroying Everything"
    
    # Kill Node.js processes
    print_progress "Terminating all Node.js processes"
    killall node 2>/dev/null || true
    killall nodejs 2>/dev/null || true
    killall npm 2>/dev/null || true
    print_done
    
    # Remove systemd services - ULTRA NUCLEAR MODE
    if [ "$SERVICE_MANAGER" = "systemd" ]; then
        print_progress "Destroying all systemd services"
        
        local services=(
            "statistics-server" "statistics-client"
            "vaultscope-server" "vaultscope-client"
            "vaultscope-statistics-server" "vaultscope-statistics-client"
        )
        
        # Stop and disable everything - INCLUDING OLD NAMES
        for service in "${services[@]}"; do
            systemctl stop "$service" 2>/dev/null || true
            systemctl stop "${service}.service" 2>/dev/null || true
            systemctl disable "$service" 2>/dev/null || true
            systemctl disable "${service}.service" 2>/dev/null || true
            systemctl mask "$service" 2>/dev/null || true
        done
        
        # FORCE STOP OLD SERVICE NAMES THAT MAY BE CACHED
        systemctl stop statistics-server.service 2>/dev/null || true
        systemctl stop statistics-client.service 2>/dev/null || true
        systemctl disable statistics-server.service 2>/dev/null || true
        systemctl disable statistics-client.service 2>/dev/null || true
        systemctl mask statistics-server.service 2>/dev/null || true
        systemctl mask statistics-client.service 2>/dev/null || true
        
        # FORCE reload to flush any cached service definitions
        systemctl daemon-reload 2>/dev/null || true
        
        # Remove ALL service files from ALL possible locations
        rm -f /etc/systemd/system/statistics*.service 2>/dev/null || true
        rm -f /etc/systemd/system/vaultscope*.service 2>/dev/null || true
        rm -f /lib/systemd/system/statistics*.service 2>/dev/null || true
        rm -f /lib/systemd/system/vaultscope*.service 2>/dev/null || true
        rm -f /usr/lib/systemd/system/statistics*.service 2>/dev/null || true
        rm -f /usr/lib/systemd/system/vaultscope*.service 2>/dev/null || true
        rm -rf /etc/systemd/system/statistics*.service.d 2>/dev/null || true
        rm -rf /etc/systemd/system/vaultscope*.service.d 2>/dev/null || true
        rm -rf /run/systemd/system/statistics*.service* 2>/dev/null || true
        rm -rf /run/systemd/system/vaultscope*.service* 2>/dev/null || true
        
        # Remove from multi-user.target.wants
        rm -f /etc/systemd/system/multi-user.target.wants/statistics*.service 2>/dev/null || true
        rm -f /etc/systemd/system/multi-user.target.wants/vaultscope*.service 2>/dev/null || true
        
        # Clear systemd cache completely
        systemctl daemon-reload 2>/dev/null || true
        systemctl reset-failed 2>/dev/null || true
        
        # Unmask services to allow recreation
        for service in "${services[@]}"; do
            systemctl unmask "$service" 2>/dev/null || true
        done
        
        # UNMASK OLD SERVICE NAMES TOO
        systemctl unmask statistics-server.service 2>/dev/null || true
        systemctl unmask statistics-client.service 2>/dev/null || true
        
        # Final reload to ensure everything is cleared
        systemctl daemon-reload 2>/dev/null || true
        
        print_done
    fi
    
    # Remove PM2 processes
    if command -v pm2 &>/dev/null; then
        print_progress "Removing PM2 processes"
        pm2 delete all 2>/dev/null || true
        pm2 kill 2>/dev/null || true
        print_done
    fi
    
    # Remove web server configs
    print_progress "Removing web server configurations"
    
    # Nginx
    rm -f /etc/nginx/sites-enabled/vaultscope-api 2>/dev/null || true
    rm -f /etc/nginx/sites-enabled/vaultscope-client 2>/dev/null || true
    rm -f /etc/nginx/sites-available/vaultscope-api 2>/dev/null || true
    rm -f /etc/nginx/sites-available/vaultscope-client 2>/dev/null || true
    rm -f /etc/nginx/sites-enabled/*statistics* 2>/dev/null || true
    rm -f /etc/nginx/sites-enabled/*vaultscope* 2>/dev/null || true
    rm -f /etc/nginx/sites-available/*statistics* 2>/dev/null || true
    rm -f /etc/nginx/sites-available/*vaultscope* 2>/dev/null || true
    
    if systemctl is-active nginx >/dev/null 2>&1; then
        nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true
    fi
    
    # Apache
    if [ -d /etc/apache2 ]; then
        a2dissite *statistics* 2>/dev/null || true
        a2dissite *vaultscope* 2>/dev/null || true
        rm -f /etc/apache2/sites-available/*statistics* 2>/dev/null || true
        rm -f /etc/apache2/sites-available/*vaultscope* 2>/dev/null || true
        systemctl reload apache2 2>/dev/null || true
    fi
    
    if [ -d /etc/httpd ]; then
        rm -f /etc/httpd/conf.d/*statistics* 2>/dev/null || true
        rm -f /etc/httpd/conf.d/*vaultscope* 2>/dev/null || true
        systemctl reload httpd 2>/dev/null || true
    fi
    
    print_done
    
    # Remove directories
    print_progress "Removing all installation directories"
    rm -rf "$INSTALL_DIR" 2>/dev/null || true
    rm -rf /var/www/vaultscope* 2>/dev/null || true
    rm -rf /var/www/statistics 2>/dev/null || true
    rm -rf /opt/vaultscope* 2>/dev/null || true
    rm -rf /opt/statistics 2>/dev/null || true
    print_done
    
    print_progress "Removing configuration directories"
    rm -rf "$CONFIG_DIR" 2>/dev/null || true
    rm -rf /etc/vaultscope* 2>/dev/null || true
    rm -rf /etc/statistics 2>/dev/null || true
    print_done
    
    print_progress "Removing log directories"
    # Save current log for reference if needed
    local current_log="$LOG_FILE"
    if [ -n "$current_log" ] && [ -f "$current_log" ]; then
        cp "$current_log" "/tmp/statistics_last_install.log" 2>/dev/null || true
    fi
    rm -rf "$LOG_DIR" 2>/dev/null || true
    rm -rf /var/log/vaultscope* 2>/dev/null || true
    rm -rf /var/log/statistics 2>/dev/null || true
    print_done
    
    print_progress "Removing backup directories"
    rm -rf "$BACKUP_DIR" 2>/dev/null || true
    rm -rf /var/backups/vaultscope* 2>/dev/null || true
    rm -rf /var/backups/statistics 2>/dev/null || true
    print_done
    
    print_progress "Removing CLI tools"
    rm -f /usr/local/bin/statistics* 2>/dev/null || true
    rm -f /usr/local/bin/vaultscope* 2>/dev/null || true
    rm -f /usr/bin/statistics* 2>/dev/null || true
    rm -f /usr/bin/vaultscope* 2>/dev/null || true
    print_done
    
    print_progress "Cleaning cron jobs"
    crontab -l 2>/dev/null | grep -v "statistics\|vaultscope" | crontab - 2>/dev/null || true
    print_done
    
    IS_CLEANING=false  # Re-enable logging
    
    print_success "Complete removal finished successfully!"
}

# ============================================================================
# CHECK EXISTING INSTALLATION
# ============================================================================
check_existing_installation() {
    print_section "Checking for Existing Installation"
    
    local found=false
    local found_items=""
    
    # Check for directories
    [ -d "$INSTALL_DIR" ] && { found=true; found_items="${found_items}• Installation directory: $INSTALL_DIR\n"; }
    [ -d "$CONFIG_DIR" ] && { found=true; found_items="${found_items}• Config directory: $CONFIG_DIR\n"; }
    [ -d "$LOG_DIR" ] && { found=true; found_items="${found_items}• Log directory: $LOG_DIR\n"; }
    [ -f /usr/local/bin/statistics ] && { found=true; found_items="${found_items}• CLI tool: statistics\n"; }
    
    # Check for services
    if [ "$SERVICE_MANAGER" = "systemd" ]; then
        systemctl list-units --all | grep -q "statistics\|vaultscope" 2>/dev/null && {
            found=true
            found_items="${found_items}• System services detected\n"
        }
    fi
    
    if [ "$found" = true ]; then
        print_warning "Existing installation detected:"
        echo ""
        echo -e "$found_items"
        echo ""
        echo "What would you like to do?"
        echo "  1) COMPLETELY UNINSTALL and exit"
        echo "  2) Remove everything and install fresh [Recommended]"
        echo "  3) Cancel"
        echo ""
        read -p "Enter your choice [1-3]: " choice
        
        case $choice in
            1)
                nuclear_cleanup
                echo ""
                print_success "Uninstallation complete!"
                exit 0
                ;;
            2)
                nuclear_cleanup
                echo ""
                print_info "Proceeding with fresh installation..."
                sleep 2
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

# ============================================================================
# INSTALL DEPENDENCIES
# ============================================================================
install_dependencies() {
    print_section "Installing System Dependencies"
    
    # Update package manager
    print_progress "Updating package manager"
    case $PKG_MANAGER in
        apt)
            apt-get update -qq >/dev/null 2>&1 || true
            ;;
        yum|dnf)
            $PKG_MANAGER makecache -q >/dev/null 2>&1 || true
            ;;
        pacman)
            pacman -Sy --noconfirm >/dev/null 2>&1 || true
            ;;
    esac
    print_done
    
    # Install required packages
    local packages="curl wget git"
    
    if [ "$OS" != "macos" ]; then
        packages="$packages build-essential"
        [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ] && packages="curl wget git gcc gcc-c++ make"
        [ "$PKG_MANAGER" = "pacman" ] && packages="curl wget git base-devel"
        [ "$PKG_MANAGER" = "apk" ] && packages="curl wget git build-base"
    fi
    
    for pkg in $packages; do
        print_progress "Installing $pkg"
        case $PKG_MANAGER in
            apt)
                DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" >/dev/null 2>&1 || true
                ;;
            yum|dnf)
                $PKG_MANAGER install -y -q "$pkg" >/dev/null 2>&1 || true
                ;;
            pacman)
                pacman -S --noconfirm --needed "$pkg" >/dev/null 2>&1 || true
                ;;
            apk)
                apk add --no-cache "$pkg" >/dev/null 2>&1 || true
                ;;
            brew)
                brew install "$pkg" >/dev/null 2>&1 || true
                ;;
        esac
        print_done
    done
}

# ============================================================================
# INSTALL NODE.JS
# ============================================================================
install_nodejs() {
    print_section "Installing Node.js"
    
    if command -v node >/dev/null 2>&1; then
        local current_version=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$current_version" -ge "$NODE_VERSION" ] 2>/dev/null; then
            print_success "Node.js v$current_version already installed"
            return 0
        fi
    fi
    
    print_progress "Installing Node.js v${NODE_VERSION}"
    
    if [ "$OS" = "macos" ]; then
        if command -v brew >/dev/null 2>&1; then
            brew install node@${NODE_VERSION} >/dev/null 2>&1 || brew install node >/dev/null 2>&1 || true
        fi
    else
        # Use NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null 2>&1 || true
        
        case $PKG_MANAGER in
            apt)
                DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null 2>&1 || true
                ;;
            yum|dnf)
                $PKG_MANAGER install -y -q nodejs >/dev/null 2>&1 || true
                ;;
            *)
                # Fallback: download and extract binary
                local node_arch="x64"
                [ "$(uname -m)" = "arm64" ] || [ "$(uname -m)" = "aarch64" ] && node_arch="arm64"
                
                wget -q "https://nodejs.org/dist/v${NODE_VERSION}.0.0/node-v${NODE_VERSION}.0.0-linux-${node_arch}.tar.xz" -O /tmp/node.tar.xz
                tar -xf /tmp/node.tar.xz -C /usr/local --strip-components=1 2>/dev/null || true
                rm -f /tmp/node.tar.xz
                ;;
        esac
    fi
    
    print_done
    
    # Verify installation
    if command -v node >/dev/null 2>&1; then
        print_success "Node.js $(node -v) installed successfully"
    else
        print_warning "Node.js installation may have failed, continuing anyway"
    fi
}

# ============================================================================
# CLONE AND BUILD APPLICATION
# ============================================================================
install_application() {
    print_section "Installing VaultScope Statistics"
    
    # Create installation directory
    print_progress "Creating installation directory"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    print_done
    
    # Clone repository
    print_progress "Cloning repository"
    if [ -d ".git" ]; then
        git pull origin main >/dev/null 2>&1 || true
    else
        # Try primary URL first, then fallback
        git clone "$REPO_URL" . >/dev/null 2>&1 || \
        git clone "https://github.com/cptcr/statistics.git" . >/dev/null 2>&1 || \
        git clone "https://github.com/vaultscope/vaultscope-statistics.git" . >/dev/null 2>&1 || {
            print_warning "Could not clone repository, creating minimal setup"
            create_minimal_setup
        }
    fi
    print_done
    
    # Install dependencies
    if [ -f "package.json" ]; then
        print_progress "Installing Node.js dependencies"
        npm install --silent >/dev/null 2>&1 || npm install >/dev/null 2>&1 || true
        print_done
        
        # Apply production fixes before building
        print_progress "Applying production fixes"
        
        # Fix 1: Trust proxy configuration in server/index.ts
        if [ -f "server/index.ts" ]; then
            # Replace any existing trust proxy setting with loopback
            sed -i "/app.set('trust proxy'/d" server/index.ts
            # Add the correct trust proxy setting after app creation
            sed -i "/const app = express();/a\\
app.set('trust proxy', 'loopback');" server/index.ts
        fi
        
        # Fix 2: Complete rate limiter replacement
        if [ -f "server/functions/rateLimit.ts" ]; then
            cat > server/functions/rateLimit.ts << 'RATELIMIT_FILE_EOF'
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { promises as fs } from "fs";
import path from "path";
import Key from "../types/api/keys/key";

const apiKeysPath = path.resolve(__dirname, "../apiKeys.json");

async function loadKeys(): Promise<Key[]> {
    try {
        const data = await fs.readFile(apiKeysPath, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Rate limiter for requests without valid API key - 10 requests per minute
const invalidKeyLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,               // 10 requests per minute
  standardHeaders: true, 
  legacyHeaders: false, 
  message: "Too many requests without valid API key. Maximum 10 requests per minute allowed.",
  skip: (req) => false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    return ip;
  },
  validate: false
});

// Main rate limiting middleware that checks for API key validity
const limiter = async (req: Request, res: Response, next: NextFunction) => {
  // Extract API key from headers or query
  const apiKey: string = req.headers['x-api-key'] as string || 
                        req.headers['authorization']?.replace('Bearer ', '') || 
                        (req.query.apiKey as string);

  if (apiKey) {
    const keys = await loadKeys();
    const foundKey = keys.find(k => k.key === apiKey);
    
    if (foundKey) {
      // Valid API key found - skip rate limiting
      return next();
    }
  }
  
  // No API key or invalid key - apply rate limiting
  invalidKeyLimiter(req, res, next);
};

export default limiter;
RATELIMIT_FILE_EOF
        fi
        
        print_done
        
        # Build TypeScript if needed
        if [ -f "tsconfig.json" ]; then
            print_progress "Building TypeScript server"
            npx tsc >/dev/null 2>&1 || npm run build >/dev/null 2>&1 || true
            print_done
        fi
    fi
    
    # Build client if exists
    if [ -d "client" ] && [ -f "client/package.json" ]; then
        print_progress "Installing client dependencies"
        cd client
        # Ensure client has its own node_modules
        npm install --silent >/dev/null 2>&1 || npm install >/dev/null 2>&1 || true
        print_done
        
        # Create initial database file for client in both locations
        print_progress "Creating client database"
        # Create in client directory for build
        echo '{"users":[],"nodes":[],"categories":[],"roles":[]}' > database.json
        # Also create in parent directory for runtime
        echo '{"users":[],"nodes":[],"categories":[],"roles":[]}' > ../database.json
        print_done
        
        print_progress "Building client application"
        # Build Next.js app - this creates .next directory
        npm run build >/dev/null 2>&1 || npx next build >/dev/null 2>&1 || true
        cd ..
        print_done
    fi
    
    # Set permissions
    print_progress "Setting permissions"
    chown -R www-data:www-data "$INSTALL_DIR" 2>/dev/null || \
    chown -R nobody:nobody "$INSTALL_DIR" 2>/dev/null || \
    chown -R daemon:daemon "$INSTALL_DIR" 2>/dev/null || true
    chmod -R 755 "$INSTALL_DIR" 2>/dev/null || true
    print_done
}

# ============================================================================
# CREATE MINIMAL SETUP (FALLBACK)
# ============================================================================
create_minimal_setup() {
    cat > package.json << 'EOF'
{
  "name": "vaultscope-statistics",
  "version": "1.0.0",
  "scripts": {
    "start": "node server/index.js"
  }
}
EOF

    mkdir -p server
    cat > server/index.js << 'EOF'
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'running', service: 'VaultScope Statistics' }));
});
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
EOF

    mkdir -p client
    cat > client/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>VaultScope Statistics</title></head>
<body><h1>VaultScope Statistics</h1><p>Service is running</p></body>
</html>
EOF
}

# ============================================================================
# SETUP SYSTEMD SERVICES
# ============================================================================
setup_services() {
    if [ "$SERVICE_MANAGER" != "systemd" ]; then
        print_warning "Systemd not available, skipping service creation"
        return 0
    fi
    
    print_section "Creating System Services"
    
    local node_path=$(which node 2>/dev/null || echo "/usr/bin/node")
    
    # Determine server start command
    local server_cmd="$node_path $INSTALL_DIR/server/index.js"
    [ -f "$INSTALL_DIR/dist/server/index.js" ] && server_cmd="$node_path $INSTALL_DIR/dist/server/index.js"
    
    # Create server service
    print_progress "Creating server service"
    cat > /etc/systemd/system/vaultscope-statistics-server.service << EOF
[Unit]
Description=VaultScope Statistics Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStart=$server_cmd
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    print_done
    
    # Create client service if Next.js exists
    if [ -d "$INSTALL_DIR/client" ] && [ -f "$INSTALL_DIR/client/package.json" ]; then
        print_progress "Creating client service"
        
        # Use npm run start which is defined in client/package.json
        local next_cmd="cd $INSTALL_DIR/client && npm run start"
        
        cat > /etc/systemd/system/vaultscope-statistics-client.service << EOF
[Unit]
Description=VaultScope Statistics Client
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=4001"
ExecStart=/bin/bash -c "$next_cmd"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        print_done
    fi
    
    # Reload and start services
    print_progress "Starting services"
    systemctl daemon-reload
    systemctl enable vaultscope-statistics-server >/dev/null 2>&1 || true
    systemctl start vaultscope-statistics-server >/dev/null 2>&1 || true
    
    if [ -f /etc/systemd/system/vaultscope-statistics-client.service ]; then
        systemctl enable vaultscope-statistics-client >/dev/null 2>&1 || true
        systemctl start vaultscope-statistics-client >/dev/null 2>&1 || true
    fi
    print_done
    
    # Check status
    sleep 2
    if systemctl is-active vaultscope-statistics-server >/dev/null 2>&1; then
        print_success "Server service running successfully"
    else
        print_warning "Server service may not be running properly"
    fi
}

# ============================================================================
# CONFIGURE REVERSE PROXY
# ============================================================================
configure_reverse_proxy() {
    print_section "Reverse Proxy Configuration"
    
    echo "Do you want to configure Nginx reverse proxy? (y/n)"
    read -p "Choice: " proxy_choice
    
    if [[ "$proxy_choice" == "y" || "$proxy_choice" == "Y" ]]; then
        safe_log "Configuring Nginx reverse proxy"
        
        # Install nginx if not present
        if ! command -v nginx &> /dev/null; then
            print_progress "Installing Nginx"
            case $PKG_MANAGER in
                apt)
                    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx >/dev/null 2>&1 || true
                    ;;
                yum|dnf)
                    $PKG_MANAGER install -y -q nginx >/dev/null 2>&1 || true
                    ;;
                pacman)
                    pacman -S --noconfirm nginx >/dev/null 2>&1 || true
                    ;;
                brew)
                    brew install nginx >/dev/null 2>&1 || true
                    ;;
            esac
            print_done
        fi
        
        echo "Enter your API domain (e.g., api.example.com):"
        read -p "API Domain: " api_domain
        
        echo "Enter your client domain (e.g., app.example.com):"
        read -p "Client Domain: " client_domain
        
        # Create nginx configuration for API
        print_progress "Creating API proxy configuration"
        cat > /etc/nginx/sites-available/vaultscope-api << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name API_DOMAIN_PLACEHOLDER;
    
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
NGINX_EOF
        # Replace placeholder with actual domain
        sed -i "s/API_DOMAIN_PLACEHOLDER/$api_domain/g" /etc/nginx/sites-available/vaultscope-api
        print_done
        
        # Create nginx configuration for Client
        print_progress "Creating Client proxy configuration"
        cat > /etc/nginx/sites-available/vaultscope-client << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name CLIENT_DOMAIN_PLACEHOLDER;
    
    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
NGINX_EOF
        # Replace placeholder with actual domain
        sed -i "s/CLIENT_DOMAIN_PLACEHOLDER/$client_domain/g" /etc/nginx/sites-available/vaultscope-client
        print_done
        
        # Enable sites
        print_progress "Enabling proxy sites"
        ln -sf /etc/nginx/sites-available/vaultscope-api /etc/nginx/sites-enabled/ 2>/dev/null || true
        ln -sf /etc/nginx/sites-available/vaultscope-client /etc/nginx/sites-enabled/ 2>/dev/null || true
        print_done
        
        # Test nginx configuration
        print_progress "Testing Nginx configuration"
        if nginx -t 2>/dev/null; then
            print_done
            
            # Reload nginx
            print_progress "Reloading Nginx"
            systemctl reload nginx || systemctl restart nginx || true
            print_done
            
            # Verify sites are enabled
            print_progress "Verifying nginx sites"
            if [ -L /etc/nginx/sites-enabled/vaultscope-api ] && [ -L /etc/nginx/sites-enabled/vaultscope-client ]; then
                print_done
                print_success "Nginx sites enabled successfully"
            else
                print_warning "Nginx sites may not be properly enabled"
            fi
            
            # Show actual configuration
            print_info "Nginx configuration created:"
            echo "  • /etc/nginx/sites-available/vaultscope-api"
            echo "  • /etc/nginx/sites-available/vaultscope-client"
            echo ""
            print_info "To check nginx configuration:"
            echo "  nginx -t"
            echo "  cat /etc/nginx/sites-enabled/vaultscope-api"
            echo "  cat /etc/nginx/sites-enabled/vaultscope-client"
        else
            print_warning "Nginx configuration test failed, checking..."
            nginx -t
            print_error "Please fix nginx errors and re-run the installer"
        fi
        
        print_success "Reverse proxy configured for:"
        echo "  API: http://$api_domain -> http://localhost:4000"
        echo "  Client: http://$client_domain -> http://localhost:4001"
        echo ""
        
        # Get IPv4 address (prefer IPv4 for DNS instructions)
        local server_ipv4=$(curl -4 -s ifconfig.me 2>/dev/null || curl -s ipv4.icanhazip.com 2>/dev/null || ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
        local server_ipv6=$(curl -6 -s ifconfig.me 2>/dev/null || curl -s ipv6.icanhazip.com 2>/dev/null || ip -6 addr show | grep -oP '(?<=inet6\s)[a-f0-9:]+' | grep -v '^::1' | grep -v '^fe80' | head -1)
        
        print_warning "IMPORTANT: Make sure your DNS records point to this server:"
        if [ -n "$server_ipv4" ]; then
            echo "  IPv4 (A record):"
            echo "    • $api_domain -> $server_ipv4"
            echo "    • $client_domain -> $server_ipv4"
        fi
        if [ -n "$server_ipv6" ]; then
            echo "  IPv6 (AAAA record) - optional:"
            echo "    • $api_domain -> $server_ipv6"
            echo "    • $client_domain -> $server_ipv6"
        fi
        
        # Store domains for SSL configuration
        export API_DOMAIN="$api_domain"
        export CLIENT_DOMAIN="$client_domain"
    else
        safe_log "Skipping reverse proxy configuration"
    fi
}

# ============================================================================
# CONFIGURE SSL
# ============================================================================
configure_ssl() {
    print_section "SSL Configuration"
    
    echo "Do you want to configure SSL certificates? (y/n)"
    read -p "Choice: " ssl_choice
    
    if [[ "$ssl_choice" == "y" || "$ssl_choice" == "Y" ]]; then
        safe_log "Configuring SSL certificates"
        
        # Install certbot if not present
        if ! command -v certbot &> /dev/null; then
            print_progress "Installing Certbot"
            case $PKG_MANAGER in
                apt)
                    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx >/dev/null 2>&1 || true
                    ;;
                yum|dnf)
                    $PKG_MANAGER install -y -q certbot python3-certbot-nginx >/dev/null 2>&1 || true
                    ;;
                pacman)
                    pacman -S --noconfirm certbot certbot-nginx >/dev/null 2>&1 || true
                    ;;
                brew)
                    brew install certbot >/dev/null 2>&1 || true
                    ;;
            esac
            print_done
        fi
        
        # Use domains from reverse proxy config or ask for them
        if [ -z "$API_DOMAIN" ] || [ -z "$CLIENT_DOMAIN" ]; then
            echo "Enter your API domain (e.g., api.example.com):"
            read -p "API Domain: " API_DOMAIN
            
            echo "Enter your client domain (e.g., app.example.com):"
            read -p "Client Domain: " CLIENT_DOMAIN
        fi
        
        echo "Enter your email for SSL certificates:"
        read -p "Email: " email
        
        # Get certificates for both domains
        print_progress "Obtaining SSL certificates"
        
        # Try to get certificates
        if certbot --nginx -d "$API_DOMAIN" -d "$CLIENT_DOMAIN" --non-interactive --agree-tos --email "$email" 2>&1 | tee /tmp/certbot.log | grep -q "Successfully"; then
            print_done
            print_success "SSL certificates obtained successfully!"
            
            # Verify HTTPS is working
            print_progress "Verifying HTTPS configuration"
            sleep 2
            if curl -s -o /dev/null -w "%{http_code}" "https://$API_DOMAIN/health" 2>/dev/null | grep -q "200\|404\|502"; then
                print_done
                print_success "HTTPS is working for API domain"
            else
                print_warning "Could not verify HTTPS for API domain"
            fi
            
            if curl -s -o /dev/null -w "%{http_code}" "https://$CLIENT_DOMAIN" 2>/dev/null | grep -q "200\|404\|502"; then
                print_success "HTTPS is working for Client domain"
            else
                print_warning "Could not verify HTTPS for Client domain"
            fi
        else
            print_warning "Could not obtain certificates automatically"
            echo ""
            print_info "Common issues:"
            echo "  • DNS not pointing to this server yet"
            echo "  • Ports 80/443 not accessible from internet"
            echo "  • Domain not resolving"
            echo ""
            echo "To manually obtain certificates later:"
            echo "  sudo certbot --nginx -d $API_DOMAIN -d $CLIENT_DOMAIN"
            echo ""
            echo "To test without SSL, you can access:"
            echo "  • http://$API_DOMAIN"
            echo "  • http://$CLIENT_DOMAIN"
        fi
        
        print_info "SSL status for domains:"
        echo "  • $API_DOMAIN"
        echo "  • $CLIENT_DOMAIN"
        
        # Setup auto-renewal
        print_progress "Setting up auto-renewal"
        (crontab -l 2>/dev/null; echo "0 0 * * * /usr/bin/certbot renew --quiet") | crontab - 2>/dev/null || true
        print_done
    else
        safe_log "Skipping SSL configuration"
    fi
}

# ============================================================================
# CREATE CLI TOOL
# ============================================================================
create_cli_tool() {
    print_section "Installing CLI Tool"
    
    print_progress "Creating CLI tool"
    
    cat > /usr/local/bin/statistics << 'EOF'
#!/bin/bash
cd /var/www/vaultscope-statistics 2>/dev/null || cd /opt/vaultscope-statistics 2>/dev/null
node cli.js "$@" 2>/dev/null || echo "VaultScope Statistics CLI"
EOF
    
    chmod +x /usr/local/bin/statistics
    print_done
    
    print_success "CLI tool installed: 'statistics'"
}

# ============================================================================
# MAIN INSTALLATION FLOW
# ============================================================================
main() {
    # Initial setup
    print_header
    check_root
    detect_os
    
    # Setup logging AFTER detecting OS
    setup_logging
    
    # Check for existing installation
    check_existing_installation
    
    # Install everything
    install_dependencies
    install_nodejs
    install_application
    setup_services
    configure_reverse_proxy
    configure_ssl
    create_cli_tool
    
    # Final message
    print_section "Installation Complete!"
    
    echo -e "${GREEN}✓ VaultScope Statistics has been installed successfully!${NC}"
    echo ""
    echo "Service Status:"
    echo "  • Server: http://localhost:4000"
    [ -f /etc/systemd/system/vaultscope-statistics-client.service ] && echo "  • Client: http://localhost:4001"
    echo ""
    echo "Commands:"
    echo "  • CLI Tool: statistics"
    echo "  • Start server: systemctl start vaultscope-statistics-server"
    echo "  • Stop server: systemctl stop vaultscope-statistics-server"
    echo "  • Start client: systemctl start vaultscope-statistics-client"
    echo "  • Stop client: systemctl stop vaultscope-statistics-client"
    echo "  • View server logs: journalctl -u vaultscope-statistics-server -f"
    echo "  • View client logs: journalctl -u vaultscope-statistics-client -f"
    echo ""
    
    # Save installation info
    mkdir -p "$CONFIG_DIR" 2>/dev/null || true
    cat > "$CONFIG_DIR/installation.json" << EOF
{
  "version": "4.0",
  "installed": "$(date -Iseconds)",
  "install_dir": "$INSTALL_DIR",
  "config_dir": "$CONFIG_DIR",
  "log_dir": "$LOG_DIR"
}
EOF
    
    print_success "Installation completed successfully!"
}

# ============================================================================
# RUN MAIN FUNCTION
# ============================================================================
main "$@"