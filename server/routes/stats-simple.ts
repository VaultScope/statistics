import { Router } from 'express';
import * as os from 'os';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);

// Simple stats endpoint
router.get('/', async (req, res) => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    res.json({
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        speed: cpus[0]?.speed || 0
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usage: ((totalMem - freeMem) / totalMem * 100).toFixed(2)
      },
      os: {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        hostname: os.hostname(),
        arch: os.arch()
      },
      uptime: os.uptime()
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch system stats', message: error.message });
  }
});

// CPU endpoint - simplified
router.get('/cpu', async (req, res) => {
  try {
    const cpus = os.cpus();
    res.json({
      info: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        architecture: os.arch()
      },
      usage: cpus.map((cpu, i) => ({
        core: i,
        model: cpu.model,
        speed: cpu.speed,
        times: cpu.times
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch CPU stats', message: error.message });
  }
});

// RAM endpoint - simplified
router.get('/ram', async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    res.json({
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
      usage: ((totalMem - freeMem) / totalMem * 100).toFixed(2) + '%'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch RAM stats', message: error.message });
  }
});

// Disk endpoint - simplified
router.get('/disk', async (req, res) => {
  try {
    // Use df command for disk stats on Unix-like systems
    if (process.platform !== 'win32') {
      const { stdout } = await execAsync('df -h');
      const lines = stdout.split('\n').slice(1).filter(line => line.trim());
      const disks = lines.map(line => {
        const parts = line.split(/\s+/);
        return {
          filesystem: parts[0],
          size: parts[1],
          used: parts[2],
          available: parts[3],
          use: parts[4],
          mount: parts[5]
        };
      });
      res.json({ disks });
    } else {
      res.json({ message: 'Disk stats not available on Windows' });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch disk stats', message: error.message });
  }
});

// Network endpoint - simplified
router.get('/network', async (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const result: any[] = [];
    
    for (const [name, nets] of Object.entries(interfaces)) {
      if (nets) {
        for (const net of nets) {
          if (!net.internal) {
            result.push({
              name,
              address: net.address,
              family: net.family,
              mac: net.mac,
              internal: net.internal
            });
          }
        }
      }
    }
    
    res.json({ interfaces: result });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch network stats', message: error.message });
  }
});

// Process endpoint - simplified
router.get('/process', async (req, res) => {
  try {
    // Use ps command for process list on Unix-like systems
    if (process.platform !== 'win32') {
      const { stdout } = await execAsync('ps aux | head -20');
      const lines = stdout.split('\n').slice(1).filter(line => line.trim());
      const processes = lines.map(line => {
        const parts = line.split(/\s+/);
        return {
          user: parts[0],
          pid: parts[1],
          cpu: parts[2],
          mem: parts[3],
          command: parts.slice(10).join(' ')
        };
      });
      res.json({ total: processes.length, processes });
    } else {
      res.json({ message: 'Process stats not available on Windows' });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch process list', message: error.message });
  }
});

export default router;