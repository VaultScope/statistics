'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { apiCall } from '@/lib/api';
import { Play, Square, Trash2, RefreshCw, Network } from 'lucide-react';
import LoadingScreen from '@/components/loading-screen';

interface NetworkPacket {
  timestamp: string;
  length: number;
  linkType: string;
  ethernet?: {
    srcMac: string;
    dstMac: string;
    ethertype: number;
  };
}

export default function NetworkPage() {
  const params = useParams();
  const [isSniffing, setIsSniffing] = useState(false);
  const [packets, setPackets] = useState<NetworkPacket[]>([]);
  const [loading, setLoading] = useState(true);
  const [node, setNode] = useState<any>(null);
  const [interfaceName, setInterfaceName] = useState('eth0');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [loadingStatus, setLoadingStatus] = useState({
    message: 'Initializing network monitor...',
    progress: 0,
    total: 3
  });

  useEffect(() => {
    async function init() {
      setLoadingStatus({ message: 'Connecting to node...', progress: 1, total: 3 });
      const nodeRes = await fetch(`/api/nodes/${params.id}`);
      if (nodeRes.ok) {
        const nodeData = await nodeRes.json();
        setNode(nodeData);
        setLoadingStatus({ message: 'Loading network data...', progress: 2, total: 3 });
        await fetchLogs(nodeData);
        setLoadingStatus({ message: 'Complete!', progress: 3, total: 3 });
        setTimeout(() => setLoading(false), 300);
      } else {
        setLoading(false);
      }
    }
    init();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [params.id]);

  const fetchLogs = async (nodeData?: any) => {
    const n = nodeData || node;
    if (!n) return;
    
    const result = await apiCall<NetworkPacket[]>(n.url, '/network/sniffer/logs', n.apiKey);
    if (result.data) {
      setPackets(result.data);
    }
  };

  const handleStartStop = async () => {
    if (!node) return;
    
    setLoading(true);
    
    if (isSniffing) {
      const result = await apiCall(node.url, '/network/sniffer/stop', node.apiKey, {
        method: 'POST'
      });
      
      if (!result.error) {
        setIsSniffing(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        alert(`Failed to stop sniffer: ${result.error}`);
      }
    } else {
      const result = await apiCall(node.url, '/network/sniffer/start', node.apiKey, {
        method: 'POST',
        body: JSON.stringify({ interface: interfaceName })
      });
      
      if (!result.error) {
        setIsSniffing(true);
        intervalRef.current = setInterval(() => fetchLogs(), 2000);
      } else {
        alert(`Failed to start sniffer: ${result.error}`);
      }
    }
    
    setLoading(false);
  };

  const handleClearLogs = async () => {
    if (!node) return;
    
    const result = await apiCall(node.url, '/network/sniffer/logs', node.apiKey, {
      method: 'DELETE'
    });
    
    if (!result.error) {
      setPackets([]);
    } else {
      alert(`Failed to clear logs: ${result.error}`);
    }
  };

  if (loading) return (
    <LoadingScreen
      title="Loading Network Monitor"
      message={loadingStatus.message}
      progress={loadingStatus.progress}
      total={loadingStatus.total}
      icon={Network}
    />
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Network Monitor</h1>
        <div className="flex items-center space-x-4">
          {!isSniffing && (
            <input
              type="text"
              value={interfaceName}
              onChange={(e) => setInterfaceName(e.target.value)}
              placeholder="Interface (e.g., eth0)"
              className="px-3 py-2 bg-input border border-border rounded-lg"
            />
          )}
          <button
            onClick={() => fetchLogs()}
            className="p-2 bg-secondary hover:bg-muted rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleClearLogs}
            className="p-2 bg-secondary hover:bg-muted rounded-lg transition-colors"
            title="Clear Logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleStartStop}
            disabled={loading}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isSniffing 
                ? 'bg-destructive hover:bg-destructive/90 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isSniffing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{loading ? 'Processing...' : isSniffing ? 'Stop Scanning' : 'Start Scanning'}</span>
          </button>
        </div>
      </div>
      
      <div className="bg-card border border-border rounded-25 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <p className="text-sm text-muted-foreground">
            {packets.length} packets captured {isSniffing && '(Live)'}
          </p>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Timestamp</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Length</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Type</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Source MAC</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Dest MAC</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Ethertype</th>
              </tr>
            </thead>
            <tbody>
              {packets.map((packet, index) => (
                <tr key={index} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-3 text-sm font-mono">
                    {new Date(packet.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-3 text-sm">{packet.length}</td>
                  <td className="px-6 py-3 text-sm">{packet.linkType}</td>
                  <td className="px-6 py-3 text-sm font-mono">{packet.ethernet?.srcMac || '-'}</td>
                  <td className="px-6 py-3 text-sm font-mono">{packet.ethernet?.dstMac || '-'}</td>
                  <td className="px-6 py-3 text-sm">
                    {packet.ethernet?.ethertype ? `0x${packet.ethernet.ethertype.toString(16)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {packets.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No packets captured yet. Start scanning to monitor network traffic.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}