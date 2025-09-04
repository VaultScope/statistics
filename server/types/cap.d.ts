declare module 'cap' {
  export class Cap {
    constructor();
    open(device: string, filter: string, bufSize: number, buffer: Buffer): string;
    close(): void;
    on(event: 'packet', callback: (nbytes: number, truncated: boolean) => void): void;
  }

  export namespace decoders {
    export const PROTOCOL: any;
    export function Ethernet(buffer: Buffer): { info: { srcmac: string; dstmac: string; type: number } };
  }

  export function findDevice(ip?: string): string | undefined;
}