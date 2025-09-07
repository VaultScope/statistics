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
readonly BACKUP_DIR="/tmp/vaultscope-backup-$(date +%Y%m%d-%H%M%S)"

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
SERVER_PORT="4000"
CLIENT_PORT="3000"
USE_SSL=false
SSL_CERT=""
SSL_KEY=""
OS=""
DISTRO=""
PKG_MANAGER=""
INIT_SYSTEM=""
TEMP_DIR=""
ROLLBACK_NEEDED=false

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
    
    if [[ "$ROLLBACK_NEEDED" == "true" ]]; then
        log "INFO" "Attempting rollback..."
        rollback_installation
    fi
    
    exit 1
}

rollback_installation() {
    log "INFO" "Rolling back installation..."
    
    if [[ -d "$BACKUP_DIR" ]]; then
        if [[ -d "$INSTALL_PATH" ]]; then
            rm -rf "$INSTALL_PATH"
        fi
        if [[ -f "$BACKUP_DIR/config.json" ]]; then
            cp "$BACKUP_DIR/config.json" "$CONFIG_FILE"
        fi
        log "SUCCESS" "Rollback completed"
    fi
    
    if [[ "$OS" == "linux" ]] && [[ "$INIT_SYSTEM" == "systemd" ]]; then
        systemctl stop vaultscope-server 2>/dev/null || true
        systemctl stop vaultscope-client 2>/dev/null || true
        systemctl disable vaultscope-server 2>/dev/null || true
        systemctl disable vaultscope-client 2>/dev/null || true
        rm -f /etc/systemd/system/vaultscope-*.service
        systemctl daemon-reload
    fi
}

cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log "WARNING" "Installation interrupted (exit code: $exit_code)"
    fi
    if [[ -d "${TEMP_DIR:-}" ]]; then
        rm -rf "$TEMP_DIR" 2>/dev/null || true
    fi
    if [[ -d "${BACKUP_DIR:-}" ]] && [[ "$ROLLBACK_NEEDED" == "false" ]]; then
        rm -rf "$BACKUP_DIR" 2>/dev/null || true
    fi
    stty echo 2>/dev/null || true
}

trap cleanup EXIT INT TERM

validate_domain() {
    local domain="$1"
    
    if [[ "$domain" == "localhost" ]] || [[ "$domain" == "127.0.0.1" ]]; then
        return 0
    fi
    
    if ! echo "$domain" | grep -qE '^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$'; then
        log "ERROR" "Invalid domain format: $domain"
        return 1
    fi
    
    if command -v host >/dev/null 2>&1; then
        if ! host "$domain" >/dev/null 2>&1; then
            log "WARNING" "Domain $domain does not resolve. Continuing anyway..."
        fi
    fi
    
    return 0
}

validate_port() {
    local port="$1"
    
    if ! [[ "$port" =~ ^[0-9]+$ ]] || [[ "$port" -lt 1 ]] || [[ "$port" -gt 65535 ]]; then
        log "ERROR" "Invalid port: $port"
        return 1
    fi
    
    if command -v lsof >/dev/null 2>&1; then
        if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            log "WARNING" "Port $port is already in use"
            return 1
        fi
    elif command -v netstat >/dev/null 2>&1; then
        if netstat -tuln | grep -q ":$port "; then
            log "WARNING" "Port $port is already in use"
            return 1
        fi
    fi
    
    return 0
}

validate_path() {
    local path="$1"
    
    if [[ "$path" =~ [[:space:]] ]]; then
        log "ERROR" "Path contains spaces: $path"
        return 1
    fi
    
    if [[ ! "$path" =~ ^/ ]]; then
        log "ERROR" "Path must be absolute: $path"
        return 1
    fi
    
    return 0
}

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
    --proxy TYPE            Setup reverse proxy (nginx|cloudflared|apache|caddy)
    --domain DOMAIN         Domain for reverse proxy
    --server-port PORT      Server port (default: 4000)
    --client-port PORT      Client port (default: 3000)
    --ssl                   Enable SSL/HTTPS
    --ssl-cert PATH         Path to SSL certificate
    --ssl-key PATH          Path to SSL private key

