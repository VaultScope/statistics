#!/usr/bin/env node

/**
 * VaultScope Statistics CLI
 * Complete management tool for VaultScope Statistics
 * Usage: vss <command> [options]
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Symbols for output
const symbols = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  arrow: '➜',
  dot: '•'
};

// Helper functions
const log = {
  success: (msg) => console.log(`${colors.green}${symbols.success} ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${symbols.error} ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${symbols.warning} ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}${symbols.info} ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
  item: (msg) => console.log(`  ${colors.dim}${symbols.dot}${colors.reset} ${msg}`)
};

// Create readline interface for prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question) => new Promise((resolve) => {
  rl.question(`${colors.yellow}${symbols.arrow} ${question}${colors.reset} `, resolve);
});

// Check if running as root
const isRoot = () => process.getuid && process.getuid() === 0;

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const options = args.slice(1);

// Main CLI class
class VaultScopeCLI {
  constructor() {
    this.rootDir = __dirname;
    this.serverDir = path.join(this.rootDir, 'server');
    this.clientDir = path.join(this.rootDir, 'client');
  }

  // Display header
  showHeader() {
    console.log(`
${colors.bright}${colors.cyan}╔══════════════════════════════════════════════════════╗
║         VaultScope Statistics CLI (vss)              ║
║              System Management Tool                  ║
╚══════════════════════════════════════════════════════╝${colors.reset}
`);
  }

  // Display help
  showHelp() {
    this.showHeader();
    console.log(`${colors.yellow}Usage:${colors.reset}
  vss <command> [options]

${colors.yellow}Installation & Setup:${colors.reset}
  ${colors.green}install${colors.reset}          Install all dependencies
  ${colors.green}setup${colors.reset}            Complete setup wizard
  ${colors.green}init-db${colors.reset}          Initialize databases

${colors.yellow}Development:${colors.reset}
  ${colors.green}dev${colors.reset}              Start both server and client in dev mode
  ${colors.green}server${colors.reset}           Start server only (dev mode)
  ${colors.green}client${colors.reset}           Start client only (dev mode)

${colors.yellow}Production:${colors.reset}
  ${colors.green}build${colors.reset}            Build both applications
  ${colors.green}start${colors.reset}            Start both in production
  ${colors.green}stop${colors.reset}             Stop all services
  ${colors.green}restart${colors.reset}          Restart all services
  ${colors.green}status${colors.reset}           Show service status

${colors.yellow}API Key Management:${colors.reset}
  ${colors.green}apikey create${colors.reset} <name> [--admin] [--viewStats] ...
  ${colors.green}apikey list${colors.reset}      List all API keys
  ${colors.green}apikey delete${colors.reset} <key>  Delete an API key

${colors.yellow}Database:${colors.reset}
  ${colors.green}db backup${colors.reset}        Backup databases
  ${colors.green}db restore${colors.reset}       Restore databases
  ${colors.green}db reset${colors.reset}         Reset databases (WARNING: deletes all data)

${colors.yellow}System:${colors.reset}
  ${colors.green}logs${colors.reset}             View application logs
  ${colors.green}health${colors.reset}           Check system health
  ${colors.green}update${colors.reset}           Update to latest version
  ${colors.green}config${colors.reset}           Configure settings
  ${colors.green}ports${colors.reset}            Check/kill processes on ports

${colors.yellow}Docker:${colors.reset}
  ${colors.green}docker build${colors.reset}     Build Docker images
  ${colors.green}docker up${colors.reset}        Start with Docker Compose
  ${colors.green}docker down${colors.reset}      Stop Docker containers

${colors.yellow}Examples:${colors.reset}
  ${colors.dim}# Complete installation${colors.reset}
  vss setup

  ${colors.dim}# Create admin API key${colors.reset}
  vss apikey create "Admin" --admin

  ${colors.dim}# Start development servers${colors.reset}
  vss dev

  ${colors.dim}# Check system status${colors.reset}
  vss status

${colors.yellow}Options:${colors.reset}
  --help, -h       Show this help message
  --version, -v    Show version information
  --verbose        Enable verbose output
`);
  }

  // Install dependencies
  async install() {
    log.section('Installing Dependencies');
    
    try {
      log.info('Installing root dependencies...');
      await this.runCommand('npm', ['install'], this.rootDir);
      
      log.info('Installing server dependencies...');
      await this.runCommand('npm', ['install'], this.serverDir);
      
      log.info('Installing client dependencies...');
      await this.runCommand('npm', ['install'], this.clientDir);
      
      log.success('All dependencies installed successfully!');
    } catch (error) {
      log.error(`Installation failed: ${error.message}`);
      process.exit(1);
    }
  }

  // Setup wizard
  async setup() {
    this.showHeader();
    log.section('Setup Wizard');
    
    const setupType = await prompt('Installation type? (full/server/client) [full]:') || 'full';
    
    // Install dependencies
    if (await prompt('Install dependencies? (y/n) [y]:') !== 'n') {
      await this.install();
    }
    
    // Initialize databases
    if (await prompt('Initialize databases? (y/n) [y]:') !== 'n') {
      await this.initDatabase();
    }
    
    // Build applications
    if (await prompt('Build applications? (y/n) [y]:') !== 'n') {
      await this.build();
    }
    
    // Create admin API key
    if (setupType !== 'client' && await prompt('Create admin API key? (y/n) [y]:') !== 'n') {
      const keyName = await prompt('Admin key name [Admin Key]:') || 'Admin Key';
      await this.createApiKey(keyName, ['--admin']);
    }
    
    // Configure systemd services
    if (isRoot() && await prompt('Configure systemd services? (y/n) [n]:') === 'y') {
      await this.configureSystemd();
    }
    
    log.success('Setup completed successfully!');
    log.info('You can now start the application with: vss start');
    rl.close();
  }

  // Initialize databases
  async initDatabase() {
    log.section('Initializing Databases');
    
    // Server database
    log.info('Initializing server database...');
    const serverDbPath = path.join(this.serverDir, 'database.db');
    if (!fs.existsSync(serverDbPath)) {
      // Run server briefly to create database
      const child = spawn('npx', ['ts-node', 'index.ts'], {
        cwd: this.serverDir,
        detached: true,
        stdio: 'ignore'
      });
      
      // Give it time to initialize
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Kill the process
      try {
        process.kill(-child.pid);
      } catch (e) {
        // Process might have already exited
      }
      
      if (fs.existsSync(serverDbPath)) {
        log.success('Server database initialized');
      }
    } else {
      log.info('Server database already exists');
    }
    
    // Client database
    log.info('Initializing client database...');
    const clientDbPath = path.join(this.clientDir, 'database.json');
    if (!fs.existsSync(clientDbPath)) {
      const defaultDb = {
        users: [],
        nodes: [],
        categories: [
          { id: 1, name: 'Production', color: '#22c55e', icon: 'server', createdAt: new Date().toISOString() },
          { id: 2, name: 'Development', color: '#3b82f6', icon: 'code', createdAt: new Date().toISOString() },
          { id: 3, name: 'Testing', color: '#f59e0b', icon: 'flask', createdAt: new Date().toISOString() },
          { id: 4, name: 'Backup', color: '#8b5cf6', icon: 'database', createdAt: new Date().toISOString() },
          { id: 5, name: 'Monitoring', color: '#ef4444', icon: 'activity', createdAt: new Date().toISOString() }
        ],
        roles: [
          {
            id: 'admin',
            name: 'Administrator',
            description: 'Full system access',
            permissions: ['nodes.view', 'nodes.create', 'nodes.edit', 'nodes.delete', 'users.view', 'users.create', 'users.edit', 'users.delete', 'system.settings'],
            isSystem: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'viewer',
            name: 'Viewer',
            description: 'Read-only access',
            permissions: ['nodes.view', 'users.view'],
            isSystem: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      };
      
      fs.writeFileSync(clientDbPath, JSON.stringify(defaultDb, null, 2));
      log.success('Client database initialized');
    } else {
      log.info('Client database already exists');
    }
  }

  // Build applications
  async build() {
    log.section('Building Applications');
    
    try {
      log.info('Building server...');
      await this.runCommand('npm', ['run', 'build'], this.serverDir);
      
      log.info('Building client...');
      await this.runCommand('npm', ['run', 'build'], this.clientDir);
      
      log.success('Build completed successfully!');
    } catch (error) {
      log.error(`Build failed: ${error.message}`);
      process.exit(1);
    }
  }

  // Start services
  async start(mode = 'dev') {
    log.section(`Starting Services (${mode} mode)`);
    
    // Check if ports are available
    await this.checkPorts();
    
    if (mode === 'dev') {
      await this.runCommand('npm', ['run', 'dev'], this.rootDir, false);
    } else {
      await this.runCommand('npm', ['run', 'start:all'], this.rootDir, false);
    }
  }

  // Check and kill processes on ports
  async checkPorts() {
    log.info('Checking ports 4000 and 4001...');
    
    try {
      const { stdout: port4000 } = await execAsync('lsof -ti:4000');
      if (port4000) {
        log.warning('Port 4000 is in use');
        if (await prompt('Kill process on port 4000? (y/n) [y]:') !== 'n') {
          await execAsync('lsof -ti:4000 | xargs kill -9');
          log.success('Port 4000 cleared');
        }
      }
    } catch (e) {
      // Port is free
    }
    
    try {
      const { stdout: port4001 } = await execAsync('lsof -ti:4001');
      if (port4001) {
        log.warning('Port 4001 is in use');
        if (await prompt('Kill process on port 4001? (y/n) [y]:') !== 'n') {
          await execAsync('lsof -ti:4001 | xargs kill -9');
          log.success('Port 4001 cleared');
        }
      }
    } catch (e) {
      // Port is free
    }
  }

  // API Key management
  async manageApiKeys(action, keyName, permissions = []) {
    log.section('API Key Management');
    
    const args = ['run', 'apikey', action];
    if (keyName) args.push(keyName);
    if (permissions.length > 0) {
      args.push('--');
      args.push(...permissions);
    }
    
    await this.runCommand('npm', args, this.serverDir, false);
  }

  // Create API key shortcut
  async createApiKey(name, permissions) {
    await this.manageApiKeys('create', name, permissions);
  }

  // Check system health
  async checkHealth() {
    log.section('System Health Check');
    
    // Check server
    try {
      const { stdout } = await execAsync('curl -s http://localhost:4000/health');
      const health = JSON.parse(stdout);
      log.success(`Server: ${health.status} (uptime: ${health.uptime})`);
    } catch (e) {
      log.error('Server: Not responding');
    }
    
    // Check client
    try {
      await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:4001');
      log.success('Client: Running');
    } catch (e) {
      log.error('Client: Not responding');
    }
    
    // Check databases
    if (fs.existsSync(path.join(this.serverDir, 'database.db'))) {
      log.success('Server database: Present');
    } else {
      log.warning('Server database: Not found');
    }
    
    if (fs.existsSync(path.join(this.clientDir, 'database.json'))) {
      log.success('Client database: Present');
    } else {
      log.warning('Client database: Not found');
    }
  }

  // Configure systemd services
  async configureSystemd() {
    log.section('Configuring Systemd Services');
    
    if (!isRoot()) {
      log.error('This command requires root privileges. Please run with sudo.');
      return;
    }
    
    // Server service
    const serverService = `[Unit]
Description=VaultScope Statistics Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${this.serverDir}
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target`;
    
    fs.writeFileSync('/etc/systemd/system/vss-server.service', serverService);
    
    // Client service
    const clientService = `[Unit]
Description=VaultScope Statistics Client
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${this.clientDir}
Environment="NODE_ENV=production"
Environment="PORT=4001"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target`;
    
    fs.writeFileSync('/etc/systemd/system/vss-client.service', clientService);
    
    await execAsync('systemctl daemon-reload');
    log.success('Systemd services configured');
    log.info('Enable services with: systemctl enable vss-server vss-client');
  }

  // Database backup
  async backupDatabase() {
    log.section('Database Backup');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.rootDir, 'backups', timestamp);
    
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Backup server database
    const serverDb = path.join(this.serverDir, 'database.db');
    if (fs.existsSync(serverDb)) {
      fs.copyFileSync(serverDb, path.join(backupDir, 'database.db'));
      log.success('Server database backed up');
    }
    
    // Backup client database
    const clientDb = path.join(this.clientDir, 'database.json');
    if (fs.existsSync(clientDb)) {
      fs.copyFileSync(clientDb, path.join(backupDir, 'database.json'));
      log.success('Client database backed up');
    }
    
    log.success(`Backup saved to: ${backupDir}`);
  }

  // View logs
  async viewLogs() {
    log.section('Application Logs');
    
    const logType = await prompt('Which logs? (server/client/all) [all]:') || 'all';
    
    if (logType === 'server' || logType === 'all') {
      console.log(`\n${colors.cyan}=== Server Logs ===${colors.reset}`);
      if (fs.existsSync('/var/log/vss-server.log')) {
        await this.runCommand('tail', ['-f', '/var/log/vss-server.log'], '.', false);
      } else {
        log.info('No server logs found. Try: journalctl -u vss-server -f');
      }
    }
    
    if (logType === 'client' || logType === 'all') {
      console.log(`\n${colors.cyan}=== Client Logs ===${colors.reset}`);
      if (fs.existsSync('/var/log/vss-client.log')) {
        await this.runCommand('tail', ['-f', '/var/log/vss-client.log'], '.', false);
      } else {
        log.info('No client logs found. Try: journalctl -u vss-client -f');
      }
    }
  }

  // Run command helper
  runCommand(command, args, cwd, wait = true) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        stdio: wait ? 'pipe' : 'inherit',
        shell: true
      });
      
      if (wait) {
        let output = '';
        
        child.stdout?.on('data', (data) => {
          output += data.toString();
          if (options.includes('--verbose')) {
            process.stdout.write(data);
          }
        });
        
        child.stderr?.on('data', (data) => {
          if (options.includes('--verbose')) {
            process.stderr.write(data);
          }
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve(output);
          } else {
            reject(new Error(`Command failed with exit code ${code}`));
          }
        });
      } else {
        child.on('error', reject);
        if (wait === false) {
          // Don't wait for long-running processes
          setTimeout(() => resolve(), 1000);
        }
      }
    });
  }

  // Main command router
  async execute() {
    switch (command) {
      case 'install':
        await this.install();
        break;
      
      case 'setup':
        await this.setup();
        break;
      
      case 'init-db':
        await this.initDatabase();
        break;
      
      case 'dev':
        await this.start('dev');
        break;
      
      case 'server':
        await this.runCommand('npm', ['run', 'server'], this.rootDir, false);
        break;
      
      case 'client':
        await this.runCommand('npm', ['run', 'client'], this.rootDir, false);
        break;
      
      case 'build':
        await this.build();
        break;
      
      case 'start':
        await this.start('production');
        break;
      
      case 'stop':
        log.info('Stopping services...');
        await execAsync('pkill -f "node.*4000" || true');
        await execAsync('pkill -f "node.*4001" || true');
        log.success('Services stopped');
        break;
      
      case 'restart':
        await this.execute('stop');
        await this.execute('start');
        break;
      
      case 'status':
      case 'health':
        await this.checkHealth();
        break;
      
      case 'apikey':
        const subCommand = options[0];
        const keyName = options[1];
        const perms = options.slice(2);
        await this.manageApiKeys(subCommand, keyName, perms);
        break;
      
      case 'db':
        const dbCommand = options[0];
        if (dbCommand === 'backup') {
          await this.backupDatabase();
        } else if (dbCommand === 'reset') {
          if (await prompt('WARNING: This will delete all data. Continue? (y/n) [n]:') === 'y') {
            fs.unlinkSync(path.join(this.serverDir, 'database.db'));
            fs.unlinkSync(path.join(this.clientDir, 'database.json'));
            log.success('Databases reset');
          }
        }
        break;
      
      case 'logs':
        await this.viewLogs();
        break;
      
      case 'ports':
        await this.checkPorts();
        break;
      
      case 'docker':
        const dockerCmd = options[0];
        if (dockerCmd === 'build') {
          await this.runCommand('docker-compose', ['build'], this.rootDir);
        } else if (dockerCmd === 'up') {
          await this.runCommand('docker-compose', ['up', '-d'], this.rootDir);
        } else if (dockerCmd === 'down') {
          await this.runCommand('docker-compose', ['down'], this.rootDir);
        }
        break;
      
      case 'update':
        log.info('Updating to latest version...');
        await this.runCommand('git', ['pull'], this.rootDir);
        await this.install();
        await this.build();
        log.success('Update completed!');
        break;
      
      case '--version':
      case '-v':
        const pkg = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf-8'));
        console.log(`VaultScope Statistics v${pkg.version}`);
        break;
      
      case 'help':
      case '--help':
      case '-h':
      case undefined:
        this.showHelp();
        break;
      
      default:
        log.error(`Unknown command: ${command}`);
        console.log('Run "vss help" for usage information');
        process.exit(1);
    }
    
    rl.close();
  }
}

// Main execution
const cli = new VaultScopeCLI();

// Handle errors
process.on('unhandledRejection', (error) => {
  log.error(`Error: ${error.message}`);
  process.exit(1);
});

// Execute CLI
cli.execute().catch((error) => {
  log.error(`Error: ${error.message}`);
  process.exit(1);
});