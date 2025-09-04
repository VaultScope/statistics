'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api';
import { Activity, Clock, CheckCircle, XCircle, TrendingUp, RefreshCw, Trash2, Filter, FileText } from 'lucide-react';
import LoadingScreen from '@/components/loading-screen';

interface ApiLog {
  id: string;
  apiKeyId: string;
  apiKeyName: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  responseTime?: number;
}

interface ApiKeyStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date | null;
  requestsPerDay: { [date: string]: number };
}

export default function LogsPage() {
  const params = useParams();
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ApiLog[]>([]);
  const [stats, setStats] = useState<{ [key: string]: ApiKeyStats }>({});
  const [loading, setLoading] = useState(true);
  const [node, setNode] = useState<any>(null);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('all');
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loadingStatus, setLoadingStatus] = useState({
    message: 'Initializing...',
    progress: 0,
    total: 4
  });

  const fetchData = async () => {
    setLoading(true);
    setLoadingStatus({ message: 'Connecting to node...', progress: 1, total: 4 });
    
    try {
      const nodeRes = await fetch(`/api/nodes/${params.id}`);
      if (!nodeRes.ok) return;
      
      const nodeData = await nodeRes.json();
      setNode(nodeData);
      
      setLoadingStatus({ message: 'Fetching API logs...', progress: 2, total: 4 });
      
      // Fetch logs and API keys
      const [logsResult, keysResult] = await Promise.all([
        apiCall<ApiLog[]>(nodeData.url, '/api/logs?limit=500', nodeData.apiKey),
        apiCall<any[]>(nodeData.url, '/api/keys', nodeData.apiKey)
      ]);
      
      if (logsResult.data) {
        setLogs(logsResult.data);
        setFilteredLogs(logsResult.data);
      }
      
      if (keysResult.data) {
        setApiKeys(keysResult.data);
        
        setLoadingStatus({ message: 'Calculating statistics...', progress: 3, total: 4 });
        
        // Fetch stats for each API key
        const statsPromises = keysResult.data.map(key => 
          apiCall<ApiKeyStats>(nodeData.url, `/api/logs/stats/${key.uuid}`, nodeData.apiKey)
        );
        
        const statsResults = await Promise.all(statsPromises);
        const statsMap: { [key: string]: ApiKeyStats } = {};
        
        keysResult.data.forEach((key, index) => {
          if (statsResults[index].data) {
            statsMap[key.uuid] = statsResults[index].data;
          }
        });
        
        setStats(statsMap);
      }
      
      setLoadingStatus({ message: 'Complete!', progress: 4, total: 4 });
      setTimeout(() => setLoading(false), 300);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [params.id]);

  useEffect(() => {
    if (selectedApiKey === 'all') {
      setFilteredLogs(logs);
    } else {
      setFilteredLogs(logs.filter(log => log.apiKeyId === selectedApiKey));
    }
  }, [selectedApiKey, logs]);

  const clearLogs = async (apiKeyId?: string) => {
    if (!confirm(`Clear ${apiKeyId ? 'logs for this API key' : 'all logs'}?`)) return;
    
    const queryParam = apiKeyId ? `?apiKeyId=${apiKeyId}` : '';
    await apiCall(node.url, `/api/logs${queryParam}`, node.apiKey, {
      method: 'DELETE'
    });
    
    fetchData();
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'text-green-500';
    if (statusCode >= 400 && statusCode < 500) return 'text-yellow-500';
    if (statusCode >= 500) return 'text-red-500';
    return 'text-gray-500';
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-500/10 text-blue-500';
      case 'POST': return 'bg-green-500/10 text-green-500';
      case 'PUT': return 'bg-yellow-500/10 text-yellow-500';
      case 'DELETE': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  if (loading) return (
    <LoadingScreen
      title="Loading API Logs"
      message={loadingStatus.message}
      progress={loadingStatus.progress}
      total={loadingStatus.total}
      icon={FileText}
    />
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">API Logs</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => clearLogs()}
            className="flex items-center space-x-2 px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All</span>
          </button>
          <button
            onClick={fetchData}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Always show all keys */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {apiKeys.map(key => {
          const keyStats = stats[key.uuid];
          if (!keyStats) return null;
          
          const isSelected = selectedApiKey === key.uuid;
          
          return (
            <div 
              key={key.uuid} 
              className={`bg-card border ${isSelected ? 'border-primary' : 'border-border'} rounded-25 p-4 cursor-pointer hover:border-primary/50 transition-colors`}
              onClick={() => setSelectedApiKey(key.uuid)}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{key.name}</h3>
                  <p className="text-sm text-muted-foreground">Total: {keyStats.totalRequests}</p>
                </div>
                <Activity className="w-5 h-5 text-muted-foreground" />
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>Success</span>
                  </span>
                  <span>{keyStats.successfulRequests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <XCircle className="w-3 h-3 text-red-500" />
                    <span>Failed</span>
                  </span>
                  <span>{keyStats.failedRequests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span>Avg Time</span>
                  </span>
                  <span>{keyStats.averageResponseTime.toFixed(0)}ms</span>
                </div>
              </div>
              
              {keyStats.lastUsed && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last used: {new Date(keyStats.lastUsed).toLocaleString()}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-4">
        <Filter className="w-5 h-5 text-muted-foreground" />
        <select
          value={selectedApiKey}
          onChange={(e) => setSelectedApiKey(e.target.value)}
          className="px-4 py-2 bg-secondary border border-border rounded-25 focus:outline-none focus:border-primary hover:bg-secondary/80 transition-colors"
        >
          <option value="all">All API Keys</option>
          {apiKeys.map(key => (
            <option key={key.uuid} value={key.uuid}>{key.name}</option>
          ))}
        </select>
        {selectedApiKey !== 'all' && (
          <button
            onClick={() => clearLogs(selectedApiKey)}
            className="text-sm text-destructive hover:underline"
          >
            Clear logs for this key
          </button>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-card border border-border rounded-25 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Time</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">API Key</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Method</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Endpoint</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Response Time</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4 text-sm">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium">{log.apiKeyName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded ${getMethodColor(log.method)}`}>
                      {log.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono">{log.endpoint}</td>
                  <td className="px-6 py-4">
                    <span className={`font-semibold ${getStatusColor(log.statusCode)}`}>
                      {log.statusCode}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {log.responseTime ? `${log.responseTime}ms` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No logs found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}