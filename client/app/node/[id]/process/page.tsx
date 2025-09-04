'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api';
import { X, RefreshCw, Search, Cpu } from 'lucide-react';
import LoadingScreen from '@/components/loading-screen';

interface Process {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}

export default function ProcessPage() {
  const params = useParams();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<Process[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [node, setNode] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState({
    message: 'Connecting to node...',
    progress: 0,
    total: 3
  });

  const fetchProcesses = async () => {
    setLoading(true);
    setLoadingStatus({ message: 'Fetching node details...', progress: 1, total: 3 });
    
    const nodeRes = await fetch(`/api/nodes/${params.id}`);
    if (!nodeRes.ok) {
      setLoading(false);
      return;
    }
    
    const nodeData = await nodeRes.json();
    setNode(nodeData);
    
    setLoadingStatus({ message: 'Loading process list...', progress: 2, total: 3 });
    
    const result = await apiCall<Process[]>(nodeData.url, '/processes', nodeData.apiKey);
    if (result.data) {
      setProcesses(result.data);
      setFilteredProcesses(result.data);
    }
    
    setLoadingStatus({ message: 'Complete!', progress: 3, total: 3 });
    setTimeout(() => setLoading(false), 300);
  };

  useEffect(() => {
    fetchProcesses();
  }, [params.id]);

  useEffect(() => {
    const filtered = processes.filter(process => 
      process.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      process.pid.toString().includes(searchTerm)
    );
    setFilteredProcesses(filtered);
  }, [searchTerm, processes]);

  const handleKillProcess = async (pid: number, name: string) => {
    if (!confirm(`Kill process "${name}" (PID: ${pid})?`)) return;
    
    const result = await apiCall(
      node.url,
      '/processes/kill',
      node.apiKey,
      {
        method: 'POST',
        body: JSON.stringify({ pid })
      }
    );
    
    if (result.error) {
      alert(`Failed to kill process: ${result.error}`);
    } else {
      alert('Process killed successfully');
      fetchProcesses();
    }
  };

  if (loading) return (
    <LoadingScreen
      title="Loading Processes"
      message={loadingStatus.message}
      progress={loadingStatus.progress}
      total={loadingStatus.total}
      icon={Cpu}
    />
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Processes</h1>
        <button
          onClick={fetchProcesses}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>
      
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by process name or PID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>
      
      <div className="bg-card border border-border rounded-25 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">PID</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">CPU %</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">RAM %</th>
                <th className="text-right px-6 py-4 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.map((process) => (
                <tr key={process.pid} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4">{process.pid}</td>
                  <td className="px-6 py-4">{process.name}</td>
                  <td className="px-6 py-4">{(process.cpu || 0).toFixed(2)}%</td>
                  <td className="px-6 py-4">{(process.memory || 0).toFixed(2)}%</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleKillProcess(process.pid, process.name)}
                      className="p-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg transition-colors"
                      title="Kill Process"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}