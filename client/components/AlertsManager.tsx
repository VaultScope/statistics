'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Edit2, Trash2, X, Check, AlertTriangle, AlertCircle, Info, Mail, MessageSquare, Webhook, Users } from 'lucide-react';

interface Alert {
  id: number;
  nodeId: number;
  metric: string;
  condition: 'above' | 'below' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  cooldown: number;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationChannel {
  id: number;
  name: string;
  type: 'email' | 'slack' | 'discord' | 'webhook' | 'teams' | 'pagerduty';
  config: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Node {
  id: number;
  name: string;
}

const METRICS = [
  { value: 'cpu_usage', label: 'CPU Usage (%)' },
  { value: 'memory_usage', label: 'Memory Usage (%)' },
  { value: 'disk_usage', label: 'Disk Usage (%)' },
  { value: 'network_rx_sec', label: 'Network RX (bytes/s)' },
  { value: 'network_tx_sec', label: 'Network TX (bytes/s)' },
  { value: 'load_1m', label: '1-minute Load Average' },
  { value: 'load_5m', label: '5-minute Load Average' },
  { value: 'load_15m', label: '15-minute Load Average' },
  { value: 'temperature', label: 'Temperature (°C)' },
  { value: 'processes_count', label: 'Process Count' },
  { value: 'uptime_hours', label: 'Uptime (hours)' }
];

const CHANNEL_ICONS = {
  email: Mail,
  slack: MessageSquare,
  discord: MessageSquare,
  webhook: Webhook,
  teams: Users,
  pagerduty: Bell
};

export default function AlertsManager() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [editingAlert, setEditingAlert] = useState<number | null>(null);
  const [editingChannel, setEditingChannel] = useState<number | null>(null);
  
  const [alertForm, setAlertForm] = useState({
    nodeId: '',
    metric: 'cpu_usage',
    condition: 'above' as const,
    threshold: 80,
    severity: 'warning' as const,
    cooldown: 5,
    enabled: true
  });

  const [channelForm, setChannelForm] = useState({
    name: '',
    type: 'email' as const,
    config: {},
    enabled: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [alertsRes, channelsRes, nodesRes] = await Promise.all([
        fetch('/api/alerts'),
        fetch('/api/notification-channels'),
        fetch('/api/nodes')
      ]);

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }

      if (channelsRes.ok) {
        const channelsData = await channelsRes.json();
        setChannels(channelsData);
      }

      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        setNodes(nodesData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...alertForm,
          nodeId: parseInt(alertForm.nodeId)
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to create alert');
        return;
      }
      
      setShowAddAlert(false);
      resetAlertForm();
      fetchData();
    } catch (error) {
      console.error('Error creating alert:', error);
      alert('Failed to create alert');
    }
  };

