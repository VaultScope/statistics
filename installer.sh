#!/bin/bash

#############################################
# VaultScope Statistics Installer v6.2.9
#############################################

set -e

VSS_VERSION="6.2.9"
INSTALL_DIR_SERVER="/var/www/vs-statistics-server"
INSTALL_DIR_CLIENT="/var/www/vs-statistics-client"
INSTALL_DIR_FULL="/var/www/statistics"
LOG_DIR="/var/log/vss-installer"
LOG_FILE="$LOG_DIR/install-$(date +%Y%m%d-%H%M%S).log"
CONFIG_FILE="/etc/vss/config.json"
CONFIG_DIR="/etc/vss"
REPO_URL="https://github.com/vaultscope/statistics.git"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_TYPE=""
BRANCH="main"
USE_NGINX=false
SERVER_DOMAIN=""
CLIENT_DOMAIN=""
USE_SSL=false
NODE_VERSION="20"
API_KEY=""
ADMIN_KEY=""
SSL_EMAIL=""

# Always run in interactive mode - use /dev/tty for input when piped
INTERACTIVE=true

mkdir -p "$LOG_DIR"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

prompt_yes_no() {
    local prompt="$1"
    local response
    while true; do
        read -p "$prompt [y/n]: " response </dev/tty
        case $response in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes (y) or no (n).";;
        esac
    done
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if grep -q Microsoft /proc/version; then
            OS="WSL"
        else
            OS="Linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
    else
        error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    log "Detected OS: $OS"
}

check_existing_installation() {
    local existing=false
    
    if [[ -f "$CONFIG_FILE" ]]; then
        existing=true
        info "Found existing VaultScope Statistics installation"
        
        if [[ -f "$CONFIG_FILE" ]]; then
            EXISTING_TYPE=$(grep -o '"install_type":"[^"]*' "$CONFIG_FILE" | cut -d'"' -f4)
            EXISTING_VERSION=$(grep -o '"version":"[^"]*' "$CONFIG_FILE" | cut -d'"' -f4)
            info "Current installation: Type=$EXISTING_TYPE, Version=$EXISTING_VERSION"
        fi
    fi
    
    if [[ -d "$INSTALL_DIR_SERVER" ]] || [[ -d "$INSTALL_DIR_CLIENT" ]] || [[ -d "$INSTALL_DIR_FULL" ]]; then
        existing=true
    fi
    
    if $existing; then
        echo ""
        echo "Existing installation detected. What would you like to do?"
        echo "1) Update existing installation"
        echo "2) Uninstall and remove"
        echo "3) Cancel"
        
        while true; do
            read -p "Select option [1-3]: " choice </dev/tty
            case $choice in
                1)
                    perform_update
                    exit 0
                    ;;
                2)
                    perform_uninstall
                    exit 0
                    ;;
                3)
                    info "Installation cancelled"
                    exit 0
                    ;;
                *)
                    echo "Invalid option. Please select 1, 2, or 3."
                    ;;
            esac
        done
    fi
}

perform_update() {
    log "Starting update process..."
    
    if [[ -f "$CONFIG_FILE" ]]; then
        INSTALL_TYPE=$(grep -o '"install_type":"[^"]*' "$CONFIG_FILE" | cut -d'"' -f4)
        BRANCH=$(grep -o '"branch":"[^"]*' "$CONFIG_FILE" | cut -d'"' -f4 || echo "main")
    fi
    
    case $INSTALL_TYPE in
        "full")
            cd "$INSTALL_DIR_FULL"
            ;;
        "server")
            cd "$INSTALL_DIR_SERVER"
            ;;
        "client")
            cd "$INSTALL_DIR_CLIENT"
            ;;
    esac
    
    log "Pulling latest changes from $BRANCH branch..."
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    
    log "Installing dependencies..."
    npm install
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
        log "Building server..."
        # Build with TypeScript errors allowed
        cd server && npx tsc --noEmitOnError false && cd .. || {
            warning "Server build had TypeScript errors but continuing..."
        }
    fi
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
        log "Building client..."
        npm run build:client || {
            warning "Client build had errors but continuing..."
        }
    fi
    
    restart_services
    
    success "Update completed successfully!"
}

