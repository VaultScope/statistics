# VaultScope Statistics Installer for Windows
# Version 1.0.0
# Requires Administrator privileges

param(
    [string]$InstallPath = "$env:ProgramFiles\VaultScope\Statistics"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

# Colors for output
function Write-Success { 
    Write-Host "✓ " -ForegroundColor Green -NoNewline
    Write-Host $args[0]
}

function Write-Info { 
    Write-Host "ℹ " -ForegroundColor Cyan -NoNewline
    Write-Host $args[0]
}

function Write-Warning { 
    Write-Host "⚠ " -ForegroundColor Yellow -NoNewline
    Write-Host $args[0]
}

function Write-Error { 
    Write-Host "✗ " -ForegroundColor Red -NoNewline
    Write-Host $args[0]
}

# Check for Administrator privileges
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Error "This script requires Administrator privileges."
    Write-Warning "Please run PowerShell as Administrator and try again."
    Write-Host ""
    Write-Host "Right-click on PowerShell and select 'Run as Administrator'"
    pause
    exit 1
}

Clear-Host
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           VaultScope Statistics Installer               ║" -ForegroundColor Cyan
Write-Host "║                    Version 1.0.0                        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command {
    param($command)
    try {
        if (Get-Command $command -ErrorAction Stop) {
            return $true
        }
    } catch {
        return $false
    }
}

