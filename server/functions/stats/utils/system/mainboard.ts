import * as systeminformation from 'systeminformation';
const si = systeminformation;
import { Mainboard } from '@server/types/statistics/system';

export default async function getMainboardInfo(): Promise<Mainboard> {
    const system = await si.system();
    const bios = await si.bios();

    const data: Mainboard = {
        manufacturer: system.manufacturer || 'Unknown',
        model: system.model || 'Unknown',
        version: system.version || 'Unknown',
        serial: system.serial || 'Unknown',
        virtual: system.virtual || false,
        bios: {
            vendor: bios.vendor || 'Unknown',
            version: bios.version || 'Unknown',
            releaseDate: bios.releaseDate || 'Unknown',
            revision: bios.revision || 'Unknown',
            serial: bios.serial || 'Unknown',
        }
    }

    return data;
}