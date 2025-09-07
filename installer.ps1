#Requires -RunAsAdministrator

param(
    [string]$InstallPath = "$env:ProgramFiles\VaultScope\Statistics",
    [switch]$Uninstall,
    [switch]$Silent,
    [switch]$ClientOnly,
    [switch]$ServerOnly,
    [string]$Proxy,
    [string]$Domain
)

$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'
$Script:Version = "3.0.0"
$Script:LogFile = "$env:TEMP\vaultscope-install-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$Script:ConfigDir = "$env:ProgramData\VaultScope"
$Script:ConfigFile = "$Script:ConfigDir\statistics.json"
$Script:GitHubRepo = "https://github.com/VaultScope/statistics"
$Script:GitHubRaw = "https://raw.githubusercontent.com/VaultScope/statistics/main"
$Script:CLIUrl = "$Script:GitHubRaw/cli.js"

function Write-Log {
    param(
        [string]$Message, 
        [string]$Level = "INFO"
    )
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$Timestamp [$Level] $Message" | Add-Content -Path $Script:LogFile -Force
    
    if (-not $Silent) {
        switch ($Level) {
            "SUCCESS" { 
                Write-Host "✓ " -ForegroundColor Green -NoNewline
                Write-Host $Message 
            }
            "INFO" { 
                Write-Host "ℹ " -ForegroundColor Cyan -NoNewline
                Write-Host $Message 
            }
            "WARNING" { 
                Write-Host "⚠ " -ForegroundColor Yellow -NoNewline
                Write-Host $Message 
            }
            "ERROR" { 
                Write-Host "✗ " -ForegroundColor Red -NoNewline
                Write-Host $Message 
            }
        }
    }
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-InternetConnection {
    try {
        $null = Invoke-WebRequest -Uri "https://api.github.com" -Method Head -TimeoutSec 5 -UseBasicParsing
        return $true
    } catch {
        return $false
    }
}

function Get-InstalledSoftware {
    param([string]$Name)
    
    $paths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    
    foreach ($path in $paths) {
        try {
            $items = Get-ItemProperty $path -ErrorAction SilentlyContinue | 
                     Where-Object { $_.DisplayName -like "*$Name*" }
            if ($items) { 
                return $items[0] 
            }
        } catch { 
            continue
        }
    }
    return $null
}

function Install-NodeJS {
    Write-Log "Checking Node.js installation..."
    
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion -match 'v(\d+)\.') {
            $majorVersion = [int]$Matches[1]
            if ($majorVersion -ge 18) {
                Write-Log "Node.js $nodeVersion is already installed" "SUCCESS"
                return $true
            }
            Write-Log "Node.js version $nodeVersion is too old, need v18+" "WARNING"
        }
    }
    
    Write-Log "Installing Node.js v20 LTS..."
    $nodeVersion = "20.18.1"
    $nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-x64.msi"
    $nodeMsi = "$env:TEMP\node-v$nodeVersion.msi"
    
    try {
        Write-Log "Downloading Node.js from $nodeUrl"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
        
        if (-not (Test-Path $nodeMsi)) {
            throw "Failed to download Node.js installer"
        }
        
        Write-Log "Installing Node.js silently..."
        $arguments = @(
            "/i",
            "`"$nodeMsi`"",
            "/quiet",
            "/norestart",
            "ADDLOCAL=ALL"
        )
        
        $process = Start-Process msiexec.exe -ArgumentList $arguments -Wait -PassThru -NoNewWindow
        
        if ($process.ExitCode -ne 0) {
            throw "Node.js installation failed with exit code: $($process.ExitCode)"
        }
        
        Remove-Item $nodeMsi -Force -ErrorAction SilentlyContinue
        
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + 
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Log "Node.js installed successfully" "SUCCESS"
        return $true
        
    } catch {
        Write-Log "Failed to install Node.js: $_" "ERROR"
        if (Test-Path $nodeMsi) { 
            Remove-Item $nodeMsi -Force -ErrorAction SilentlyContinue 
        }
        return $false
    }
}

function Install-Git {
    Write-Log "Checking Git installation..."
    
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) {
        $gitVersion = & git --version 2>$null
        Write-Log "Git is already installed: $gitVersion" "SUCCESS"
        return $true
    }
    
    Write-Log "Installing Git for Windows..."
    $gitVersion = "2.47.1"
    $gitUrl = "https://github.com/git-for-windows/git/releases/download/v$gitVersion.windows.1/Git-$gitVersion-64-bit.exe"
    $gitExe = "$env:TEMP\git-installer.exe"
    
    try {
        Write-Log "Downloading Git from $gitUrl"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitExe -UseBasicParsing
        
        if (-not (Test-Path $gitExe)) {
            throw "Failed to download Git installer"
        }
        
        Write-Log "Installing Git silently..."
        $arguments = @(
            "/VERYSILENT",
            "/NORESTART",
            "/NOCANCEL",
            "/SP-"
        )
        
        $process = Start-Process $gitExe -ArgumentList $arguments -Wait -PassThru -NoNewWindow
        
        if ($process.ExitCode -notin @(0, 3010)) {
            throw "Git installation failed with exit code: $($process.ExitCode)"
        }
        
        Remove-Item $gitExe -Force -ErrorAction SilentlyContinue
        
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + 
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Log "Git installed successfully" "SUCCESS"
        return $true
        
    } catch {
        Write-Log "Failed to install Git: $_" "ERROR"
        if (Test-Path $gitExe) { 
            Remove-Item $gitExe -Force -ErrorAction SilentlyContinue 
        }
        return $false
    }
}

function Install-PM2 {
    Write-Log "Checking PM2 installation..."
    
    $pm2Cmd = Get-Command pm2 -ErrorAction SilentlyContinue
    if ($pm2Cmd) {
        Write-Log "PM2 is already installed" "SUCCESS"
        return $true
    }
    
    Write-Log "Installing PM2 globally..."
    try {
        $output = & npm install -g pm2 --silent 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed: $output"
        }
        
        Write-Log "Installing PM2 Windows service tools..."
        $output = & npm install -g pm2-windows-service --silent 2>&1
        
        Write-Log "PM2 installed successfully" "SUCCESS"
        return $true
    } catch {
        Write-Log "Failed to install PM2: $_" "ERROR"
        return $false
    }
}

function Download-FromGitHub {
    param(
        [string]$Component,
        [string]$TargetDir
    )
    
    Write-Log "Downloading $Component from GitHub..."
    
    if ($Component -eq "cli") {
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $Script:CLIUrl -OutFile "$TargetDir\cli.js" -UseBasicParsing
            return $true
        } catch {
            Write-Log "Failed to download CLI: $_" "WARNING"
            return $false
        }
    }
    
    $tempDir = "$env:TEMP\vaultscope-$(Get-Random)"
    
    try {
        $archiveUrl = "$Script:GitHubRepo/archive/refs/heads/main.zip"
        $archivePath = "$tempDir\repo.zip"
        
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing
        
        Expand-Archive -Path $archivePath -DestinationPath $tempDir -Force
        
        $extractedDir = "$tempDir\statistics-main"
        
        if (Test-Path "$extractedDir\$Component") {
            Copy-Item -Path "$extractedDir\$Component\*" -Destination $TargetDir -Recurse -Force
            Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
            return $true
        }
    } catch {
        Write-Log "Failed to download from GitHub: $_" "WARNING"
    }
    
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    return $false
}

function Setup-Component {
    param(
        [string]$ComponentPath,
        [string]$ComponentName,
        [int]$Port
    )
    
    Write-Log "Setting up $ComponentName..."
    
    if (-not (Test-Path $ComponentPath)) {
        New-Item -ItemType Directory -Path $ComponentPath -Force | Out-Null
    }
    
    if (-not (Download-FromGitHub -Component $ComponentName -TargetDir $ComponentPath)) {
        Write-Log "Using fallback configuration for $ComponentName" "WARNING"
        
        Set-Location $ComponentPath
        
        if ($ComponentName -eq "server") {
            $packageJson = @{
                name = "vaultscope-statistics-server"
                version = "1.0.0"
                scripts = @{
                    start = "node index.js"
                    build = "echo Build complete"
                }
                dependencies = @{
                    express = "^4.18.2"
                    cors = "^2.8.5"
                    systeminformation = "^5.21.20"
                    dotenv = "^16.3.1"
                }
            }
            
            $indexJs = @'
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
'@
            
            $packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath "$ComponentPath\package.json" -Encoding UTF8
            $indexJs | Out-File -FilePath "$ComponentPath\index.js" -Encoding UTF8
            
        } elseif ($ComponentName -eq "client") {
            $packageJson = @{
                name = "vaultscope-statistics-client"
                version = "1.0.0"
                scripts = @{
                    dev = "next dev"
                    build = "next build"
                    start = "next start -p $Port"
                }
                dependencies = @{
                    next = "^14.0.0"
                    react = "^18.2.0"
                    "react-dom" = "^18.2.0"
                }
            }
            
            $packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath "$ComponentPath\package.json" -Encoding UTF8
        }
    }
    
    Set-Location $ComponentPath
    
    Write-Log "Installing dependencies for $ComponentName..."
    
    try {
        $npmOutput = & npm install --production --no-optional --loglevel=error 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Some optional dependencies failed, retrying..." "WARNING"
            $npmOutput = & npm install --production 2>&1
        }
    } catch {
        Write-Log "NPM install warning: $_" "WARNING"
    }
    
    if ((Test-Path "$ComponentPath\tsconfig.json") -or ($ComponentName -eq "client")) {
        Write-Log "Building $ComponentName..."
        try {
            & npm run build 2>&1 | Out-Null
        } catch {
            Write-Log "Build warning: $_" "WARNING"
        }
    }
    
    return $true
}

function Create-ServiceScript {
    param(
        [string]$ServiceName,
        [string]$ComponentPath,
        [string]$StartCommand
    )
    
    $serviceScript = "$InstallPath\bin\${ServiceName}-service.ps1"
    $serviceBatch = "$InstallPath\bin\${ServiceName}-service.cmd"
    
    if (-not (Test-Path "$InstallPath\bin")) {
        New-Item -ItemType Directory -Path "$InstallPath\bin" -Force | Out-Null
    }
    
    $psContent = @"
param(
    [string]`$Action = "status"
)

`$ServiceName = "$ServiceName"
`$ComponentPath = "$ComponentPath"
`$PidFile = "`$env:TEMP\vaultscope-`$ServiceName.pid"
`$LogFile = "`$env:TEMP\vaultscope-`$ServiceName.log"

function Start-Service {
    if (Test-Path `$PidFile) {
        `$pid = Get-Content `$PidFile
        if (Get-Process -Id `$pid -ErrorAction SilentlyContinue) {
            Write-Host "`$ServiceName is already running (PID: `$pid)"
            return
        }
    }
    
    Write-Host "Starting `$ServiceName..."
    Set-Location `$ComponentPath
    `$process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $StartCommand > `$LogFile 2>&1" -PassThru -WindowStyle Hidden
    `$process.Id | Out-File -FilePath `$PidFile
    Write-Host "`$ServiceName started (PID: `$(`$process.Id))"
}