perform_uninstall() {
    warning "This will completely remove VaultScope Statistics from your system."
    if ! prompt_yes_no "Are you sure you want to continue?"; then
        info "Uninstall cancelled"
        return
    fi
    
    log "Stopping services..."
    systemctl stop vss-server 2>/dev/null || true
    systemctl stop vss-client 2>/dev/null || true
    systemctl disable vss-server 2>/dev/null || true
    systemctl disable vss-client 2>/dev/null || true
    
    log "Removing service files..."
    rm -f /etc/systemd/system/vss-server.service
    rm -f /etc/systemd/system/vss-client.service
    systemctl daemon-reload
    
    log "Removing VSS CLI tool..."
    rm -f /usr/local/bin/vss
    
    log "Removing application directories..."
    rm -rf "$INSTALL_DIR_SERVER"
    rm -rf "$INSTALL_DIR_CLIENT"
    rm -rf "$INSTALL_DIR_FULL"
    
    log "Removing configuration..."
    rm -rf "$CONFIG_DIR"
    
    if prompt_yes_no "Remove Nginx configuration?"; then
        rm -f /etc/nginx/sites-enabled/vss-server
        rm -f /etc/nginx/sites-enabled/vss-client
        rm -f /etc/nginx/sites-available/vss-server
        rm -f /etc/nginx/sites-available/vss-client
        systemctl reload nginx 2>/dev/null || true
    fi
    
    success "VaultScope Statistics has been uninstalled successfully!"
}

install_dependencies() {
    log "Installing system dependencies..."
    
    if [[ "$OS" == "Linux" ]] || [[ "$OS" == "WSL" ]]; then
        apt-get update
        apt-get install -y curl git build-essential python3 gcc g++ make
        
        if ! command -v node &> /dev/null; then
            log "Installing Node.js v$NODE_VERSION..."
            curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
            apt-get install -y nodejs
        fi
        
        if $USE_NGINX; then
            apt-get install -y nginx certbot python3-certbot-nginx
        fi
        
    elif [[ "$OS" == "macOS" ]]; then
        if ! command -v brew &> /dev/null; then
            error "Homebrew is required. Please install it from https://brew.sh"
            exit 1
        fi
        
        brew update
        
        if ! command -v node &> /dev/null; then
            log "Installing Node.js..."
            brew install node@$NODE_VERSION
        fi
        
        if $USE_NGINX; then
            brew install nginx certbot
        fi
    fi
    
    npm install -g npm@latest
    npm install -g pm2
}

select_installation_type() {
    echo ""
    echo "Select installation type:"
    echo "1) Full installation (Server + Client)"
    echo "2) Server only"
    echo "3) Client only"
    
    while true; do
        read -p "Select option [1-3]: " choice </dev/tty
        case $choice in
            1)
                INSTALL_TYPE="full"
                break
                ;;
            2)
                INSTALL_TYPE="server"
                break
                ;;
            3)
                INSTALL_TYPE="client"
                break
                ;;
            *)
                echo "Invalid option. Please select 1, 2, or 3."
                ;;
        esac
    done
    
    log "Installation type selected: $INSTALL_TYPE"
}

select_branch() {
    echo ""
    echo "Select branch to install from:"
    echo "1) main (recommended - stable)"
    echo "2) dev (experimental - latest features)"
    
    while true; do
        read -p "Select option [1-2]: " choice </dev/tty
        case $choice in
            1)
                BRANCH="main"
                break
                ;;
            2)
                BRANCH="dev"
                break
                ;;
            *)
                echo "Invalid option. Please select 1 or 2."
                ;;
        esac
    done
    
    log "Selected branch: $BRANCH"
}

clone_repository() {
    local target_dir="$1"
    
    log "Cloning repository from branch $BRANCH..."
    
    if [[ -d "$target_dir" ]]; then
        warning "Directory $target_dir already exists. Removing..."
        rm -rf "$target_dir"
    fi
    
    git clone -b "$BRANCH" "$REPO_URL" "$target_dir"
    cd "$target_dir"
    
    log "Repository cloned successfully"
}

