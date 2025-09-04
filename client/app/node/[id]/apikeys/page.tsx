'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api';
import { Key, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

interface ApiKey {
  uuid: string;
  name: string;
  permissions: {
    viewStats: boolean;
    createApiKey: boolean;
    deleteApiKey: boolean;
    viewApiKeys: boolean;
    usePowerCommands: boolean;
  };
  createdAt: string;
}

export default function ApiKeysPage() {
  const params = useParams();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [node, setNode] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState({
    name: '',
    permissions: {
      viewStats: true,
      createApiKey: false,
      deleteApiKey: false,
      viewApiKeys: false,
      usePowerCommands: false
    }
  });

  const fetchKeys = async () => {
    const nodeRes = await fetch(`/api/nodes/${params.id}`);
    if (!nodeRes.ok) {
      setLoading(false);
      return;
    }
    
    const nodeData = await nodeRes.json();
    setNode(nodeData);
    
    const result = await apiCall<ApiKey[]>(nodeData.url, '/api/keys', nodeData.apiKey);
    if (result.data) {
      setKeys(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, [params.id]);

  const handleCreateKey = async () => {
    if (!node || !newKey.name) return;
    
    const result = await apiCall(node.url, '/api/keys', node.apiKey, {
      method: 'POST',
      body: JSON.stringify(newKey)
    });
    
    if (result.error) {
      alert(`Failed to create key: ${result.error}`);
    } else {
      setShowCreateForm(false);
      setNewKey({
        name: '',
        permissions: {
          viewStats: true,
          createApiKey: false,
          deleteApiKey: false,
          viewApiKeys: false,
          usePowerCommands: false
        }
      });
      fetchKeys();
      if (result.data?.key) {
        alert(`Key created successfully: ${result.data.key}\n\nPlease save this key, it won't be shown again!`);
      }
    }
  };

  const handleDeleteKey = async (uuid: string, name: string) => {
    if (!confirm(`Delete API key "${name}"?`)) return;
    
    const result = await apiCall(node.url, `/api/keys/${uuid}`, node.apiKey, {
      method: 'DELETE'
    });
    
    if (result.error) {
      alert(`Failed to delete key: ${result.error}`);
    } else {
      fetchKeys();
    }
  };

  const handleUpdatePermissions = async (key: ApiKey) => {
    const result = await apiCall(node.url, `/api/keys/${key.uuid}/permissions`, node.apiKey, {
      method: 'PUT',
      body: JSON.stringify({ permissions: key.permissions })
    });
    
    if (result.error) {
      alert(`Failed to update permissions: ${result.error}`);
    } else {
      setEditingKey(null);
      fetchKeys();
    }
  };

  const togglePermission = (keyIndex: number, permission: keyof ApiKey['permissions']) => {
    const updatedKeys = [...keys];
    updatedKeys[keyIndex].permissions[permission] = !updatedKeys[keyIndex].permissions[permission];
    setKeys(updatedKeys);
  };

  if (loading) return <div className="p-8">Loading API keys...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Key</span>
        </button>
      </div>
      
      {showCreateForm && (
        <div className="bg-card border border-border rounded-25 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New API Key</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Key Name</label>
              <input
                type="text"
                value={newKey.name}
                onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                className="w-full px-4 py-2 bg-input border border-border rounded-lg"
                placeholder="My API Key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Permissions</label>
              <div className="space-y-2">
                {Object.entries(newKey.permissions).map(([key, value]) => (
                  <label key={key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setNewKey({
                        ...newKey,
                        permissions: { ...newKey.permissions, [key]: e.target.checked }
                      })}
                      className="rounded"
                    />
                    <span className="text-sm">{key}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleCreateKey}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        {keys.map((key, index) => (
          <div key={key.uuid} className="bg-card border border-border rounded-25 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center space-x-2">
                  <Key className="w-4 h-4" />
                  <span>{key.name}</span>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Created: {new Date(key.createdAt).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  UUID: {key.uuid}
                </p>
              </div>
              <div className="flex space-x-2">
                {editingKey === key.uuid ? (
                  <>
                    <button
                      onClick={() => handleUpdatePermissions(key)}
                      className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingKey(null);
                        fetchKeys();
                      }}
                      className="p-2 bg-secondary hover:bg-muted text-white rounded-lg"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditingKey(key.uuid)}
                      className="p-2 bg-secondary hover:bg-muted text-white rounded-lg"
                      title="Edit Permissions"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteKey(key.uuid, key.name)}
                      className="p-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Permissions</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(key.permissions).map(([perm, value]) => (
                  <label key={perm} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={value}
                      disabled={editingKey !== key.uuid}
                      onChange={() => togglePermission(index, perm as keyof ApiKey['permissions'])}
                      className="rounded"
                    />
                    <span className="text-sm">{perm}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
        
        {keys.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No API keys found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}