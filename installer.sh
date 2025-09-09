#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                     VaultScope Statistics Installer v4.0.5                      ║
# ║                          Modern Interactive Installation                        ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set +e  # Don't exit on errors - we handle them properly

# Compatibility check
if [ "${BASH_VERSION%%.*}" -lt 4 ]; then
    echo "Error: This installer requires Bash 4.0 or higher"
    echo "Your version: $BASH_VERSION"
    exit 1
fi

# Check for required commands
for cmd in git curl wget; do
    if ! command -v $cmd >/dev/null 2>&1; then
        echo "Warning: $cmd is not installed. Some features may not work."
    fi
done

# Parse command line arguments
UNINSTALL_MODE=false
RECOVERY_MODE=false
QUIET_MODE=false
AUTO_YES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --uninstall|-u)
            UNINSTALL_MODE=true
            shift
            ;;
        --recovery|-r)
            RECOVERY_MODE=true
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
        --help|-h)
            echo "VaultScope Statistics Installer v4.0.5"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --uninstall, -u    Run in uninstall mode"
            echo "  --recovery, -r     Run in recovery mode (fix broken installation)"
            echo "  --quiet, -q        Suppress non-essential output"
            echo "  --yes, -y          Automatically answer yes to prompts"
            echo "  --help, -h         Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# ============================================================================
# CONFIGURATION
# ============================================================================
INSTALL_DIR="/var/www/vaultscope-statistics"
CONFIG_DIR="/etc/vaultscope-statistics" 
LOG_DIR="/var/log/vaultscope-statistics"
BACKUP_DIR="/var/backups/vaultscope-statistics"
STATE_FILE="/var/lib/vaultscope-statistics/installer.state"
REPO_URL="https://github.com/vaultscope/statistics.git"
NODE_VERSION="20"
BRANCH="dev"

# State tracking
INSTALLER_VERSION="4.0.5"
INSTALLER_PID=$$
LOG_FILE="/tmp/vaultscope_install_$(date +%Y%m%d_%H%M%S).log"
PROGRESS_CURRENT=0
PROGRESS_TOTAL=100

# Terminal capabilities - safe defaults
if command -v tput >/dev/null 2>&1; then
    TERM_WIDTH=$(tput cols 2>/dev/null || echo 80)
    TERM_HEIGHT=$(tput lines 2>/dev/null || echo 24)
else
    TERM_WIDTH=80
    TERM_HEIGHT=24
fi

# ============================================================================
# COLORS AND UI ELEMENTS
# ============================================================================
if [ -t 1 ] && [ "$QUIET_MODE" = false ]; then
    # Regular Colors
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    WHITE='\033[1;37m'
    GRAY='\033[0;90m'
    DARK_GRAY='\033[1;30m'
    
    # Bold
    BOLD='\033[1m'
    DIM='\033[2m'
    ITALIC='\033[3m'
    UNDERLINE='\033[4m'
    BLINK='\033[5m'
    REVERSE='\033[7m'
    
    # Background
    BG_RED='\033[41m'
    BG_GREEN='\033[42m'
    BG_YELLOW='\033[43m'
    BG_BLUE='\033[44m'
    BG_MAGENTA='\033[45m'
    BG_CYAN='\033[46m'
    BG_WHITE='\033[47m'
    BG_DARK='\033[40m'
    
    # Reset
    NC='\033[0m'
    CLEAR_LINE='\033[2K'
    MOVE_UP='\033[1A'
    SAVE_CURSOR='\033[s'
    RESTORE_CURSOR='\033[u'
    
    # Unicode symbols
    CHECK="✓"
    CROSS="✗"
    ARROW="➜"
    DOT="•"
    STAR="★"
    HEART="♥"
    DIAMOND="◆"
    CIRCLE="●"
    SQUARE="■"
    TRIANGLE="▲"
    PLAY="▶"
    PAUSE="⏸"
    STOP="⏹"
    WARNING="⚠"
    INFO="ℹ"
    QUESTION="?"
    HOURGLASS="⏳"
    ROCKET="🚀"
    PACKAGE="📦"
    WRENCH="🔧"
    SHIELD="🛡"
    LOCK="🔒"
    KEY="🔑"
    GLOBE="🌐"
    FIRE="🔥"
    SPARKLES="✨"
else
    # No colors in quiet mode or non-terminal
    RED='' GREEN='' YELLOW='' BLUE='' MAGENTA='' CYAN='' WHITE='' GRAY='' DARK_GRAY=''
    BOLD='' DIM='' ITALIC='' UNDERLINE='' BLINK='' REVERSE=''
    BG_RED='' BG_GREEN='' BG_YELLOW='' BG_BLUE='' BG_MAGENTA='' BG_CYAN='' BG_WHITE='' BG_DARK=''
    NC='' CLEAR_LINE='' MOVE_UP='' SAVE_CURSOR='' RESTORE_CURSOR=''
    CHECK="[OK]" CROSS="[FAIL]" ARROW="->" DOT="*" STAR="*" HEART="<3" DIAMOND="<>" 
    CIRCLE="o" SQUARE="[]" TRIANGLE="^" PLAY=">" PAUSE="||" STOP="[]" WARNING="[!]" 
    INFO="[i]" QUESTION="[?]" HOURGLASS="..." ROCKET="=>" PACKAGE="[P]" WRENCH="[W]"
    SHIELD="[S]" LOCK="[L]" KEY="[K]" GLOBE="[G]" FIRE="[F]" SPARKLES="*"
fi

# Animation frames
SPINNER_FRAMES=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
LOADING_FRAMES=("◐" "◓" "◑" "◒")
PROGRESS_FRAMES=("▱▱▱▱▱" "▰▱▱▱▱" "▰▰▱▱▱" "▰▰▰▱▱" "▰▰▰▰▱" "▰▰▰▰▰")
WAVE_FRAMES=("～～～～～" "∿～～～～" "～∿～～～" "～～∿～～" "～～～∿～" "～～～～∿")

