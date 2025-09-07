#!/bin/bash

set -euo pipefail
IFS=$'\n\t'

readonly SCRIPT_VERSION="3.0.0"
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="/tmp/vaultscope-install-$(date +%Y%m%d-%H%M%S).log"
readonly GITHUB_REPO="https://github.com/VaultScope/statistics"
readonly CONFIG_DIR="/etc/vaultscope"
readonly CONFIG_FILE="$CONFIG_DIR/statistics.json"
readonly CLI_URL="https://raw.githubusercontent.com/VaultScope/statistics/main/cli.js"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

INSTALL_PATH=""
UNINSTALL=false
SILENT=false
CLIENT_ONLY=false
SERVER_ONLY=false
USE_PROXY=false
PROXY_TYPE=""
PROXY_DOMAIN=""
OS=""
DISTRO=""
PKG_MANAGER=""
INIT_SYSTEM=""
TEMP_DIR=""

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    echo "$timestamp [$level] $message" >> "$LOG_FILE"
    
    if [[ "$SILENT" != "true" ]]; then
        case "$level" in
            SUCCESS) echo -e "${GREEN}✓${NC} $message" ;;
            INFO) echo -e "${CYAN}ℹ${NC} $message" ;;
            WARNING) echo -e "${YELLOW}⚠${NC} $message" ;;
            ERROR) echo -e "${RED}✗${NC} $message" ;;
            *) echo "$message" ;;
        esac
    fi
}

error_exit() {
    log "ERROR" "$1"
    log "INFO" "Installation log: $LOG_FILE"
    exit 1
}

cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log "WARNING" "Installation interrupted (exit code: $exit_code)"
    fi
    if [[ -d "${TEMP_DIR:-}" ]]; then
        rm -rf "$TEMP_DIR" 2>/dev/null || true
    fi
    stty echo 2>/dev/null || true
}

trap cleanup EXIT INT TERM

show_usage() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -v, --version           Show version
    -p, --path PATH         Installation path (default: auto-detected)
    -u, --uninstall         Uninstall VaultScope Statistics
    -s, --silent            Silent installation
    -c, --client-only       Install client only
    -S, --server-only       Install server only
    --proxy TYPE            Setup reverse proxy (nginx|cloudflared)
    --domain DOMAIN         Domain for reverse proxy

EXAMPLES:
    $SCRIPT_NAME                    # Interactive installation
    $SCRIPT_NAME --path /opt/vs     # Install to specific path
    $SCRIPT_NAME --uninstall        # Remove installation
    $SCRIPT_NAME --proxy nginx --domain stats.example.com

EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--version)
                echo "VaultScope Statistics Installer v$SCRIPT_VERSION"
                exit 0
                ;;
            -p|--path)
                INSTALL_PATH="$2"
                shift 2
                ;;
            -u|--uninstall)
                UNINSTALL=true
                shift
                ;;
            -s|--silent)
                SILENT=true
                shift
                ;;
            -c|--client-only)
                CLIENT_ONLY=true
                shift
                ;;
            -S|--server-only)
                SERVER_ONLY=true
                shift
                ;;
            --proxy)
                USE_PROXY=true
                PROXY_TYPE="$2"
                shift 2
                ;;
            --domain)
                PROXY_DOMAIN="$2"
                shift 2
                ;;
            *)
                error_exit "Unknown option: $1"
                ;;
        esac
    done
}

detect_os() {
    log "INFO" "Detecting operating system..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macos"
        PKG_MANAGER="brew"
        INIT_SYSTEM="launchd"
        log "SUCCESS" "Detected OS: macOS"
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS="linux"
        DISTRO="${ID,,}"
        
        case "$DISTRO" in
            ubuntu|debian|raspbian)
                PKG_MANAGER="apt"
                INIT_SYSTEM="systemd"
                ;;
            rhel|centos|rocky|almalinux|fedora)
                PKG_MANAGER="yum"
                [[ "$DISTRO" == "fedora" ]] && PKG_MANAGER="dnf"
                INIT_SYSTEM="systemd"
                ;;
            arch|manjaro)
                PKG_MANAGER="pacman"
                INIT_SYSTEM="systemd"
                ;;
            alpine)
                PKG_MANAGER="apk"
                INIT_SYSTEM="openrc"
                ;;
            *)
                error_exit "Unsupported Linux distribution: $DISTRO"
                ;;
        esac
        
        log "SUCCESS" "Detected OS: Linux ($DISTRO)"
    else
        error_exit "Unable to detect operating system"
    fi
    
    if [[ -z "$INSTALL_PATH" ]]; then
        if [[ "$OS" == "macos" ]]; then
            INSTALL_PATH="$HOME/VaultScope/Statistics"
        else
            INSTALL_PATH="/opt/vaultscope/statistics"
        fi
    fi
}

check_root() {
    if [[ "$OS" == "linux" ]] && [[ $EUID -ne 0 ]]; then
        if command -v sudo >/dev/null 2>&1; then
            log "INFO" "Re-running with sudo..."
            exec sudo "$0" "$@"
        else
            error_exit "This script must be run as root on Linux"
        fi
    fi
}

