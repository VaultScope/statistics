'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { apiCall } from '@/lib/api';
import { Cpu, HardDrive, MemoryStick, Network, Activity, TrendingUp, TrendingDown, Gauge, Server } from 'lucide-react';
import { UsagePieChart, NetworkKPIChart } from '@/components/charts';
import LoadingScreen from '@/components/loading-screen';

interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
    speed: number;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network: {
    interfaces: any[];
    stats: any[];
  };
  disk: {
    devices: any[];
  };
  uptime: number;
}

interface NetworkSpeedHistory {
  time: string;
  inbound: number;
  outbound: number;
}

export default function NodeOverviewPage() {
  const params = useParams();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [node, setNode] = useState<any>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [networkHistory, setNetworkHistory] = useState<NetworkSpeedHistory[]>([]);
  const [loadingStatus, setLoadingStatus] = useState({
    message: 'Connecting to node...',
    progress: 0,
    total: 7
  });

  const fetchStats = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoadingStatus({ message: 'Fetching node details...', progress: 1, total: 7 });
      }
      
      const nodeRes = await fetch(`/api/nodes/${params.id}`);
      if (!nodeRes.ok) return;
      
      const nodeData = await nodeRes.json();
      setNode(nodeData);
      
      if (isInitial) {
        setLoadingStatus({ message: 'Loading system metrics...', progress: 2, total: 7 });
      }
      
      // Fetch current usage stats
      if (isInitial) {
        setLoadingStatus({ message: 'Loading CPU metrics...', progress: 3, total: 7 });
      }
      
      const [cpuLoad, mem, networkStats, networkTraffic, diskStats, time] = await Promise.all([
        apiCall(nodeData.url, '/stats/cpu', nodeData.apiKey),
        apiCall(nodeData.url, '/data/ram', nodeData.apiKey),
        apiCall(nodeData.url, '/stats/network', nodeData.apiKey),
        apiCall(nodeData.url, '/stats/network/traffic', nodeData.apiKey, {
          headers: { 'X-Client-Id': `node-${params.id}` }
        }),
        apiCall(nodeData.url, '/stats/disk', nodeData.apiKey),
        apiCall(nodeData.url, '/stats/time', nodeData.apiKey)
      ]);
      
      if (isInitial) {
        setLoadingStatus({ message: 'Processing metrics...', progress: 6, total: 7 });
      }
      
      const newStats = {
        cpu: cpuLoad.data || { usage: 0, cores: 0, speed: 0 },
        memory: {
          total: mem.data?.total || 0,
          used: mem.data?.used || 0,
          free: mem.data?.free || 0,
          percentage: mem.data ? (mem.data.used / mem.data.total * 100) : 0
        },
        network: {
          interfaces: networkStats.data?.interfaces || [],
          stats: networkStats.data?.stats || []
        },
        disk: {
          devices: diskStats.data || []
        },
        uptime: time.data?.uptime || 0
      };
      
      setStats(newStats);
      
      // Use the new traffic endpoint data
      const currentTime = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
      });
      
      if (networkTraffic.data) {
        setNetworkHistory(prev => {
          const newHistory = [...prev, {
            time: currentTime,
            inbound: networkTraffic.data.rx_mbps || 0,
            outbound: networkTraffic.data.tx_mbps || 0
          }];
          return newHistory.slice(-20); // Keep last 20 data points
        });
      }
      
      if (isInitial) {
        setLoadingStatus({ message: 'Complete!', progress: 7, total: 7 });
        setTimeout(() => setLoading(false), 300);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(true);
    const interval = setInterval(() => fetchStats(false), 5000); // Refresh every 5 seconds
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [params.id]);

  if (loading) return (
    <LoadingScreen
      title="Loading Node Overview"
      message={loadingStatus.message}
      progress={loadingStatus.progress}
      total={loadingStatus.total}
      icon={Server}
      steps={[
        { icon: Server, label: 'Node', done: loadingStatus.progress > 1 },
        { icon: Cpu, label: 'CPU', done: loadingStatus.progress > 2 },
        { icon: MemoryStick, label: 'Memory', done: loadingStatus.progress > 3 },
        { icon: Network, label: 'Network', done: loadingStatus.progress > 4 },
        { icon: HardDrive, label: 'Storage', done: loadingStatus.progress > 5 },
        { icon: Activity, label: 'Metrics', done: loadingStatus.progress > 6 },
      ]}
    />
  );
  if (!stats) return <div className="p-8 text-red-500">Failed to load stats</div>;

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / 1024 / 1024 / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">System Overview</h1>
        <div className="text-sm text-muted-foreground">
          Uptime: {formatUptime(stats.uptime)}
        </div>
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CPU Usage Pie Chart */}
        <div className="bg-card border border-border rounded-25 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Cpu className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">CPU Usage</span>
          </div>
          <UsagePieChart
            data={[
              { name: 'Used', value: stats.cpu.usage || 0, color: '#ef4444' },
              { name: 'Free', value: 100 - (stats.cpu.usage || 0), color: '#262626' }
            ]}
            title=""
            centerText={`${(stats.cpu.usage || 0).toFixed(1)}%`}
          />
          <div className="text-sm text-muted-foreground text-center mt-2">
            {stats.cpu.cores} cores @ {stats.cpu.speed?.toFixed(2) || 0} GHz
            {stats.cpu.temperature && ` • ${stats.cpu.temperature}°C`}
          </div>
        </div>
        
        {/* Memory Usage Pie Chart */}
        <div className="bg-card border border-border rounded-25 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <MemoryStick className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">Memory Usage</span>
          </div>
          <UsagePieChart
            data={[
              { name: 'Used', value: stats.memory.percentage || 0, color: '#3b82f6' },
              { name: 'Free', value: 100 - (stats.memory.percentage || 0), color: '#262626' }
            ]}
            title=""
            centerText={`${stats.memory.percentage.toFixed(1)}%`}
          />
          <div className="text-sm text-muted-foreground text-center mt-2">
            {formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}
          </div>
        </div>
        
        {/* Disk Usage Info */}
        <div className="bg-card border border-border rounded-25 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <HardDrive className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">Storage Overview</span>
          </div>
          <div className="space-y-3 mt-8">
            {stats.disk.devices?.slice(0, 3).map((disk: any, index: number) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground truncate max-w-[150px]">{disk.fs}</span>
                  <span className="font-medium">{disk.use}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full"
                    style={{ width: `${disk.use}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatBytes(disk.used)} / {formatBytes(disk.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Network Chart */}
      <div className="bg-card border border-border rounded-25 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Network className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">Network Traffic</span>
        </div>
        <NetworkKPIChart data={networkHistory} />
      </div>
      
      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Interfaces */}
        <div className="bg-card border border-border rounded-25 p-6">
          <h2 className="text-lg font-semibold mb-4">Network Interfaces</h2>
          <div className="space-y-3">
            {stats.network.interfaces?.map((iface: any, index: number) => (
              <div key={index} className="text-sm">
                <div className="font-medium">{iface.iface}</div>
                <div className="text-muted-foreground">
                  IP: {iface.ip4 || 'N/A'} | MAC: {iface.mac || 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Disk Devices */}
        <div className="bg-card border border-border rounded-25 p-6">
          <h2 className="text-lg font-semibold mb-4">Storage Devices</h2>
          <div className="space-y-3">
            {stats.disk.devices?.map((disk: any, index: number) => (
              <div key={index} className="text-sm">
                <div className="font-medium">{disk.fs}</div>
                <div className="text-muted-foreground">
                  {formatBytes(disk.used)} / {formatBytes(disk.size)} ({disk.use}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}