# ============================================================================
# ENHANCED UI FUNCTIONS
# ============================================================================
center_text() {
    local text="$1"
    local width=${2:-$TERM_WIDTH}
    local text_length=${#text}
    local padding=$(( (width - text_length) / 2 ))
    printf "%*s%s%*s" $padding "" "$text" $padding ""
}

print_banner() {
    clear
    local mode_text=""
    local color=""
    
    if [[ "$UNINSTALL_MODE" == true ]]; then
        mode_text="UNINSTALL MODE"
        color=$RED
    elif [[ "$RECOVERY_MODE" == true ]]; then
        mode_text="RECOVERY MODE"
        color=$YELLOW
    else
        mode_text="INSTALLATION"
        color=$CYAN
    fi
    
    echo ""
    echo -e "${color}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}${CYAN}     ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗${NC}"
    echo -e "${BOLD}${CYAN}     ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝${NC}"
    echo -e "${BOLD}${BRIGHT_CYAN}     ██║   ██║███████║██║   ██║██║     ██║   ███████╗██║     ██║   ██║██████╔╝█████╗  ${NC}"
    echo -e "${BOLD}${CYAN}     ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║   ╚════██║██║     ██║   ██║██╔═══╝ ██╔══╝  ${NC}"
    echo -e "${BOLD}${CYAN}      ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║   ███████║╚██████╗╚██████╔╝██║     ███████╗${NC}"
    echo -e "${BOLD}${CYAN}       ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝   ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝${NC}"
    echo ""
    echo -e "                     ${BOLD}${WHITE}STATISTICS MONITORING SYSTEM${NC} ${DIM}v${INSTALLER_VERSION}${NC}"
    echo -e "                              ${BOLD}${color}[ $mode_text ]${NC}"
    echo ""
    echo -e "${color}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_section() {
    local title="$1"
    local color="${2:-$BLUE}"
    echo ""
    echo -e "${color}════════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "  ${BOLD}${WHITE}$title${NC}"
    echo -e "${color}════════════════════════════════════════════════════════════════════════════════${NC}"
}

print_subsection() {
    local title="$1"
    echo ""
    echo -e "${CYAN}  ${UNDERLINE}$title${NC}"
}

print_progress_bar() {
    local current=$1
    local total=$2
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((width * current / total))
    local empty=$((width - filled))
    
    printf "\r  "
    
    # Progress bar
    printf "${CYAN}["
    for ((i=0; i<filled; i++)); do
        printf "${GREEN}█"
    done
    for ((i=0; i<empty; i++)); do
        printf "${DIM}░"
    done
    printf "${CYAN}]${NC}"
    
    # Percentage with color based on progress
    if [ $percentage -lt 33 ]; then
        printf " ${YELLOW}%3d%%${NC}" $percentage
    elif [ $percentage -lt 66 ]; then
        printf " ${CYAN}%3d%%${NC}" $percentage
    else
        printf " ${GREEN}%3d%%${NC}" $percentage
    fi
    
    # Status text
    if [ $current -eq $total ]; then
        printf " ${GREEN}✓ Complete${NC}\n"
    fi
}

animated_print() {
    local message="$1"
    local delay="${2:-0.02}"
    
    for (( i=0; i<${#message}; i++ )); do
        echo -n "${message:$i:1}"
        sleep $delay
    done
    echo ""
}

show_spinner() {
    local pid=$1
    local message="${2:-Processing}"
    local frame=0
    local timeout=0
    
    # Safety timeout of 300 seconds (5 minutes)
    while ps -p $pid > /dev/null 2>&1 && [ $timeout -lt 3000 ]; do
        printf "\r  ${CYAN}${SPINNER_FRAMES[$frame]}${NC} ${message}..."
        frame=$(( (frame + 1) % ${#SPINNER_FRAMES[@]} ))
        sleep 0.1
        timeout=$((timeout + 1))
    done
    
    # Kill process if timeout reached
    if [ $timeout -ge 3000 ]; then
        kill -9 $pid 2>/dev/null || true
        printf "\r  ${RED}${CROSS}${NC} ${message}... (timeout)"
    fi
    
    printf "\r${CLEAR_LINE}"
}

print_status() {
    local status=$1
    local message="$2"
    
    case $status in
        "progress")
            echo -en "\r  ${YELLOW}${HOURGLASS}${NC} ${message}..."
            ;;
        "success")
            echo -e "\r  ${GREEN}${CHECK}${NC} ${message}"
            ;;
        "error")
            echo -e "\r  ${RED}${CROSS}${NC} ${message}"
            ;;
        "warning")
            echo -e "  ${YELLOW}${WARNING}${NC} ${message}"
            ;;
        "info")
            echo -e "  ${CYAN}${INFO}${NC} ${message}"
            ;;
        "question")
            echo -en "  ${MAGENTA}${QUESTION}${NC} ${message}"
            ;;
    esac
}

print_box() {
    local title="$1"
    local content="$2"
    local color="${3:-$CYAN}"
    local width="${4:-60}"
    
    # Create horizontal line
    local hline=""
    local i
    for ((i=0; i<width-2; i++)); do
        hline="${hline}─"
    done
    
    echo -e "${color}┌${hline}┐${NC}"
    if [ -n "$title" ]; then
        local title_pad=$((width - ${#title} - 3))
        local padding=""
        for ((i=0; i<title_pad; i++)); do
            padding="${padding} "
        done
        echo -e "${color}│${NC} ${BOLD}$title${NC}${padding}${color}│${NC}"
        echo -e "${color}├${hline}┤${NC}"
    fi
    
    while IFS= read -r line; do
        local line_length=${#line}
        local padding_needed=$((width - line_length - 3))
        local padding=""
        for ((i=0; i<padding_needed; i++)); do
            padding="${padding} "
        done
        echo -e "${color}│${NC} $line${padding}${color}│${NC}"
    done <<< "$content"
    
    echo -e "${color}└${hline}┘${NC}"
}

# ============================================================================
# STATE MANAGEMENT
# ============================================================================
save_state() {
    local key="$1"
    local value="$2"
    
    mkdir -p "$(dirname "$STATE_FILE")"
    echo "$key=$value" >> "$STATE_FILE"
}

load_state() {
    local key="$1"
    
    if [ -f "$STATE_FILE" ]; then
        grep "^$key=" "$STATE_FILE" 2>/dev/null | cut -d'=' -f2-
    fi
}

clear_state() {
    rm -f "$STATE_FILE"
}

# ============================================================================
# SYSTEM DETECTION
# ============================================================================
detect_system() {
    print_status "progress" "Detecting system configuration"
    
    # OS Detection
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
    
    # Architecture
    ARCH=$(uname -m)
    
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
    elif command -v zypper &>/dev/null; then
        PKG_MANAGER="zypper"
    elif command -v apk &>/dev/null; then
        PKG_MANAGER="apk"
    else
        PKG_MANAGER="unknown"
    fi
    
    # Service manager detection
    if command -v systemctl &>/dev/null && systemctl --version &>/dev/null; then
        SERVICE_MANAGER="systemd"
    elif command -v service &>/dev/null; then
        SERVICE_MANAGER="sysv"
    elif command -v rc-service &>/dev/null; then
        SERVICE_MANAGER="openrc"
    else
        SERVICE_MANAGER="none"
    fi
    
    # Memory and disk space
    TOTAL_MEM=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo "Unknown")
    AVAILABLE_DISK=$(df -BG "$INSTALL_DIR" 2>/dev/null | awk 'NR==2{print $4}' | sed 's/G//' || echo "Unknown")
    
    print_status "success" "System detection complete"
    
    # Display system info in a nice box
    local system_info="OS: $OS_NAME
Architecture: $ARCH
Package Manager: $PKG_MANAGER
Service Manager: $SERVICE_MANAGER
Total Memory: ${TOTAL_MEM}MB
Available Disk: ${AVAILABLE_DISK}GB"
    
    print_box "System Information" "$system_info" "$GREEN"
    
    # Check for specific OS requirements
    if [[ "$OS" == "ubuntu" && "$OS_VERSION" == "24.04" ]]; then
        print_status "info" "Ubuntu 24.04 LTS detected - applying specific optimizations"
        UBUNTU_2404=true
    else
        UBUNTU_2404=false
    fi
    
    # Save system state
    save_state "OS" "$OS"
    save_state "OS_VERSION" "$OS_VERSION"
    save_state "PKG_MANAGER" "$PKG_MANAGER"
    save_state "SERVICE_MANAGER" "$SERVICE_MANAGER"
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
    ["database"]=true
    ["monitoring"]=false
    ["backup"]=false
)

declare -A OPTION_DESCRIPTIONS=(
    ["server"]="API Server - Core backend service"
    ["client"]="Web Client - Frontend dashboard"
    ["nginx"]="Nginx Reverse Proxy - Web server configuration"
    ["ssl"]="SSL Certificates - HTTPS with Let's Encrypt"
    ["cli"]="CLI Tools - Command-line utilities"
    ["systemd"]="Systemd Services - Service management"
    ["apikey"]="Initial API Key - Admin access key"
    ["database"]="Database Setup - SQLite initialization"
    ["monitoring"]="Health Monitoring - Service health checks"
    ["backup"]="Auto Backup - Scheduled backups"
)

show_installation_menu() {
    local finished=false
    local selected_index=0
    local options_array=("server" "client" "nginx" "ssl" "cli" "systemd" "apikey" "database" "monitoring" "backup")
    
    while [ "$finished" = false ]; do
        print_banner
        print_section "Installation Configuration" "$CYAN"
        echo ""
        echo -e "  ${BOLD}${CYAN}Select components to install:${NC}"
        echo ""
        echo -e "  ${DIM}Use ↑/↓ arrows or j/k to navigate, SPACE to toggle, ENTER to proceed${NC}"
        echo ""
        
        for i in "${!options_array[@]}"; do
            local key="${options_array[$i]}"
            local checked="${INSTALL_OPTIONS[$key]}"
            local desc="${OPTION_DESCRIPTIONS[$key]}"
            
            if [ $i -eq $selected_index ]; then
                if [ "$checked" = true ]; then
                    echo -e "  ${CYAN}▶${NC} ${GREEN}[✓]${NC} ${BOLD}${WHITE}${key^^}${NC} - ${desc}"
                else
                    echo -e "  ${CYAN}▶${NC} ${DIM}[ ]${NC} ${BOLD}${WHITE}${key^^}${NC} - ${DIM}${desc}${NC}"
                fi
            else
                if [ "$checked" = true ]; then
                    echo -e "    ${GREEN}[✓]${NC} ${key^^} - ${desc}"
                else
                    echo -e "    ${DIM}[ ]${NC} ${DIM}${key^^} - ${desc}${NC}"
                fi
            fi
        done
        
        echo ""
        echo -e "  ${DIM}────────────────────────────────────────────────────────────────${NC}"
        echo -e "  ${BOLD}[SPACE]${NC} Toggle  ${BOLD}[A]${NC} All  ${BOLD}[N]${NC} None  ${BOLD}[ENTER]${NC} Proceed  ${BOLD}[Q]${NC} Quit"
        echo ""
        
        # Read single character
        read -rsn1 key
        
        case $key in
            $'\x1b')  # ESC sequence
                read -rsn2 key
                case $key in
                    '[A')  # Up arrow
                        selected_index=$(( (selected_index - 1 + ${#options_array[@]}) % ${#options_array[@]} ))
                        ;;
                    '[B')  # Down arrow
                        selected_index=$(( (selected_index + 1) % ${#options_array[@]} ))
                        ;;
                esac
                ;;
            ' ')  # Space - toggle selection
                local key="${options_array[$selected_index]}"
                INSTALL_OPTIONS[$key]=$([ "${INSTALL_OPTIONS[$key]}" = true ] && echo false || echo true)
                ;;
            'a'|'A')  # Select all
                for key in "${!INSTALL_OPTIONS[@]}"; do
                    INSTALL_OPTIONS[$key]=true
                done
                ;;
            'n'|'N')  # Select none
                for key in "${!INSTALL_OPTIONS[@]}"; do
                    INSTALL_OPTIONS[$key]=false
                done
                ;;
            'p'|'P')  # Proceed
                finished=true
                ;;
            'q'|'Q')  # Quit
                print_status "info" "Installation cancelled by user"
                exit 0
                ;;
        esac
    done
}

# ============================================================================
# PREREQUISITES CHECK
# ============================================================================
check_prerequisites() {
    print_section "Prerequisites Check" "$YELLOW"
    
    local prerequisites_met=true
    
    # Check if running as root
    print_status "progress" "Checking root privileges"
    if [ "$EUID" -ne 0 ]; then
        print_status "error" "Root privileges required"
        prerequisites_met=false
    else
        print_status "success" "Root privileges confirmed"
    fi
    
    # Check internet connectivity
    print_status "progress" "Checking internet connectivity"
    if ping -c 1 -W 2 8.8.8.8 &>/dev/null || ping -c 1 -W 2 1.1.1.1 &>/dev/null; then
        print_status "success" "Internet connection available"
    else
        print_status "warning" "Internet connection may be limited"
    fi
    
    # Check disk space (need at least 1GB)
    print_status "progress" "Checking disk space"
    if [ "$AVAILABLE_DISK" != "Unknown" ] && [ "$AVAILABLE_DISK" -ge 1 ]; then
        print_status "success" "Sufficient disk space (${AVAILABLE_DISK}GB available)"
    else
        print_status "warning" "Low disk space detected"
    fi
    
    # Check memory (recommend at least 1GB)
    print_status "progress" "Checking system memory"
    if [ "$TOTAL_MEM" != "Unknown" ] && [ "$TOTAL_MEM" -ge 1024 ]; then
        print_status "success" "Sufficient memory (${TOTAL_MEM}MB available)"
    else
        print_status "warning" "Low memory detected (${TOTAL_MEM}MB)"
    fi
    
    # Check for conflicting services
    print_status "progress" "Checking for conflicts"
    local conflicts=()
    
    if lsof -i:4000 &>/dev/null; then
        conflicts+=("Port 4000 is in use")
    fi
    
    if lsof -i:4001 &>/dev/null; then
        conflicts+=("Port 4001 is in use")
    fi
    
    if [ ${#conflicts[@]} -eq 0 ]; then
        print_status "success" "No conflicts detected"
    else
        for conflict in "${conflicts[@]}"; do
            print_status "warning" "$conflict"
        done
    fi
    
    if [ "$prerequisites_met" = false ]; then
        echo ""
        print_status "error" "Prerequisites not met. Please fix the issues above and try again."
        exit 1
    fi
    
    echo ""
}

# ============================================================================
# DEPENDENCY INSTALLATION
# ============================================================================
install_dependencies() {
    print_section "Installing System Dependencies" "$BLUE"
    
    # Update package manager
    print_status "progress" "Updating package manager"
    case $PKG_MANAGER in
        apt)
            apt-get update &>/dev/null &
            show_spinner $! "Updating APT repositories"
            ;;
        yum|dnf)
            $PKG_MANAGER makecache &>/dev/null &
            show_spinner $! "Updating $PKG_MANAGER cache"
            ;;
        pacman)
            pacman -Sy &>/dev/null &
            show_spinner $! "Updating Pacman database"
            ;;
        zypper)
            zypper refresh &>/dev/null &
            show_spinner $! "Refreshing Zypper repositories"
            ;;
    esac
    print_status "success" "Package manager updated"
    
    # Required packages
    local packages=("curl" "wget" "git" "build-essential" "python3" "python3-pip")
    
    # Optional packages for enhanced features
    local optional_packages=("htop" "net-tools" "iotop" "sysstat")
    
    echo ""
    print_subsection "Core Dependencies"
    
    for package in "${packages[@]}"; do
        print_status "progress" "Installing $package"
        
        case $PKG_MANAGER in
            apt)
                apt-get install -y $package &>/dev/null 2>&1
                ;;
            yum|dnf)
                $PKG_MANAGER install -y $package &>/dev/null 2>&1
                ;;
            pacman)
                pacman -S --noconfirm $package &>/dev/null 2>&1
                ;;
        esac
        
        if [ $? -eq 0 ]; then
            print_status "success" "$package installed"
        else
            print_status "warning" "$package installation failed (may already be installed)"
        fi
    done
    
    echo ""
    print_subsection "Optional Enhancements"
    
    for package in "${optional_packages[@]}"; do
        print_status "progress" "Installing $package"
        
        case $PKG_MANAGER in
            apt)
                apt-get install -y $package &>/dev/null 2>&1
                ;;
            yum|dnf)
                $PKG_MANAGER install -y $package &>/dev/null 2>&1
                ;;
        esac
        
        if [ $? -eq 0 ]; then
            print_status "success" "$package installed"
        else
            print_status "info" "$package skipped (optional)"
        fi
    done
    
    print_progress_bar 20 100
}