check_internet() {
    log "INFO" "Checking internet connection..."
    
    local test_urls=("https://api.github.com" "https://nodejs.org" "https://registry.npmjs.org")
    
    for url in "${test_urls[@]}"; do
        if curl -sS --connect-timeout 5 --head "$url" >/dev/null 2>&1; then
            log "SUCCESS" "Internet connection verified"
            return 0
        fi
    done
    
    error_exit "No internet connection available"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

install_package() {
    local package="$1"
    log "INFO" "Installing $package..."
    
    case "$PKG_MANAGER" in
        apt)
            apt-get update -qq >/dev/null 2>&1
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$package" >/dev/null 2>&1
            ;;
        yum)
            yum install -y -q "$package" >/dev/null 2>&1
            ;;
        dnf)
            dnf install -y -q "$package" >/dev/null 2>&1
            ;;
        pacman)
            pacman -S --noconfirm --quiet "$package" >/dev/null 2>&1
            ;;
        brew)
            brew install --quiet "$package" >/dev/null 2>&1
            ;;
        apk)
            apk add --no-cache --quiet "$package" >/dev/null 2>&1
            ;;
    esac
}

install_nodejs() {
    log "INFO" "Checking Node.js installation..."
    
    if command_exists node; then
        local node_version="$(node --version 2>/dev/null || echo "v0.0.0")"
        local major_version="${node_version%%.*}"
        major_version="${major_version#v}"
        
        if [[ "$major_version" -ge 18 ]]; then
            log "SUCCESS" "Node.js $node_version is already installed"
            return 0
        fi
        
        log "WARNING" "Node.js $node_version is too old, upgrading to v20..."
    fi
    
    log "INFO" "Installing Node.js v20 LTS..."
    
    case "$OS" in
        macos)
            if ! command_exists brew; then
                error_exit "Homebrew is required. Install from https://brew.sh"
            fi
            brew install --quiet node@20 >/dev/null 2>&1 || brew upgrade --quiet node@20 >/dev/null 2>&1
            ;;
        linux)
            case "$DISTRO" in
                ubuntu|debian|raspbian)
                    curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1
                    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null 2>&1
                    ;;
                rhel|centos|rocky|almalinux)
                    curl -fsSL https://rpm.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1
                    yum install -y -q nodejs >/dev/null 2>&1
                    ;;
                fedora)
                    dnf module install -y -q nodejs:20 >/dev/null 2>&1
                    ;;
                arch|manjaro)
                    pacman -S --noconfirm --quiet nodejs npm >/dev/null 2>&1
                    ;;
                alpine)
                    apk add --no-cache --quiet nodejs npm >/dev/null 2>&1
                    ;;
            esac
            ;;
    esac
    
    if ! command_exists node; then
        error_exit "Failed to install Node.js"
    fi
    
    log "SUCCESS" "Node.js installed successfully"
}

install_git() {
    log "INFO" "Checking Git installation..."
    
    if command_exists git; then
        log "SUCCESS" "Git is already installed"
        return 0
    fi
    
    log "INFO" "Installing Git..."
    
    case "$OS" in
        macos)
            if ! command_exists brew; then
                xcode-select --install 2>/dev/null || true
            else
                brew install --quiet git >/dev/null 2>&1
            fi
            ;;
        linux)
            install_package "git"
            ;;
    esac
    
    if ! command_exists git; then
        error_exit "Failed to install Git"
    fi
    
    log "SUCCESS" "Git installed successfully"
}

install_build_tools() {
    log "INFO" "Checking build tools..."
    
    case "$OS" in
        linux)
            case "$DISTRO" in
                ubuntu|debian|raspbian)
                    if ! command_exists make || ! command_exists gcc; then
                        log "INFO" "Installing build-essential..."
                        apt-get update -qq >/dev/null 2>&1
                        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq build-essential python3 >/dev/null 2>&1
                    fi
                    ;;
                rhel|centos|rocky|almalinux)
                    if ! command_exists make || ! command_exists gcc; then
                        log "INFO" "Installing Development Tools..."
                        yum groupinstall -y -q "Development Tools" >/dev/null 2>&1
                        yum install -y -q python3 >/dev/null 2>&1
                    fi
                    ;;
                fedora)
                    if ! command_exists make || ! command_exists gcc; then
                        log "INFO" "Installing Development Tools..."
                        dnf groupinstall -y -q "Development Tools" >/dev/null 2>&1
                        dnf install -y -q python3 >/dev/null 2>&1
                    fi
                    ;;
                arch|manjaro)
                    if ! command_exists make || ! command_exists gcc; then
                        log "INFO" "Installing base-devel..."
                        pacman -S --noconfirm --quiet base-devel python >/dev/null 2>&1
                    fi
                    ;;
                alpine)
                    apk add --no-cache --quiet build-base python3 >/dev/null 2>&1
                    ;;
            esac
            log "SUCCESS" "Build tools installed"
            ;;
        macos)
            if ! command_exists make; then
                log "INFO" "Installing Xcode Command Line Tools..."
                xcode-select --install 2>/dev/null || true
            fi
            log "SUCCESS" "Build tools ready"
            ;;
    esac
}

