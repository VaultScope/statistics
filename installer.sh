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
readonly INSTALLER_VERSION="5.0.0"
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
    
    info "Installing server dependencies..."
    npm ci --production 2>&1 | tee -a "$LOG_FILE" || npm install --production 2>&1 | tee -a "$LOG_FILE"
    
    if [[ -d "client" ]]; then
        info "Installing client dependencies..."
        cd client
        npm ci --production 2>&1 | tee -a "$LOG_FILE" || npm install --production 2>&1 | tee -a "$LOG_FILE"
        cd ..
    fi
    
    success "Dependencies installed"
}

build_application() {
    print_header "Building Application"
    
    cd "$INSTALL_DIR"
    
    info "Building server..."
    npm run build 2>&1 | tee -a "$LOG_FILE" || {
        error "Server build failed"
        return 1
    }
    
    if [[ -d "client" ]] && [[ -f "client/package.json" ]]; then
        info "Building client..."
        npm run client:build 2>&1 | tee -a "$LOG_FILE" || {
            warning "Client build failed - continuing without client"
        }
    fi
    
    success "Application built successfully"
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
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/server.log
StandardError=append:$LOG_DIR/server-error.log

[Install]
WantedBy=multi-user.target
EOF

    # Client service (if client exists)
    if [[ -d "$INSTALL_DIR/client" ]]; then
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
    systemctl start vaultscope-statistics-server
    
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
    echo ""
    echo "Useful Commands:"
    echo "  • Check status: systemctl status vaultscope-statistics-server"
    echo "  • View logs: journalctl -u vaultscope-statistics-server -f"
    echo "  • Restart: systemctl restart vaultscope-statistics-server"
    echo "  • API keys: cd $INSTALL_DIR && npm run apikey list"
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
    
    # Show summary
    show_summary
    
    info "Full installation log available at: $LOG_FILE"
}

# ============================================================================
# ENTRY POINT
# ============================================================================
main "$@"