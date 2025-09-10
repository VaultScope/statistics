export interface SpeedTestResult {
  download: number;
  upload: number;
  ping: number;
  server: SpeedTestServer;
  timestamp: Date;
}

export interface SpeedTestServer {
  id: string;
  name: string;
  location: string;
  country: string;
  host: string;
  port: number;
  distance?: number;
}

export interface SpeedTestLocation {
  lat: number;
  lon: number;
  city?: string;
  country?: string;
}

// Aliases for compatibility
export type SpeedtestResult = SpeedTestResult;
export type SpeedtestServer = SpeedTestServer;
export type Location = SpeedTestLocation;