install_pm2() {
    log "INFO" "Checking PM2 installation..."
    
    if command_exists pm2; then
        log "SUCCESS" "PM2 is already installed"
        return 0
    fi
    
    log "INFO" "Installing PM2 globally..."
    npm install -g pm2 --silent >/dev/null 2>&1
    
    if ! command_exists pm2; then
        error_exit "Failed to install PM2"
    fi
    
    log "SUCCESS" "PM2 installed successfully"
}

download_from_github() {
    local component="$1"
    local target_dir="$2"
    
    log "INFO" "Downloading $component from GitHub..."
    
    TEMP_DIR="$(mktemp -d)"
    
    if [[ "$component" == "cli" ]]; then
        curl -fsSL "$CLI_URL" -o "$target_dir/cli.js" 2>/dev/null || {
            log "WARNING" "Failed to download CLI from GitHub"
            return 1
        }
        chmod +x "$target_dir/cli.js"
        return 0
    fi
    
    local archive_url="${GITHUB_REPO}/archive/refs/heads/main.tar.gz"
    
    if curl -fsSL "$archive_url" -o "$TEMP_DIR/repo.tar.gz" 2>/dev/null; then
        tar -xzf "$TEMP_DIR/repo.tar.gz" -C "$TEMP_DIR" 2>/dev/null || {
            log "WARNING" "Failed to extract repository archive"
            rm -rf "$TEMP_DIR"
            return 1
        }
        
        local extracted_dir="$TEMP_DIR/statistics-main"
        
        if [[ -d "$extracted_dir/$component" ]]; then
            cp -r "$extracted_dir/$component/"* "$target_dir/" 2>/dev/null || true
            cp -r "$extracted_dir/$component/".* "$target_dir/" 2>/dev/null || true
            rm -rf "$TEMP_DIR"
            return 0
        fi
    fi
    
    rm -rf "$TEMP_DIR"
    return 1
}

setup_component() {
    local component_path="$1"
    local component_name="$2"
    local port="$3"
    
    log "INFO" "Setting up $component_name..."
    
    mkdir -p "$component_path"
    
    if ! download_from_github "$component_name" "$component_path"; then
        log "WARNING" "Using fallback configuration for $component_name"
        
        cd "$component_path"
        
        if [[ "$component_name" == "server" ]]; then
            cat > package.json << 'EOF'
{
  "name": "vaultscope-statistics-server",
  "version": "1.0.0",
  "scripts": {
    "start": "node index.js",
    "build": "echo Build complete"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "systeminformation": "^5.21.20",
    "dotenv": "^16.3.1"
  }
}
EOF
            
            cat > index.js << 'EOF'
const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const apiKey = process.env.API_KEY;

app.use((req, res, next) => {
    const key = req.headers['x-api-key'] || req.query.apiKey;
    if (req.path === '/health' || key === apiKey) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.get('/data', async (req, res) => {
    try {
        const [cpu, mem, disk] = await Promise.all([
            si.cpu(),
            si.mem(),
            si.fsSize()
        ]);
        res.json({ cpu, memory: mem, disk });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`VaultScope Statistics Server running on port ${PORT}`);
});
EOF
        elif [[ "$component_name" == "client" ]]; then
            cat > package.json << EOF
{
  "name": "vaultscope-statistics-client",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p $port"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
EOF
        fi
    fi
    
    cd "$component_path"
    
    log "INFO" "Installing dependencies for $component_name..."
    
    npm install --production --no-optional --loglevel=error >/dev/null 2>&1 || \
    npm install --production --no-optional >/dev/null 2>&1 || \
    npm install --production >/dev/null 2>&1 || true
    
    if [[ -f "tsconfig.json" ]] || [[ -f "index.ts" ]]; then
        log "INFO" "Building TypeScript for $component_name..."
        npm run build >/dev/null 2>&1 || true
    elif [[ "$component_name" == "client" ]] && [[ -f "package.json" ]]; then
        log "INFO" "Building Next.js application..."
        npm run build >/dev/null 2>&1 || true
    fi
    
    return 0
}

create_service_script() {
    local service_name="$1"
    local component_path="$2"
    local start_command="$3"
    
    local service_script="$INSTALL_PATH/bin/${service_name}-service.sh"
    mkdir -p "$INSTALL_PATH/bin"
    
    cat > "$service_script" << EOF
#!/bin/bash

SERVICE_NAME="$service_name"
COMPONENT_PATH="$component_path"
PID_FILE="/var/run/\${SERVICE_NAME}.pid"
LOG_FILE="/var/log/\${SERVICE_NAME}.log"

start() {
    if [[ -f "\$PID_FILE" ]] && kill -0 \$(cat "\$PID_FILE") 2>/dev/null; then
        echo "\$SERVICE_NAME is already running"
        return 1
    fi
    
    echo "Starting \$SERVICE_NAME..."
    cd "\$COMPONENT_PATH"
    nohup $start_command >> "\$LOG_FILE" 2>&1 &
    echo \$! > "\$PID_FILE"
    echo "\$SERVICE_NAME started"
}

stop() {
    if [[ ! -f "\$PID_FILE" ]]; then
        echo "\$SERVICE_NAME is not running"
        return 1
    fi
    
    echo "Stopping \$SERVICE_NAME..."
    kill \$(cat "\$PID_FILE") 2>/dev/null
    rm -f "\$PID_FILE"
    echo "\$SERVICE_NAME stopped"
}

restart() {
    stop
    sleep 2
    start
}

status() {
    if [[ -f "\$PID_FILE" ]] && kill -0 \$(cat "\$PID_FILE") 2>/dev/null; then
        echo "\$SERVICE_NAME is running (PID: \$(cat "\$PID_FILE"))"
    else
        echo "\$SERVICE_NAME is not running"
        rm -f "\$PID_FILE" 2>/dev/null
    fi
}

case "\$1" in
    start) start ;;
    stop) stop ;;
    restart) restart ;;
    status) status ;;
    *) echo "Usage: \$0 {start|stop|restart|status}" ;;
