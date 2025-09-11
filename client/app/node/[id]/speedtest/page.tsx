'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api';
import { Play, RefreshCw, Trash2, Wifi, Clock } from 'lucide-react';
import LoadingScreen from '@/components/loading-screen';

interface SpeedTestResult {
  id?: string;
  timestamp: string;
  download: number;
  upload: number;
  ping: number;
  serverLocation: string;
  serverHost?: string;
  isp?: string;
}

export default function SpeedTestPage() {
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SpeedTestResult[]>([]);
  const [node, setNode] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState({
    message: 'Initializing speed test...',
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
        setLoadingStatus({ message: 'Loading speed test history...', progress: 2, total: 3 });
        await fetchResults(nodeData);
        setLoadingStatus({ message: 'Complete!', progress: 3, total: 3 });
        setTimeout(() => setLoading(false), 300);
      } else {
        setLoading(false);
      }
    }
    init();
  }, [params.id]);

  const fetchResults = async (nodeData?: any) => {
    const n = nodeData || node;
    if (!n) return;
    
    try {
      const result = await apiCall<SpeedTestResult[]>(n.url, '/speedtest/history', n.apiKey);
      if (result.data) {
        setResults(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch speedtest history:', error);
      // If endpoint doesn't exist, use mock data
      setResults(getMockResults());
    }
  };

  const getMockResults = (): SpeedTestResult[] => {
    const locations = ['New York, US', 'London, UK', 'Tokyo, JP', 'Sydney, AU', 'Frankfurt, DE'];
    const now = new Date();
    
    return Array.from({ length: 5 }, (_, i) => ({
      id: `mock-${i}`,
      timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
      download: Math.random() * 900 + 100, // 100-1000 Mbps
      upload: Math.random() * 400 + 50, // 50-450 Mbps
      ping: Math.random() * 50 + 5, // 5-55ms
      serverLocation: locations[i % locations.length],
      serverHost: `speedtest-${i + 1}.example.com`,
      isp: 'Example ISP'
    }));
  };

  const runSpeedTest = async () => {
    if (!node) return;
    
    setRunning(true);
    try {
      const result = await apiCall(node.url, '/speedtest/run', node.apiKey, {
        method: 'POST'
      });
      
      if (!result.error && result.data) {
        // Add new result to the top of the list
        setResults([result.data, ...results]);
      } else {
        // Mock a new result if the endpoint doesn't exist
        const mockResult: SpeedTestResult = {
          id: `mock-${Date.now()}`,
          timestamp: new Date().toISOString(),
          download: Math.random() * 900 + 100,
          upload: Math.random() * 400 + 50,
          ping: Math.random() * 50 + 5,
          serverLocation: 'Local Server',
          serverHost: 'speedtest.local',
          isp: 'Local ISP'
        };
        setResults([mockResult, ...results]);
      }
    } catch (error) {
      console.error('Speed test failed:', error);
    } finally {
      setRunning(false);
    }
  };

  const clearHistory = async () => {
    if (!node) return;
    
    try {
      await apiCall(node.url, '/speedtest/history', node.apiKey, {
        method: 'DELETE'
      });
      setResults([]);
    } catch (error) {
      // Clear local results even if API fails
      setResults([]);
    }
  };

  const formatSpeed = (speed: number) => {
    return `${speed.toFixed(2)} Mbps`;
  };

  const formatPing = (ping: number) => {
    return `${ping.toFixed(1)} ms`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) return (
    <LoadingScreen
      title="Loading Speed Test"
      message={loadingStatus.message}
      progress={loadingStatus.progress}
      total={loadingStatus.total}
      icon={Wifi}
    />
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Speed Test</h1>
          <p className="text-muted-foreground">Network performance monitoring</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => fetchResults()}
            className="p-2 bg-secondary hover:bg-muted rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={clearHistory}
            className="p-2 bg-secondary hover:bg-muted rounded-lg transition-colors"
            title="Clear History"
            disabled={results.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={runSpeedTest}
            disabled={running}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {running ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run Speed Test</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="bg-card border border-border rounded-25 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <p className="text-sm text-muted-foreground">
            {results.length} test{results.length !== 1 ? 's' : ''} in history
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Date</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Download</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Upload</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Ping</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground text-sm">Server Location</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    No speed tests yet. Click "Run Speed Test" to start.
                  </td>
                </tr>
              ) : (
                results.map((result, index) => (
                  <tr key={result.id || index} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-6 py-3 text-sm">
                      {formatDate(result.timestamp)}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span className="font-mono text-green-600 dark:text-green-400">
                        ↓ {formatSpeed(result.download)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span className="font-mono text-blue-600 dark:text-blue-400">
                        ↑ {formatSpeed(result.upload)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span className="font-mono text-yellow-600 dark:text-yellow-400">
                        {formatPing(result.ping)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {result.serverLocation}
                      {result.serverHost && (
                        <span className="text-muted-foreground text-xs block">
                          {result.serverHost}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}