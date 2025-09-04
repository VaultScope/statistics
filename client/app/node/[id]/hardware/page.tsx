'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api';
import { Cpu, HardDrive, MemoryStick, CircuitBoard, Monitor, Computer } from 'lucide-react';

interface HardwareData {
  cpu: any;
  gpu: any[];
  disk: any[];
  ram: any;
  mainboard: any;
  os: any;
}

interface LoadingStatus {
  current: string;
  progress: number;
  total: number;
}

export default function HardwarePage() {
  const params = useParams();
  const [data, setData] = useState<HardwareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({
    current: 'Initializing...',
    progress: 0,
    total: 7
  });

  useEffect(() => {
    async function fetchData() {
      setLoadingStatus({ current: 'Connecting to node...', progress: 0, total: 7 });
      
      const nodeRes = await fetch(`/api/nodes/${params.id}`);
      if (!nodeRes.ok) {
        setError('Failed to load node');
        setLoading(false);
        return;
      }
      
      const node = await nodeRes.json();
      setLoadingStatus({ current: 'Connected to node', progress: 1, total: 7 });
      
      const endpoints = [
        { url: '/data/cpu', name: 'CPU information' },
        { url: '/data/gpu', name: 'Graphics cards' },
        { url: '/data/disk', name: 'Storage devices' },
        { url: '/data/ram', name: 'Memory modules' },
        { url: '/data/mainboard', name: 'Motherboard details' },
        { url: '/data/os', name: 'Operating system' }
      ];
      
      const results: any[] = [];
      
      for (let i = 0; i < endpoints.length; i++) {
        setLoadingStatus({
          current: `Loading ${endpoints[i].name}...`,
          progress: i + 2,
          total: 7
        });
        
        const result = await apiCall(node.url, endpoints[i].url, node.apiKey);
        results.push(result);
        
        // Small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setData({
        cpu: results[0].data,
        gpu: results[1].data,
        disk: results[2].data,
        ram: results[3].data,
        mainboard: results[4].data,
        os: results[5].data
      });
      
      setLoadingStatus({ current: 'Complete!', progress: 7, total: 7 });
      
      // Short delay before hiding loading screen
      setTimeout(() => {
        setLoading(false);
      }, 300);
    }
    
    fetchData();
  }, [params.id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-primary/10">
            <Computer className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Loading Hardware Information</h2>
          <p className="text-muted-foreground">{loadingStatus.current}</p>
        </div>
        
        <div className="space-y-4">
          <div className="relative">
            <div className="flex mb-2 items-center justify-between">
              <span className="text-xs font-semibold inline-block text-primary">
                Progress
              </span>
              <span className="text-xs font-semibold inline-block text-primary">
                {Math.round((loadingStatus.progress / loadingStatus.total) * 100)}%
              </span>
            </div>
            <div className="overflow-hidden h-2 text-xs flex rounded-full bg-secondary">
              <div
                style={{ width: `${(loadingStatus.progress / loadingStatus.total) * 100}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-6">
            {[
              { icon: Cpu, label: 'CPU', done: loadingStatus.progress > 1 },
              { icon: Monitor, label: 'GPU', done: loadingStatus.progress > 2 },
              { icon: HardDrive, label: 'Storage', done: loadingStatus.progress > 3 },
              { icon: MemoryStick, label: 'Memory', done: loadingStatus.progress > 4 },
              { icon: CircuitBoard, label: 'Mainboard', done: loadingStatus.progress > 5 },
              { icon: Computer, label: 'OS', done: loadingStatus.progress > 6 }
            ].map(({ icon: Icon, label, done }) => (
              <div
                key={label}
                className={`flex items-center space-x-2 p-2 rounded-lg transition-all ${
                  done ? 'bg-primary/10 text-primary' : 'bg-secondary/50 text-muted-foreground'
                }`}
              >
                <Icon className={`w-4 h-4 ${done ? 'animate-none' : loadingStatus.current.includes(label.toLowerCase()) ? 'animate-spin' : ''}`} />
                <span className="text-sm">{label}</span>
                {done && (
                  <svg className="w-4 h-4 ml-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
  if (error || !data) return <div className="p-8 text-red-500">{error || 'Failed to load data'}</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold mb-6">Hardware Information</h1>
      
      <div className="bg-card border border-border rounded-25 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Cpu className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">CPU</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Manufacturer:</span> {data.cpu?.manufacturer}</div>
          <div><span className="text-muted-foreground">Brand:</span> {data.cpu?.brand}</div>
          <div><span className="text-muted-foreground">Speed:</span> {data.cpu?.speed} GHz</div>
          <div><span className="text-muted-foreground">Cores:</span> {data.cpu?.cores}</div>
          <div><span className="text-muted-foreground">Physical Cores:</span> {data.cpu?.physicalCores}</div>
          <div><span className="text-muted-foreground">Processors:</span> {data.cpu?.processors}</div>
          <div><span className="text-muted-foreground">Socket:</span> {data.cpu?.socket}</div>
          <div><span className="text-muted-foreground">Virtualization:</span> {data.cpu?.virtualization ? 'Yes' : 'No'}</div>
          {data.cpu?.cache && (
            <>
              <div><span className="text-muted-foreground">L1D Cache:</span> {data.cpu.cache.l1d / 1024} KB</div>
              <div><span className="text-muted-foreground">L1I Cache:</span> {data.cpu.cache.l1i / 1024} KB</div>
              <div><span className="text-muted-foreground">L2 Cache:</span> {data.cpu.cache.l2 / 1024} KB</div>
              <div><span className="text-muted-foreground">L3 Cache:</span> {data.cpu.cache.l3 / 1024 / 1024} MB</div>
            </>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-25 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Monitor className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Graphics Cards ({data.gpu?.length || 0})</h2>
        </div>
        {data.gpu && Array.isArray(data.gpu) && data.gpu.length > 0 ? (
          data.gpu.map((gpu: any, index: number) => (
            <div key={index} className={`${index > 0 ? 'mt-4 pt-4 border-t border-border' : ''}`}>
              <h3 className="font-medium mb-2">
                {gpu.vendor === 'Intel' || gpu.model?.toLowerCase().includes('intel') ? 'Integrated GPU' : `GPU ${index + 1}`}
                {gpu.name && ` - ${gpu.name}`}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Vendor:</span> {gpu.vendor || 'Unknown'}</div>
                <div><span className="text-muted-foreground">Model:</span> {gpu.model || 'Unknown'}</div>
                {gpu.bus && <div><span className="text-muted-foreground">Bus:</span> {gpu.bus}</div>}
                {gpu.vram !== undefined && <div><span className="text-muted-foreground">VRAM:</span> {gpu.vram} MB</div>}
                {gpu.vramDynamic !== undefined && <div><span className="text-muted-foreground">Dynamic VRAM:</span> {gpu.vramDynamic ? 'Yes' : 'No'}</div>}
                {gpu.subDeviceId && <div><span className="text-muted-foreground">Device ID:</span> {gpu.subDeviceId}</div>}
                {gpu.driverVersion && <div><span className="text-muted-foreground">Driver:</span> {gpu.driverVersion}</div>}
                {gpu.temperatureGpu !== undefined && <div><span className="text-muted-foreground">Temperature:</span> {gpu.temperatureGpu}°C</div>}
                {gpu.utilizationGpu !== undefined && <div><span className="text-muted-foreground">GPU Usage:</span> {gpu.utilizationGpu}%</div>}
                {gpu.utilizationMemory !== undefined && <div><span className="text-muted-foreground">Memory Usage:</span> {gpu.utilizationMemory}%</div>}
                {gpu.fanSpeed !== undefined && <div><span className="text-muted-foreground">Fan Speed:</span> {gpu.fanSpeed} RPM</div>}
                {gpu.powerDraw !== undefined && <div><span className="text-muted-foreground">Power Draw:</span> {gpu.powerDraw}W</div>}
                {gpu.powerLimit !== undefined && <div><span className="text-muted-foreground">Power Limit:</span> {gpu.powerLimit}W</div>}
                {gpu.clockCore !== undefined && <div><span className="text-muted-foreground">Core Clock:</span> {gpu.clockCore} MHz</div>}
                {gpu.clockMemory !== undefined && <div><span className="text-muted-foreground">Memory Clock:</span> {gpu.clockMemory} MHz</div>}
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No GPU information available</div>
        )}
      </div>

      <div className="bg-card border border-border rounded-25 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <MemoryStick className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Memory</h2>
        </div>
        
        <div className="mb-4">
          <h3 className="font-medium mb-2">System Memory Usage</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Total:</span> {(data.ram?.total / 1024 / 1024 / 1024).toFixed(2)} GB</div>
            <div><span className="text-muted-foreground">Free:</span> {(data.ram?.free / 1024 / 1024 / 1024).toFixed(2)} GB</div>
            <div><span className="text-muted-foreground">Used:</span> {(data.ram?.used / 1024 / 1024 / 1024).toFixed(2)} GB</div>
            <div><span className="text-muted-foreground">Active:</span> {(data.ram?.active / 1024 / 1024 / 1024).toFixed(2)} GB</div>
            {data.ram?.available !== undefined && (
              <div><span className="text-muted-foreground">Available:</span> {(data.ram.available / 1024 / 1024 / 1024).toFixed(2)} GB</div>
            )}
            {data.ram?.swaptotal !== undefined && data.ram.swaptotal > 0 && (
              <>
                <div><span className="text-muted-foreground">Swap Total:</span> {(data.ram.swaptotal / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                <div><span className="text-muted-foreground">Swap Used:</span> {(data.ram.swapused / 1024 / 1024 / 1024).toFixed(2)} GB</div>
              </>
            )}
          </div>
        </div>
        
        {data.ram?.layout && Array.isArray(data.ram.layout) && data.ram.layout.length > 0 && (
          <div>
            <h3 className="font-medium mb-2">Physical Memory Modules ({data.ram.layout.length})</h3>
            <div className="space-y-3">
              {data.ram.layout.map((module: any, index: number) => (
                <div key={index} className={`text-sm ${index > 0 ? 'pt-3 border-t border-border' : ''}`}>
                  <div className="font-medium mb-1">Slot {index + 1}{module.bank ? ` (Bank ${module.bank})` : ''}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Size:</span> {(module.size / 1024 / 1024 / 1024).toFixed(0)} GB</div>
                    <div><span className="text-muted-foreground">Type:</span> {module.type || 'Unknown'}</div>
                    {module.clockSpeed && <div><span className="text-muted-foreground">Speed:</span> {module.clockSpeed} MHz</div>}
                    {module.formFactor && <div><span className="text-muted-foreground">Form:</span> {module.formFactor}</div>}
                    {module.manufacturer && <div><span className="text-muted-foreground">Manufacturer:</span> {module.manufacturer}</div>}
                    {module.partNum && <div><span className="text-muted-foreground">Part #:</span> {module.partNum}</div>}
                    {module.serialNum && <div><span className="text-muted-foreground">Serial:</span> {module.serialNum}</div>}
                    {module.voltageConfigured && <div><span className="text-muted-foreground">Voltage:</span> {module.voltageConfigured}V</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-25 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <HardDrive className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Storage</h2>
        </div>
        {data.disk?.map((disk: any, index: number) => (
          <div key={index} className="mb-4 last:mb-0">
            <h3 className="font-medium mb-2">Disk {index + 1}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Device:</span> {disk.device}</div>
              <div><span className="text-muted-foreground">Type:</span> {disk.type}</div>
              <div><span className="text-muted-foreground">Name:</span> {disk.name}</div>
              <div><span className="text-muted-foreground">Vendor:</span> {disk.vendor}</div>
              <div><span className="text-muted-foreground">Size:</span> {(disk.size / 1024 / 1024 / 1024).toFixed(2)} GB</div>
              <div><span className="text-muted-foreground">Interface:</span> {disk.interfaceType}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-25 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <CircuitBoard className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Mainboard</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Manufacturer:</span> {data.mainboard?.manufacturer}</div>
          <div><span className="text-muted-foreground">Model:</span> {data.mainboard?.model}</div>
          <div><span className="text-muted-foreground">Version:</span> {data.mainboard?.version}</div>
          <div><span className="text-muted-foreground">Serial:</span> {data.mainboard?.serial || 'N/A'}</div>
          {data.mainboard?.bios && (
            <>
              <div><span className="text-muted-foreground">BIOS Vendor:</span> {data.mainboard.bios.vendor}</div>
              <div><span className="text-muted-foreground">BIOS Version:</span> {data.mainboard.bios.version}</div>
            </>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-25 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Computer className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Operating System</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Platform:</span> {data.os?.platform}</div>
          <div><span className="text-muted-foreground">Distribution:</span> {data.os?.distro}</div>
          <div><span className="text-muted-foreground">Release:</span> {data.os?.release}</div>
          <div><span className="text-muted-foreground">Codename:</span> {data.os?.codename}</div>
          <div><span className="text-muted-foreground">Kernel:</span> {data.os?.kernel}</div>
          <div><span className="text-muted-foreground">Architecture:</span> {data.os?.arch}</div>
          <div><span className="text-muted-foreground">Hostname:</span> {data.os?.hostname}</div>
          <div><span className="text-muted-foreground">FQDN:</span> {data.os?.fqdn}</div>
        </div>
      </div>
    </div>
  );
}