esac
EOF
    
    chmod +x "$service_script"
    
    if [[ "$OS" == "linux" ]]; then
        ln -sf "$service_script" "/usr/local/bin/vaultscope-${service_name}" 2>/dev/null || true
    fi
}

create_systemd_service() {
    local service_name="$1"
    local description="$2"
    local exec_start="$3"
    local working_dir="$4"
    
    if [[ "$INIT_SYSTEM" != "systemd" ]]; then
        return 0
    fi
    
    log "INFO" "Creating systemd service: $service_name"
    
    local service_user="nobody"
    if [[ "$EUID" -eq 0 ]]; then
        if ! id "vaultscope" >/dev/null 2>&1; then
            useradd -r -s /bin/false vaultscope 2>/dev/null || true
        fi
        service_user="vaultscope"
        chown -R "$service_user:$service_user" "$working_dir" 2>/dev/null || true
    else
        service_user="$(whoami)"
    fi
    
    cat > "/etc/systemd/system/$service_name.service" << EOF
[Unit]
Description=$description
After=network.target

[Service]
Type=simple
User=$service_user
Group=$service_user
WorkingDirectory=$working_dir
ExecStart=$exec_start
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "$service_name" >/dev/null 2>&1
    systemctl start "$service_name" >/dev/null 2>&1
    
    log "SUCCESS" "Service $service_name created and started"
}

create_launchd_service() {
    local service_name="$1"
    local description="$2"
    local exec_command="$3"
    local working_dir="$4"
    
    if [[ "$OS" != "macos" ]]; then
        return 0
    fi
    
    local plist_file="$HOME/Library/LaunchAgents/com.vaultscope.$service_name.plist"
    
    mkdir -p "$HOME/Library/LaunchAgents"
    
    cat > "$plist_file" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vaultscope.$service_name</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(echo $exec_command | cut -d' ' -f1)</string>
        $(echo $exec_command | cut -d' ' -f2- | tr ' ' '\n' | sed 's/.*/<string>&<\/string>/')
    </array>
    <key>WorkingDirectory</key>
    <string>$working_dir</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/$service_name.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/$service_name.error.log</string>
</dict>
</plist>
EOF
    
    launchctl load "$plist_file" 2>/dev/null || true
    
    log "SUCCESS" "LaunchAgent $service_name created"
}

install_nginx_proxy() {
    log "INFO" "Setting up Nginx reverse proxy..."
    
    if ! command_exists nginx; then
        log "INFO" "Installing Nginx..."
        case "$OS" in
            linux)
                install_package "nginx"
                ;;
            macos)
                brew install nginx >/dev/null 2>&1
                ;;
        esac
    fi
    
    if [[ -z "$PROXY_DOMAIN" ]]; then
        PROXY_DOMAIN="localhost"
    fi
    
    local nginx_conf="/etc/nginx/sites-available/vaultscope"
    [[ "$OS" == "macos" ]] && nginx_conf="/usr/local/etc/nginx/servers/vaultscope.conf"
    
    log "INFO" "Configuring Nginx for domain: $PROXY_DOMAIN"
    
    cat > "$nginx_conf" << EOF