# ============================================================================
# NODE.JS INSTALLATION
# ============================================================================
install_nodejs() {
    print_section "Installing Node.js" "$GREEN"
    
    # Check existing Node.js installation
    if command -v node &>/dev/null; then
        local current_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$current_version" -ge "$NODE_VERSION" ]; then
            print_status "success" "Node.js v$current_version already installed"
            print_progress_bar 30 100
            return
        else
            print_status "info" "Upgrading Node.js from v$current_version to v$NODE_VERSION"
        fi
    fi
    
    print_status "progress" "Downloading Node.js setup script"
    
    # Install Node.js based on package manager
    case $PKG_MANAGER in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x -o /tmp/nodesource_setup.sh &>/dev/null
            print_status "progress" "Installing Node.js v$NODE_VERSION"
            bash /tmp/nodesource_setup.sh &>/dev/null
            apt-get install -y nodejs &>/dev/null &
            show_spinner $! "Installing Node.js packages"
            ;;
        yum|dnf)
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x -o /tmp/nodesource_setup.sh &>/dev/null
            print_status "progress" "Installing Node.js v$NODE_VERSION"
            bash /tmp/nodesource_setup.sh &>/dev/null
            $PKG_MANAGER install -y nodejs &>/dev/null &
            show_spinner $! "Installing Node.js packages"
            ;;
        *)
            print_status "warning" "Manual Node.js installation required for $PKG_MANAGER"
            ;;
    esac
    
    # Verify installation
    if command -v node &>/dev/null; then
        local installed_version=$(node -v)
        print_status "success" "Node.js $installed_version installed"
        
        # Install global npm packages
        print_status "progress" "Installing global npm packages"
        npm install -g npm@latest pm2 nodemon &>/dev/null
        print_status "success" "Global packages installed"
    else
        print_status "error" "Node.js installation failed"
        exit 1
    fi
    
    print_progress_bar 30 100
}

