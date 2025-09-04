import si from 'systeminformation';
import { CPU } from '@server/types/statistics/system';

export default async function getCPUInfo(): Promise<CPU> {
    const cpu = await si.cpu();
    const cpuFlags = cpu.flags ? cpu.flags.split(' ') : [];
    const cpuSpeed = await si.cpuCurrentSpeed();
    const cpuTemp = await si.cpuTemperature();
    
    return {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        family: cpu.family,
        speed: cpuSpeed.avg.toString(),
        speedMax: cpuSpeed.max.toString(),
        speedMin: cpuSpeed.min.toString(),
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        processors: cpu.processors,
        performanceCores: cpu.performanceCores || 0,
        efficiencyCores: cpu.efficiencyCores || 0,
        socket: cpu.socket || '',
        virtualization: cpuFlags.includes('vmx') || cpuFlags.includes('svm'),
        cache: {
            l1d: cpu.cache.l1d || 0,
            l1i: cpu.cache.l1i || 0,
            l2: cpu.cache.l2 || 0,
            l3: cpu.cache.l3 || 0
        }
    };
}