server {
    listen 80;
    server_name $PROXY_DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api {
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
    
    if [[ "$OS" == "linux" ]]; then
        ln -sf "$nginx_conf" /etc/nginx/sites-enabled/vaultscope 2>/dev/null || true
        nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1
    else
        brew services restart nginx >/dev/null 2>&1
    fi
    
    log "SUCCESS" "Nginx reverse proxy configured for $PROXY_DOMAIN"
    log "INFO" "You can now access:"
    log "INFO" "  Dashboard: http://$PROXY_DOMAIN"
    log "INFO" "  API: http://$PROXY_DOMAIN/api"
}

install_cloudflared_proxy() {
    log "INFO" "Installing Cloudflare Tunnel..."
    
    if ! command_exists cloudflared; then
        case "$OS" in
            linux)
                case "$DISTRO" in
                    ubuntu|debian|raspbian)
                        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
                        dpkg -i cloudflared-linux-amd64.deb >/dev/null 2>&1
                        rm cloudflared-linux-amd64.deb
                        ;;
                    *)
                        wget -q -O /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
                        chmod +x /usr/local/bin/cloudflared
                        ;;
                esac
                ;;
            macos)
                brew install cloudflared >/dev/null 2>&1
                ;;
        esac
    fi
    
    log "INFO" "Configuring Cloudflare Tunnel..."
    
    local tunnel_config="$CONFIG_DIR/cloudflared.yml"
    
    cat > "$tunnel_config" << EOF
tunnel: vaultscope-statistics
credentials-file: $CONFIG_DIR/cloudflared-creds.json

ingress:
  - hostname: ${PROXY_DOMAIN:-localhost}
    service: http://localhost:3000
  - hostname: api.${PROXY_DOMAIN:-localhost}
    service: http://localhost:4000
  - service: http_status:404
EOF
    
    log "INFO" "Cloudflare Tunnel configured"
    log "WARNING" "Run 'cloudflared tunnel login' to authenticate"
    log "WARNING" "Then run 'cloudflared tunnel create vaultscope-statistics'"
    log "WARNING" "Finally run 'cloudflared tunnel route dns vaultscope-statistics $PROXY_DOMAIN'"
}

install_server() {
    local server_path="$INSTALL_PATH/server"
    
    setup_component "$server_path" "server" "4000"
    
    cd "$server_path"
    
    local api_key=""
    if command_exists openssl; then
        api_key="$(openssl rand -hex 24 2>/dev/null)"
    elif [[ -f /dev/urandom ]]; then
        api_key="$(head -c 48 /dev/urandom | base64 | tr -d '+/=' | head -c 48)"
    else
        api_key="$(date +%s%N | sha256sum | head -c 48)"
    fi
    
    cat > .env << EOF
PORT=4000
API_KEY=$api_key
NODE_ENV=production
EOF
    
    local entry_point=""
    if [[ -f "dist/index.js" ]]; then
        entry_point="$server_path/dist/index.js"
    elif [[ -f "index.js" ]]; then
        entry_point="$server_path/index.js"
    else
        log "WARNING" "No server entry point found, using default"
        entry_point="$server_path/index.js"
    fi
    
    create_service_script "server" "$server_path" "$(command -v node) $entry_point"
    
    if [[ "$OS" == "linux" ]] && [[ "$INIT_SYSTEM" == "systemd" ]]; then
        create_systemd_service \
            "vaultscope-server" \
            "VaultScope Statistics Server" \
            "$(command -v node) $entry_point" \
            "$server_path"
    elif [[ "$OS" == "macos" ]]; then
        create_launchd_service \
            "server" \
            "VaultScope Statistics Server" \
            "$(command -v node) $entry_point" \
            "$server_path"
    else
        pm2 delete vaultscope-server 2>/dev/null || true
        pm2 start "$entry_point" --name "vaultscope-server" --cwd "$server_path" >/dev/null 2>&1
        pm2 save >/dev/null 2>&1
        
        if [[ "$OS" == "linux" ]]; then
            local current_user="$(whoami)"
            pm2 startup systemd -u "$current_user" --hp "$HOME" 2>/dev/null | grep -v "^\[PM2\]" | bash >/dev/null 2>&1 || true
        fi
    fi
    
    echo "$api_key" > "$INSTALL_PATH/server-api-key.txt"
    chmod 600 "$INSTALL_PATH/server-api-key.txt"
    
    log "SUCCESS" "Server installed successfully!"
    log "INFO" "Server URL: http://localhost:4000"
    log "WARNING" "API Key: $api_key"
    log "WARNING" "API Key saved to: $INSTALL_PATH/server-api-key.txt"
    
    return 0
}

install_client() {
    local client_path="$INSTALL_PATH/client"
    
    setup_component "$client_path" "client" "3000"
    
    cd "$client_path"
    
    local session_secret=""
    if command_exists uuidgen; then
        session_secret="$(uuidgen)"
    elif [[ -f /proc/sys/kernel/random/uuid ]]; then
        session_secret="$(cat /proc/sys/kernel/random/uuid)"
    else
        session_secret="$(date +%s%N | sha256sum | head -c 32)"
    fi
    
    cat > .env.production << EOF
NEXT_PUBLIC_API_URL=http://localhost:4000
NODE_ENV=production
SESSION_SECRET=$session_secret
EOF
    
    create_service_script "client" "$client_path" "$(command -v npm) run start"
    
    if [[ "$OS" == "linux" ]] && [[ "$INIT_SYSTEM" == "systemd" ]]; then
        create_systemd_service \
            "vaultscope-client" \
            "VaultScope Statistics Client" \
            "$(command -v npm) run start" \
            "$client_path"
    elif [[ "$OS" == "macos" ]]; then
        create_launchd_service \
            "client" \
            "VaultScope Statistics Client" \
            "$(command -v npm) run start" \
            "$client_path"
    else
        pm2 delete vaultscope-client 2>/dev/null || true
        pm2 start "npm run start" --name "vaultscope-client" --cwd "$client_path" >/dev/null 2>&1
        pm2 save >/dev/null 2>&1
    fi
    
    log "SUCCESS" "Client installed successfully!"
    log "INFO" "Client URL: http://localhost:3000"
    
    return 0
}