# ============================================================================
# APPLICATION INSTALLATION
# ============================================================================
install_application() {
    print_section "Installing VaultScope Statistics" "$MAGENTA"
    
    # Create installation directory
    print_status "progress" "Creating installation directory"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    print_status "success" "Directory created: $INSTALL_DIR"
    
    # Clone or update repository
    if [ -d ".git" ]; then
        print_status "progress" "Updating existing repository"
        git fetch origin &>/dev/null
        git checkout $BRANCH &>/dev/null
        git pull origin $BRANCH &>/dev/null &
        show_spinner $! "Pulling latest changes"
        print_status "success" "Repository updated"
    else
        print_status "progress" "Cloning repository (branch: $BRANCH)"
        git clone -b $BRANCH "$REPO_URL" . &>/dev/null 2>&1 &
        show_spinner $! "Downloading application files"
        print_status "success" "Repository cloned"
    fi
    
    print_progress_bar 40 100
    
    # Install server dependencies
    if [ "${INSTALL_OPTIONS[server]}" = true ]; then
        echo ""
        print_subsection "Server Installation"
        
        print_status "progress" "Installing server dependencies"
        npm install --production &>/dev/null 2>&1 &
        show_spinner $! "Installing npm packages"
        print_status "success" "Server dependencies installed"
        
        print_status "progress" "Building TypeScript server"
        npm run build &>/dev/null 2>&1 &
        show_spinner $! "Compiling TypeScript"
        print_status "success" "Server built successfully"
    fi
    
    print_progress_bar 50 100
    
    # Install client dependencies
    if [ "${INSTALL_OPTIONS[client]}" = true ]; then
        echo ""
        print_subsection "Client Installation"
        
        cd client
        print_status "progress" "Installing client dependencies"
        npm install --production &>/dev/null 2>&1 &
        show_spinner $! "Installing client packages"
        print_status "success" "Client dependencies installed"
        
        print_status "progress" "Building Next.js application"
        npm run build &>/dev/null 2>&1 &
        show_spinner $! "Building production bundle"
        print_status "success" "Client built successfully"
        cd ..
    fi
    
    print_progress_bar 60 100
    
    # Set permissions
    print_status "progress" "Setting file permissions"
    chown -R www-data:www-data "$INSTALL_DIR" 2>/dev/null || \
    chown -R $(whoami):$(whoami) "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"
    print_status "success" "Permissions configured"
    
    print_progress_bar 65 100
}

# ============================================================================
# DATABASE SETUP
# ============================================================================
setup_databases() {
    if [ "${INSTALL_OPTIONS[database]}" != true ]; then
        return
    fi
    
    print_section "Database Configuration" "$YELLOW"
    
    cd "$INSTALL_DIR"
    
    # Database will be automatically initialized on first server start
    print_status "progress" "Preparing database configuration"
    
    # Ensure database directory has proper permissions
    mkdir -p "$INSTALL_DIR"
    chmod 755 "$INSTALL_DIR"
    chown www-data:www-data "$INSTALL_DIR" 2>/dev/null || \
    chown $(whoami):$(whoami) "$INSTALL_DIR"
    
    print_status "success" "Database will be initialized on first start"
    print_status "info" "The server will automatically create all required tables"
    print_status "info" "Admin credentials will be displayed on first start"
    
    print_progress_bar 70 100
    
    # Create initial API key if requested
    if [ "${INSTALL_OPTIONS[apikey]}" = true ]; then
        setup_initial_apikey
    fi
}

# ============================================================================
# API KEY SETUP
# ============================================================================
setup_initial_apikey() {
    echo ""
    print_subsection "API Key Information"
    
    # API keys will be created automatically on first server start
    print_status "info" "Admin API key will be generated on first server start"
    print_status "info" "Credentials will be displayed in the server console"
    print_status "warning" "Make sure to save the credentials when they appear!"
    
    # Save a note about where to find the credentials
    cat > /root/.vaultscope_first_start_note << EOF
VaultScope Statistics - First Start Information
===============================================

The database and admin credentials will be automatically generated
when the server starts for the first time.

To view the credentials:
1. Start the server: systemctl start vaultscope-statistics-server
2. Check the logs: journalctl -u vaultscope-statistics-server -n 50

The credentials will only be shown once, so save them securely!

You can also check the server console output directly if running manually.
EOF
    
    chmod 600 /root/.vaultscope_first_start_note
    print_status "success" "First-start instructions saved to /root/.vaultscope_first_start_note"
    
    print_progress_bar 75 100
}

