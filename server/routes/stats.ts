import { Router } from 'express';
import * as si from 'systeminformation';
import psList from 'ps-list';

const router = Router();

// Main stats endpoint
router.get('/', async (req, res) => {
  try {
    const [cpu, mem, disk, network, os, time] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.networkInterfaces(),
      si.osInfo(),
      si.time()
    ]);

    res.json({
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        active: mem.active,
        available: mem.available,
        usage: ((mem.used / mem.total) * 100).toFixed(2)
      },
      disk: disk.map(d => ({
        fs: d.fs,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        use: d.use,
        mount: d.mount
      })),
      network: network.filter(n => !n.internal).map(n => ({
        iface: n.iface,
        ip4: n.ip4,
        ip6: n.ip6,
        mac: n.mac,
        type: n.type,
        speed: n.speed
      })),
      os: {
        platform: os.platform,
        distro: os.distro,
        release: os.release,
        kernel: os.kernel,
        arch: os.arch,
        hostname: os.hostname
      },
      uptime: time.uptime
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch system stats', message: error.message });
  }
});

// CPU endpoint
router.get('/cpu', async (req, res) => {
  try {
    const [cpu, cpuCurrentSpeed, cpuTemperature, currentLoad] = await Promise.all([
      si.cpu(),
      si.cpuCurrentSpeed(),
      si.cpuTemperature(),
      si.currentLoad()
    ]);

    res.json({
      info: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        vendor: cpu.vendor,
        family: cpu.family,
        model: cpu.model,
        stepping: cpu.stepping,
        revision: cpu.revision,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        processors: cpu.processors,
        socket: cpu.socket
      },
      speed: {
        min: cpuCurrentSpeed.min,
        max: cpuCurrentSpeed.max,
        avg: cpuCurrentSpeed.avg,
        cores: cpuCurrentSpeed.cores
      },
      temperature: {
        main: cpuTemperature.main,
        cores: cpuTemperature.cores,
        max: cpuTemperature.max
      },
      load: {
        avgLoad: currentLoad.avgLoad,
        currentLoad: currentLoad.currentLoad,
        currentLoadUser: currentLoad.currentLoadUser,
        currentLoadSystem: currentLoad.currentLoadSystem,
        cpus: currentLoad.cpus
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch CPU stats', message: error.message });
  }
});

// RAM endpoint
router.get('/ram', async (req, res) => {
  try {
    const [mem, memLayout] = await Promise.all([
      si.mem(),
      si.memLayout()
    ]);

    res.json({
      usage: {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        active: mem.active,
        available: mem.available,
        buffers: mem.buffers,
        cached: mem.cached,
        slab: mem.slab,
        buffcache: mem.buffcache,
        swaptotal: mem.swaptotal,
        swapused: mem.swapused,
        swapfree: mem.swapfree,
        usage: ((mem.used / mem.total) * 100).toFixed(2)
      },
      layout: memLayout.map(m => ({
        size: m.size,
        bank: m.bank,
        type: m.type,
        clockSpeed: m.clockSpeed,
        formFactor: m.formFactor,
        manufacturer: m.manufacturer,
        partNum: m.partNum,
        serialNum: m.serialNum,
        voltageConfigured: m.voltageConfigured,
        voltageMin: m.voltageMin,
        voltageMax: m.voltageMax
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch RAM stats', message: error.message });
  }
});

// Disk endpoint
router.get('/disk', async (req, res) => {
  try {
    const [fsSize, blockDevices, disksIO] = await Promise.all([
      si.fsSize(),
      si.blockDevices(),
      si.disksIO()
    ]);

    res.json({
      filesystems: fsSize.map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        use: fs.use,
        mount: fs.mount
      })),
      devices: blockDevices.map(dev => ({
        name: dev.name,
        type: dev.type,
        fsType: dev.fsType,
        mount: dev.mount,
        size: dev.size,
        physical: dev.physical,
        uuid: dev.uuid,
        label: dev.label,
        model: dev.model,
        serial: dev.serial,
        removable: dev.removable,
        protocol: dev.protocol
      })),
      io: {
        rIO: disksIO.rIO,
        wIO: disksIO.wIO,
        tIO: disksIO.tIO,
        rIOSec: disksIO.rIO_sec,
        wIOSec: disksIO.wIO_sec,
        tIOSec: disksIO.tIO_sec,
        msActive: disksIO.ms
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch disk stats', message: error.message });
  }
});

// Network endpoint
router.get('/network', async (req, res) => {
  try {
    const [networkInterfaces, networkStats, networkConnections] = await Promise.all([
      si.networkInterfaces(),
      si.networkStats(),
      si.networkConnections()
    ]);

    res.json({
      interfaces: networkInterfaces.map(iface => ({
        iface: iface.iface,
        ifaceName: iface.ifaceName,
        ip4: iface.ip4,
        ip4subnet: iface.ip4subnet,
        ip6: iface.ip6,
        ip6subnet: iface.ip6subnet,
        mac: iface.mac,
        internal: iface.internal,
        virtual: iface.virtual,
        operstate: iface.operstate,
        type: iface.type,
        duplex: iface.duplex,
        mtu: iface.mtu,
        speed: iface.speed,
        dhcp: iface.dhcp,
        dnsSuffix: iface.dnsSuffix,
        ieee8021xAuth: iface.ieee8021xAuth,
        ieee8021xState: iface.ieee8021xState,
        carrier_changes: iface.carrierChanges
      })),
      stats: networkStats.map(stat => ({
        iface: stat.iface,
        operstate: stat.operstate,
        rx_bytes: stat.rx_bytes,
        rx_dropped: stat.rx_dropped,
        rx_errors: stat.rx_errors,
        tx_bytes: stat.tx_bytes,
        tx_dropped: stat.tx_dropped,
        tx_errors: stat.tx_errors,
        rx_sec: stat.rx_sec,
        tx_sec: stat.tx_sec,
        ms: stat.ms
      })),
      connections: networkConnections.map(conn => ({
        protocol: conn.protocol,
        localAddress: conn.localAddress,
        localPort: conn.localPort,
        peerAddress: conn.peerAddress,
        peerPort: conn.peerPort,
        state: conn.state,
        pid: conn.pid,
        process: conn.process
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch network stats', message: error.message });
  }
});

// Process endpoint
router.get('/process', async (req, res) => {
  try {
    const processes = await psList();
    
    const sortedProcesses = processes
      .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
      .slice(0, 50)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu,
        memory: p.memory,
        ppid: p.ppid,
        uid: p.uid,
        cmd: p.cmd
      }));

    res.json({
      total: processes.length,
      top50: sortedProcesses
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch process list', message: error.message });
  }
});

export default router;