#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

const VERSION = '2.0.0';
const CONFIG_FILE = path.join(
    os.platform() === 'win32' 
        ? path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'vaultscope-statistics')
        : '/etc/vaultscope-statistics',
    'config.json'
);

class VaultScopeCLI {
    constructor() {
        this.config = this.loadConfig();
        this.platform = os.platform();
        this.args = process.argv.slice(2);
    }

    loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            }
        } catch (error) {
            console.error('Warning: Could not load configuration');
        }
        return null;
    }

    saveConfig(config) {
        try {
            const dir = path.dirname(CONFIG_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Error saving configuration:', error.message);
        }
    }

    printHeader() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║             VaultScope Statistics Manager                ║');
        console.log(`║                    Version ${VERSION}                        ║`);
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    printHelp() {
        this.printHeader();
        console.log('Usage: statistics <command> [options]\n');
        console.log('Commands:');
        console.log('  status                   Show service status');
        console.log('  start [component]        Start services (server/client/all)');
        console.log('  stop [component]         Stop services (server/client/all)');
        console.log('  restart [component]      Restart services (server/client/all)');
        console.log('  logs [component]         View logs (server/client/all)');
        console.log('  config                   Show configuration');
        console.log('  info                     Display installation information');
        console.log('  apikey                   Manage API keys');
        console.log('  update                   Update VaultScope Statistics');
        console.log('  uninstall                Uninstall VaultScope Statistics');
        console.log('  version, -v              Show version');
        console.log('  help, -h                 Show this help message');
        console.log('\nExamples:');
        console.log('  statistics status               # Show service status');
        console.log('  statistics start server         # Start server only');
        console.log('  statistics logs client          # View client logs');
        console.log('  statistics uninstall            # Remove everything');
        console.log('\nConfiguration file:', CONFIG_FILE);
    }

    showStatistics() {
        this.printHeader();
        
        if (!this.config) {
            console.log('❌ VaultScope Statistics is not installed or configured.\n');
            console.log('To install, run the appropriate installer:');
            console.log('  Windows: .\\installer.ps1');
            console.log('  Linux/Mac: ./installer.sh\n');
            return;
        }

        console.log('📊 Installation Information:\n');
        console.log(`  Installation Path: ${this.config.installPath}`);
        console.log(`  Installation Date: ${this.config.installDate}`);
        console.log(`  Platform: ${this.config.platform}`);
        console.log(`  Components: ${this.config.components.join(', ')}`);
        
        if (this.config.server) {
            console.log('\n📡 Server Configuration:');
            console.log(`  Path: ${this.config.server.path}`);
            console.log(`  URL: ${this.config.server.url}`);
            console.log(`  Port: ${this.config.server.port}`);
            console.log(`  API Key File: ${this.config.server.apiKeyFile}`);
        }
        
        if (this.config.client) {
            console.log('\n🖥️  Client Configuration:');
            console.log(`  Path: ${this.config.client.path}`);
            console.log(`  URL: ${this.config.client.url}`);
            console.log(`  Port: ${this.config.client.port}`);
        }
        
        console.log('\n📦 Service Manager:');
        console.log(`  Type: ${this.config.serviceManager}`);
        
        if (this.config.serviceManager === 'systemd') {
            console.log('  Services: vaultscope-statistics-server.service, vaultscope-statistics-client.service');
        } else if (this.config.serviceManager === 'pm2') {
            console.log('  Processes: vaultscope-server, vaultscope-client');
        }
        
        this.showStatus();
    }

    showStatus() {
        console.log('\n🔄 Service Status:\n');
        
        // Add URLs for when config is not available
        const defaultUrls = {
            server: 'http://localhost:4000',
            client: 'http://localhost:4001'
        };
        
        try {
            // Always try to check systemd services, even without config
            if (!this.config || this.config?.serviceManager === 'systemd') {
                // Check both services if no config or check configured components
                // Try new service names first, then fall back to old ones
                if (!this.config || this.config.components.includes('server')) {
                    let serverStatus = this.getSystemdStatus('vaultscope-statistics-server');
                    if (serverStatus === '❓ Unknown') {
                        serverStatus = this.getSystemdStatus('statistics-server');
                    }
                    console.log(`  Server: ${serverStatus}`);
                }
                if (!this.config || this.config.components.includes('client')) {
                    let clientStatus = this.getSystemdStatus('vaultscope-statistics-client');
                    if (clientStatus === '❓ Unknown') {
                        clientStatus = this.getSystemdStatus('statistics-client');
                    }
                    console.log(`  Client: ${clientStatus}`);
                }
            } else if (this.config?.serviceManager === 'pm2') {
                const pm2List = execSync('pm2 list --no-color', { encoding: 'utf8' });
                
                if (this.config.components.includes('server')) {
                    const serverRunning = pm2List.includes('statistics-server') && 
                                        pm2List.includes('online');
                    console.log(`  Server: ${serverRunning ? '✅ Running' : '❌ Stopped'}`);
                }
                if (this.config.components.includes('client')) {
                    const clientRunning = pm2List.includes('statistics-client') && 
                                        pm2List.includes('online');
                    console.log(`  Client: ${clientRunning ? '✅ Running' : '❌ Stopped'}`);
                }
            }
            
            console.log('\n🔗 Access URLs:');
            if (this.config?.server) {
                console.log(`  Server API: ${this.config.server.url}`);
            } else {
                console.log(`  Server API: ${defaultUrls.server}`);
            }
            if (this.config?.client) {
                console.log(`  Client Dashboard: ${this.config.client.url}`);
            } else {
                console.log(`  Client Dashboard: ${defaultUrls.client}`);
            }
        } catch (error) {
            console.log('  Unable to determine service status');
        }
    }

    getSystemdStatus(service) {
        try {
            const status = execSync(`systemctl is-active ${service}`, { encoding: 'utf8' }).trim();
            return status === 'active' ? '✅ Running' : '❌ Stopped';
        } catch {
            return '❓ Unknown';
        }
    }

    startService(component = 'all') {
        // Allow starting services even without config
        const components = component === 'all' ? ['server', 'client'] : [component];

        console.log(`Starting ${component}...`);
        
        components.forEach(comp => {
            if (this.config && !this.config.components.includes(comp)) {
                console.log(`  ${comp}: Not configured`);
                return;
            }
            
            try {
                // Default to systemd with new service names
                if (!this.config || this.config.serviceManager === 'systemd') {
                    try {
                        execSync(`sudo systemctl start vaultscope-statistics-${comp}`, { stdio: 'inherit' });
                    } catch {
                        // Fallback to old service names
                        execSync(`sudo systemctl start statistics-${comp}`, { stdio: 'inherit' });
                    }
                } else if (this.config.serviceManager === 'pm2') {
                    execSync(`pm2 start statistics-${comp}`, { stdio: 'inherit' });
                }
                console.log(`  ${comp}: ✅ Started`);
            } catch (error) {
                console.error(`  ${comp}: ❌ Failed to start`);
            }
        });
    }

    stopService(component = 'all') {
        // Allow stopping services even without config
        const components = component === 'all' ? ['server', 'client'] : [component];

        console.log(`Stopping ${component}...`);
        
        components.forEach(comp => {
            if (this.config && !this.config.components.includes(comp)) {
                console.log(`  ${comp}: Not configured`);
                return;
            }
            
            try {
                // Default to systemd with new service names
                if (!this.config || this.config.serviceManager === 'systemd') {
                    try {
                        execSync(`sudo systemctl stop vaultscope-statistics-${comp}`, { stdio: 'inherit' });
                    } catch {
                        // Fallback to old service names
                        execSync(`sudo systemctl stop statistics-${comp}`, { stdio: 'inherit' });
                    }
                } else if (this.config.serviceManager === 'pm2') {
                    execSync(`pm2 stop statistics-${comp}`, { stdio: 'inherit' });
                }
                console.log(`  ${comp}: ✅ Stopped`);
            } catch (error) {
                console.error(`  ${comp}: ❌ Failed to stop`);
            }
        });
    }

    restartService(component = 'all') {
        // Allow restarting services even without config
        const components = component === 'all' ? ['server', 'client'] : [component];

        console.log(`Restarting ${component}...`);
        
        components.forEach(comp => {
            if (this.config && !this.config.components.includes(comp)) {
                console.log(`  ${comp}: Not configured`);
                return;
            }
            
            try {
                // Default to systemd with new service names
                if (!this.config || this.config.serviceManager === 'systemd') {
                    try {
                        execSync(`sudo systemctl restart vaultscope-statistics-${comp}`, { stdio: 'inherit' });
                    } catch {
                        // Fallback to old service names
                        execSync(`sudo systemctl restart statistics-${comp}`, { stdio: 'inherit' });
                    }
                } else if (this.config.serviceManager === 'pm2') {
                    execSync(`pm2 restart statistics-${comp}`, { stdio: 'inherit' });
                }
                console.log(`  ${comp}: ✅ Restarted`);
            } catch (error) {
                console.error(`  ${comp}: ❌ Failed to restart`);
            }
        });
    }

    viewLogs(component = 'all') {
        if (!this.config) {
            console.error('❌ VaultScope Statistics is not installed');
            return;
        }

        if (component === 'all') {
            console.log('Viewing all logs...\n');
            if (this.config.serviceManager === 'pm2') {
                spawn('pm2', ['logs'], { stdio: 'inherit' });
            } else {
                console.log('Use these commands to view logs:');
                if (this.config.components.includes('server')) {
                    console.log('  Server: sudo journalctl -u statistics-server -f');
                }
                if (this.config.components.includes('client')) {
                    console.log('  Client: sudo journalctl -u statistics-client -f');
                }
            }
        } else {
            if (!this.config.components.includes(component)) {
                console.error(`❌ ${component} is not installed`);
                return;
            }
            
            console.log(`Viewing ${component} logs...\n`);
            if (this.config.serviceManager === 'systemd') {
                spawn('journalctl', ['-u', `statistics-${component}`, '-f'], { stdio: 'inherit' });
            } else if (this.config.serviceManager === 'pm2') {
                spawn('pm2', ['logs', `statistics-${component}`], { stdio: 'inherit' });
            }
        }
    }

    showConfig() {
        if (!this.config) {
            console.error('❌ No configuration found');
            return;
        }
        
        console.log('\n📋 Current Configuration:\n');
        console.log(JSON.stringify(this.config, null, 2));
    }

    manageApiKeys() {
        if (!this.config?.server) {
            console.error('❌ Server is not installed');
            return;
        }
        
        console.log('\n🔑 API Key Management\n');
        
        const serverPath = this.config.server.path;
        const apiKeyScript = path.join(serverPath, 'cli', 'apikey.js');
        
        if (!fs.existsSync(apiKeyScript)) {
            console.log('API key management not available.');
            console.log(`\nCurrent API key file: ${this.config.server.apiKeyFile}`);
            
            if (fs.existsSync(this.config.server.apiKeyFile)) {
                const apiKey = fs.readFileSync(this.config.server.apiKeyFile, 'utf8').trim();
                console.log(`Current API key: ${apiKey}`);
            }
            return;
        }
        
        const args = this.args.slice(1);
        spawn('node', [apiKeyScript, ...args], { 
            stdio: 'inherit',
            cwd: serverPath
        });
    }

    async uninstall() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('\n⚠️  WARNING: This will completely remove VaultScope Statistics\n');
        console.log('The following will be removed:');
        console.log('  • All installed components (server and client)');
        console.log('  • Configuration files');
        console.log('  • System services');
        console.log('  • Log files');
        if (this.config?.installPath) {
            console.log(`  • Installation directory: ${this.config.installPath}`);
        }
        console.log('\n');
        
        const answer = await new Promise(resolve => {
            rl.question('Are you sure you want to continue? (yes/no): ', resolve);
        });
        rl.close();
        
        if (answer.toLowerCase() !== 'yes') {
            console.log('Uninstall cancelled.');
            return;
        }
        
        console.log('\nUninstalling VaultScope Statistics...\n');
        
        try {
            if (this.config) {
                if (this.config.serviceManager === 'systemd') {
                    console.log('Stopping and removing systemd services...');
                    this.config.components.forEach(comp => {
                        try {
                            execSync(`sudo systemctl stop statistics-${comp}`, { stdio: 'pipe' });
                            execSync(`sudo systemctl disable statistics-${comp}`, { stdio: 'pipe' });
                            execSync(`sudo rm -f /etc/systemd/system/statistics-${comp}.service`, { stdio: 'pipe' });
                        } catch {}
                    });
                    execSync('sudo systemctl daemon-reload', { stdio: 'pipe' });
                } else if (this.config.serviceManager === 'pm2') {
                    console.log('Stopping and removing PM2 processes...');
                    this.config.components.forEach(comp => {
                        try {
                            execSync(`pm2 delete statistics-${comp}`, { stdio: 'pipe' });
                        } catch {}
                    });
                    execSync('pm2 save', { stdio: 'pipe' });
                }
                
                if (this.config.installPath && fs.existsSync(this.config.installPath)) {
                    console.log(`Removing installation directory: ${this.config.installPath}`);
                    
                    if (this.platform === 'win32') {
                        execSync(`rmdir /s /q "${this.config.installPath}"`, { stdio: 'pipe' });
                    } else {
                        execSync(`rm -rf "${this.config.installPath}"`, { stdio: 'pipe' });
                    }
                }
            }
            
            console.log('Removing configuration file...');
            if (fs.existsSync(CONFIG_FILE)) {
                fs.unlinkSync(CONFIG_FILE);
            }
            
            console.log('Removing vaultscope command...');
            if (this.platform === 'win32') {
                try {
                    execSync('npm uninstall -g vaultscope-cli', { stdio: 'pipe' });
                } catch {}
            } else {
                try {
                    execSync('sudo npm uninstall -g vaultscope-cli', { stdio: 'pipe' });
                } catch {}
            }
            
            console.log('\n✅ VaultScope Statistics has been completely uninstalled.\n');
        } catch (error) {
            console.error('❌ Error during uninstall:', error.message);
            console.log('\nPartial uninstall may have occurred. Manual cleanup may be required.');
        }
    }

    async update() {
        console.log('\n🔄 Checking for updates...\n');
        
        if (!this.config) {
            console.error('❌ VaultScope Statistics is not installed');
            return;
        }
        
        try {
            console.log('Downloading latest version...');
            
            const installerUrl = this.platform === 'win32'
                ? 'https://raw.githubusercontent.com/VaultScope/statistics/main/installer.ps1'
                : 'https://raw.githubusercontent.com/VaultScope/statistics/main/installer.sh';
            
            const installerPath = path.join(os.tmpdir(), this.platform === 'win32' ? 'installer.ps1' : 'installer.sh');
            
            const https = require('https');
            const file = fs.createWriteStream(installerPath);
            
            await new Promise((resolve, reject) => {
                https.get(installerUrl, response => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            });
            
            console.log('Running update...');
            
            if (this.platform === 'win32') {
                execSync(`powershell -ExecutionPolicy Bypass -File "${installerPath}" -Silent`, { stdio: 'inherit' });
            } else {
                execSync(`chmod +x "${installerPath}" && "${installerPath}" --silent`, { stdio: 'inherit' });
            }
            
            console.log('\n✅ Update completed successfully!\n');
        } catch (error) {
            console.error('❌ Update failed:', error.message);
        }
    }

    async run() {
        const command = this.args[0];
        const subCommand = this.args[1];
        
        // For status command, always show it even without config
        if (command === 'status' || !command) {
            this.showStatus();
            return;
        }
        
        switch (command) {
            case 'info':
                this.showStatistics();
                break;
                
            case 'start':
                this.startService(subCommand);
                break;
                
            case 'stop':
                this.stopService(subCommand);
                break;
                
            case 'restart':
                this.restartService(subCommand);
                break;
                
            case 'logs':
                this.viewLogs(subCommand);
                break;
                
            case 'config':
                this.showConfig();
                break;
                
            case 'apikey':
                this.manageApiKeys();
                break;
                
            case 'update':
                await this.update();
                break;
                
            case 'uninstall':
                await this.uninstall();
                break;
                
            case 'version':
            case '-v':
            case '--version':
                console.log(`VaultScope Statistics CLI v${VERSION}`);
                break;
                
            case 'help':
            case '-h':
            case '--help':
            case undefined:
                this.printHelp();
                break;
                
            default:
                console.error(`Unknown command: ${command}`);
                console.log('Run "statistics help" for available commands');
                process.exit(1);
        }
    }
}

if (require.main === module) {
    const cli = new VaultScopeCLI();
    cli.run().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = VaultScopeCLI;