install_cli() {
    log "INFO" "Installing VaultScope CLI..."
    
    local cli_path="$INSTALL_PATH/cli.js"
    
    if ! download_from_github "cli" "$INSTALL_PATH"; then
        log "WARNING" "Could not download CLI from GitHub"
        
        cat > "$cli_path" << 'EOF'
#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = '/etc/vaultscope/statistics.json';

function getConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (err) {
        console.error('Configuration not found. Is VaultScope installed?');
        process.exit(1);
    }
}

function showHelp() {
    console.log(`
VaultScope CLI

Usage: vaultscope [COMMAND]

Commands:
  status      Show service status
  start       Start all services
  stop        Stop all services
  restart     Restart all services
  logs        View service logs
  statistics  Show installation info
  help        Show this help

`);
}

const command = process.argv[2] || 'help';
const config = command !== 'help' ? getConfig() : null;

switch (command) {
    case 'status':
        if (config.serviceManager === 'systemd') {
            exec('systemctl status vaultscope-*', (err, stdout) => console.log(stdout));
        } else {
            exec('pm2 list', (err, stdout) => console.log(stdout));
        }
        break;
    
    case 'start':
        if (config.serviceManager === 'systemd') {
            exec('sudo systemctl start vaultscope-server vaultscope-client', (err) => {
                console.log(err ? 'Failed to start services' : 'Services started');
            });
        } else {
            exec('pm2 start all', (err) => {
                console.log(err ? 'Failed to start services' : 'Services started');
            });
        }
        break;
    
    case 'stop':
        if (config.serviceManager === 'systemd') {
            exec('sudo systemctl stop vaultscope-server vaultscope-client', (err) => {
                console.log(err ? 'Failed to stop services' : 'Services stopped');
            });
        } else {
            exec('pm2 stop all', (err) => {
                console.log(err ? 'Failed to stop services' : 'Services stopped');
            });
        }
        break;
    
    case 'restart':
        if (config.serviceManager === 'systemd') {
            exec('sudo systemctl restart vaultscope-server vaultscope-client', (err) => {
                console.log(err ? 'Failed to restart services' : 'Services restarted');
            });
        } else {
            exec('pm2 restart all', (err) => {
                console.log(err ? 'Failed to restart services' : 'Services restarted');
            });
        }
        break;
    
    case 'logs':
        if (config.serviceManager === 'systemd') {
            exec('sudo journalctl -u vaultscope-* -f', (err, stdout) => console.log(stdout));
        } else {
            exec('pm2 logs', (err, stdout) => console.log(stdout));
        }
        break;
    
    case 'statistics':
        console.log('VaultScope Statistics Installation:');
        console.log(JSON.stringify(config, null, 2));
        break;
    
    case 'help':
    case '-h':
    case '--help':
        showHelp();
        break;
    
    default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
}
EOF
    fi
    
    chmod +x "$cli_path"
    
    if [[ "$OS" == "linux" ]] || [[ "$OS" == "macos" ]]; then
        ln -sf "$cli_path" /usr/local/bin/vaultscope 2>/dev/null || true
    fi
    
    if command_exists vaultscope; then
        log "SUCCESS" "VaultScope CLI installed"
    fi
}

