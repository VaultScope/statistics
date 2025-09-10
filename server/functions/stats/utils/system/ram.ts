import si from 'systeminformation';
import { RAM } from '@server/types/statistics/system';

export default async function getRAMInfo(): Promise<RAM> {
    const mem = await si.mem();
    const memLayout = await si.memLayout();
    
    const sticks = memLayout.map(stick => ({
        size: stick.size || 0,
        bank: stick.bank || '',
        type: stick.type || '',
        ecc: stick.ecc || false,
        clockSpeed: stick.clockSpeed || 0,
        formFactor: stick.formFactor || '',
        manufacturer: stick.manufacturer || '',
        partNum: stick.partNum || '',
        serialNum: stick.serialNum || '',
        voltageConfigured: stick.voltageConfigured || 0,
        voltageMin: stick.voltageMin || 0,
        voltageMax: stick.voltageMax || 0
    }));
    
    const data: RAM = {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        active: mem.active,
        available: mem.available,
        // @ts-ignore
        buffers: mem.buffers,
        cached: mem.cached,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused,
        swapFree: mem.swapfree,
        layout: sticks as any
    };

    return data;
}