setup_application() {
    log "Setting up application..."
    
    case $INSTALL_TYPE in
        "full")
            TARGET_DIR="$INSTALL_DIR_FULL"
            ;;
        "server")
            TARGET_DIR="$INSTALL_DIR_SERVER"
            ;;
        "client")
            TARGET_DIR="$INSTALL_DIR_CLIENT"
            ;;
    esac
    
    clone_repository "$TARGET_DIR"
    cd "$TARGET_DIR"
    
    log "Installing root dependencies..."
    npm install
    
    # Rebuild native modules to ensure compatibility
    log "Rebuilding native modules..."
    npm rebuild better-sqlite3 --build-from-source 2>/dev/null || npm rebuild || true
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
        log "Installing server dependencies..."
        cd server
        npm install || {
            warning "Some server dependencies may be missing, continuing..."
        }
        # Rebuild server native modules
        npm rebuild || true
        cd ..
    fi
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
        log "Installing client dependencies..."
        cd client
        npm install || {
            warning "Some client dependencies may be missing, continuing..."
        }
        cd ..
    fi
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
        log "Building server..."
        # Build with TypeScript errors allowed
        cd server && npx tsc --noEmitOnError false && cd .. || {
            warning "Server build had TypeScript errors but continuing..."
        }
        
        log "Initializing server database..."
        cd server
        # Use the initialization script that creates database with all tables
        npm run init 2>/dev/null || node scripts/setup-database.js
        if [[ -f "database.db" ]]; then
            chown www-data:www-data database.db* 2>/dev/null || true
            success "Server database initialized with default admin credentials:"
            info "  Email: admin@vaultscope.com"
            info "  Password: admin123"
        else
            error "Failed to initialize server database"
        fi
        cd ..
        
        log "Generating admin API key..."
        cd "$TARGET_DIR/server"
        # Ensure native modules are built for current Node version
        npm rebuild better-sqlite3 2>/dev/null || true
        API_KEY_OUTPUT=$(npm run apikey create "Admin Key" -- --admin --viewStats --createApiKey --deleteApiKey --viewApiKeys --usePowerCommands 2>&1 || true)
        API_KEY=$(echo "$API_KEY_OUTPUT" | grep -oP 'API Key: \K[a-f0-9]{64}' || echo "")
        if [[ -n "$API_KEY" ]]; then
            success "Admin API key generated successfully"
        else
            warning "Could not generate API key automatically. You can create one later with:"
            warning "  cd /var/www/statistics && npm rebuild better-sqlite3"
            warning "  vss apikey create 'Admin Key' -- --admin"
        fi
        cd "$TARGET_DIR"
    fi
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
        log "Building client..."
        npm run build:client || {
            warning "Client build had errors but continuing..."
        }
        
        log "Initializing client database..."
        cd client
        # Use the initialization script that creates database.json
        npm run init 2>/dev/null || node lib/init-database.js
        if [[ ! -f "database.json" ]]; then
            # Fallback to manual creation if script fails
            cat > database.json << 'EODB'
{
  "users": [],
  "nodes": [],
  "categories": [
    {"id": 1, "name": "Production", "color": "#22c55e", "icon": "server", "createdAt": "2024-01-01T00:00:00Z"},
    {"id": 2, "name": "Development", "color": "#3b82f6", "icon": "code", "createdAt": "2024-01-01T00:00:00Z"},
    {"id": 3, "name": "Testing", "color": "#f59e0b", "icon": "flask", "createdAt": "2024-01-01T00:00:00Z"},
    {"id": 4, "name": "Backup", "color": "#8b5cf6", "icon": "database", "createdAt": "2024-01-01T00:00:00Z"},
    {"id": 5, "name": "Monitoring", "color": "#ef4444", "icon": "activity", "createdAt": "2024-01-01T00:00:00Z"}
  ],
  "roles": [
    {
      "id": "admin",
      "name": "Administrator",
      "description": "Full system access",
      "permissions": ["nodes.view", "nodes.create", "nodes.edit", "nodes.delete", "users.view", "users.create", "users.edit", "users.delete", "system.settings"],
      "isSystem": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "viewer",
      "name": "Viewer",
      "description": "Read-only access",
      "permissions": ["nodes.view", "users.view"],
      "isSystem": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
EODB
        fi
        chown www-data:www-data database.json 2>/dev/null || true
        success "Client database initialized"
        cd ..
    fi
}

create_systemd_services() {
    log "Creating systemd services..."
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
        cat > /etc/systemd/system/vss-server.service << EOF
[Unit]
Description=VaultScope Statistics Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$TARGET_DIR
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStart=/usr/bin/node server/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vss-server

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl enable vss-server
        systemctl start vss-server
        log "Server service created and started"
    fi
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
        cat > /etc/systemd/system/vss-client.service << EOF
[Unit]
Description=VaultScope Statistics Client (Next.js)
After=network.target vss-server.service

[Service]
Type=simple
User=root
WorkingDirectory=$TARGET_DIR/client
Environment="NODE_ENV=production"
Environment="PORT=4001"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vss-client

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl enable vss-client
        systemctl start vss-client
        log "Client service created and started"
    fi
}

setup_nginx() {
    if ! $USE_NGINX; then
        return
    fi
    
    log "Setting up Nginx reverse proxy..."
    
    local server_ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n1)
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
        cat > /etc/nginx/sites-available/vss-server << EOF
server {
    listen 80;
    server_name $SERVER_DOMAIN;
    
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
        
        ln -sf /etc/nginx/sites-available/vss-server /etc/nginx/sites-enabled/
    fi
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
        cat > /etc/nginx/sites-available/vss-client << EOF
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
        
        ln -sf /etc/nginx/sites-available/vss-client /etc/nginx/sites-enabled/
    fi
    
    systemctl reload nginx
    
    if $USE_SSL; then
        log "Setting up SSL certificates..."
        
        if [[ -n "$SERVER_DOMAIN" ]]; then
            # Kill any existing certbot processes
            pkill -f certbot 2>/dev/null || true
            sleep 2
            certbot --nginx -d "$SERVER_DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" || {
                warning "SSL setup for $SERVER_DOMAIN may have failed - check if already configured"
            }
        fi
        
        if [[ -n "$CLIENT_DOMAIN" ]]; then
            certbot --nginx -d "$CLIENT_DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" || {
                warning "SSL setup for $CLIENT_DOMAIN may have failed - check if already configured"
            }
        fi
    fi
}

create_vss_cli() {
    log "Creating VSS CLI tool..."
    
    # Check if cli.js exists in the installation directory
    local CLI_PATH=""
    if [[ -f "$INSTALL_DIR_FULL/cli.js" ]]; then
        CLI_PATH="$INSTALL_DIR_FULL/cli.js"
    elif [[ -f "$INSTALL_DIR_SERVER/../cli.js" ]]; then
        CLI_PATH="$INSTALL_DIR_SERVER/../cli.js"
    fi
    
    if [[ -n "$CLI_PATH" ]]; then
        # Make cli.js executable
        chmod +x "$CLI_PATH"
        
        # Create symlink to /usr/local/bin/vss
        ln -sf "$CLI_PATH" /usr/local/bin/vss
        
        log "VSS CLI tool linked from $CLI_PATH to /usr/local/bin/vss"
    else
        # Fallback to the old bash script if cli.js doesn't exist
        cat > /usr/local/bin/vss << 'EOF'
#!/bin/bash

VSS_CONFIG="/etc/vss/config.json"
VSS_VERSION="6.1.0"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [[ ! -f "$VSS_CONFIG" ]]; then
    echo -e "${RED}Error: VaultScope Statistics is not installed${NC}"
    exit 1
fi

INSTALL_TYPE=$(grep -o '"install_type":"[^"]*' "$VSS_CONFIG" | cut -d'"' -f4)
INSTALL_DIR=$(grep -o '"install_dir":"[^"]*' "$VSS_CONFIG" | cut -d'"' -f4)

show_help() {
    echo "VaultScope Statistics CLI v$VSS_VERSION"
    echo ""
    echo "Usage: vss [command] [options]"
    echo ""
    echo "Commands:"
    echo "  status          Show service status"
    echo "  start           Start services"
    echo "  stop            Stop services"
    echo "  restart         Restart services"
    echo "  logs [service]  Show logs (server/client)"
    echo "  update          Update installation"
    echo "  check           Check installation health"
    echo "  apikey          Manage API keys"
    echo "    list          List all API keys"
    echo "    create <name> Create new API key"
    echo "    delete <key>  Delete API key"
    echo "  uninstall       Remove VaultScope Statistics"
    echo "  help            Show this help message"
}

case "$1" in
    status)
        echo -e "${CYAN}VaultScope Statistics Status${NC}"
        echo "Installation type: $INSTALL_TYPE"
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
            systemctl status vss-server --no-pager
        fi
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
            systemctl status vss-client --no-pager
        fi
        ;;
        
    start)
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
            systemctl start vss-server
            echo -e "${GREEN}Server started${NC}"
        fi
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
            systemctl start vss-client
            echo -e "${GREEN}Client started${NC}"
        fi
        ;;
        
    stop)
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
            systemctl stop vss-server
            echo -e "${YELLOW}Server stopped${NC}"
        fi
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
            systemctl stop vss-client
            echo -e "${YELLOW}Client stopped${NC}"
        fi
        ;;
        
    restart)
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
            systemctl restart vss-server
            echo -e "${GREEN}Server restarted${NC}"
        fi
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
            systemctl restart vss-client
            echo -e "${GREEN}Client restarted${NC}"
        fi
        ;;
        
    logs)
        SERVICE="$2"
        if [[ -z "$SERVICE" ]]; then
            if [[ "$INSTALL_TYPE" == "server" ]]; then
                SERVICE="server"
            elif [[ "$INSTALL_TYPE" == "client" ]]; then
                SERVICE="client"
            else
                echo "Please specify service: vss logs [server|client]"
                exit 1
            fi
        fi
        
        case "$SERVICE" in
            server)
                journalctl -u vss-server -f
                ;;
            client)
                journalctl -u vss-client -f
                ;;
            *)
                echo "Invalid service. Use: server or client"
                ;;
        esac
        ;;
        
    update)
        cd "$INSTALL_DIR"
        git pull origin $(git branch --show-current)
        npm install
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
            npm run build:server
            systemctl restart vss-server
        fi
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
            npm run build:client
            systemctl restart vss-client
        fi
        
        echo -e "${GREEN}Update completed${NC}"
        ;;
        
    check)
        echo -e "${CYAN}Checking installation health...${NC}"
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
            if curl -s http://localhost:4000/health > /dev/null; then
                echo -e "${GREEN}✓ Server is healthy${NC}"
            else
                echo -e "${RED}✗ Server is not responding${NC}"
            fi
        fi
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
            if curl -s http://localhost:4001 > /dev/null; then
                echo -e "${GREEN}✓ Client is healthy${NC}"
            else
                echo -e "${RED}✗ Client is not responding${NC}"
            fi
        fi
        ;;
        
    apikey)
        if [[ "$INSTALL_TYPE" != "full" ]] && [[ "$INSTALL_TYPE" != "server" ]]; then
            echo -e "${RED}API key management is only available with server installation${NC}"
            exit 1
        fi
        
        cd "$INSTALL_DIR"
        
        case "$2" in
            list)
                npm run apikey list
                ;;
            create)
                if [[ -z "$3" ]]; then
                    echo "Usage: vss apikey create <name>"
                    exit 1
                fi
                shift 2
                npm run apikey create "$@"
                ;;
            delete)
                if [[ -z "$3" ]]; then
                    echo "Usage: vss apikey delete <key>"
                    exit 1
                fi
                npm run apikey delete "$3"
                ;;
            *)
                echo "Usage: vss apikey [list|create|delete]"
                ;;
        esac
        ;;
        
    uninstall)
        echo -e "${YELLOW}Warning: This will completely remove VaultScope Statistics${NC}"
        read -p "Are you sure? [y/N]: " confirm </dev/tty
        if [[ "$confirm" == "y" ]] || [[ "$confirm" == "Y" ]]; then
            bash /var/log/vss-installer/uninstall.sh
        fi
        ;;
        
    help|--help|-h)
        show_help
        ;;
        
    *)
        show_help
        exit 1
        ;;