  const handleUpdateAlert = async (id: number) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...alertForm,
          nodeId: parseInt(alertForm.nodeId)
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to update alert');
        return;
      }
      
      setEditingAlert(null);
      resetAlertForm();
      fetchData();
    } catch (error) {
      console.error('Error updating alert:', error);
      alert('Failed to update alert');
    }
  };

  const handleDeleteAlert = async (id: number) => {
    if (!confirm('Delete this alert?')) return;
    
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to delete alert');
        return;
      }
      
      fetchData();
    } catch (error) {
      console.error('Error deleting alert:', error);
      alert('Failed to delete alert');
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...channelForm,
          config: JSON.stringify(channelForm.config)
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to create channel');
        return;
      }
      
      setShowAddChannel(false);
      resetChannelForm();
      fetchData();
    } catch (error) {
      console.error('Error creating channel:', error);
      alert('Failed to create channel');
    }
  };

  const toggleAlertEnabled = async (alert: Alert) => {
    try {
      const res = await fetch(`/api/alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !alert.enabled })
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to toggle alert');
        return;
      }
      
      fetchData();
    } catch (error) {
      console.error('Error toggling alert:', error);
    }
  };

  const resetAlertForm = () => {
    setAlertForm({
      nodeId: '',
      metric: 'cpu_usage',
      condition: 'above',
      threshold: 80,
      severity: 'warning',
      cooldown: 5,
      enabled: true
    });
  };

  const resetChannelForm = () => {
    setChannelForm({
      name: '',
      type: 'email',
      config: {},
      enabled: true
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getChannelIcon = (type: string) => {
    const Icon = CHANNEL_ICONS[type as keyof typeof CHANNEL_ICONS] || Bell;
    return <Icon className="w-4 h-4" />;
  };

  const renderChannelConfigForm = () => {
    switch (channelForm.type) {
      case 'email':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">SMTP Host</label>
              <input
                type="text"
                required
                value={(channelForm.config as any).host || ''}
                onChange={(e) => setChannelForm({
                  ...channelForm,
                  config: { ...channelForm.config, host: e.target.value }
                })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Port</label>
                <input
                  type="number"
                  required
                  value={(channelForm.config as any).port || 587}
                  onChange={(e) => setChannelForm({
                    ...channelForm,
                    config: { ...channelForm.config, port: parseInt(e.target.value) }
                  })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Secure</label>
                <select
                  value={(channelForm.config as any).secure ? 'true' : 'false'}
                  onChange={(e) => setChannelForm({
                    ...channelForm,
                    config: { ...channelForm.config, secure: e.target.value === 'true' }
                  })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                >
                  <option value="false">No (STARTTLS)</option>
                  <option value="true">Yes (SSL/TLS)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                required
                value={(channelForm.config as any).auth?.user || ''}
                onChange={(e) => setChannelForm({
                  ...channelForm,
                  config: {
                    ...channelForm.config,
                    auth: { ...(channelForm.config as any).auth, user: e.target.value }
                  }
                })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                placeholder="your-email@gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                required
                value={(channelForm.config as any).auth?.pass || ''}
                onChange={(e) => setChannelForm({
                  ...channelForm,
                  config: {
                    ...channelForm.config,
                    auth: { ...(channelForm.config as any).auth, pass: e.target.value }
                  }
                })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                placeholder="App password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">From Address</label>
              <input
                type="email"
                required
                value={(channelForm.config as any).from || ''}
                onChange={(e) => setChannelForm({
                  ...channelForm,
                  config: { ...channelForm.config, from: e.target.value }
                })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                placeholder="alerts@yourdomain.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">To Addresses (comma-separated)</label>
              <input
                type="text"
                required
                value={(channelForm.config as any).to?.join(', ') || ''}
                onChange={(e) => setChannelForm({
                  ...channelForm,
                  config: { ...channelForm.config, to: e.target.value.split(',').map(s => s.trim()) }
                })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                placeholder="admin@example.com, ops@example.com"
              />
            </div>
          </>
        );
      
      case 'slack':
      case 'discord':
      case 'teams':
        return (
          <div>
            <label className="block text-sm font-medium mb-2">Webhook URL</label>
            <input
              type="url"
              required
              value={(channelForm.config as any).webhookUrl || ''}
              onChange={(e) => setChannelForm({
                ...channelForm,
                config: { ...channelForm.config, webhookUrl: e.target.value }
              })}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg"
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>
        );
      
      case 'webhook':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">URL</label>
              <input
                type="url"
                required
                value={(channelForm.config as any).url || ''}
                onChange={(e) => setChannelForm({
                  ...channelForm,
                  config: { ...channelForm.config, url: e.target.value }
                })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                placeholder="https://your-webhook.com/alerts"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Method</label>
              <select
                value={(channelForm.config as any).method || 'POST'}
                onChange={(e) => setChannelForm({
                  ...channelForm,
                  config: { ...channelForm.config, method: e.target.value }
                })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
          </>
        );
      
      case 'pagerduty':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Integration Key</label>
              <input
                type="text"
                required
                value={(channelForm.config as any).integrationKey || ''}
                onChange={(e) => setChannelForm({
                  ...channelForm,
                  config: { ...channelForm.config, integrationKey: e.target.value }
                })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                placeholder="Your PagerDuty integration key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Service ID</label>
              <input
                type="text"
                required
                value={(channelForm.config as any).serviceId || ''}
                onChange={(e) => setChannelForm({
                  ...channelForm,
                  config: { ...channelForm.config, serviceId: e.target.value }
                })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                placeholder="PagerDuty service ID"
              />
            </div>
          </>
        );
      
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Alert Rules</h3>
          <button
            onClick={() => setShowAddAlert(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Alert
          </button>
        </div>

        {showAddAlert && (
          <div className="bg-card border border-border rounded-xl p-6 mb-4">
            <h4 className="text-base font-semibold mb-4">New Alert Rule</h4>
            <form onSubmit={handleAddAlert} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Node</label>
                  <select
                    required
                    value={alertForm.nodeId}
                    onChange={(e) => setAlertForm({ ...alertForm, nodeId: e.target.value })}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                  >
                    <option value="">Select a node</option>
                    {nodes.map(node => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Metric</label>
                  <select
                    value={alertForm.metric}
                    onChange={(e) => setAlertForm({ ...alertForm, metric: e.target.value })}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                  >
                    {METRICS.map(metric => (
                      <option key={metric.value} value={metric.value}>{metric.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Condition</label>
                  <select
                    value={alertForm.condition}
                    onChange={(e) => setAlertForm({ ...alertForm, condition: e.target.value as any })}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                  >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={alertForm.threshold}
                    onChange={(e) => setAlertForm({ ...alertForm, threshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Severity</label>
                  <select
                    value={alertForm.severity}
                    onChange={(e) => setAlertForm({ ...alertForm, severity: e.target.value as any })}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                  >
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Cooldown (minutes)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={alertForm.cooldown}
                  onChange={(e) => setAlertForm({ ...alertForm, cooldown: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Create Alert
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAlert(false);
                    resetAlertForm();
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid gap-4">
          {alerts.map(alert => {
            const node = nodes.find(n => n.id === alert.nodeId);
            const metric = METRICS.find(m => m.value === alert.metric);
            
            return (
              <div
                key={alert.id}
                className="bg-card border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {metric?.label || alert.metric} {alert.condition} {alert.threshold}
                        {!alert.enabled && (
                          <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">Disabled</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Node: {node?.name || 'Unknown'} • Cooldown: {alert.cooldown}m
                        {alert.lastTriggered && ` • Last triggered: ${new Date(alert.lastTriggered).toLocaleString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAlertEnabled(alert)}
                      className={`p-2 rounded-lg ${alert.enabled ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      {alert.enabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {alerts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No alert rules configured. Create your first alert to start monitoring.
            </div>
          )}
        </div>
      </div>

      {/* Notification Channels Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Notification Channels</h3>
          <button
            onClick={() => setShowAddChannel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Channel
          </button>
        </div>

        {showAddChannel && (
          <div className="bg-card border border-border rounded-xl p-6 mb-4">
            <h4 className="text-base font-semibold mb-4">New Notification Channel</h4>
            <form onSubmit={handleAddChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={channelForm.name}
                  onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                  placeholder="e.g., Ops Team Email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={channelForm.type}
                  onChange={(e) => setChannelForm({ ...channelForm, type: e.target.value as any, config: {} })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg"
                >
                  <option value="email">Email</option>
                  <option value="slack">Slack</option>
                  <option value="discord">Discord</option>
                  <option value="webhook">Webhook</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="pagerduty">PagerDuty</option>
                </select>
              </div>

              {renderChannelConfigForm()}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Create Channel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddChannel(false);
                    resetChannelForm();
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid gap-4">
          {channels.map(channel => (
            <div
              key={channel.id}
              className="bg-card border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getChannelIcon(channel.type)}
                  <div>
                    <div className="font-medium">{channel.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Type: {channel.type} • {channel.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {channels.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No notification channels configured. Add a channel to receive alerts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}