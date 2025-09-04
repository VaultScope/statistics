export interface EthernetPacket {
  srcMac: string;
  dstMac: string;
  ethertype: number;
  payload: Buffer;
}

export interface NetworkPacket {
  timestamp: Date;
  length: number;
  linkType: string;
  ethernet: EthernetPacket;
}
