# VaultScope Statistics Installer for Windows
# Requires Administrator privileges

param(
    [string]$InstallPath = "$env:ProgramFiles\VaultScope\Statistics"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green $args }
function Write-Info { Write-ColorOutput Cyan $args }
function Write-Warning { Write-ColorOutput Yellow $args }
function Write-Error { Write-ColorOutput Red $args }

# Check for Administrator privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script requires Administrator privileges."
    Write-Warning "Please run PowerShell as Administrator and try again."
    exit 1
}

Clear-Host
Write-Info @"
TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW
Q                                                            Q
Q           VaultScope Statistics Installer                 Q
Q                  Version 1.0.0                             Q
Q                                                            Q
ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]
"@

# Function to check if a command exists
function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to install Node.js if not present
function Install-NodeJS {
    if (Test-Command "node") {
        $nodeVersion = node --version
        Write-Success "Node.js is already installed (version $nodeVersion)"
    } else {
        Write-Info "Installing Node.js..."
        $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
        $nodeMsi = "$env:TEMP\node-installer.msi"
        
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi
        Start-Process msiexec.exe -Wait -ArgumentList "/i", $nodeMsi, "/quiet"
        Remove-Item $nodeMsi
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Success "Node.js installed successfully"
    }
}

# Function to install Git if not present
function Install-Git {
    if (Test-Command "git") {
        $gitVersion = git --version
        Write-Success "Git is already installed (version $gitVersion)"
    } else {
        Write-Info "Installing Git..."
        $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe"
        $gitExe = "$env:TEMP\git-installer.exe"
        
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitExe
        Start-Process $gitExe -Wait -ArgumentList "/VERYSILENT"
        Remove-Item $gitExe
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Success "Git installed successfully"
    }
}

# Function to install PM2 globally
function Install-PM2 {
    if (Test-Command "pm2") {
        Write-Success "PM2 is already installed"
    } else {
        Write-Info "Installing PM2 globally..."
        npm install -g pm2
        Write-Success "PM2 installed successfully"
    }
}

# Function to install Cloudflared
function Install-Cloudflared {
    $cloudflaredPath = "$InstallPath\cloudflared\cloudflared.exe"
    if (Test-Path $cloudflaredPath) {
        Write-Success "Cloudflared is already installed"
    } else {
        Write-Info "Installing Cloudflared..."
        $cloudflaredUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        New-Item -ItemType Directory -Path "$InstallPath\cloudflared" -Force | Out-Null
        Invoke-WebRequest -Uri $cloudflaredUrl -OutFile $cloudflaredPath
        Write-Success "Cloudflared installed successfully"
    }
}