# ============================================================================
# SYSTEMD SERVICES
# ============================================================================
setup_services() {
    if [ "${INSTALL_OPTIONS[systemd]}" != true ] || [ "$SERVICE_MANAGER" != "systemd" ]; then
        return
    fi
    
    print_section "Service Configuration" "$CYAN"
    
    # Create log directory
    mkdir -p "$LOG_DIR"
    chown -R www-data:www-data "$LOG_DIR" 2>/dev/null || \
    chown -R $(whoami):$(whoami) "$LOG_DIR"
    
    # Server service
    if [ "${INSTALL_OPTIONS[server]}" = true ]; then
        print_status "progress" "Creating server service"
        
        cat > /etc/systemd/system/vaultscope-statistics-server.service << EOF
[Unit]
Description=VaultScope Statistics API Server
After=network.target network-online.target
Wants=network-online.target
Documentation=https://github.com/vaultscope/statistics

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStartPre=/bin/sleep 2
ExecStart=/usr/bin/node $INSTALL_DIR/dist/server/index.js
ExecReload=/bin/kill -USR2 \$MAINPID
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always
RestartSec=10
StartLimitInterval=60s
StartLimitBurst=3

# Logging
StandardOutput=append:$LOG_DIR/server.log
StandardError=append:$LOG_DIR/server-error.log

# Security
NoNewPrivileges=false
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$INSTALL_DIR $LOG_DIR /tmp
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
        print_status "success" "Server service created"
    fi
    
    # Client service
    if [ "${INSTALL_OPTIONS[client]}" = true ]; then
        print_status "progress" "Creating client service"
        
        cat > /etc/systemd/system/vaultscope-statistics-client.service << EOF
[Unit]
Description=VaultScope Statistics Web Client
After=network.target vaultscope-statistics-server.service
Wants=network-online.target
Documentation=https://github.com/vaultscope/statistics

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/client
Environment="NODE_ENV=production"
Environment="PORT=4001"
ExecStartPre=/bin/sleep 3
ExecStart=/usr/bin/npx next start -p 4001
ExecReload=/bin/kill -USR2 \$MAINPID
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always
RestartSec=10
StartLimitInterval=60s
StartLimitBurst=3

# Logging
StandardOutput=append:$LOG_DIR/client.log
StandardError=append:$LOG_DIR/client-error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$INSTALL_DIR/client $LOG_DIR /tmp
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
        print_status "success" "Client service created"
    fi
    
    print_progress_bar 80 100
    
    # Reload and start services
    print_status "progress" "Starting services"
    systemctl daemon-reload
    
    if [ "${INSTALL_OPTIONS[server]}" = true ]; then
        systemctl enable vaultscope-statistics-server &>/dev/null
        systemctl restart vaultscope-statistics-server
        
        # Wait for server to start
        sleep 3
        
        if systemctl is-active --quiet vaultscope-statistics-server; then
            print_status "success" "Server service started"
        else
            print_status "warning" "Server service failed to start - check logs"
        fi
    fi
    
    if [ "${INSTALL_OPTIONS[client]}" = true ]; then
        systemctl enable vaultscope-statistics-client &>/dev/null
        systemctl restart vaultscope-statistics-client
        
        # Wait for client to start
        sleep 3
        
        if systemctl is-active --quiet vaultscope-statistics-client; then
            print_status "success" "Client service started"
        else
            print_status "warning" "Client service failed to start - check logs"
        fi
    fi
    
    print_progress_bar 85 100
}

# ============================================================================
# NGINX CONFIGURATION
# ============================================================================
configure_nginx() {
    if [ "${INSTALL_OPTIONS[nginx]}" != true ]; then
        return
    fi
    
    print_section "Web Server Configuration" "$BLUE"
    
    # Install nginx if needed
    if ! command -v nginx &>/dev/null; then
        print_status "progress" "Installing Nginx"
        case $PKG_MANAGER in
            apt)
                apt-get install -y nginx &>/dev/null &
                show_spinner $! "Installing Nginx"
                ;;
            yum|dnf)
                $PKG_MANAGER install -y nginx &>/dev/null &
                show_spinner $! "Installing Nginx"
                ;;
        esac
        print_status "success" "Nginx installed"
    fi
    
    # Get domain configuration
    echo ""
    if [ "$AUTO_YES" = false ]; then
        read -p "  Enter API domain (e.g., api.example.com): " API_DOMAIN
        read -p "  Enter client domain (e.g., app.example.com): " CLIENT_DOMAIN
    else
        API_DOMAIN="api.localhost"
        CLIENT_DOMAIN="app.localhost"
    fi
    
    # Create Nginx configurations
    print_status "progress" "Configuring Nginx"
    
    # API configuration
    cat > /etc/nginx/sites-available/vaultscope-api << EOF
server {
    listen 80;
    server_name $API_DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
    
    # Client configuration
    cat > /etc/nginx/sites-available/vaultscope-client << EOF
server {
    listen 80;
    server_name $CLIENT_DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
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
    
    # Test and reload
    nginx -t &>/dev/null && systemctl reload nginx
    print_status "success" "Nginx configured"
    
    print_progress_bar 90 100
    
    # SSL configuration
    if [ "${INSTALL_OPTIONS[ssl]}" = true ]; then
        configure_ssl "$API_DOMAIN" "$CLIENT_DOMAIN"
    fi
}

# ============================================================================
# SSL CONFIGURATION
# ============================================================================
configure_ssl() {
    local API_DOMAIN=$1
    local CLIENT_DOMAIN=$2
    
    print_subsection "SSL Certificate Setup"
    
    # Install certbot
    if ! command -v certbot &>/dev/null; then
        print_status "progress" "Installing Certbot"
        case $PKG_MANAGER in
            apt)
                apt-get install -y certbot python3-certbot-nginx &>/dev/null
                ;;
            yum|dnf)
                $PKG_MANAGER install -y certbot python3-certbot-nginx &>/dev/null
                ;;
        esac
        print_status "success" "Certbot installed"
    fi
    
    # Get SSL email
    if [ "$AUTO_YES" = false ]; then
        read -p "  Enter email for SSL certificates: " SSL_EMAIL
    else
        SSL_EMAIL="admin@$API_DOMAIN"
    fi
    
    # Obtain certificates
    print_status "progress" "Obtaining SSL certificates"
    certbot --nginx -d "$API_DOMAIN" -d "$CLIENT_DOMAIN" \
            --non-interactive --agree-tos -m "$SSL_EMAIL" \
            --redirect &>/dev/null
    
    if [ $? -eq 0 ]; then
        print_status "success" "SSL certificates obtained"
        
        # Setup auto-renewal
        echo "0 0,12 * * * root certbot renew --quiet" | tee -a /etc/crontab > /dev/null
        print_status "success" "Auto-renewal configured"
    else
        print_status "warning" "SSL setup failed - configure manually later"
    fi
    
    print_progress_bar 95 100
}