function Stop-Service {
    if (-not (Test-Path `$PidFile)) {
        Write-Host "`$ServiceName is not running"
        return
    }
    
    `$pid = Get-Content `$PidFile
    Write-Host "Stopping `$ServiceName..."
    Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
    Remove-Item `$PidFile -Force
    Write-Host "`$ServiceName stopped"
}

function Get-ServiceStatus {
    if (Test-Path `$PidFile) {
        `$pid = Get-Content `$PidFile
        if (Get-Process -Id `$pid -ErrorAction SilentlyContinue) {
            Write-Host "`$ServiceName is running (PID: `$pid)"
        } else {
            Write-Host "`$ServiceName is not running"
            Remove-Item `$PidFile -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "`$ServiceName is not running"
    }
}

switch (`$Action) {
    "start" { Start-Service }
    "stop" { Stop-Service }
    "restart" { 
        Stop-Service
        Start-Sleep -Seconds 2
        Start-Service
    }
    "status" { Get-ServiceStatus }
    default { Write-Host "Usage: `$ServiceName-service.ps1 -Action {start|stop|restart|status}" }
}
"@
    
    $psContent | Out-File -FilePath $serviceScript -Encoding UTF8
    
    $batchContent = @"
@echo off
powershell.exe -ExecutionPolicy Bypass -File "$serviceScript" -Action %1
"@
    
    $batchContent | Out-File -FilePath $serviceBatch -Encoding ASCII
    
    Write-Log "Service script created for $ServiceName" "SUCCESS"
}

