export interface CPUInfo {
  manufacturer: string;
  brand: string;
  cores: number;
  physicalCores: number;
  speed: number;
  temperature?: number;
}

export interface RAMInfo {
  total: number;
  free: number;
  used: number;
  active: number;
  available: number;
  usage: number;
}

export interface DiskInfo {
  device: string;
  mount: string;
  type: string;
  size: number;
  used: number;
  available: number;
  usage: number;
}

export interface GPUInfo {
  vendor: string;
  model: string;
  vram?: number;
  temperature?: number;
  utilization?: number;
}

export interface MainboardInfo {
  manufacturer: string;
  model: string;
  version: string;
  serial?: string;
  bios?: {
    vendor: string;
    version: string;
    releaseDate: string;
  };
}

export interface OSInfo {
  platform: string;
  distro: string;
  release: string;
  codename?: string;
  kernel: string;
  arch: string;
  hostname: string;
  uptime: number;
}

// Aliases for compatibility
export type CPU = CPUInfo;
export type RAM = RAMInfo;
export type DiskLayout = DiskInfo;
export type Graphics = GPUInfo;
export type Mainboard = MainboardInfo;
export type OS = OSInfo;
