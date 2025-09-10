export interface NetworkInterface {
  id: string;
  name: string;
  address: string;
  type: string;
  status: 'up' | 'down';
}

export interface NetworkStats {
  interfaces: NetworkInterface[];
  traffic: {
    rx: number;
    tx: number;
  };
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  roleId?: string;
  isActive?: boolean;
}