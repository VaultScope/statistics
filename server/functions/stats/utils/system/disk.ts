import si from 'systeminformation';
import { DiskLayout } from '@server/types/statistics/system';

export default async function getDiskInfo(): Promise<DiskLayout[]> {
    const disks = await si.diskLayout();
    return disks.map(disk => ({
        devices: [{
            type: disk.type || '',
            name: disk.name || '',
            vendor: disk.vendor || '',
            size: disk.size || 0,
            bytesPerSector: disk.bytesPerSector || 0,
            totalCylinders: disk.totalCylinders || 0,
            totalHeads: disk.totalHeads || 0,
            totalSectors: disk.totalSectors || 0,
            totalTracks: disk.totalTracks || 0,
            tracksPerCylinder: disk.tracksPerCylinder || 0,
            sectorsPerTrack: disk.sectorsPerTrack || 0,
            firmwareRevision: disk.firmwareRevision || '',
            serialNum: disk.serialNum || '',
            interfaceType: disk.interfaceType || '',
            smartStatus: disk.smartStatus || '',
            temperature: disk.temperature || 0
        }],
        device: disk.device || '',
        type: disk.type || '',
        name: disk.name || '',
        vendor: disk.vendor || '',
        size: disk.size || 0,
        bytesPerSector: disk.bytesPerSector || 0,
        totalCylinders: disk.totalCylinders || 0,
        totalHeads: disk.totalHeads || 0,
        totalSectors: disk.totalSectors || 0,
        totalTracks: disk.totalTracks || 0,
        tracksPerCylinder: disk.tracksPerCylinder || 0,
        sectorsPerTrack: disk.sectorsPerTrack || 0,
        firmwareRevision: disk.firmwareRevision || '',
        serialNum: disk.serialNum || '',
        interfaceType: disk.interfaceType || '',
        smartStatus: disk.smartStatus || '',
        temperature: disk.temperature || 0
    }));
}