EXAMPLES:
    $SCRIPT_NAME                    # Interactive installation
    $SCRIPT_NAME --path /opt/vs     # Install to specific path
    $SCRIPT_NAME --uninstall        # Remove installation
    $SCRIPT_NAME --proxy nginx --domain stats.example.com --ssl

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
                validate_path "$INSTALL_PATH" || error_exit "Invalid installation path"
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
                validate_domain "$PROXY_DOMAIN" || error_exit "Invalid domain"
                shift 2
                ;;
            --server-port)
                SERVER_PORT="$2"
                validate_port "$SERVER_PORT" || error_exit "Invalid server port"
                shift 2
                ;;
            --client-port)
                CLIENT_PORT="$2"
                validate_port "$CLIENT_PORT" || error_exit "Invalid client port"
                shift 2
                ;;
            --ssl)
                USE_SSL=true
                shift
                ;;
            --ssl-cert)
                SSL_CERT="$2"
                shift 2
                ;;
            --ssl-key)
                SSL_KEY="$2"
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
    local max_retries=3
    local retry_count=0
    
    while [[ $retry_count -lt $max_retries ]]; do
        for url in "${test_urls[@]}"; do
            if curl -sS --connect-timeout 5 --head "$url" >/dev/null 2>&1; then
                log "SUCCESS" "Internet connection verified"
                return 0
            fi
        done
        retry_count=$((retry_count + 1))
        log "WARNING" "Connection attempt $retry_count of $max_retries failed"
        sleep 2
    done
    
    error_exit "No internet connection available after $max_retries attempts"
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
    
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log "ERROR" "Failed to install $package"
        return 1
    fi
    
    return 0
}

verify_node_version() {
    if ! command_exists node; then
        return 1
    fi
    
    local node_version="$(node --version 2>/dev/null || echo "v0.0.0")"
    local major_version="${node_version%%.*}"
    major_version="${major_version#v}"
    
    if [[ "$major_version" -ge 18 ]]; then
        return 0
    fi
    
    return 1
}

install_nodejs() {
    log "INFO" "Checking Node.js installation..."
    
    if verify_node_version; then
        local node_version="$(node --version 2>/dev/null)"
        log "SUCCESS" "Node.js $node_version is already installed"
        return 0
    fi
    
    log "INFO" "Installing Node.js v20 LTS..."
    
    local max_retries=3
    local retry_count=0
    
    while [[ $retry_count -lt $max_retries ]]; do
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
        
        if verify_node_version; then
            log "SUCCESS" "Node.js installed successfully"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log "WARNING" "Installation attempt $retry_count of $max_retries failed"
        sleep 2
    done
    
    error_exit "Failed to install Node.js after $max_retries attempts"
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
            install_package "git" || error_exit "Failed to install Git"
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

download_with_retry() {
    local url="$1"
    local output="$2"
    local max_retries=3
    local retry_count=0
    
    while [[ $retry_count -lt $max_retries ]]; do
        if curl -fsSL "$url" -o "$output" 2>/dev/null; then
            return 0
        fi
        retry_count=$((retry_count + 1))
        log "WARNING" "Download attempt $retry_count of $max_retries failed"
        sleep 2
    done
    
    return 1
}

download_from_github() {
    local component="$1"
    local target_dir="$2"
    
    log "INFO" "Downloading $component from GitHub..."
    
    TEMP_DIR="$(mktemp -d)"
    
    if [[ "$component" == "cli" ]]; then
        if download_with_retry "$CLI_URL" "$target_dir/cli.js"; then
            chmod +x "$target_dir/cli.js"
            return 0
        else
            log "WARNING" "Failed to download CLI from GitHub"
            return 1
        fi
    fi
    
    local archive_url="${GITHUB_REPO}/archive/refs/heads/main.tar.gz"
    
    if download_with_retry "$archive_url" "$TEMP_DIR/repo.tar.gz"; then
        if tar -xzf "$TEMP_DIR/repo.tar.gz" -C "$TEMP_DIR" 2>/dev/null; then
            local extracted_dir="$TEMP_DIR/statistics-main"
            
            if [[ -d "$extracted_dir/$component" ]]; then
                cp -r "$extracted_dir/$component/"* "$target_dir/" 2>/dev/null || true
                cp -r "$extracted_dir/$component/".* "$target_dir/" 2>/dev/null || true
                rm -rf "$TEMP_DIR"
                return 0
            fi
        fi
    fi
    
    rm -rf "$TEMP_DIR"
    return 1
}

generate_secure_key() {
    local length="${1:-48}"
    
    if command_exists openssl; then
        openssl rand -hex "$length" 2>/dev/null | head -c "$length"
    elif [[ -f /dev/urandom ]]; then
        head -c "$length" /dev/urandom | base64 | tr -d '+/=' | head -c "$length"
    else
        date +%s%N | sha256sum | head -c "$length"
    fi
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
    "build": "tsc || echo 'TypeScript compilation skipped'"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "systeminformation": "^5.21.20",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.1",
    "ps-list": "^8.1.1"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.11.0",
    "@types/express": "^4.17.21"
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
    const key = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.apiKey;
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
    "dev": "next dev -p $port",
    "build": "next build || echo 'Next.js build skipped'",
    "start": "next start -p $port"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^3.1.2"
  }
}
EOF
        fi
    fi
    
    cd "$component_path"
    
    log "INFO" "Installing dependencies for $component_name..."
    
    local npm_install_success=false
    local max_retries=3
    local retry_count=0
    
    while [[ $retry_count -lt $max_retries ]]; do
        if npm install --production --no-optional --loglevel=error >/dev/null 2>&1; then
            npm_install_success=true
            break
        fi
        retry_count=$((retry_count + 1))
        log "WARNING" "npm install attempt $retry_count of $max_retries failed"
        sleep 2
    done
    
    if [[ "$npm_install_success" == "false" ]]; then
        log "ERROR" "Failed to install dependencies for $component_name"
        return 1
    fi
    
    if [[ "$component_name" == "server" ]]; then
        if [[ -f "index.ts" ]] && ! [[ -f "index.js" ]]; then
            log "INFO" "Compiling TypeScript for $component_name..."
            if command_exists tsc; then
                tsc index.ts --outDir . --target es2022 --module commonjs >/dev/null 2>&1 || true
            elif command_exists npx; then
                npx tsc index.ts --outDir . --target es2022 --module commonjs >/dev/null 2>&1 || true
            fi
        fi
        
        if [[ -f "tsconfig.json" ]] && ! [[ -f "dist/index.js" ]]; then
            npm run build >/dev/null 2>&1 || true
        fi
    elif [[ "$component_name" == "client" ]]; then
        if [[ -f "package.json" ]]; then
            log "INFO" "Building Next.js application..."
            npm run build >/dev/null 2>&1 || true
        fi
    fi
    
    return 0
}