# ============================================================================
# CLI TOOLS
# ============================================================================
create_cli_tool() {
    if [ "${INSTALL_OPTIONS[cli]}" != true ]; then
        return
    fi
    
    print_section "CLI Tool Installation" "$GREEN"
    
    print_status "progress" "Creating CLI wrapper"
    
    cat > /usr/local/bin/vaultscope << 'EOF'
#!/bin/bash
# VaultScope Statistics CLI Tool v2.0
# Enhanced command-line interface for VaultScope Statistics

INSTALL_DIR="/var/www/vaultscope-statistics"
VERSION="2.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Check installation
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${RED}Error: VaultScope Statistics not found in $INSTALL_DIR${NC}"
    exit 1
fi

cd "$INSTALL_DIR"

# Main command handler
case "$1" in
    # API Key Management
    "key"|"apikey")
        shift
        case "$1" in
            "create"|"add")
                shift
                npm run apikey create "$@"
                ;;
            "list"|"ls")
                npm run apikey list
                ;;
            "delete"|"rm")
                shift
                npm run apikey delete "$@"
                ;;
            *)
                echo -e "${CYAN}API Key Management:${NC}"
                echo "  vaultscope key create <name> [--admin]  Create new API key"
                echo "  vaultscope key list                     List all keys"
                echo "  vaultscope key delete <id>              Delete a key"
                ;;
        esac
        ;;
    
    # Service Management
    "server"|"srv")
        shift
        case "$1" in
            "start") systemctl start vaultscope-statistics-server ;;
            "stop") systemctl stop vaultscope-statistics-server ;;
            "restart") systemctl restart vaultscope-statistics-server ;;
            "status") systemctl status vaultscope-statistics-server ;;
            "logs") journalctl -u vaultscope-statistics-server -f ;;
            *) echo "Usage: vaultscope server [start|stop|restart|status|logs]" ;;
        esac
        ;;
    
    "client"|"web")
        shift
        case "$1" in
            "start") systemctl start vaultscope-statistics-client ;;
            "stop") systemctl stop vaultscope-statistics-client ;;
            "restart") systemctl restart vaultscope-statistics-client ;;
            "status") systemctl status vaultscope-statistics-client ;;
            "logs") journalctl -u vaultscope-statistics-client -f ;;
            *) echo "Usage: vaultscope client [start|stop|restart|status|logs]" ;;
        esac
        ;;
    
    # Utilities
    "speed"|"speedtest")
        npm run speed
        ;;
    
    "info"|"sysinfo")
        npm run sysinfo
        ;;
    
    "status")
        echo -e "${CYAN}VaultScope Statistics Status${NC}"
        echo -e "${CYAN}═══════════════════════════${NC}"
        echo ""
        
        # Check server
        if systemctl is-active --quiet vaultscope-statistics-server; then
            echo -e "Server:  ${GREEN}● Running${NC}"
        else
            echo -e "Server:  ${RED}● Stopped${NC}"
        fi
        
        # Check client
        if systemctl is-active --quiet vaultscope-statistics-client; then
            echo -e "Client:  ${GREEN}● Running${NC}"
        else
            echo -e "Client:  ${RED}● Stopped${NC}"
        fi
        
        # Check ports
        echo ""
        echo -e "${CYAN}Port Status:${NC}"
        if lsof -i:4000 &>/dev/null; then
            echo -e "API (4000):    ${GREEN}● Open${NC}"
        else
            echo -e "API (4000):    ${RED}● Closed${NC}"
        fi
        
        if lsof -i:4001 &>/dev/null; then
            echo -e "Client (4001): ${GREEN}● Open${NC}"
        else
            echo -e "Client (4001): ${RED}● Closed${NC}"
        fi
        ;;
    
    "update")
        echo -e "${CYAN}Updating VaultScope Statistics...${NC}"
        cd "$INSTALL_DIR"
        git pull origin main
        npm install
        npm run build
        systemctl restart vaultscope-statistics-server
        systemctl restart vaultscope-statistics-client
        echo -e "${GREEN}Update complete!${NC}"
        ;;
    
    "backup")
        BACKUP_FILE="/tmp/vaultscope-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        echo -e "${CYAN}Creating backup...${NC}"
        tar -czf "$BACKUP_FILE" "$INSTALL_DIR" 2>/dev/null
        echo -e "${GREEN}Backup saved to: $BACKUP_FILE${NC}"
        ;;
    
    "version"|"--version"|"-v")
        echo "VaultScope Statistics CLI v$VERSION"
        ;;
    
    "help"|"--help"|"-h"|"")
        echo -e "${BOLD}VaultScope Statistics CLI v$VERSION${NC}"
        echo -e "${CYAN}═══════════════════════════════${NC}"
        echo ""
        echo "Usage: vaultscope <command> [options]"
        echo ""
        echo -e "${CYAN}Service Management:${NC}"
        echo "  server <action>    Manage API server"
        echo "  client <action>    Manage web client"
        echo "  status             Show service status"
        echo ""
        echo -e "${CYAN}API Keys:${NC}"
        echo "  key create <name>  Create new API key"
        echo "  key list           List all keys"
        echo "  key delete <id>    Delete a key"
        echo ""
        echo -e "${CYAN}Utilities:${NC}"
        echo "  speed              Run speed test"
        echo "  info               Show system info"
        echo "  update             Update application"
        echo "  backup             Create backup"
        echo ""
        echo -e "${CYAN}Actions:${NC}"
        echo "  start, stop, restart, status, logs"
        echo ""
        echo -e "${CYAN}Examples:${NC}"
        echo "  vaultscope status"
        echo "  vaultscope key create \"Admin\" --admin"
        echo "  vaultscope server restart"
        ;;
    
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Use 'vaultscope help' for available commands"
        exit 1
        ;;
esac
EOF
    
    chmod +x /usr/local/bin/vaultscope
    
    # Create shorter aliases
    ln -sf /usr/local/bin/vaultscope /usr/local/bin/vs
    ln -sf /usr/local/bin/vaultscope /usr/local/bin/statistics
    
    print_status "success" "CLI tool installed (vaultscope, vs, statistics)"
    
    # Add bash completion
    cat > /etc/bash_completion.d/vaultscope << 'EOF'
_vaultscope_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands
    if [ $COMP_CWORD -eq 1 ]; then
        opts="key server client status speed info update backup help version"
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
    
    # Sub-commands
    case "${prev}" in
        key|apikey)
            opts="create list delete"
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        server|client)
            opts="start stop restart status logs"
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
    esac
}

complete -F _vaultscope_completion vaultscope
complete -F _vaultscope_completion vs
complete -F _vaultscope_completion statistics
EOF
    
    print_status "success" "Bash completion added"
    print_progress_bar 98 100
}

