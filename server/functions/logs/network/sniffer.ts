/// <reference path="../../../types/cap.d.ts" />
import { NetworkPacket } from "@server/types/logs/network";

export type PacketCallback = (packet: NetworkPacket) => void;

export interface INetworkSniffer {
  start(): void;
  stop(): void;
  onPacket(callback: PacketCallback): void;
  offPacket(callback: PacketCallback): void;
}

export class NetworkSniffer implements INetworkSniffer {
  private cap: any;
  private decoders: any;
  private buffer: Buffer | null = null;
  private callbacks: PacketCallback[] = [];
  private isCapAvailable: boolean = false;

  constructor(private device: string) {
    try {
      // Dynamically require cap module only when needed
      const capModule = require("cap");
      this.cap = new capModule.Cap();
      this.decoders = capModule.decoders;
      this.buffer = Buffer.alloc(65535);
      this.isCapAvailable = true;
    } catch (error) {
      console.warn("Warning: cap module not available. Network sniffer functionality will be disabled.");
      console.warn("This is expected on Windows/WSL environments.");
      this.isCapAvailable = false;
      this.buffer = null;
    }
  }

  start() {
    if (!this.isCapAvailable || !this.buffer) {
      throw new Error("Network sniffer is not available on this platform");
    }

    const filter = ""; // all packets
    const bufSize = 10 * 1024 * 1024;
    const linkType = this.cap.open(this.device, filter, bufSize, this.buffer);

    this.cap.on("packet", (nbytes: number) => {
      if (!this.buffer) return; // Safety check
      
      const eth = this.decoders.Ethernet(this.buffer);
      const packet: NetworkPacket = {
        timestamp: new Date(),
        // @ts-ignore
        length: nbytes,
        linkType: linkType,
        ethernet: {
          srcMac: eth.info.srcmac,
          dstMac: eth.info.dstmac,
          ethertype: eth.info.type,
          payload: this.buffer.slice(14, nbytes),
        },
      };

      this.callbacks.forEach((cb) => cb(packet));
    });
  }

  stop() {
    if (!this.isCapAvailable || !this.cap) {
      return;
    }
    this.cap.close();
  }

  onPacket(callback: PacketCallback) {
    this.callbacks.push(callback);
  }

  offPacket(callback: PacketCallback) {
    this.callbacks = this.callbacks.filter((cb) => cb !== callback);
  }
}
