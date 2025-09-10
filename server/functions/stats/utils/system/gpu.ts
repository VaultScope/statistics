import si from 'systeminformation';
import { Graphics } from '@server/types/statistics/system';

export default async function getGPUInfo(): Promise<Graphics[]> {
    const graphics = await si.graphics();
    
    // Return all graphics controllers as separate items
    if (graphics.controllers && graphics.controllers.length > 0) {
        return graphics.controllers.map(controller => ({
            vendor: controller.vendor || 'Unknown',
            model: controller.model || 'Unknown',
            bus: controller.bus || '',
            vram: controller.vram ?? 0,
            vramDynamic: controller.vramDynamic ?? false,
            name: controller.name || undefined,
            subDeviceId: controller.subDeviceId || undefined,
            driverVersion: controller.driverVersion || undefined,
            pciBus: controller.pciBus || undefined,
            fanSpeed: controller.fanSpeed ?? undefined,
            memoryTotal: controller.memoryTotal ?? undefined,
            memoryUsed: controller.memoryUsed ?? undefined,
            memoryFree: controller.memoryFree ?? undefined,
            utilizationGpu: controller.utilizationGpu ?? undefined,
            utilizationMemory: controller.utilizationMemory ?? undefined,
            temperatureGpu: controller.temperatureGpu ?? undefined,
            powerDraw: controller.powerDraw ?? undefined,
            powerLimit: controller.powerLimit ?? undefined,
            clockCore: controller.clockCore ?? undefined,
            clockMemory: controller.clockMemory ?? undefined
        }));
    }
    
    // Return empty array if no GPUs found
    return [{
        vendor: 'None',
        model: 'No GPU detected',
        // @ts-ignore
        bus: '',
        vram: 0,
        vramDynamic: false
    }];
}