function Install-NginxProxy {
    Write-Log "Installing Nginx reverse proxy..."
    
    $nginxPath = "$env:ProgramFiles\nginx"
    $nginxUrl = "https://nginx.org/download/nginx-1.24.0.zip"
    $nginxZip = "$env:TEMP\nginx.zip"
    
    if (-not (Test-Path "$nginxPath\nginx.exe")) {
        try {
            Write-Log "Downloading Nginx..."
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $nginxUrl -OutFile $nginxZip -UseBasicParsing
            
            Expand-Archive -Path $nginxZip -DestinationPath "$env:ProgramFiles" -Force
            Move-Item "$env:ProgramFiles\nginx-*" $nginxPath -Force
            Remove-Item $nginxZip -Force
        } catch {
            Write-Log "Failed to install Nginx: $_" "ERROR"
            return $false
        }
    }
    
    if ([string]::IsNullOrEmpty($Domain)) {
        $Domain = Read-Host "Enter domain name for reverse proxy"
    }
    
    $nginxConf = @"
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    server {
        listen 80;
        server_name $Domain;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade `$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host `$host;
            proxy_cache_bypass `$http_upgrade;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }

        location /api {
            proxy_pass http://localhost:4000;
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
}
"@
    
    $nginxConf | Out-File -FilePath "$nginxPath\conf\nginx.conf" -Encoding UTF8
    
    & "$nginxPath\nginx.exe" -s stop 2>$null
    Start-Sleep -Seconds 1
    & "$nginxPath\nginx.exe"
    
    Write-Log "Nginx reverse proxy configured for $Domain" "SUCCESS"
    return $true
}

function Install-CloudflaredProxy {
    Write-Log "Installing Cloudflare Tunnel..."
    
    $cloudflaredPath = "$env:ProgramFiles\Cloudflare"
    $cloudflaredExe = "$cloudflaredPath\cloudflared.exe"
    $cloudflaredUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    
    if (-not (Test-Path $cloudflaredExe)) {
        try {
            Write-Log "Downloading cloudflared..."
            New-Item -ItemType Directory -Path $cloudflaredPath -Force | Out-Null
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $cloudflaredUrl -OutFile $cloudflaredExe -UseBasicParsing
        } catch {
            Write-Log "Failed to download cloudflared: $_" "ERROR"
            return $false
        }
    }
    
    if ([string]::IsNullOrEmpty($Domain)) {
        $Domain = Read-Host "Enter domain name for Cloudflare Tunnel"
    }
    
    $tunnelConfig = @"
tunnel: vaultscope-statistics
credentials-file: $Script:ConfigDir\cloudflared-creds.json

ingress:
  - hostname: $Domain
    service: http://localhost:3000
  - hostname: api.$Domain
    service: http://localhost:4000
  - service: http_status:404
"@
    
    $tunnelConfig | Out-File -FilePath "$Script:ConfigDir\cloudflared.yml" -Encoding UTF8
    
    Write-Log "Cloudflare Tunnel configured" "SUCCESS"
    Write-Log "Run 'cloudflared tunnel login' to authenticate" "WARNING"
    Write-Log "Then run 'cloudflared tunnel create vaultscope-statistics'" "WARNING"
    Write-Log "Finally run 'cloudflared tunnel route dns vaultscope-statistics $Domain'" "WARNING"
    
    return $true
}

function Install-Server {
    $serverPath = "$InstallPath\server"
    
    if (-not (Setup-Component -ComponentPath $serverPath -ComponentName "server" -Port 4000)) {
        return $false
    }
    
    Set-Location $serverPath
    
    $apiKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
    
    $envContent = @"
PORT=4000
API_KEY=$apiKey
NODE_ENV=production
"@
    $envContent | Out-File -FilePath "$serverPath\.env" -Encoding UTF8
    
    Create-ServiceScript -ServiceName "server" -ComponentPath $serverPath -StartCommand "node index.js"
    
    Write-Log "Setting up PM2 service for server..."
    
    $entryPoint = if (Test-Path "$serverPath\dist\index.js") { 
        "$serverPath\dist\index.js" 
    } elseif (Test-Path "$serverPath\index.js") { 
        "$serverPath\index.js" 
    } else { 
        "$serverPath\index.js"
    }
    
    try {
        & pm2 delete vaultscope-server 2>$null
        & pm2 start $entryPoint --name "vaultscope-server" --cwd $serverPath
        & pm2 save
    } catch {
        Write-Log "PM2 error: $_" "WARNING"
    }
    
    Write-Log "Server installed successfully!" "SUCCESS"
    Write-Log "Server URL: http://localhost:4000" "INFO"
    Write-Log "API Key: $apiKey" "WARNING"
    
    $apiKey | Out-File -FilePath "$InstallPath\server-api-key.txt"
    
    return $true
}

function Install-Client {
    $clientPath = "$InstallPath\client"
    
    if (-not (Setup-Component -ComponentPath $clientPath -ComponentName "client" -Port 3000)) {
        return $false
    }
    
    Set-Location $clientPath
    
    $envContent = @"
NEXT_PUBLIC_API_URL=http://localhost:4000
NODE_ENV=production
SESSION_SECRET=$(New-Guid)
"@
    $envContent | Out-File -FilePath "$clientPath\.env.production" -Encoding UTF8
    
    Create-ServiceScript -ServiceName "client" -ComponentPath $clientPath -StartCommand "npm run start"
    
    Write-Log "Setting up PM2 service for client..."
    
    try {
        & pm2 delete vaultscope-client 2>$null
        & pm2 start "npm run start" --name "vaultscope-client" --cwd $clientPath
        & pm2 save
    } catch {
        Write-Log "PM2 error: $_" "WARNING"
    }
    
    Write-Log "Client installed successfully!" "SUCCESS"
    Write-Log "Client URL: http://localhost:3000" "INFO"
    
    return $true
}

function Install-CLI {
    Write-Log "Installing VaultScope CLI..."
    
    $cliSource = "$InstallPath\cli.js"
    $cliBatch = "$InstallPath\vaultscope.cmd"
    $cliPs1 = "$InstallPath\vaultscope.ps1"
    
    if (-not (Download-FromGitHub -Component "cli" -TargetDir $InstallPath)) {
        Write-Log "Creating embedded CLI..." "WARNING"
        
        $cliContent = @'
#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = process.platform === 'win32' 
    ? path.join(process.env.ProgramData, 'VaultScope', 'statistics.json')
    : '/etc/vaultscope/statistics.json';

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
        exec('pm2 list', (err, stdout) => console.log(stdout));
        break;
    
    case 'start':
        exec('pm2 start all', (err) => {
            console.log(err ? 'Failed to start services' : 'Services started');
        });
        break;
    
    case 'stop':
        exec('pm2 stop all', (err) => {
            console.log(err ? 'Failed to stop services' : 'Services stopped');
        });
        break;
    
    case 'restart':
        exec('pm2 restart all', (err) => {
            console.log(err ? 'Failed to restart services' : 'Services restarted');
        });
        break;
    
    case 'logs':
        exec('pm2 logs', (err, stdout) => console.log(stdout));
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
'@
        
        $cliContent | Out-File -FilePath $cliSource -Encoding UTF8
    }
    
    if (Test-Path $cliSource) {
        # Create batch wrapper for CMD
        $batchContent = @"
@echo off
node "$cliSource" %*
"@
        $batchContent | Out-File -FilePath $cliBatch -Encoding ASCII
        
        # Create PowerShell wrapper
        $ps1Content = @"
#!/usr/bin/env pwsh
param(
    [Parameter(ValueFromRemainingArguments=`$true)]
    [string[]]`$Arguments
)

& node "$cliSource" @Arguments
"@
        $ps1Content | Out-File -FilePath $cliPs1 -Encoding UTF8
        
        # Add to PATH
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        if ($currentPath -notlike "*$InstallPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallPath", "Machine")
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")
        }
        
        # Create firewall rules for services
        Write-Log "Creating firewall rules..."
        New-NetFirewallRule -DisplayName "VaultScope Server" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -ErrorAction SilentlyContinue | Out-Null
        New-NetFirewallRule -DisplayName "VaultScope Client" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -ErrorAction SilentlyContinue | Out-Null
        
        Write-Log "VaultScope CLI installed successfully" "SUCCESS"
        Write-Log "CLI commands available: vaultscope (CMD) or vaultscope.ps1 (PowerShell)" "INFO"
    } else {
        Write-Log "Failed to create CLI" "ERROR"
    }
}

function Save-Configuration {
    param(
        [bool]$HasServer,
        [bool]$HasClient,
        [string]$ServerPath,
        [string]$ClientPath,
        [string]$ApiKeyFile,
        [string]$ProxyType,
        [string]$ProxyDomain
    )
    
    Write-Log "Saving configuration..."
    
    if (-not (Test-Path $Script:ConfigDir)) {
        New-Item -ItemType Directory -Path $Script:ConfigDir -Force | Out-Null
    }
    
    $components = @()
    if ($HasServer) { $components += "server" }
    if ($HasClient) { $components += "client" }
    
    $config = @{
        version = $Script:Version
        installPath = $InstallPath
        installDate = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        platform = "windows"
        components = $components
        serviceManager = "pm2"
        proxyEnabled = ($ProxyType -ne $null -and $ProxyType -ne "")
        proxyType = $ProxyType
        proxyDomain = $ProxyDomain
        server = @{
            path = $ServerPath
            url = "http://localhost:4000"
            port = 4000
            apiKeyFile = $ApiKeyFile
        }
        client = @{
            path = $ClientPath
            url = "http://localhost:3000"
            port = 3000
        }
    }
    
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $Script:ConfigFile -Encoding UTF8
    Write-Log "Configuration saved to $Script:ConfigFile" "SUCCESS"
}

function Uninstall-VaultScope {
    Write-Log "Uninstalling VaultScope Statistics..." "INFO"
    
    # Stop PM2 processes
    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        Write-Log "Stopping PM2 processes..."
        & pm2 delete vaultscope-server 2>$null
        & pm2 delete vaultscope-client 2>$null
        & pm2 save 2>$null
    }
    
    # Stop Windows services if they exist
    $services = @("vaultscope-server", "vaultscope-client")
    foreach ($service in $services) {
        if (Get-Service -Name $service -ErrorAction SilentlyContinue) {
            Write-Log "Stopping service: $service"
            Stop-Service -Name $service -Force -ErrorAction SilentlyContinue
            & sc.exe delete $service 2>$null
        }
    }
    
    # Stop Nginx if running
    $nginxPath = "$env:ProgramFiles\nginx"
    if (Test-Path "$nginxPath\nginx.exe") {
        Write-Log "Stopping Nginx..."
        & "$nginxPath\nginx.exe" -s stop 2>$null
        Start-Sleep -Seconds 2
    }
    
    # Remove installation directory
    if (Test-Path $InstallPath) {
        Write-Log "Removing installation directory: $InstallPath"
        # Try to remove read-only attributes first
        Get-ChildItem -Path $InstallPath -Recurse | ForEach-Object {
            $_.Attributes = 'Normal'
        }
        Remove-Item -Path $InstallPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Remove configuration directory
    if (Test-Path $Script:ConfigDir) {
        Write-Log "Removing configuration directory..."
        Remove-Item -Path $Script:ConfigDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Remove from PATH
    Write-Log "Removing from PATH..."
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $newPath = ($currentPath -split ';' | Where-Object { $_ -notlike "*$InstallPath*" }) -join ';'
    [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
    $env:Path = $newPath
    
    # Remove firewall rules
    Write-Log "Removing firewall rules..."
    Remove-NetFirewallRule -DisplayName "VaultScope*" -ErrorAction SilentlyContinue
    
    # Clean up temporary files
    $tempFiles = @(
        "$env:TEMP\vaultscope*",
        "$env:TEMP\node-v*",
        "$env:TEMP\git-installer.exe",
        "$env:TEMP\nginx.zip"
    )
    foreach ($pattern in $tempFiles) {
        Remove-Item -Path $pattern -Force -ErrorAction SilentlyContinue
    }
    
    Write-Log "Uninstallation complete" "SUCCESS"
    Write-Log "VaultScope Statistics has been removed from your system" "INFO"
}

function Show-Menu {
    Clear-Host
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║           VaultScope Statistics Installer               ║" -ForegroundColor Cyan
    Write-Host "║                 Version $Script:Version                        ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Installation Options:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1) Install Client only (Dashboard)"
    Write-Host "  2) Install Server only (Monitoring Agent)"
    Write-Host "  3) Install Both (Recommended)"
    Write-Host "  4) Install with Reverse Proxy"
    Write-Host "  5) Uninstall"
    Write-Host "  6) Exit"
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    
    $choice = ""
    $validChoice = $false
    
    while (-not $validChoice) {
        Write-Host -NoNewline "Enter your choice [1-6]: "
        $choice = Read-Host
        
        if ($choice -match '^[1-6]$') {
            $validChoice = $true
            Write-Host ""
            Write-Host "✓ You selected option $choice" -ForegroundColor Green
            Start-Sleep -Milliseconds 500
        } elseif ([string]::IsNullOrWhiteSpace($choice)) {
            Write-Host "✗ No input provided. Please enter a number between 1 and 6." -ForegroundColor Red
        } else {
            Write-Host "✗ Invalid choice: '$choice'. Please enter a number between 1 and 6." -ForegroundColor Red
        }
    }
    
    return $choice
}

function Show-ProxyMenu {
    Clear-Host
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║              Reverse Proxy Configuration                ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Select Reverse Proxy Type:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1) Nginx"
    Write-Host "  2) Cloudflare Tunnel"
    Write-Host "  3) Skip proxy setup"
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    
    $choice = ""
    $validChoice = $false
    
    while (-not $validChoice) {
        Write-Host -NoNewline "Enter your choice [1-3]: "
        $choice = Read-Host
        
        switch ($choice) {
            "1" {
                $validChoice = $true
                Write-Host "✓ Selected: Nginx" -ForegroundColor Green
                return "nginx"
            }
            "2" {
                $validChoice = $true
                Write-Host "✓ Selected: Cloudflare Tunnel" -ForegroundColor Green
                return "cloudflared"
            }
            "3" {
                $validChoice = $true
                Write-Host "✓ Skipping proxy setup" -ForegroundColor Green
                return ""
            }
            default {
                if ([string]::IsNullOrWhiteSpace($choice)) {
                    Write-Host "✗ No input provided. Please enter a number between 1 and 3." -ForegroundColor Red
                } else {
                    Write-Host "✗ Invalid choice: '$choice'. Please enter a number between 1 and 3." -ForegroundColor Red
                }
            }
        }
    }
}

try {
    if (-not (Test-Administrator)) {
        Write-Log "This installer requires Administrator privileges" "ERROR"
        Write-Host "Please run PowerShell as Administrator and try again"
        exit 1
    }
    
    Write-Log "VaultScope Statistics Installer started" "INFO"
    Write-Log "Installation path: $InstallPath" "INFO"
    
    if (-not (Test-InternetConnection)) {
        Write-Log "No internet connection detected" "ERROR"
        exit 1
    }
    
    if ($Uninstall) {
        Uninstall-VaultScope
        exit 0
    }
    
    Write-Log "Checking prerequisites..." "INFO"
    
    if (-not (Install-NodeJS)) {
        throw "Failed to install Node.js"
    }
    
    if (-not (Install-Git)) {
        throw "Failed to install Git"
    }
    
    if (-not (Install-PM2)) {
        throw "Failed to install PM2"
    }
    
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    
    $installChoice = if ($ClientOnly) { 1 } elseif ($ServerOnly) { 2 } elseif ($Silent) { 3 } else { 0 }
    
    if ($installChoice -eq 0) {
        $installChoice = Show-Menu
    }
    
    $success = $false
    $proxyType = $Proxy
    $proxyDomain = $Domain
    
    switch ($installChoice) {
        "1" { 
            $success = Install-Client 
        }
        "2" { 
            $success = Install-Server 
        }
        "3" { 
            if (Install-Server) {
                $success = Install-Client
            }
        }
        "4" {
            if (Install-Server) {
                if (Install-Client) {
                    $success = $true
                    if ([string]::IsNullOrEmpty($proxyType)) {
                        $proxyType = Show-ProxyMenu
                    }
                    if (-not [string]::IsNullOrEmpty($proxyType)) {
                        switch ($proxyType) {
                            "nginx" { Install-NginxProxy }
                            "cloudflared" { Install-CloudflaredProxy }
                        }
                    }
                }
            }
        }
        "5" { 
            Uninstall-VaultScope
            exit 0
        }
        "6" { 
            Write-Log "Installation cancelled" "INFO"
            exit 0
        }
        default { 
            Write-Log "Invalid choice" "ERROR"
            exit 1
        }
    }
    
    if ($success) {
        Install-CLI
        
        $hasServer = (Test-Path "$InstallPath\server")
        $hasClient = (Test-Path "$InstallPath\client")
        Save-Configuration `
            -HasServer $hasServer `
            -HasClient $hasClient `
            -ServerPath "$InstallPath\server" `
            -ClientPath "$InstallPath\client" `
            -ApiKeyFile "$InstallPath\server-api-key.txt" `
            -ProxyType $proxyType `
            -ProxyDomain $proxyDomain
        
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Log "Installation completed successfully!" "SUCCESS"
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Host ""
        
        Write-Log "🎉 VaultScope CLI is now available!" "SUCCESS"
        Write-Host ""
        Write-Host "Quick Start Commands:" -ForegroundColor Cyan
        Write-Host "  vaultscope help            # Show help"
        Write-Host "  vaultscope statistics      # Show installation info"
        Write-Host "  vaultscope status          # Check service status"
        Write-Host "  vaultscope start           # Start all services"
        Write-Host "  vaultscope stop            # Stop all services"
        Write-Host "  vaultscope restart         # Restart all services"
        Write-Host "  vaultscope logs            # View logs"
        Write-Host ""
        
        Write-Host "Service Control Scripts:" -ForegroundColor Cyan
        Write-Host "  $InstallPath\bin\server-service.cmd {start|stop|restart|status}"
        Write-Host "  $InstallPath\bin\client-service.cmd {start|stop|restart|status}"
        Write-Host ""
        
        Write-Log "PM2 Commands:" "INFO"
        Write-Host "  pm2 list              - Show all services"
        Write-Host "  pm2 restart all       - Restart services"
        Write-Host "  pm2 logs              - View logs"
        Write-Host "  pm2 monit             - Monitor services"
        Write-Host ""
        
        if (-not [string]::IsNullOrEmpty($proxyType) -and -not [string]::IsNullOrEmpty($proxyDomain)) {
            Write-Host "Reverse Proxy Configuration:" -ForegroundColor Cyan
            Write-Host "  Type: $proxyType"
            Write-Host "  Domain: $proxyDomain"
            if ($proxyType -eq "nginx") {
                Write-Host "  Client URL: http://$proxyDomain"
                Write-Host "  API URL: http://$proxyDomain/api"
            } elseif ($proxyType -eq "cloudflared") {
                Write-Host "  Client URL: https://$proxyDomain"
                Write-Host "  API URL: https://api.$proxyDomain"
            }
            Write-Host ""
        }
        
        if (Test-Path "$InstallPath\server-api-key.txt") {
            Write-Log "Server API Key saved to: $InstallPath\server-api-key.txt" "WARNING"
            Write-Host ""
        }
        
        Write-Log "Installation log saved to: $Script:LogFile" "INFO"
        
        if (-not $Silent) {
            Write-Host ""
            Write-Host "Press any key to exit..." -ForegroundColor Gray
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    } else {
        throw "Installation failed"
    }
    
} catch {
    Write-Log "Installation failed: $_" "ERROR"
    Write-Log "Check the log file for details: $Script:LogFile" "INFO"
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host "Press any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    
    exit 1
}