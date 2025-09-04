// Permission system for fine-grained access control

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'nodes' | 'users' | 'apikeys' | 'system' | 'monitoring';
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Permission IDs
  isSystem: boolean; // System roles cannot be deleted
  createdAt: string;
  updatedAt: string;
}

// All available permissions in the system
export const PERMISSIONS: Record<string, Permission> = {
  // Node Management
  'nodes.view': {
    id: 'nodes.view',
    name: 'View Nodes',
    description: 'View list of nodes and their basic information',
    category: 'nodes'
  },
  'nodes.create': {
    id: 'nodes.create',
    name: 'Create Nodes',
    description: 'Add new nodes to the system',
    category: 'nodes'
  },
  'nodes.edit': {
    id: 'nodes.edit',
    name: 'Edit Nodes',
    description: 'Modify node configuration and settings',
    category: 'nodes'
  },
  'nodes.delete': {
    id: 'nodes.delete',
    name: 'Delete Nodes',
    description: 'Remove nodes from the system',
    category: 'nodes'
  },
  'nodes.power': {
    id: 'nodes.power',
    name: 'Power Control',
    description: 'Reboot or shutdown nodes',
    category: 'nodes'
  },
  
  // User Management
  'users.view': {
    id: 'users.view',
    name: 'View Users',
    description: 'View user list and profiles',
    category: 'users'
  },
  'users.create': {
    id: 'users.create',
    name: 'Create Users',
    description: 'Add new users to the system',
    category: 'users'
  },
  'users.edit': {
    id: 'users.edit',
    name: 'Edit Users',
    description: 'Modify user information and settings',
    category: 'users'
  },
  'users.delete': {
    id: 'users.delete',
    name: 'Delete Users',
    description: 'Remove users from the system',
    category: 'users'
  },
  'users.roles': {
    id: 'users.roles',
    name: 'Manage User Roles',
    description: 'Assign and modify user roles',
    category: 'users'
  },
  
  // API Key Management
  'apikeys.view': {
    id: 'apikeys.view',
    name: 'View API Keys',
    description: 'View API keys and their permissions',
    category: 'apikeys'
  },
  'apikeys.create': {
    id: 'apikeys.create',
    name: 'Create API Keys',
    description: 'Generate new API keys',
    category: 'apikeys'
  },
  'apikeys.edit': {
    id: 'apikeys.edit',
    name: 'Edit API Keys',
    description: 'Modify API key permissions',
    category: 'apikeys'
  },
  'apikeys.delete': {
    id: 'apikeys.delete',
    name: 'Delete API Keys',
    description: 'Revoke API keys',
    category: 'apikeys'
  },
  'apikeys.logs': {
    id: 'apikeys.logs',
    name: 'View API Logs',
    description: 'View API usage logs and statistics',
    category: 'apikeys'
  },
  
  // System Management
  'system.roles': {
    id: 'system.roles',
    name: 'Manage Roles',
    description: 'Create, edit, and delete roles',
    category: 'system'
  },
  'system.permissions': {
    id: 'system.permissions',
    name: 'Manage Permissions',
    description: 'Configure role permissions',
    category: 'system'
  },
  'system.settings': {
    id: 'system.settings',
    name: 'System Settings',
    description: 'Modify system configuration',
    category: 'system'
  },
  'system.categories': {
    id: 'system.categories',
    name: 'Manage Categories',
    description: 'Create and manage node categories',
    category: 'system'
  },
  
  // Monitoring
  'monitoring.hardware': {
    id: 'monitoring.hardware',
    name: 'View Hardware',
    description: 'View hardware information',
    category: 'monitoring'
  },
  'monitoring.process': {
    id: 'monitoring.process',
    name: 'View Processes',
    description: 'View and manage processes',
    category: 'monitoring'
  },
  'monitoring.network': {
    id: 'monitoring.network',
    name: 'View Network',
    description: 'View network statistics',
    category: 'monitoring'
  },
  'monitoring.overview': {
    id: 'monitoring.overview',
    name: 'View Overview',
    description: 'View system overview and stats',
    category: 'monitoring'
  }
};

// Default system roles
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    permissions: Object.keys(PERMISSIONS),
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Manage nodes and API keys',
    permissions: [
      'nodes.view', 'nodes.create', 'nodes.edit', 
      'apikeys.view', 'apikeys.create', 'apikeys.edit', 'apikeys.logs',
      'monitoring.hardware', 'monitoring.process', 'monitoring.network', 'monitoring.overview',
      'system.categories'
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'operator',
    name: 'Operator',
    description: 'Monitor and operate nodes',
    permissions: [
      'nodes.view', 'nodes.power',
      'monitoring.hardware', 'monitoring.process', 'monitoring.network', 'monitoring.overview',
      'apikeys.view', 'apikeys.logs'
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'nodes.view',
      'monitoring.hardware', 'monitoring.overview'
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Helper functions
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  return userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.some(permission => userPermissions.includes(permission));
}

export function hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.every(permission => userPermissions.includes(permission));
}

export function getPermissionsByCategory(category: string): Permission[] {
  return Object.values(PERMISSIONS).filter(p => p.category === category);
}

export function getRolePermissions(role: Role): Permission[] {
  return role.permissions.map(id => PERMISSIONS[id]).filter(Boolean);
}