# Function to setup Windows service
function Setup-WindowsService {
    param(
        [string]$ServiceName,
        [string]$DisplayName,
        [string]$Description,
        [string]$WorkingDirectory,
        [string]$StartCommand
    )
    
    Write-Info "Setting up Windows service: $DisplayName"
    
    # Install PM2 Windows Service
    Set-Location $WorkingDirectory
    
    # Create PM2 ecosystem file
    $ecosystem = @"
module.exports = {
  apps: [{
    name: '$ServiceName',
    script: '$StartCommand',
    cwd: '$WorkingDirectory',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
"@
    
    $ecosystem | Out-File -FilePath "$WorkingDirectory\ecosystem.config.js" -Encoding UTF8
    
    # Start with PM2
    pm2 start ecosystem.config.js
    pm2 save
    
    # Install PM2 as Windows service
    npm install -g pm2-windows-service
    pm2-service-install -n "VaultScope-$ServiceName"
    
    Write-Success "Service installed: $DisplayName"
}

# Function to setup Nginx reverse proxy
function Setup-Nginx {
    param(
        [string]$AppType,
        [int]$Port,
        [string]$Domain
    )
    
    Write-Info "Setting up Nginx reverse proxy for $AppType..."
    
    # Download and install Nginx if not present
    $nginxPath = "$InstallPath\nginx"
    if (-not (Test-Path "$nginxPath\nginx.exe")) {
        Write-Info "Downloading Nginx..."
        $nginxUrl = "https://nginx.org/download/nginx-1.24.0.zip"
        $nginxZip = "$env:TEMP\nginx.zip"
        
        Invoke-WebRequest -Uri $nginxUrl -OutFile $nginxZip
        Expand-Archive -Path $nginxZip -DestinationPath $InstallPath -Force
        Move-Item "$InstallPath\nginx-*" $nginxPath
        Remove-Item $nginxZip
    }
    
    # Create Nginx configuration
    $nginxConfig = @"
server {
    listen 80;
    server_name $Domain;

    location / {
        proxy_pass http://localhost:$Port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_cache_bypass `$http_upgrade;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }
}
"@
    
    # Add to sites-enabled
    $sitesPath = "$nginxPath\conf\sites-enabled"
    New-Item -ItemType Directory -Path $sitesPath -Force | Out-Null
    $nginxConfig | Out-File -FilePath "$sitesPath\vaultscope-$AppType.conf" -Encoding UTF8
    
    # Update main nginx.conf to include sites-enabled
    $mainConfig = Get-Content "$nginxPath\conf\nginx.conf"
    if ($mainConfig -notmatch "sites-enabled") {
        $mainConfig = $mainConfig -replace "http \{", @"
http {
    include sites-enabled/*.conf;
"@
        $mainConfig | Out-File -FilePath "$nginxPath\conf\nginx.conf" -Encoding UTF8
    }
    
    # Start Nginx as service
    Start-Process "$nginxPath\nginx.exe" -WorkingDirectory $nginxPath
    
    Write-Success "Nginx configured for $Domain -> localhost:$Port"
}

# Function to setup Cloudflared tunnel
function Setup-Cloudflared {
    param(
        [string]$AppType,
        [int]$Port,
        [string]$Domain
    )
    
    Write-Info "Setting up Cloudflare tunnel for $AppType..."
    
    $cloudflaredPath = "$InstallPath\cloudflared"
    $configFile = "$cloudflaredPath\config-$AppType.yml"
    
    # Create tunnel configuration
    $tunnelConfig = @"
url: http://localhost:$Port
tunnel: vaultscope-$AppType
credentials-file: $cloudflaredPath\credentials.json
"@
    
    $tunnelConfig | Out-File -FilePath $configFile -Encoding UTF8
    
    Write-Info "Please authenticate with Cloudflare..."
    & "$cloudflaredPath\cloudflared.exe" tunnel login
    
    Write-Info "Creating tunnel..."
    & "$cloudflaredPath\cloudflared.exe" tunnel create vaultscope-$AppType
    
    Write-Info "Routing traffic to $Domain..."
    & "$cloudflaredPath\cloudflared.exe" tunnel route dns vaultscope-$AppType $Domain
    
    # Create service for cloudflared
    & "$cloudflaredPath\cloudflared.exe" service install
    & "$cloudflaredPath\cloudflared.exe" tunnel run --config $configFile vaultscope-$AppType
    
    Write-Success "Cloudflare tunnel configured for $Domain"
}

# Main installation menu
function Show-Menu {
    Write-Host ""
    Write-Info "What would you like to install?"
    Write-Host "1. Client only"
    Write-Host "2. Server only"
    Write-Host "3. Both Client and Server"
    Write-Host "4. Exit"
    Write-Host ""
    
    $choice = Read-Host "Enter your choice (1-4)"
    return $choice
}

# Reverse proxy menu
function Show-ProxyMenu {
    Write-Host ""
    Write-Info "Would you like to setup a reverse proxy?"
    Write-Host "1. No reverse proxy (localhost only)"
    Write-Host "2. Cloudflare Tunnel (recommended)"
    Write-Host "3. Nginx"
    Write-Host "4. Both Cloudflare and Nginx"
    Write-Host ""
    
    $choice = Read-Host "Enter your choice (1-4)"
    return $choice
}

# Install client
function Install-Client {
    Write-Info "Installing VaultScope Statistics Client..."
    
    $clientPath = "$InstallPath\client"
    
    # Clone repository
    Write-Info "Cloning repository..."
    if (Test-Path $clientPath) {
        Remove-Item -Recurse -Force $clientPath
    }
    git clone https://github.com/VaultScope/statistics.git "$InstallPath\temp"
    Move-Item "$InstallPath\temp\client" $clientPath
    
    # Install dependencies
    Write-Info "Installing dependencies..."
    Set-Location $clientPath
    npm install
    
    # Build the client
    Write-Info "Building client..."
    npm run build
    
    # Setup environment variables
    $envContent = @"
# Client Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=production
"@
    $envContent | Out-File -FilePath "$clientPath\.env.production" -Encoding UTF8
    
    # Setup reverse proxy if requested
    $proxyChoice = Show-ProxyMenu
    $clientPort = 3000
    
    switch ($proxyChoice) {
        "2" {
            Install-Cloudflared
            $domain = Read-Host "Enter your domain for the client (e.g., stats.yourdomain.com)"
            Setup-Cloudflared -AppType "client" -Port $clientPort -Domain $domain
        }
        "3" {
            $domain = Read-Host "Enter your domain for the client (e.g., stats.yourdomain.com)"
            Setup-Nginx -AppType "client" -Port $clientPort -Domain $domain
        }
        "4" {
            Install-Cloudflared
            $domain = Read-Host "Enter your domain for the client (e.g., stats.yourdomain.com)"
            Setup-Cloudflared -AppType "client" -Port $clientPort -Domain $domain
            Setup-Nginx -AppType "client" -Port $clientPort -Domain $domain
        }
    }
    
    # Setup Windows service
    Setup-WindowsService -ServiceName "Statistics-Client" `
                        -DisplayName "VaultScope Statistics Client" `
                        -Description "VaultScope Statistics monitoring client" `
                        -WorkingDirectory $clientPath `
                        -StartCommand "npm start"
    
    Write-Success "Client installed successfully!"
    Write-Info "Client is running on http://localhost:$clientPort"
}

# Install server
function Install-Server {
    Write-Info "Installing VaultScope Statistics Server..."
    
    $serverPath = "$InstallPath\server"
    
    # Clone repository
    Write-Info "Cloning repository..."
    if (Test-Path $serverPath) {
        Remove-Item -Recurse -Force $serverPath
    }
    git clone https://github.com/VaultScope/statistics.git "$InstallPath\temp"
    Move-Item "$InstallPath\temp\server" $serverPath
    
    # Install dependencies
    Write-Info "Installing dependencies..."
    Set-Location $serverPath
    npm install
    
    # Build the server
    Write-Info "Building server..."
    npm run build
    
    # Generate API key
    $apiKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    
    # Setup environment variables
    $envContent = @"
# Server Configuration
PORT=4000
API_KEY=$apiKey
NODE_ENV=production
"@
    $envContent | Out-File -FilePath "$serverPath\.env" -Encoding UTF8
    
    Write-Warning "Your server API key is: $apiKey"
    Write-Warning "Please save this key securely!"
    
    # Setup reverse proxy if requested
    $proxyChoice = Show-ProxyMenu
    $serverPort = 4000
    
    switch ($proxyChoice) {
        "2" {
            Install-Cloudflared
            $domain = Read-Host "Enter your domain for the server API (e.g., api.yourdomain.com)"
            Setup-Cloudflared -AppType "server" -Port $serverPort -Domain $domain
        }
        "3" {
            $domain = Read-Host "Enter your domain for the server API (e.g., api.yourdomain.com)"
            Setup-Nginx -AppType "server" -Port $serverPort -Domain $domain
        }
        "4" {
            Install-Cloudflared
            $domain = Read-Host "Enter your domain for the server API (e.g., api.yourdomain.com)"
            Setup-Cloudflared -AppType "server" -Port $serverPort -Domain $domain
            Setup-Nginx -AppType "server" -Port $serverPort -Domain $domain
        }
    }
    
    # Setup Windows service
    Setup-WindowsService -ServiceName "Statistics-Server" `
                        -DisplayName "VaultScope Statistics Server" `
                        -Description "VaultScope Statistics monitoring server" `
                        -WorkingDirectory $serverPath `
                        -StartCommand "npm start"
    
    Write-Success "Server installed successfully!"
    Write-Info "Server is running on http://localhost:$serverPort"
    Write-Info "API Key: $apiKey"
}

# Cleanup temp directory
function Cleanup {
    if (Test-Path "$InstallPath\temp") {
        Remove-Item -Recurse -Force "$InstallPath\temp"
    }
}

# Main execution
try {
    # Install prerequisites
    Write-Info "Checking prerequisites..."
    Install-NodeJS
    Install-Git
    Install-PM2
    
    # Create installation directory
    if (-not (Test-Path $InstallPath)) {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    }
    
    # Show menu and process choice
    $choice = Show-Menu
    
    switch ($choice) {
        "1" {
            Install-Client
        }
        "2" {
            Install-Server
        }
        "3" {
            Install-Server
            Write-Host ""
            Install-Client
        }
        "4" {
            Write-Info "Installation cancelled."
            exit 0
        }
        default {
            Write-Warning "Invalid choice. Exiting."
            exit 1
        }
    }
    
    # Cleanup
    Cleanup
    
    Write-Host ""
    Write-Success "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP"
    Write-Success "Installation completed successfully!"
    Write-Success "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP"
    Write-Host ""
    Write-Info "Services have been configured to start automatically on boot."
    Write-Info "You can manage services using PM2 commands:"
    Write-Host "  pm2 list      - Show all services"
    Write-Host "  pm2 restart   - Restart services"
    Write-Host "  pm2 logs      - View logs"
    Write-Host ""
    
} catch {
    Write-Error "Installation failed: $_"
    Cleanup
    exit 1
}