esac
EOF
        
        chmod +x /usr/local/bin/vss
        log "VSS CLI tool installed at /usr/local/bin/vss (bash fallback)"
    fi
}

save_configuration() {
    log "Saving configuration..."
    
    mkdir -p "$CONFIG_DIR"
    
    cat > "$CONFIG_FILE" << EOF
{
    "version": "$VSS_VERSION",
    "install_type": "$INSTALL_TYPE",
    "install_dir": "$TARGET_DIR",
    "branch": "$BRANCH",
    "use_nginx": $USE_NGINX,
    "server_domain": "$SERVER_DOMAIN",
    "client_domain": "$CLIENT_DOMAIN",
    "use_ssl": $USE_SSL,
    "installed_at": "$(date -Iseconds)"
}
EOF
    
    chmod 600 "$CONFIG_FILE"
}

restart_services() {
    log "Restarting services..."
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
        systemctl restart vss-server
    fi
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
        systemctl restart vss-client
    fi
}

display_installation_info() {
    echo ""
    echo "========================================="
    echo -e "${GREEN}VaultScope Statistics Installation Complete!${NC}"
    echo "========================================="
    echo ""
    echo -e "${CYAN}Installation Details:${NC}"
    echo "Version: $VSS_VERSION"
    echo "Type: $INSTALL_TYPE"
    echo "Branch: $BRANCH"
    echo "Directory: $TARGET_DIR"
    echo ""
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
        echo -e "${CYAN}Server Configuration:${NC}"
        echo "Port: 4000"
        if [[ -n "$SERVER_DOMAIN" ]]; then
            echo "Domain: $SERVER_DOMAIN"
            if $USE_SSL; then
                echo "URL: https://$SERVER_DOMAIN"
            else
                echo "URL: http://$SERVER_DOMAIN"
            fi
        else
            echo "URL: http://localhost:4000"
        fi
        echo ""
        
        if [[ -n "$API_KEY" ]]; then
            echo -e "${YELLOW}IMPORTANT - Save these credentials:${NC}"
            echo "Admin API Key: $API_KEY"
            echo ""
            echo "Use this API key when configuring nodes to connect to this server."
        fi
    fi
    
    if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
        echo -e "${CYAN}Client Configuration:${NC}"
        echo "Port: 4001"
        if [[ -n "$CLIENT_DOMAIN" ]]; then
            echo "Domain: $CLIENT_DOMAIN"
            if $USE_SSL; then
                echo "URL: https://$CLIENT_DOMAIN"
            else
                echo "URL: http://$CLIENT_DOMAIN"
            fi
        else
            echo "URL: http://localhost:4001"
        fi
    fi
    
    echo ""
    echo -e "${CYAN}Useful Commands:${NC}"
    echo "Check services:  systemctl status vss-server vss-client"
    echo "View logs:       journalctl -u vss-server -f"
    echo "                 journalctl -u vss-client -f"
    echo "Restart server:  systemctl restart vss-server"
    echo "Restart client:  systemctl restart vss-client"
    echo "CLI tool:        vss --help"
    echo "API keys:        vss apikey list"
    echo "Health check:    vss health"
    echo ""
    echo -e "${CYAN}Test Installation:${NC}"
    echo "Server health:   curl http://localhost:4000/health"
    echo "Client status:   curl http://localhost:4001"
    echo ""
    echo -e "${GREEN}Installation log: $LOG_FILE${NC}"
    echo -e "${GREEN}Configuration: $CONFIG_FILE${NC}"
}