save_configuration() {
    log "INFO" "Saving configuration..."
    
    mkdir -p "$CONFIG_DIR" 2>/dev/null || true
    
    local components=()
    [[ -d "$INSTALL_PATH/server" ]] && components+=("server")
    [[ -d "$INSTALL_PATH/client" ]] && components+=("client")
    
    local service_manager="none"
    if [[ "$INIT_SYSTEM" == "systemd" ]]; then
        service_manager="systemd"
    elif [[ "$OS" == "macos" ]]; then
        service_manager="launchd"
    elif command_exists pm2; then
        service_manager="pm2"
    fi
    
    cat > "$CONFIG_FILE" << EOF
{
  "version": "$SCRIPT_VERSION",
  "installPath": "$INSTALL_PATH",
  "installDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platform": "$OS",
  "distro": "$DISTRO",
  "components": $(printf '%s\n' "${components[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]'),
  "serviceManager": "$service_manager",
  "proxyEnabled": $([[ "$USE_PROXY" == "true" ]] && echo "true" || echo "false"),
  "proxyType": "${PROXY_TYPE:-none}",
  "proxyDomain": "${PROXY_DOMAIN:-}",
  "server": {
    "path": "$INSTALL_PATH/server",
    "url": "http://localhost:4000",
    "port": 4000,
    "apiKeyFile": "$INSTALL_PATH/server-api-key.txt"
  },
  "client": {
    "path": "$INSTALL_PATH/client",
    "url": "http://localhost:3000",
    "port": 3000
  }
}
EOF
    
    chmod 644 "$CONFIG_FILE" 2>/dev/null || true
    log "SUCCESS" "Configuration saved to $CONFIG_FILE"
}

uninstall_vaultscope() {
    log "INFO" "Uninstalling VaultScope Statistics..."
    
    if [[ "$OS" == "linux" ]] && [[ "$INIT_SYSTEM" == "systemd" ]]; then
        systemctl stop vaultscope-server 2>/dev/null || true
        systemctl stop vaultscope-client 2>/dev/null || true
        systemctl disable vaultscope-server 2>/dev/null || true
        systemctl disable vaultscope-client 2>/dev/null || true
        rm -f /etc/systemd/system/vaultscope-*.service
        systemctl daemon-reload
    elif [[ "$OS" == "macos" ]]; then
        launchctl unload "$HOME/Library/LaunchAgents/com.vaultscope.server.plist" 2>/dev/null || true
        launchctl unload "$HOME/Library/LaunchAgents/com.vaultscope.client.plist" 2>/dev/null || true
        rm -f "$HOME/Library/LaunchAgents/com.vaultscope.*.plist"
    fi
    
    pm2 delete vaultscope-server 2>/dev/null || true
    pm2 delete vaultscope-client 2>/dev/null || true
    pm2 save 2>/dev/null || true
    
    if [[ -L /usr/local/bin/vaultscope ]]; then
        rm -f /usr/local/bin/vaultscope
    fi
    
    if [[ -L /usr/local/bin/vaultscope-server ]]; then
        rm -f /usr/local/bin/vaultscope-server
    fi
    
    if [[ -L /usr/local/bin/vaultscope-client ]]; then
        rm -f /usr/local/bin/vaultscope-client
    fi
    
    if [[ "$OS" == "linux" ]]; then
        rm -f /etc/nginx/sites-enabled/vaultscope 2>/dev/null || true
        rm -f /etc/nginx/sites-available/vaultscope 2>/dev/null || true
        nginx -t && systemctl reload nginx 2>/dev/null || true
    elif [[ "$OS" == "macos" ]]; then
        rm -f /usr/local/etc/nginx/servers/vaultscope.conf 2>/dev/null || true
        brew services restart nginx 2>/dev/null || true
    fi
    
    if [[ -d "$INSTALL_PATH" ]]; then
        rm -rf "$INSTALL_PATH"
        log "SUCCESS" "Installation directory removed"
    fi
    
    if [[ -f "$CONFIG_FILE" ]]; then
        rm -f "$CONFIG_FILE"
        log "SUCCESS" "Configuration file removed"
    fi
    
    if [[ -d "$CONFIG_DIR" ]] && [[ -z "$(ls -A "$CONFIG_DIR")" ]]; then
        rmdir "$CONFIG_DIR" 2>/dev/null || true
    fi
    
    log "SUCCESS" "Uninstallation complete"
}

show_menu() {
    echo >&2
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}" >&2
    echo -e "${CYAN}║           VaultScope Statistics Installer               ║${NC}" >&2
    echo -e "${CYAN}║                 Version $SCRIPT_VERSION                        ║${NC}" >&2
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}" >&2
    echo >&2
    echo -e "${YELLOW}Installation Options:${NC}" >&2
    echo "  1. Install Client only (Dashboard)" >&2
    echo "  2. Install Server only (Monitoring Agent)" >&2
    echo "  3. Install Both (Recommended)" >&2
    echo "  4. Install with Reverse Proxy" >&2
    echo "  5. Uninstall" >&2
    echo "  6. Exit" >&2
    echo >&2
    
    local choice=""
    while [[ ! "$choice" =~ ^[1-6]$ ]]; do
        read -p "Enter your choice (1-6): " choice >&2
        if [[ ! "$choice" =~ ^[1-6]$ ]]; then
            echo -e "${RED}Invalid choice. Please enter a number between 1 and 6.${NC}" >&2
        fi
    done
    echo "$choice"
}

show_proxy_menu() {
    echo
    echo -e "${YELLOW}Select Reverse Proxy Type:${NC}"
    echo "  1. Nginx"
    echo "  2. Cloudflare Tunnel"
    echo "  3. Skip proxy setup"
    echo
    
    local choice=""
    while [[ ! "$choice" =~ ^[1-3]$ ]]; do
        read -p "Enter your choice (1-3): " choice
        if [[ ! "$choice" =~ ^[1-3]$ ]]; then
            echo -e "${RED}Invalid choice. Please enter a number between 1 and 3.${NC}"
        fi
    done
    
    case "$choice" in
        1) PROXY_TYPE="nginx" ;;
        2) PROXY_TYPE="cloudflared" ;;
        3) PROXY_TYPE="" ;;
    esac
}

