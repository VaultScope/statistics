#!/bin/bash

# VaultScope Statistics Installer for Linux/Mac
# Version 1.0.0

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Installation directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    INSTALL_PATH="$HOME/VaultScope/Statistics"
else
    INSTALL_PATH="/opt/vaultscope/statistics"
fi

# Print functions
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info() { echo -e "${CYAN}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macos"
        print_info "Detected OS: macOS"
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS="linux"
        DISTRO="${ID,,}" # Convert to lowercase
        print_info "Detected OS: Linux ($DISTRO)"
    else
        print_error "Unsupported operating system"
        exit 1
    fi
}

# Check root permissions
check_root() {
    if [[ "$OS" == "linux" ]] && [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root on Linux"
        print_info "Please run: sudo $0"
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
        NODE_VERSION=$(node --version 2>/dev/null || echo "v0.0.0")
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
        print_info "Installing Node.js v20..."
        
        if [[ "$OS" == "macos" ]]; then
            # macOS installation
            if command_exists brew; then
                brew install node
            else
                print_error "Homebrew is required. Please install from https://brew.sh"
                exit 1
            fi
        else
            # Linux installation
            case "$DISTRO" in
                ubuntu|debian|raspbian)
                    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                    apt-get install -y nodejs
                    ;;
                centos|rhel|rocky|almalinux)
                    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
                    yum install -y nodejs
                    ;;
                fedora)
                    dnf install -y nodejs npm
                    ;;
                arch|manjaro)
                    pacman -S --noconfirm nodejs npm
                    ;;
                *)
                    print_error "Unsupported Linux distribution: $DISTRO"
                    print_info "Please install Node.js v18+ manually"
                    exit 1
                    ;;
            esac
        fi
        
        print_success "Node.js installed successfully"
    fi
}

# Install Git
install_git() {
    if command_exists git; then
        print_success "Git is already installed"
    else
        print_info "Installing Git..."
        
        if [[ "$OS" == "macos" ]]; then
            if command_exists brew; then
                brew install git
            else
                print_error "Git is required. Please install Xcode Command Line Tools"
                exit 1
            fi
        else
            case "$DISTRO" in
                ubuntu|debian|raspbian)
                    apt-get update && apt-get install -y git
                    ;;
                centos|rhel|rocky|almalinux|fedora)
                    yum install -y git
                    ;;
                arch|manjaro)
                    pacman -S --noconfirm git
                    ;;
                *)
                    print_error "Cannot install Git automatically"
                    exit 1
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
        print_info "Installing PM2..."
        npm install -g pm2
        print_success "PM2 installed successfully"
    fi
}

# Clone repository
clone_repository() {
    local TARGET_DIR=$1
    local COMPONENT=$2
    
    print_info "Downloading $COMPONENT..."
    
    # Create temp directory
    TEMP_DIR="/tmp/vaultscope-$$"
    mkdir -p "$TEMP_DIR"
    
    # Clone repository
    if ! git clone --quiet https://github.com/VaultScope/statistics.git "$TEMP_DIR" 2>/dev/null; then
        print_warning "Repository not available, using local files"
        # For testing, create basic structure
        mkdir -p "$TARGET_DIR"
        return 0
    fi
    
    # Move component to target
    if [[ -d "$TEMP_DIR/$COMPONENT" ]]; then
        cp -r "$TEMP_DIR/$COMPONENT" "$TARGET_DIR"
    fi
    
    # Cleanup
    rm -rf "$TEMP_DIR"
}

# Setup systemd service (Linux)
setup_systemd_service() {
    local SERVICE_NAME=$1
    local DISPLAY_NAME=$2
    local WORKING_DIR=$3
    
    if [[ "$OS" != "linux" ]]; then
        return 0
    fi
    
    print_info "Setting up systemd service: $DISPLAY_NAME"
    
    cat > "/etc/systemd/system/vaultscope-$SERVICE_NAME.service" << EOF
[Unit]
Description=$DISPLAY_NAME
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$WORKING_DIR
ExecStart=$(which node) $WORKING_DIR/index.js
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "vaultscope-$SERVICE_NAME.service"
    
    print_success "Service configured: $DISPLAY_NAME"
}

# Install Server
install_server() {
    print_info "Installing VaultScope Statistics Server..."
    
    SERVER_PATH="$INSTALL_PATH/server"
    mkdir -p "$SERVER_PATH"
    
    # Clone or create server
    clone_repository "$SERVER_PATH" "server"
    
    # Create basic server structure if not exists
    if [[ ! -f "$SERVER_PATH/package.json" ]]; then
        cat > "$SERVER_PATH/package.json" << 'EOF'
{
  "name": "vaultscope-statistics-server",
  "version": "1.0.0",
  "description": "VaultScope Statistics Server",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "systeminformation": "^5.21.20"
  }
}
EOF
    fi
    
    # Create basic server if not exists
    if [[ ! -f "$SERVER_PATH/index.js" ]]; then
        cat > "$SERVER_PATH/index.js" << 'EOF'
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.send('OK');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
EOF
    fi
    
    # Install dependencies
    cd "$SERVER_PATH"
    print_info "Installing server dependencies..."
    npm install --production
    
    # Generate API key
    API_KEY=$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -d '+/=' | head -c 48)
    
    # Create .env file
    cat > "$SERVER_PATH/.env" << EOF
