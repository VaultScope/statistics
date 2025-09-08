'use client';

import { useState, useEffect } from 'react';
import { PERMISSIONS, getPermissionsByCategory } from '@/lib/permissions';
import { 
  Users, Shield, Settings, Plus, Edit2, Trash2, Check, X, 
  ChevronDown, Key, Monitor, Database, Activity, Mail, Lock,
  Server, Folder, ArrowLeft, Loader2, Home
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingScreen from '@/components/loading-screen';
import CategoriesManager from '@/components/CategoriesManager';

type Tab = 'nodes' | 'categories' | 'users' | 'roles' | 'permissions';

interface User {
  id: number;
  username: string;
  firstName: string;
  roleId: string;
  email?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Node {
  id: number;
  name: string;
  url: string;
  apiKey: string;
  category: string;
  status: string;
  lastCheck: string;
  createdAt: string;
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('nodes');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState({
    message: 'Initializing...',
    progress: 0,
    total: 5
  });
  
  // User management states
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    firstName: '',
    email: '',
    password: '',
    confirmPassword: '',
    roleId: 'viewer'
  });
  
  // Role management states
  const [showAddRole, setShowAddRole] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  });
  
  // Permission view states
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['nodes']);
  
  // Node management states
  const [showAddNode, setShowAddNode] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [nodeForm, setNodeForm] = useState({
    name: '',
    url: '',
    apiKey: '',
    category: 'default'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingStatus({ message: 'Checking permissions...', progress: 1, total: 5 });
      
      const usersRes = await fetch('/api/users');
      if (!usersRes.ok) {
        if (usersRes.status === 401) {
          router.push('/login');
          return;
        }
        if (usersRes.status === 403) {
          // User doesn't have permission to view users, but continue loading other data
          console.log('No permission to view users');
        }
      }
      
      const usersData = usersRes.ok ? await usersRes.json() : { users: [], currentUser: null };
      setUsers(usersData.users || []);
      setCurrentUser(usersData.currentUser);
      
      setLoadingStatus({ message: 'Loading roles...', progress: 2, total: 5 });
      const rolesRes = await fetch('/api/roles');
      const rolesData = rolesRes.ok ? await rolesRes.json() : [];
      setRoles(rolesData || []);
      
      setLoadingStatus({ message: 'Loading nodes...', progress: 3, total: 5 });
      const nodesRes = await fetch('/api/nodes');
      const nodesData = nodesRes.ok ? await nodesRes.json() : [];
      setNodes(nodesData || []);
      
      setLoadingStatus({ message: 'Loading categories...', progress: 4, total: 5 });
      const categoriesRes = await fetch('/api/categories');
      const categoriesData = categoriesRes.ok ? await categoriesRes.json() : [];
      setCategories(categoriesData || []);
      
      setLoadingStatus({ message: 'Complete!', progress: 5, total: 5 });
      
      // Short delay before hiding loading screen
      setTimeout(() => {
        setLoading(false);
      }, 300);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (userForm.password !== userForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to create user');
        return;
      }
      
      setShowAddUser(false);
      resetUserForm();
      fetchData();
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    }
  };

  const handleUpdateUser = async (id: number, updates: Partial<User>) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!res.ok) throw new Error('Failed to update user');
      
      setEditingUser(null);
      fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to delete user');
        return;
      }
      
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleForm)
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to create role');
        return;
      }
      
      setShowAddRole(false);
      resetRoleForm();
      fetchData();
    } catch (error) {
      console.error('Error creating role:', error);
      alert('Failed to create role');
    }
  };

  const handleUpdateRole = async (id: string, updates: Partial<Role>) => {
    try {
      const res = await fetch(`/api/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!res.ok) throw new Error('Failed to update role');
      
      setEditingRole(null);
      fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    }
  };

  const handleDeleteRole = async (id: string, name: string) => {
    if (!confirm(`Delete role "${name}"?`)) return;
    
    try {
      const res = await fetch(`/api/roles/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to delete role');
        return;
      }
      
      fetchData();
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Failed to delete role');
    }
  };

  const resetUserForm = () => {
    setUserForm({
      username: '',
      firstName: '',
      email: '',
      password: '',
      confirmPassword: '',
      roleId: 'viewer'
    });
  };

  const resetRoleForm = () => {
    setRoleForm({
      name: '',
      description: '',
      permissions: []
    });
  };

  const handleAddNode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodeForm)
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to create node');
        return;
      }
      
      setShowAddNode(false);
      resetNodeForm();
      fetchData();
    } catch (error) {
      console.error('Error creating node:', error);
      alert('Failed to create node');
    }
  };

  const handleUpdateNode = async (id: number) => {
    if (!editingNode) return;
    
    try {
      const res = await fetch(`/api/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingNode.name,
          url: editingNode.url,
          apiKey: editingNode.apiKey,
          category: editingNode.category
        })
      });
      
      if (!res.ok) throw new Error('Failed to update node');
      
      setEditingNode(null);
      fetchData();
    } catch (error) {
      console.error('Error updating node:', error);
      alert('Failed to update node');
    }
  };

  const handleDeleteNode = async (id: number, name: string) => {
    if (!confirm(`Delete node "${name}"?`)) return;
    
    try {
      const res = await fetch(`/api/nodes/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to delete node');
        return;
      }
      
      fetchData();
    } catch (error) {
      console.error('Error deleting node:', error);
      alert('Failed to delete node');
    }
  };

  const resetNodeForm = () => {
    setNodeForm({
      name: '',
      url: '',
      apiKey: '',
      category: 'default'
    });
  };

  const togglePermission = (permId: string) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getRoleIcon = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return null;
    
    if (role.id === 'admin') return <Shield className="w-4 h-4" />;
    if (role.id === 'manager') return <Key className="w-4 h-4" />;
    if (role.id === 'operator') return <Monitor className="w-4 h-4" />;
    return <Users className="w-4 h-4" />;
  };

  if (loading) return (
    <LoadingScreen
      title="Loading Settings"
      message={loadingStatus.message}
      progress={loadingStatus.progress}
      total={loadingStatus.total}
      icon={Settings}
      steps={[
        { icon: Shield, label: 'Permissions', done: loadingStatus.progress > 1 },
        { icon: Users, label: 'Roles', done: loadingStatus.progress > 2 },
        { icon: Server, label: 'Nodes', done: loadingStatus.progress > 3 },
        { icon: Folder, label: 'Categories', done: loadingStatus.progress > 4 },
      ]}
    />
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">System Settings</h1>
          <p className="text-muted-foreground">Manage users, roles, and permissions</p>
        </div>
        <Link
          href="/"
          className="flex items-center space-x-2 px-4 py-2 bg-secondary hover:bg-muted text-white rounded-lg transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-secondary/50 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'nodes' 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-secondary text-muted-foreground'
          }`}
        >
          <Server className="w-4 h-4 inline mr-2" />
          Nodes
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'categories' 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-secondary text-muted-foreground'
          }`}
        >
          <Folder className="w-4 h-4 inline mr-2" />
          Categories
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'users' 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-secondary text-muted-foreground'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'roles' 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-secondary text-muted-foreground'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Roles
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'permissions' 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-secondary text-muted-foreground'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Permissions
        </button>
      </div>

      {/* Nodes Tab */}
      {activeTab === 'nodes' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Node Management</h2>
            <button
              onClick={() => setShowAddNode(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              <span>Add Node</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((node) => (
              <div key={node.id} className="bg-card border border-border rounded-25 p-4">
                {editingNode?.id === node.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editingNode.name}
                      onChange={(e) => setEditingNode({ ...editingNode, name: e.target.value })}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                    />
                    <input
                      type="text"
                      value={editingNode.url}
                      onChange={(e) => setEditingNode({ ...editingNode, url: e.target.value })}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                    />
                    <input
                      type="text"
                      value={editingNode.apiKey}
                      onChange={(e) => setEditingNode({ ...editingNode, apiKey: e.target.value })}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                    />
                    <select
                      value={editingNode.category}
                      onChange={(e) => setEditingNode({ ...editingNode, category: e.target.value })}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-25"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateNode(node.id)}
                        className="flex-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNode(null)}
                        className="flex-1 px-3 py-1.5 bg-secondary rounded-lg hover:bg-secondary/80"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold flex items-center space-x-2">
                          <Server className="w-4 h-4" />
                          <span>{node.name}</span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">{node.url}</p>
                      </div>
                      <span className={`w-2 h-2 rounded-full ${
                        node.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-1">API Key</p>
                      <code className="text-xs bg-secondary px-2 py-1 rounded block truncate">
                        {node.apiKey}
                      </code>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-secondary/50 px-2 py-1 rounded">
                        {node.category}
                      </span>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => setEditingNode(node)}
                          className="p-1 text-blue-500 hover:bg-blue-500/10 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteNode(node.id, node.name)}
                          className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div>
          <CategoriesManager />
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">User Management</h2>
            <button
              onClick={() => setShowAddUser(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>

          <div className="bg-card border border-border rounded-25 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-4 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-6 py-4 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-6 py-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-6 py-4 font-medium text-muted-foreground">Last Login</th>
                  <th className="text-right px-6 py-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const role = roles.find(r => r.id === user.roleId);
                  
                  return (
                    <tr key={user.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{user.firstName}</p>
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                          {user.email && (
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                              <Mail className="w-3 h-3 mr-1" />
                              {user.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs bg-secondary">
                          {getRoleIcon(user.roleId)}
                          <span>{role?.name || 'Unknown'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs ${
                          user.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {user.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-1 text-blue-500 hover:bg-blue-500/10 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user.id !== currentUser?.id && (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Role Management</h2>
            <button
              onClick={() => setShowAddRole(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              <span>Add Role</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <div key={role.id} className="bg-card border border-border rounded-25 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold flex items-center space-x-2">
                      {getRoleIcon(role.id)}
                      <span>{role.name}</span>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                  </div>
                  {!role.isSystem && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setEditingRole(role);
                          setRoleForm({
                            name: role.name,
                            description: role.description,
                            permissions: role.permissions
                          });
                        }}
                        className="p-1 text-blue-500 hover:bg-blue-500/10 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    {role.permissions.length} permissions
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 5).map(permId => (
                      <span key={permId} className="text-xs px-1.5 py-0.5 bg-secondary rounded">
                        {PERMISSIONS[permId]?.name || permId}
                      </span>
                    ))}
                    {role.permissions.length > 5 && (
                      <span className="text-xs text-muted-foreground">
                        +{role.permissions.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
                
                {role.isSystem && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <Lock className="w-3 h-3 inline mr-1" />
                    System Role
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Permission Reference</h2>
          <div className="bg-card border border-border rounded-25 p-4">
            {Object.entries(
              Object.values(PERMISSIONS).reduce((acc, perm) => {
                if (!acc[perm.category]) acc[perm.category] = [];
                acc[perm.category].push(perm);
                return acc;
              }, {} as Record<string, typeof PERMISSIONS[keyof typeof PERMISSIONS][]>)
            ).map(([category, perms]) => (
              <div key={category} className="mb-4">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-2 hover:bg-secondary/50 rounded-lg"
                >
                  <h3 className="font-medium capitalize">{category}</h3>
                  <ChevronDown 
                    className={`w-4 h-4 transition-transform ${
                      expandedCategories.includes(category) ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedCategories.includes(category) && (
                  <div className="mt-2 pl-4 space-y-2">
                    {perms.map((perm) => (
                      <div key={perm.id} className="flex items-start space-x-3 p-2">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{perm.name}</p>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                          <code className="text-xs bg-secondary px-1 py-0.5 rounded mt-1 inline-block">
                            {perm.id}
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Node Modal */}
      {showAddNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-25 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Node</h2>
            <form onSubmit={handleAddNode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Node Name</label>
                <input
                  type="text"
                  value={nodeForm.name}
                  onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input
                  type="text"
                  value={nodeForm.url}
                  onChange={(e) => setNodeForm({ ...nodeForm, url: e.target.value })}
                  placeholder="http://localhost:4000"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  type="text"
                  value={nodeForm.apiKey}
                  onChange={(e) => setNodeForm({ ...nodeForm, apiKey: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={nodeForm.category}
                  onChange={(e) => setNodeForm({ ...nodeForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-25"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddNode(false);
                    resetNodeForm();
                  }}
                  className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Add Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {(showAddUser || editingUser) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-25 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h2>
            <form onSubmit={editingUser ? (e) => {
              e.preventDefault();
              handleUpdateUser(editingUser.id, {
                firstName: editingUser.firstName,
                email: editingUser.email,
                roleId: editingUser.roleId,
                isActive: editingUser.isActive
              });
            } : handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={editingUser ? editingUser.username : userForm.username}
                  onChange={(e) => !editingUser && setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  disabled={!!editingUser}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input
                  type="text"
                  value={editingUser ? editingUser.firstName : userForm.firstName}
                  onChange={(e) => editingUser 
                    ? setEditingUser({ ...editingUser, firstName: e.target.value })
                    : setUserForm({ ...userForm, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editingUser ? editingUser.email || '' : userForm.email}
                  onChange={(e) => editingUser
                    ? setEditingUser({ ...editingUser, email: e.target.value })
                    : setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                />
              </div>
              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={userForm.confirmPassword}
                      onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                      required
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={editingUser ? editingUser.roleId : userForm.roleId}
                  onChange={(e) => editingUser
                    ? setEditingUser({ ...editingUser, roleId: e.target.value })
                    : setUserForm({ ...userForm, roleId: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-25"
                  disabled={editingUser?.id === currentUser?.id}
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              {editingUser && (
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={editingUser.isActive ? 'active' : 'disabled'}
                    onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.value === 'active' })}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-25"
                    disabled={editingUser.id === currentUser?.id}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUser(false);
                    setEditingUser(null);
                    resetUserForm();
                  }}
                  className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Role Modal */}
      {(showAddRole || editingRole) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-card border border-border rounded-25 p-6 w-full max-w-2xl my-8">
            <h2 className="text-xl font-bold mb-4">
              {editingRole ? 'Edit Role' : 'Add New Role'}
            </h2>
            <form onSubmit={editingRole ? (e) => {
              e.preventDefault();
              handleUpdateRole(editingRole.id, roleForm);
            } : handleAddRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role Name</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Permissions</label>
                <div className="max-h-96 overflow-y-auto bg-secondary/50 border border-border rounded-lg p-3">
                  {Object.entries(
                    Object.values(PERMISSIONS).reduce((acc, perm) => {
                      if (!acc[perm.category]) acc[perm.category] = [];
                      acc[perm.category].push(perm);
                      return acc;
                    }, {} as Record<string, typeof PERMISSIONS[keyof typeof PERMISSIONS][]>)
                  ).map(([category, perms]) => (
                    <div key={category} className="mb-4">
                      <h4 className="font-medium capitalize mb-2">{category}</h4>
                      <div className="space-y-2">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-start space-x-2 p-2 hover:bg-secondary/50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={roleForm.permissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{perm.name}</p>
                              <p className="text-xs text-muted-foreground">{perm.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRole(false);
                    setEditingRole(null);
                    resetRoleForm();
                  }}
                  className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}