# Function to install Node.js
function Install-NodeJS {
    Write-Info "Checking Node.js..."
    
    if (Test-Command "node") {
        $nodeVersion = node --version
        Write-Success "Node.js is already installed (version $nodeVersion)"
        
        # Check if version is 18+
        $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($majorVersion -lt 18) {
            Write-Warning "Node.js version is less than 18. Please update manually."
            return $false
        }
        return $true
    }
    
    Write-Info "Installing Node.js v20..."
    $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    $nodeMsi = "$env:TEMP\node-installer.msi"
    
    try {
        Write-Info "Downloading Node.js..."
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
        
        Write-Info "Installing Node.js (this may take a few minutes)..."
        $process = Start-Process msiexec.exe -ArgumentList "/i", "`"$nodeMsi`"", "/quiet", "/norestart" -Wait -PassThru
        
        if ($process.ExitCode -ne 0) {
            throw "Node.js installation failed with exit code: $($process.ExitCode)"
        }
        
        Remove-Item $nodeMsi -Force
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Success "Node.js installed successfully"
        return $true
    } catch {
        Write-Error "Failed to install Node.js: $_"
        return $false
    }
}

# Function to install Git
function Install-Git {
    Write-Info "Checking Git..."
    
    if (Test-Command "git") {
        $gitVersion = git --version
        Write-Success "Git is already installed ($gitVersion)"
        return $true
    }
    
    Write-Info "Installing Git..."
    $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe"
    $gitExe = "$env:TEMP\git-installer.exe"
    
    try {
        Write-Info "Downloading Git..."
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitExe -UseBasicParsing
        
        Write-Info "Installing Git (this may take a few minutes)..."
        $process = Start-Process $gitExe -ArgumentList "/VERYSILENT", "/NORESTART" -Wait -PassThru
        
        if ($process.ExitCode -ne 0) {
            throw "Git installation failed with exit code: $($process.ExitCode)"
        }
        
        Remove-Item $gitExe -Force
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Success "Git installed successfully"
        return $true
    } catch {
        Write-Error "Failed to install Git: $_"
        return $false
    }
}

# Function to install PM2
function Install-PM2 {
    Write-Info "Checking PM2..."
    
    if (Test-Command "pm2") {
        Write-Success "PM2 is already installed"
        return $true
    }
    
    Write-Info "Installing PM2 globally..."
    try {
        npm install -g pm2
        Write-Success "PM2 installed successfully"
        return $true
    } catch {
        Write-Error "Failed to install PM2: $_"
        return $false
    }
}

# Clone repository
function Clone-Repository {
    param(
        [string]$TargetDir,
        [string]$Component
    )
    
    Write-Info "Setting up $Component..."
    
    # Create target directory
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    
    $tempDir = "$env:TEMP\vaultscope-$(Get-Random)"
    
    try {
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        
        # Try to clone repository
        $gitProcess = Start-Process git -ArgumentList "clone", "--quiet", "https://github.com/VaultScope/statistics.git", "`"$tempDir`"" -Wait -PassThru -WindowStyle Hidden
        
        if ($gitProcess.ExitCode -eq 0 -and (Test-Path "$tempDir\$Component")) {
            # Copy component files
            Copy-Item -Path "$tempDir\$Component\*" -Destination $TargetDir -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            Write-Warning "Using fallback configuration for $Component"
        }
    } catch {
        Write-Warning "Using fallback configuration for $Component"
    } finally {
        if (Test-Path $tempDir) {
            Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Install Server
function Install-Server {
    Write-Info "Installing VaultScope Statistics Server..."
    
    $serverPath = "$InstallPath\server"
    New-Item -ItemType Directory -Path $serverPath -Force | Out-Null
    
    # Clone or create server
    Clone-Repository -TargetDir $serverPath -Component "server"
    
    # Check if we have the actual TypeScript server files
    if ((Test-Path "$serverPath\index.ts") -and (Test-Path "$serverPath\package.json")) {
        Write-Info "Found TypeScript server files"
    } else {
        # Create basic server structure as fallback
        if (-not (Test-Path "$serverPath\package.json")) {
            @'
{
  "name": "vaultscope-statistics-server",
  "version": "1.0.0",
  "description": "VaultScope Statistics Server",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node index.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "systeminformation": "^5.21.20",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.1"
  }
}
'@ | Out-File -FilePath "$serverPath\package.json" -Encoding UTF8
        }
        
        # Create basic server if not exists
        if ((-not (Test-Path "$serverPath\index.js")) -and (-not (Test-Path "$serverPath\index.ts"))) {
            @'
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

app.listen(PORT, () => {
    console.log(`VaultScope Statistics Server running on port ${PORT}`);
});
'@ | Out-File -FilePath "$serverPath\index.js" -Encoding UTF8
        }
    }
    
    # Install dependencies
    Set-Location $serverPath
    Write-Info "Installing server dependencies..."
    npm install
    
    # Build TypeScript if needed
    if ((Test-Path "$serverPath\tsconfig.json") -or (Test-Path "$serverPath\index.ts")) {
        Write-Info "Building TypeScript server..."
        try {
            npm run build
        } catch {
            Write-Warning "Build step skipped"
        }
    }
    
    # Generate API key
    $apiKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
    
    # Create .env file
    @"
PORT=4000
API_KEY=$apiKey
NODE_ENV=production
"@ | Out-File -FilePath "$serverPath\.env" -Encoding UTF8
    
    # Setup PM2
    Write-Info "Setting up PM2 service for server..."
    
    # Check what to start
    if (Test-Path "$serverPath\dist\index.js") {
        pm2 start "$serverPath\dist\index.js" --name "vaultscope-server"
    } elseif (Test-Path "$serverPath\index.js") {
        pm2 start "$serverPath\index.js" --name "vaultscope-server"
    } else {
        Write-Error "No server entry point found"
        return $false
    }
    
    pm2 save
    
    # Install PM2 as Windows service
    try {
        npm install -g pm2-windows-service
        pm2-service-install -n "VaultScope-Server"
    } catch {
        Write-Warning "Could not install PM2 Windows service, server will need manual start"
    }
    
    Write-Success "Server installed successfully!"
    Write-Info "Server will run on: http://localhost:4000"
    Write-Warning "API Key: $apiKey"
    Write-Warning "Please save this API key securely!"
    
    $apiKey | Out-File -FilePath "$InstallPath\server-api-key.txt"
    
    return $true
}

# Install Client
function Install-Client {
    Write-Info "Installing VaultScope Statistics Client..."
    
    $clientPath = "$InstallPath\client"
    New-Item -ItemType Directory -Path $clientPath -Force | Out-Null
    
    # Clone or create client
    Clone-Repository -TargetDir $clientPath -Component "client"
    
    # Create basic client structure if not exists
    if (-not (Test-Path "$clientPath\package.json")) {
        @'
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
'@ | Out-File -FilePath "$clientPath\package.json" -Encoding UTF8
    }
    
    # Install dependencies
    Set-Location $clientPath
    Write-Info "Installing client dependencies..."
    npm install --production
    
    # Try to build
    if ((Test-Path "$clientPath\next.config.js") -or (Test-Path "$clientPath\next.config.mjs")) {
        Write-Info "Building client..."
        try {
            npm run build
        } catch {
            Write-Warning "Build failed, client will run in dev mode"
        }
    }
    
    # Create .env file
    @"
NEXT_PUBLIC_API_URL=http://localhost:4000
NODE_ENV=production
"@ | Out-File -FilePath "$clientPath\.env.production" -Encoding UTF8
    
    # Setup PM2
    Write-Info "Setting up PM2 service for client..."
    pm2 start "npm run start" --name "vaultscope-client"
    pm2 save
    
    Write-Success "Client installed successfully!"
    Write-Info "Client will run on: http://localhost:3000"
    
    return $true
}

# Main menu
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

# Main execution
try {
    # Install prerequisites
    Write-Info "Checking prerequisites..."
    
    if (-not (Install-NodeJS)) {
        throw "Failed to install Node.js"
    }
    
    if (-not (Install-Git)) {
        throw "Failed to install Git"
    }
    
    if (-not (Install-PM2)) {
        throw "Failed to install PM2"
    }
    
    # Create installation directory
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    
    # Show menu and process choice
    $choice = Show-Menu
    
    $success = $false
    switch ($choice) {
        "1" {
            $success = Install-Client
        }
        "2" {
            $success = Install-Server
        }
        "3" {
            if (Install-Server) {
                Write-Host ""
                $success = Install-Client
            }
        }
        "4" {
            Write-Info "Installation cancelled"
            exit 0
        }
        default {
            Write-Warning "Invalid choice. Exiting."
            exit 1
        }
    }
    
    if ($success) {
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Success "Installation completed successfully!"
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Host ""
        
        Write-Info "Services are managed by PM2"
        Write-Host "  pm2 list              - Show all services"
        Write-Host "  pm2 restart all       - Restart services"
        Write-Host "  pm2 logs              - View logs"
        Write-Host "  pm2 stop all          - Stop all services"
        Write-Host ""
        
        if (Test-Path "$InstallPath\server-api-key.txt") {
            Write-Warning "Server API Key saved to: $InstallPath\server-api-key.txt"
        }
        
        Write-Host ""
        Write-Info "Press any key to exit..."
        pause
    }
    
} catch {
    Write-Error "Installation failed: $_"
    Write-Host ""
    Write-Info "Press any key to exit..."
    pause
    exit 1
}