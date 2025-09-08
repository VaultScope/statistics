export interface NetworkInterface {
  iface: string;
  ifaceName: string;
  default?: boolean;
  ip4?: string;
  ip4subnet?: string;
  ip6?: string;
  ip6subnet?: string;
  mac?: string;
  internal?: boolean;
  virtual?: boolean;
  operstate?: string;
  type?: string;
  duplex?: string;
  mtu?: number;
  speed?: number;
  dhcp?: boolean;
  dnsSuffix?: string;
  ieee8021xAuth?: string;
  ieee8021xState?: string;
  carrier_changes?: number;
}

export interface NetworkStats {
  iface: string;
  operstate: string;
  rx_bytes: number;
  rx_dropped: number;
  rx_errors: number;
  tx_bytes: number;
  tx_dropped: number;
  tx_errors: number;
  rx_sec?: number;
  tx_sec?: number;
  ms?: number;
}

export interface NetworkTrafficData {
  rx_sec: number;
  tx_sec: number;
  rx_mbps: number;
  tx_mbps: number;
  interfaces: NetworkInterfaceTraffic[];
}

export interface NetworkInterfaceTraffic {
  iface: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_sec: number;
  tx_sec: number;
  rx_mbps: number;
  tx_mbps: number;
}

export interface NetworkStatsCache {
  stats: NetworkStats[];
  timestamp: number;
}

export interface DatabaseUser {
  id: number;
  username: string;
  email: string | null;
  passwordHash: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
}

export interface UpdateUserData {
  username?: string;
  email?: string | null;
  passwordHash?: string;
  role?: 'admin' | 'user' | 'viewer';
  lastLogin?: Date | null;
}

export interface MetricsData {
  timestamp: number;
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
  disk: Array<{
    fs: string;
    size: number;
    used: number;
    available: number;
    use: number;
    mount: string;
  }>;
  network: {
    rx_bytes: number;
    tx_bytes: number;
    rx_sec: number;
    tx_sec: number;
  };
  processes?: number;
  uptime?: number;
  docker?: {
    containers: number;
    running: number;
    paused: number;
    stopped: number;
  };
  kubernetes?: {
    nodes: number;
    pods: number;
    deployments: number;
    services: number;
  };
}