verify_service_running() {
    local service_name="$1"
    local port="$2"
    local max_wait=30
    local wait_count=0
    
    log "INFO" "Verifying $service_name is running..."
    
    while [[ $wait_count -lt $max_wait ]]; do
        if curl -sS --connect-timeout 2 "http://localhost:$port/health" >/dev/null 2>&1; then
            log "SUCCESS" "$service_name is running and responding"
            return 0
        fi
        wait_count=$((wait_count + 1))
        sleep 1
    done
    
    log "ERROR" "$service_name failed to start within $max_wait seconds"
    return 1
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
    
    sleep 2
    
    if ! systemctl is-active --quiet "$service_name"; then
        log "ERROR" "Service $service_name failed to start"
        return 1
    fi
    
    log "SUCCESS" "Service $service_name created and started"
    return 0
}

install_nginx_proxy() {
    log "INFO" "Setting up Nginx reverse proxy..."
    
    if ! command_exists nginx; then
        log "INFO" "Installing Nginx..."
        case "$OS" in
            linux)
                install_package "nginx" || return 1
                ;;
            macos)
                brew install nginx >/dev/null 2>&1 || return 1
                ;;
        esac
    fi
    
    local nginx_conf="/etc/nginx/sites-available/vaultscope"
    [[ "$OS" == "macos" ]] && nginx_conf="/usr/local/etc/nginx/servers/vaultscope.conf"
    
    log "INFO" "Configuring Nginx for domain: $PROXY_DOMAIN"
    
    if [[ "$USE_SSL" == "true" ]]; then
        if [[ -z "$SSL_CERT" ]] || [[ -z "$SSL_KEY" ]]; then
            log "WARNING" "SSL requested but no certificate provided. Generating self-signed certificate..."
            local ssl_dir="/etc/nginx/ssl"
            mkdir -p "$ssl_dir"
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$ssl_dir/vaultscope.key" \
                -out "$ssl_dir/vaultscope.crt" \
                -subj "/C=US/ST=State/L=City/O=VaultScope/CN=$PROXY_DOMAIN" \
                >/dev/null 2>&1
            SSL_CERT="$ssl_dir/vaultscope.crt"
            SSL_KEY="$ssl_dir/vaultscope.key"
        fi
        
        cat > "$nginx_conf" << EOF
