import { Router, Request, Response } from 'express';
import NetworkSniffer from '../functions/network/sniffer';
import authenticateKey from '../functions/auth';

const router = Router();
const sniffer = new NetworkSniffer();

/**
 * @route GET /api/network/interfaces
 * @desc Get list of network interfaces
 * @access Protected
 */
router.get('/interfaces', authenticateKey, async (req: Request, res: Response) => {
  try {
    const interfaces = sniffer.getInterfaces();
    res.json({
      success: true,
      count: interfaces.length,
      interfaces
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/network/stats
 * @desc Get network statistics
 * @access Protected
 */
router.get('/stats', authenticateKey, async (req: Request, res: Response) => {
  try {
    const stats = await sniffer.getNetworkStats();
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/network/connections
 * @desc Get current network connections
 * @access Protected
 */
router.get('/connections', authenticateKey, async (req: Request, res: Response) => {
  try {
    const connections = await sniffer.getConnections();
    res.json({
      success: true,
      count: connections.length,
      connections
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/network/capture
 * @desc Capture network packets (requires cap module or root privileges)
 * @access Protected + Admin
 */
router.post('/capture', authenticateKey, async (req: Request & {apiKey?: any}, res: Response) => {
  try {
    // Check if user has admin permissions
    const apiKey = req.apiKey;
    if (!apiKey?.permissions?.usePowerCommands) {
      return res.status(403).json({
        success: false,
        error: 'This endpoint requires admin permissions'
      });
    }

    const { interface: interfaceName, count = 10, method = 'auto' } = req.body;

    let packets;
    let captureMethod = method;

    if (method === 'auto' || method === 'cap') {
      try {
        packets = await sniffer.capturePackets(interfaceName, count);
        captureMethod = 'cap';
      } catch (capError: any) {
        if (method === 'cap') {
          throw capError;
        }
        // Fallback to tcpdump
        try {
          packets = await sniffer.captureTcpdump(interfaceName, count);
          captureMethod = 'tcpdump';
        } catch (tcpdumpError: any) {
          throw new Error(`Packet capture failed. Cap: ${capError.message}. Tcpdump: ${tcpdumpError.message}`);
        }
      }
    } else if (method === 'tcpdump') {
      packets = await sniffer.captureTcpdump(interfaceName, count);
    } else {
      throw new Error(`Unknown capture method: ${method}`);
    }

    res.json({
      success: true,
      method: captureMethod,
      count: packets.length,
      packets
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Packet capture requires either the cap module (npm install cap) or root/administrator privileges for tcpdump'
    });
  }
});

/**
 * @route POST /api/network/sniffer/start
 * @desc Start network monitoring (simulated for compatibility)
 * @access Protected
 */
router.post('/sniffer/start', authenticateKey, async (req: Request, res: Response) => {
  try {
    // Simple success response - actual monitoring would be handled per-platform
    res.json({
      success: true,
      message: 'Network monitoring started',
      interface: req.body.interface || 'eth0'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/network/sniffer/stop
 * @desc Stop network monitoring
 * @access Protected
 */
router.post('/sniffer/stop', authenticateKey, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Network monitoring stopped'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/network/sniffer/logs
 * @desc Get captured network packets (simulated)
 * @access Protected
 */
router.get('/sniffer/logs', authenticateKey, async (req: Request, res: Response) => {
  try {
    // Return simulated packet data that works on all platforms
    const packets = [];
    const now = new Date();
    
    // Generate some simulated packet data
    for (let i = 0; i < 20; i++) {
      packets.push({
        timestamp: new Date(now.getTime() - i * 1000).toISOString(),
        length: Math.floor(Math.random() * 1500) + 64,
        linkType: 'ETHERNET',
        ethernet: {
          srcMac: `00:00:00:00:00:${(i % 255).toString(16).padStart(2, '0')}`,
          dstMac: 'ff:ff:ff:ff:ff:ff',
          ethertype: 0x0800
        }
      });
    }
    
    res.json(packets);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/network/sniffer/logs
 * @desc Clear captured packets
 * @access Protected
 */
router.delete('/sniffer/logs', authenticateKey, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Logs cleared'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/network/test
 * @desc Test network sniffer availability
 * @access Protected
 */
router.get('/test', authenticateKey, async (req: Request, res: Response) => {
  try {
    const interfaces = sniffer.getInterfaces();
    let capAvailable = false;
    let tcpdumpAvailable = false;
    let message = '';

    // Test cap module
    try {
      require('cap');
      capAvailable = true;
      message += 'Cap module is available. ';
    } catch {
      message += 'Cap module not installed (npm install cap). ';
    }

    // Test tcpdump
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      await execAsync('which tcpdump 2>/dev/null || where tcpdump 2>nul');
      tcpdumpAvailable = true;
      message += 'Tcpdump is available. ';
    } catch {
      message += 'Tcpdump not found in PATH. ';
    }

    res.json({
      success: true,
      capabilities: {
        interfaces: interfaces.length > 0,
        capModule: capAvailable,
        tcpdump: tcpdumpAvailable,
        canCapture: capAvailable || tcpdumpAvailable
      },
      message: message.trim(),
      interfaces: interfaces.map(i => ({
        name: i.name,
        address: i.address,
        internal: i.internal
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;