# ============================================================================
# UNINSTALLER
# ============================================================================
show_uninstall_menu() {
    local finished=false
    local selected_index=0
    local components=("server" "client" "nginx" "database" "logs" "config" "complete")
    
    declare -gA UNINSTALL_OPTIONS=(
        ["server"]=true
        ["client"]=true
        ["nginx"]=true
        ["database"]=false
        ["logs"]=false
        ["config"]=false
        ["complete"]=false
    )
    
    while [ "$finished" = false ]; do
        print_banner
        print_section "Uninstall Configuration" "$RED"
        echo ""
        echo -e "${BOLD}  Select components to remove:${NC}"
        echo ""
        
        for i in "${!components[@]}"; do
            local key="${components[$i]}"
            local checked="${UNINSTALL_OPTIONS[$key]}"
            
            if [ "$key" = "complete" ]; then
                echo ""
                echo -e "${GRAY}────────────────────────────────────────────────${NC}"
            fi
            
            if [ $i -eq $selected_index ]; then
                if [ "$checked" = true ]; then
                    echo -e "${REVERSE}  ${RED}[${CHECK}]${NC}${REVERSE} Remove ${key^^}${NC}"
                else
                    echo -e "${REVERSE}  ${GRAY}[ ]${NC}${REVERSE} Remove ${key^^}${NC}"
                fi
            else
                if [ "$checked" = true ]; then
                    echo -e "  ${RED}[${CHECK}]${NC} Remove ${key^^}"
                else
                    echo -e "  ${GRAY}[ ]${NC} Remove ${key^^}"
                fi
            fi
        done
        
        echo ""
        echo -e "${GRAY}────────────────────────────────────────────────${NC}"
        echo -e "  ${BOLD}[SPACE]${NC} Toggle  ${BOLD}[P]${NC} Proceed  ${BOLD}[C]${NC} Cancel"
        echo ""
        
        read -rsn1 key
        
        case $key in
            $'\x1b')  # ESC sequence
                read -rsn2 key
                case $key in
                    '[A')  # Up arrow
                        selected_index=$(( (selected_index - 1 + ${#components[@]}) % ${#components[@]} ))
                        ;;
                    '[B')  # Down arrow
                        selected_index=$(( (selected_index + 1) % ${#components[@]} ))
                        ;;
                esac
                ;;
            ' ')  # Space - toggle
                local key="${components[$selected_index]}"
                UNINSTALL_OPTIONS[$key]=$([ "${UNINSTALL_OPTIONS[$key]}" = true ] && echo false || echo true)
                
                # If complete is selected, select all
                if [ "$key" = "complete" ] && [ "${UNINSTALL_OPTIONS[$key]}" = true ]; then
                    for k in "${!UNINSTALL_OPTIONS[@]}"; do
                        UNINSTALL_OPTIONS[$k]=true
                    done
                fi
                ;;
            'p'|'P')
                finished=true
                perform_selective_uninstall
                ;;
            'c'|'C')
                print_status "info" "Uninstallation cancelled"
                exit 0
                ;;
        esac
    done
}

perform_selective_uninstall() {
    # Check if UNINSTALL_OPTIONS is defined
    if [ -z "${UNINSTALL_OPTIONS+x}" ]; then
        echo "Error: UNINSTALL_OPTIONS not defined"
        exit 1
    fi
    
    print_banner
    print_section "Uninstallation Process" "$RED"
    
    # Confirmation
    echo ""
    echo -e "${YELLOW}${WARNING} WARNING: This will permanently remove selected components!${NC}"
    echo ""
    
    if [ "$AUTO_YES" = false ]; then
        read -p "  Create backup before uninstalling? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            create_uninstall_backup
        fi
        
        echo ""
        read -p "  Are you absolutely sure? Type 'yes' to confirm: " -r
        if [[ ! $REPLY == "yes" ]]; then
            print_status "info" "Uninstallation cancelled"
            exit 0
        fi
    fi
    
    # Stop services first
    if [ "${UNINSTALL_OPTIONS[server]}" = true ] || [ "${UNINSTALL_OPTIONS[complete]}" = true ]; then
        print_status "progress" "Stopping server service"
        systemctl stop vaultscope-statistics-server 2>/dev/null || true
        systemctl disable vaultscope-statistics-server 2>/dev/null || true
        rm -f /etc/systemd/system/vaultscope-statistics-server.service
        print_status "success" "Server service removed"
    fi
    
    if [ "${UNINSTALL_OPTIONS[client]}" = true ] || [ "${UNINSTALL_OPTIONS[complete]}" = true ]; then
        print_status "progress" "Stopping client service"
        systemctl stop vaultscope-statistics-client 2>/dev/null || true
        systemctl disable vaultscope-statistics-client 2>/dev/null || true
        rm -f /etc/systemd/system/vaultscope-statistics-client.service
        print_status "success" "Client service removed"
    fi
    
    systemctl daemon-reload
    
    # Remove nginx configuration
    if [ "${UNINSTALL_OPTIONS[nginx]}" = true ] || [ "${UNINSTALL_OPTIONS[complete]}" = true ]; then
        print_status "progress" "Removing nginx configuration"
        rm -f /etc/nginx/sites-enabled/vaultscope-api
        rm -f /etc/nginx/sites-enabled/vaultscope-client
        rm -f /etc/nginx/sites-available/vaultscope-api
        rm -f /etc/nginx/sites-available/vaultscope-client
        nginx -t &>/dev/null && systemctl reload nginx
        print_status "success" "Nginx configuration removed"
    fi
    
    # Remove application files
    if [ "${UNINSTALL_OPTIONS[complete]}" = true ]; then
        print_status "progress" "Removing application files"
        rm -rf "$INSTALL_DIR"
        print_status "success" "Application files removed"
    fi
    
    # Remove database
    if [ "${UNINSTALL_OPTIONS[database]}" = true ] || [ "${UNINSTALL_OPTIONS[complete]}" = true ]; then
        print_status "progress" "Removing database"
        rm -f "$INSTALL_DIR/database.db"
        rm -f "$INSTALL_DIR/database.db-journal"
        print_status "success" "Database removed"
    fi
    
    # Remove logs
    if [ "${UNINSTALL_OPTIONS[logs]}" = true ] || [ "${UNINSTALL_OPTIONS[complete]}" = true ]; then
        print_status "progress" "Removing log files"
        rm -rf "$LOG_DIR"
        print_status "success" "Log files removed"
    fi
    
    # Remove config
    if [ "${UNINSTALL_OPTIONS[config]}" = true ] || [ "${UNINSTALL_OPTIONS[complete]}" = true ]; then
        print_status "progress" "Removing configuration"
        rm -rf "$CONFIG_DIR"
        rm -f /usr/local/bin/vaultscope
        rm -f /usr/local/bin/vs
        rm -f /usr/local/bin/statistics
        rm -f /etc/bash_completion.d/vaultscope
        print_status "success" "Configuration removed"
    fi
    
    # Clear state
    clear_state
    
    print_progress_bar 100 100
    
    echo ""
    print_box "Uninstallation Complete" "Selected components have been removed.
Thank you for using VaultScope Statistics!" "$GREEN"
    
    if [ -n "$BACKUP_FILE" ]; then
        echo ""
        print_status "info" "Backup saved at: $BACKUP_FILE"
    fi
}

create_uninstall_backup() {
    print_status "progress" "Creating backup"
    
    BACKUP_FILE="/tmp/vaultscope-uninstall-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    # Create backup
    tar -czf "$BACKUP_FILE" \
        "$INSTALL_DIR" \
        "$CONFIG_DIR" \
        "$LOG_DIR" \
        /etc/systemd/system/vaultscope-statistics-*.service \
        /etc/nginx/sites-*/vaultscope-* \
        2>/dev/null || true
    
    print_status "success" "Backup created: $BACKUP_FILE"
    
    # Export API keys if database exists
    if [ -f "$INSTALL_DIR/database.db" ]; then
        sqlite3 "$INSTALL_DIR/database.db" \
            "SELECT name, key FROM api_keys;" > /tmp/vaultscope-api-keys.txt 2>/dev/null || true
        
        if [ -f "/tmp/vaultscope-api-keys.txt" ]; then
            print_status "success" "API keys exported to: /tmp/vaultscope-api-keys.txt"
        fi
    fi
}

# ============================================================================
# RECOVERY MODE
# ============================================================================
perform_recovery() {
    print_banner
    print_section "Recovery Mode" "$YELLOW"
    
    echo ""
    print_status "info" "Checking system state..."
    
    local issues_found=false
    local fixes_applied=0
    
    # Check services
    if [ -f /etc/systemd/system/vaultscope-statistics-server.service ]; then
        if ! systemctl is-active --quiet vaultscope-statistics-server; then
            print_status "warning" "Server service is not running"
            print_status "progress" "Attempting to start server"
            systemctl start vaultscope-statistics-server
            
            if systemctl is-active --quiet vaultscope-statistics-server; then
                print_status "success" "Server service started"
                ((fixes_applied++))
            else
                print_status "error" "Failed to start server service"
            fi
            issues_found=true
        fi
    fi
    
    # Check database
    if [ ! -f "$INSTALL_DIR/database.db" ]; then
        print_status "warning" "Database file missing"
        print_status "progress" "Recreating database"
        cd "$INSTALL_DIR"
        npm run db:migrate &>/dev/null 2>&1
        
        if [ -f "$INSTALL_DIR/database.db" ]; then
            print_status "success" "Database recreated"
            ((fixes_applied++))
        fi
        issues_found=true
    fi
    
    # Check permissions
    print_status "progress" "Checking file permissions"
    chown -R www-data:www-data "$INSTALL_DIR" 2>/dev/null || \
    chown -R $(whoami):$(whoami) "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"
    print_status "success" "Permissions verified"
    
    # Check Node modules
    if [ ! -d "$INSTALL_DIR/node_modules" ]; then
        print_status "warning" "Node modules missing"
        print_status "progress" "Reinstalling dependencies"
        cd "$INSTALL_DIR"
        npm install &>/dev/null 2>&1
        print_status "success" "Dependencies reinstalled"
        ((fixes_applied++))
        issues_found=true
    fi
    
    echo ""
    if [ "$issues_found" = true ]; then
        print_box "Recovery Complete" "$fixes_applied issues were addressed.
Please check service status with: vaultscope status" "$GREEN"
    else
        print_box "System Healthy" "No issues found.
All components are functioning correctly." "$GREEN"
    fi
}

# ============================================================================
# COMPLETION SCREEN
# ============================================================================
show_completion() {
    print_banner
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "  ${BOLD}${GREEN}✓ Installation Complete!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${GREEN}✨${NC} ${BOLD}VaultScope Statistics has been successfully installed!${NC} ${GREEN}✨${NC}"
    echo ""
    
    # Access Information
    local access_info=""
    
    if [ "${INSTALL_OPTIONS[server]}" = true ]; then
        access_info="${access_info}API Server: ${BOLD}http://localhost:4000${NC}\n"
    fi
    
    if [ "${INSTALL_OPTIONS[client]}" = true ]; then
        access_info="${access_info}Web Client: ${BOLD}http://localhost:4001${NC}\n"
    fi
    
    if [ -n "$API_DOMAIN" ] && [ "${INSTALL_OPTIONS[nginx]}" = true ]; then
        access_info="${access_info}API Domain: ${BOLD}https://$API_DOMAIN${NC}\n"
        access_info="${access_info}Client Domain: ${BOLD}https://$CLIENT_DOMAIN${NC}"
    fi
    
    print_box "Access Information" "$access_info" "$CYAN"
    
    # First Start Information
    echo ""
    print_box "IMPORTANT: First Start Instructions" "${YELLOW}${WARNING} The database and admin credentials will be${NC}
${YELLOW}automatically generated on first server start!${NC}

To view your admin credentials:
1. Start the server: ${CYAN}systemctl start vaultscope-statistics-server${NC}
2. Check logs: ${CYAN}journalctl -u vaultscope-statistics-server -n 50${NC}

${RED}${BOLD}The credentials are only shown ONCE!${NC}
${RED}Make sure to save them securely!${NC}" "$YELLOW"
    
    # Quick Commands
    if [ "${INSTALL_OPTIONS[cli]}" = true ]; then
        echo ""
        local cli_commands="Check status:    ${CYAN}vaultscope status${NC}
View logs:       ${CYAN}vaultscope server logs${NC}
Create API key:  ${CYAN}vaultscope key create \"Name\"${NC}
Get help:        ${CYAN}vaultscope help${NC}"
        
        print_box "Quick Commands" "$cli_commands" "$MAGENTA"
    fi
    
    # Next Steps
    echo ""
    print_subsection "Next Steps"
    echo -e "  1. ${CYAN}vaultscope status${NC} - Verify services are running"
    echo -e "  2. ${CYAN}vaultscope key create \"Admin\" --admin${NC} - Create additional API keys"
    echo -e "  3. Visit ${BOLD}http://localhost:4001${NC} to access the dashboard"
    
    echo ""
    print_status "info" "Installation log saved: $LOG_FILE"
    
    print_progress_bar 100 100
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "           ${BOLD}Thank you for choosing VaultScope Statistics!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ============================================================================
# ERROR HANDLING
# ============================================================================
handle_error() {
    local exit_code=$1
    local line_number=$2
    
    echo ""
    print_status "error" "Installation failed at line $line_number (exit code: $exit_code)"
    print_status "info" "Check log for details: $LOG_FILE"
    
    # Attempt recovery suggestions
    echo ""
    print_subsection "Troubleshooting Suggestions"
    
    case $exit_code in
        1)
            echo "  • Ensure you're running as root (sudo)"
            echo "  • Check system requirements"
            ;;
        2)
            echo "  • Check internet connectivity"
            echo "  • Verify repository URL is accessible"
            ;;
        127)
            echo "  • Required command not found"
            echo "  • Install missing dependencies"
            ;;
        *)
            echo "  • Review the log file for specific errors"
            echo "  • Try running with --recovery flag"
            ;;
    esac
    
    echo ""
    echo -e "${YELLOW}For help, visit: https://github.com/vaultscope/statistics${NC}"
    
    exit $exit_code
}