server {
    listen 80;
    server_name $PROXY_DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $PROXY_DOMAIN;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:$CLIENT_PORT;
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
        proxy_pass http://localhost:$SERVER_PORT;
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
    else
        cat > "$nginx_conf" << EOF
server {
    listen 80;
    server_name $PROXY_DOMAIN;

    location / {
        proxy_pass http://localhost:$CLIENT_PORT;
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
        proxy_pass http://localhost:$SERVER_PORT;
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
    fi
    
    if [[ "$OS" == "linux" ]]; then
        ln -sf "$nginx_conf" /etc/nginx/sites-enabled/vaultscope 2>/dev/null || true
        if ! nginx -t >/dev/null 2>&1; then
            log "ERROR" "Nginx configuration is invalid"
            return 1
        fi
        systemctl reload nginx >/dev/null 2>&1
    else
        brew services restart nginx >/dev/null 2>&1
    fi
    
    log "SUCCESS" "Nginx reverse proxy configured for $PROXY_DOMAIN"
    
    if [[ "$USE_SSL" == "true" ]]; then
        log "INFO" "You can now access:"
        log "INFO" "  Dashboard: https://$PROXY_DOMAIN"
        log "INFO" "  API: https://$PROXY_DOMAIN/api"
    else
        log "INFO" "You can now access:"
        log "INFO" "  Dashboard: http://$PROXY_DOMAIN"
        log "INFO" "  API: http://$PROXY_DOMAIN/api"
    fi
    
    return 0
}

install_server() {
    local server_path="$INSTALL_PATH/server"
    
    ROLLBACK_NEEDED=true
    
    if ! setup_component "$server_path" "server" "$SERVER_PORT"; then
        error_exit "Failed to setup server component"
    fi
    
    cd "$server_path"
    
    local api_key="$(generate_secure_key 48)"
    
    cat > .env << EOF
PORT=$SERVER_PORT
API_KEY=$api_key
NODE_ENV=production
EOF
    
    local api_key_file="$INSTALL_PATH/.api_key"
    echo "$api_key" > "$api_key_file"
    chmod 600 "$api_key_file"
    
    if command_exists openssl; then
        local encrypted_key_file="$INSTALL_PATH/.api_key.enc"
        local encryption_password="$(generate_secure_key 32)"
        openssl enc -aes-256-cbc -salt -in "$api_key_file" -out "$encrypted_key_file" -k "$encryption_password" 2>/dev/null || true
        echo "$encryption_password" > "$INSTALL_PATH/.key_password"
        chmod 600 "$INSTALL_PATH/.key_password"
    fi
    
    local entry_point=""
    if [[ -f "dist/index.js" ]]; then
        entry_point="$server_path/dist/index.js"
    elif [[ -f "index.js" ]]; then
        entry_point="$server_path/index.js"
    else
        log "WARNING" "No server entry point found, using default"
        entry_point="$server_path/index.js"
    fi
    
    if [[ "$OS" == "linux" ]] && [[ "$INIT_SYSTEM" == "systemd" ]]; then
        if ! create_systemd_service \
            "vaultscope-server" \
            "VaultScope Statistics Server" \
            "$(command -v node) $entry_point" \
            "$server_path"; then
            error_exit "Failed to create server service"
        fi
    else
        pm2 delete vaultscope-server 2>/dev/null || true
        pm2 start "$entry_point" --name "vaultscope-server" --cwd "$server_path" >/dev/null 2>&1
        pm2 save >/dev/null 2>&1
    fi
    
    if ! verify_service_running "Server" "$SERVER_PORT"; then
        error_exit "Server failed to start properly"
    fi
    
    ROLLBACK_NEEDED=false
    
    log "SUCCESS" "Server installed successfully!"
    log "INFO" "Server URL: http://localhost:$SERVER_PORT"
    log "WARNING" "API Key: $api_key"
    log "WARNING" "API Key saved to: $api_key_file"
    
    return 0
}

install_client() {
    local client_path="$INSTALL_PATH/client"
    
    ROLLBACK_NEEDED=true
    
    if ! setup_component "$client_path" "client" "$CLIENT_PORT"; then
        error_exit "Failed to setup client component"
    fi
    
    cd "$client_path"
    
    local session_secret="$(generate_secure_key 32)"
    
    cat > .env.production << EOF
NEXT_PUBLIC_API_URL=http://localhost:$SERVER_PORT
NODE_ENV=production
SESSION_SECRET=$session_secret
PORT=$CLIENT_PORT
EOF
    
    if [[ "$OS" == "linux" ]] && [[ "$INIT_SYSTEM" == "systemd" ]]; then
        if ! create_systemd_service \
            "vaultscope-client" \
            "VaultScope Statistics Client" \
            "$(command -v npm) run start" \
            "$client_path"; then
            error_exit "Failed to create client service"
        fi
    else
        pm2 delete vaultscope-client 2>/dev/null || true
        pm2 start "npm run start" --name "vaultscope-client" --cwd "$client_path" >/dev/null 2>&1
        pm2 save >/dev/null 2>&1
    fi
    
    if ! verify_service_running "Client" "$CLIENT_PORT"; then
        error_exit "Client failed to start properly"
    fi
    
    ROLLBACK_NEEDED=false
    
    log "SUCCESS" "Client installed successfully!"
    log "INFO" "Client URL: http://localhost:$CLIENT_PORT"
    
    return 0
}

save_configuration() {
    log "INFO" "Saving configuration..."
    
    if [[ -f "$CONFIG_FILE" ]]; then
        mkdir -p "$BACKUP_DIR"
        cp "$CONFIG_FILE" "$BACKUP_DIR/config.json"
    fi
    
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
    
    local components_json='['
    local first=true
    for comp in "${components[@]}"; do
        if [[ "$first" == "true" ]]; then
            components_json+='"'$comp'"'
            first=false
        else
            components_json+=',"'$comp'"'
        fi
    done
    components_json+=']'
    
    cat > "$CONFIG_FILE" << EOF
{
  "version": "$SCRIPT_VERSION",
  "installPath": "$INSTALL_PATH",
  "installDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platform": "$OS",
  "distro": "$DISTRO",
  "components": $components_json,
  "serviceManager": "$service_manager",
  "proxyEnabled": $([[ "$USE_PROXY" == "true" ]] && echo "true" || echo "false"),
  "proxyType": "${PROXY_TYPE:-none}",
  "proxyDomain": "${PROXY_DOMAIN:-}",
  "sslEnabled": $([[ "$USE_SSL" == "true" ]] && echo "true" || echo "false"),
  "server": {
    "path": "$INSTALL_PATH/server",
    "url": "http://localhost:$SERVER_PORT",
    "port": $SERVER_PORT,
    "apiKeyFile": "$INSTALL_PATH/.api_key"
  },
  "client": {
    "path": "$INSTALL_PATH/client",
    "url": "http://localhost:$CLIENT_PORT",
    "port": $CLIENT_PORT
  }
}
EOF
    
    chmod 644 "$CONFIG_FILE" 2>/dev/null || true
    log "SUCCESS" "Configuration saved to $CONFIG_FILE"
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
        error_exit "Uninstall function not implemented in this version"
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
    fi
    
    case "$install_choice" in
        1) install_client ;;
        2) install_server ;;
        3) install_server && echo && install_client ;;
        4) 
            install_server && echo && install_client && echo
            if [[ -z "$PROXY_TYPE" ]]; then
                echo -e "${YELLOW}Select Reverse Proxy Type:${NC}"
                echo "  1. Nginx"
                echo "  2. Skip proxy setup"
                read -p "Enter your choice (1-2): " proxy_choice
                case "$proxy_choice" in
                    1) 
                        PROXY_TYPE="nginx"
                        if [[ -z "$PROXY_DOMAIN" ]]; then
                            read -p "Enter domain name (or press Enter for localhost): " PROXY_DOMAIN
                            [[ -z "$PROXY_DOMAIN" ]] && PROXY_DOMAIN="localhost"
                        fi
                        USE_PROXY=true
                        install_nginx_proxy
                        ;;
                esac
            fi
            ;;
        5) error_exit "Uninstall not implemented" ;;
        6) log "INFO" "Installation cancelled"; exit 0 ;;
        *) error_exit "Invalid choice: $install_choice" ;;
    esac
    
    save_configuration
    
    echo
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    log "SUCCESS" "Installation completed successfully!"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo
    
    log "INFO" "Installation log: $LOG_FILE"
    
    if [[ -f "$INSTALL_PATH/.api_key" ]]; then
        echo
        log "WARNING" "Server API Key saved to: $INSTALL_PATH/.api_key"
        log "WARNING" "Keep this key secure!"
    fi
}

main "$@"