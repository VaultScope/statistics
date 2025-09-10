export interface NetworkLog {
  timestamp: Date;
  source: string;
  destination: string;
  protocol: string;
  size: number;
}

export interface PacketCapture {
  id: string;
  packets: NetworkLog[];
}

export interface NetworkPacket {
  timestamp: Date;
  source: string;
  destination: string;
  protocol: string;
  size: number;
  data?: any;
}