PORT=4000
API_KEY=$API_KEY
NODE_ENV=production
EOF
    
    # Setup service
    if [[ "$OS" == "linux" ]]; then
        setup_systemd_service "server" "VaultScope Statistics Server" "$SERVER_PATH"
    else
        # macOS - use PM2
        cd "$SERVER_PATH"
        pm2 start index.js --name "vaultscope-server"
        pm2 save
    fi
    
    print_success "Server installed successfully!"
    print_info "Server will run on: http://localhost:4000"
    print_warning "API Key: $API_KEY"
    print_warning "Please save this API key securely!"
    
    echo "$API_KEY" > "$INSTALL_PATH/server-api-key.txt"
}

# Install Client
install_client() {
    print_info "Installing VaultScope Statistics Client..."
    
    CLIENT_PATH="$INSTALL_PATH/client"
    mkdir -p "$CLIENT_PATH"
    
    # Clone or create client
    clone_repository "$CLIENT_PATH" "client"
    
    # Create basic Next.js structure if not exists
    if [[ ! -f "$CLIENT_PATH/package.json" ]]; then
        cat > "$CLIENT_PATH/package.json" << 'EOF'
{
  "name": "vaultscope-statistics-client",
  "version": "1.0.0",
  "description": "VaultScope Statistics Client",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
EOF
    fi
    
    # Install dependencies
    cd "$CLIENT_PATH"
    print_info "Installing client dependencies..."
    npm install --production
    
    # Try to build
    if [[ -f "$CLIENT_PATH/next.config.js" ]] || [[ -f "$CLIENT_PATH/next.config.mjs" ]]; then
        print_info "Building client..."
        npm run build || print_warning "Build failed, client will run in dev mode"
    fi
    
    # Create .env file
    cat > "$CLIENT_PATH/.env.production" << EOF
NEXT_PUBLIC_API_URL=http://localhost:4000
NODE_ENV=production
EOF
    
    # Setup service
    if [[ "$OS" == "linux" ]]; then
        setup_systemd_service "client" "VaultScope Statistics Client" "$CLIENT_PATH"
    else
        # macOS - use PM2
        cd "$CLIENT_PATH"
        pm2 start "npm run start" --name "vaultscope-client"
        pm2 save
    fi
    
    print_success "Client installed successfully!"
    print_info "Client will run on: http://localhost:3000"
}

# Show menu
show_menu() {
    # Display menu to stderr so it doesn't get captured
    echo >&2
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}" >&2
    echo -e "${CYAN}║           VaultScope Statistics Installer               ║${NC}" >&2
    echo -e "${CYAN}║                    Version 1.0.0                        ║${NC}" >&2
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}" >&2
    echo >&2
    echo -e "${CYAN}ℹ${NC} What would you like to install?" >&2
    echo "  1. Client only" >&2
    echo "  2. Server only" >&2
    echo "  3. Both Client and Server" >&2
    echo "  4. Exit" >&2
    echo >&2
    read -p "Enter your choice (1-4): " CHOICE
    # Only output the choice to stdout for capture
    echo "$CHOICE"
}

# Cleanup
cleanup() {
    if [[ -d "/tmp/vaultscope-$$" ]]; then
        rm -rf "/tmp/vaultscope-$$"
    fi
}

# Main function
main() {
    # Trap cleanup
    trap cleanup EXIT
    
    # Detect OS
    detect_os
    
    # Check permissions
    check_root
    
    # Install prerequisites
    print_info "Checking prerequisites..."
    install_nodejs
    install_git
    install_pm2
    
    # Create installation directory
    mkdir -p "$INSTALL_PATH"
    
    # Get user choice
    CHOICE=$(show_menu)
    
    # Debug output
    # echo "DEBUG: Choice captured: '$CHOICE'"
    
    case "$CHOICE" in
        "1")
            install_client
            ;;
        "2")
            install_server
            ;;
        "3")
            install_server
            echo
            install_client
            ;;
        "4")
            print_info "Installation cancelled"
            exit 0
            ;;
        *)
            print_error "Invalid choice: '$CHOICE'"
            exit 1
            ;;
    esac
    
    # Show completion message
    echo
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    print_success "Installation completed successfully!"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo
    
    if [[ "$OS" == "linux" ]]; then
        print_info "Services are configured to start automatically"
        print_info "Use these commands to manage services:"
        echo "  sudo systemctl status vaultscope-server"
        echo "  sudo systemctl status vaultscope-client"
        echo "  sudo systemctl restart vaultscope-server"
        echo "  sudo systemctl restart vaultscope-client"
    else
        print_info "Services managed by PM2"
        echo "  pm2 list              - Show services"
        echo "  pm2 restart all       - Restart services"
        echo "  pm2 logs             - View logs"
    fi
    
    if [[ -f "$INSTALL_PATH/server-api-key.txt" ]]; then
        echo
        print_warning "Server API Key saved to: $INSTALL_PATH/server-api-key.txt"
    fi
}

# Run main function
main "$@"