main() {
    parse_args "$@"
    
    detect_os
    check_root "$@"
    
    log "INFO" "VaultScope Statistics Installer v$SCRIPT_VERSION"
    log "INFO" "Installation path: $INSTALL_PATH"
    log "INFO" "OS: $OS ($DISTRO)"
    log "INFO" "Package manager: $PKG_MANAGER"
    log "INFO" "Init system: $INIT_SYSTEM"
    
    if [[ "$UNINSTALL" == "true" ]]; then
        uninstall_vaultscope
        exit 0
    fi
    
    check_internet
    
    log "INFO" "Installing prerequisites..."
    install_nodejs
    install_git
    install_build_tools
    install_pm2
    
    mkdir -p "$INSTALL_PATH"
    
    local install_choice=""
    
    if [[ "$CLIENT_ONLY" == "true" ]]; then
        install_choice="1"
    elif [[ "$SERVER_ONLY" == "true" ]]; then
        install_choice="2"
    elif [[ "$SILENT" == "true" ]]; then
        install_choice="3"
    else
        install_choice=$(show_menu)
        
        if [[ -z "$install_choice" ]]; then
            error_exit "No installation option selected"
        fi
    fi
    
    case "$install_choice" in
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
            install_server
            echo
            install_client
            echo
            if [[ -z "$PROXY_TYPE" ]]; then
                show_proxy_menu
            fi
            if [[ -n "$PROXY_TYPE" ]]; then
                USE_PROXY=true
                case "$PROXY_TYPE" in
                    nginx) install_nginx_proxy ;;
                    cloudflared) install_cloudflared_proxy ;;
                esac
            fi
            ;;
        5)
            uninstall_vaultscope
            exit 0
            ;;
        6)
            log "INFO" "Installation cancelled"
            exit 0
            ;;
        *)
            error_exit "Invalid choice: $install_choice"
            ;;
    esac
    
    install_cli
    save_configuration
    
    echo
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    log "SUCCESS" "Installation completed successfully!"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo
    
    if command_exists vaultscope; then
        log "SUCCESS" "🎉 VaultScope CLI is now available!"
        echo
        echo -e "${CYAN}Quick Start Commands:${NC}"
        echo "  vaultscope help            # Show help"
        echo "  vaultscope statistics      # Show installation info"
        echo "  vaultscope status          # Check service status"
        echo "  vaultscope start           # Start all services"
        echo "  vaultscope stop            # Stop all services"
        echo "  vaultscope restart         # Restart all services"
        echo "  vaultscope logs            # View logs"
        echo
    fi
    
    if [[ "$OS" == "linux" ]] && [[ "$INIT_SYSTEM" == "systemd" ]]; then
        log "INFO" "Service Management Commands:"
        echo "  sudo systemctl status vaultscope-server    # Check server status"
        echo "  sudo systemctl status vaultscope-client    # Check client status"
        echo "  sudo systemctl restart vaultscope-server   # Restart server"
        echo "  sudo systemctl restart vaultscope-client   # Restart client"
        echo "  sudo journalctl -u vaultscope-server -f    # View server logs"
        echo "  sudo journalctl -u vaultscope-client -f    # View client logs"
    elif [[ "$OS" == "macos" ]]; then
        log "INFO" "Service Management Commands:"
        echo "  launchctl list | grep vaultscope           # Check service status"
        echo "  tail -f /tmp/server.log                    # View server logs"
        echo "  tail -f /tmp/client.log                    # View client logs"
    else
        log "INFO" "PM2 Management Commands:"
        echo "  pm2 list              # Show all services"
        echo "  pm2 restart all       # Restart all services"
        echo "  pm2 logs              # View logs"
        echo "  pm2 monit             # Monitor services"
    fi
    
    if [[ "$USE_PROXY" == "true" ]] && [[ -n "$PROXY_DOMAIN" ]]; then
        echo
        log "INFO" "Reverse Proxy Configuration:"
        echo "  Type: $PROXY_TYPE"
        echo "  Domain: $PROXY_DOMAIN"
        if [[ "$PROXY_TYPE" == "nginx" ]]; then
            echo "  Client URL: http://$PROXY_DOMAIN"
            echo "  API URL: http://$PROXY_DOMAIN/api"
        elif [[ "$PROXY_TYPE" == "cloudflared" ]]; then
            echo "  Client URL: https://$PROXY_DOMAIN"
            echo "  API URL: https://api.$PROXY_DOMAIN"
        fi
    fi
    
    echo
    log "INFO" "Installation log: $LOG_FILE"
    
    if [[ -f "$INSTALL_PATH/server-api-key.txt" ]]; then
        echo
        log "WARNING" "Server API Key saved to: $INSTALL_PATH/server-api-key.txt"
        log "WARNING" "Keep this key secure!"
    fi
}

main "$@"