main() {
    clear
    echo "========================================="
    echo "VaultScope Statistics Installer v$VSS_VERSION"
    echo "========================================="
    echo ""
    
    # Ensure we can read from terminal even when piped
    exec < /dev/tty
    
    check_root
    detect_os
    check_existing_installation
    
    select_installation_type
    select_branch
    
    if prompt_yes_no "Would you like to use Nginx as a reverse proxy?"; then
        USE_NGINX=true
        
        # Get server IP for DNS configuration
        local server_ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n1)
        
        echo ""
        echo -e "${CYAN}=== Domain Configuration ===${NC}"
        echo -e "Your server IP address is: ${GREEN}$server_ip${NC}"
        echo "Please configure your DNS A records to point to this IP before continuing."
        echo ""
        
        # Collect domain names based on installation type
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "server" ]]; then
            read -p "Enter domain for API/Server (e.g., api.example.com): " SERVER_DOMAIN </dev/tty
            echo -e "Add DNS A record: ${GREEN}$SERVER_DOMAIN -> $server_ip${NC}"
        fi
        
        if [[ "$INSTALL_TYPE" == "full" ]] || [[ "$INSTALL_TYPE" == "client" ]]; then
            read -p "Enter domain for Client (e.g., stats.example.com): " CLIENT_DOMAIN </dev/tty
            echo -e "Add DNS A record: ${GREEN}$CLIENT_DOMAIN -> $server_ip${NC}"
        fi
        
        echo ""
        if prompt_yes_no "Would you like to setup SSL certificates?"; then
            USE_SSL=true
            read -p "Enter email address for SSL certificates: " SSL_EMAIL </dev/tty
        fi
        
        if prompt_yes_no "Have you configured the DNS records? Continue?"; then
            log "DNS records confirmed by user"
        else
            error "Please configure DNS records and run the installer again."
            exit 1
        fi
    fi
    
    install_dependencies
    setup_application
    create_systemd_services
    setup_nginx
    create_vss_cli
    save_configuration
    
    display_installation_info
}

trap 'error "Installation failed. Check log at $LOG_FILE"' ERR

main "$@"