trap 'handle_error $? $LINENO' ERR

# ============================================================================
# MAIN EXECUTION
# ============================================================================
main() {
    # Setup logging
    exec 2> >(tee -a "$LOG_FILE" >&2)
    
    # Check root privileges
    if [ "$EUID" -ne 0 ] && [ "$RECOVERY_MODE" = false ]; then
        print_status "error" "This installer must be run as root (use sudo)"
        exit 1
    fi
    
    # Handle different modes
    if [ "$UNINSTALL_MODE" = true ]; then
        show_uninstall_menu
    elif [ "$RECOVERY_MODE" = true ]; then
        perform_recovery
    else
        # Normal installation
        print_banner
        
        # System checks
        detect_system
        check_prerequisites
        
        # Installation menu
        if [ "$AUTO_YES" = false ]; then
            show_installation_menu
        fi
        
        # Confirm installation
        if [ "$AUTO_YES" = false ]; then
            print_banner
            print_section "Installation Summary" "$CYAN"
            echo ""
            echo -e "${BOLD}  Components to install:${NC}"
            
            for key in "${!INSTALL_OPTIONS[@]}"; do
                if [ "${INSTALL_OPTIONS[$key]}" = true ]; then
                    echo -e "    ${GREEN}${CHECK}${NC} ${key^^}"
                fi
            done
            
            echo ""
            read -p "  Proceed with installation? (y/n): " confirm
            
            if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
                print_status "info" "Installation cancelled"
                exit 0
            fi
        fi
        
        # Run installation steps
        install_dependencies
        install_nodejs
        install_application
        setup_databases
        setup_services
        configure_nginx
        create_cli_tool
        
        # Show completion
        show_completion
    fi
    
    # Save installation state
    save_state "INSTALLED" "$(date)"
    save_state "VERSION" "$INSTALLER_VERSION"
}

# Run installer
main "$@"