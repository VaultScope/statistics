import * as systeminformation from 'systeminformation';
const si = systeminformation;
import { OS } from '@server/types/statistics/system';

export default async function getOSInfo(): Promise<OS> {
    const osInfo = await si.osInfo();
    const system = await si.system();
    const uuid = await si.uuid();
    
    const data: OS = {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        codename: osInfo.codename || '',
        kernel: osInfo.kernel,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
        fqdn: osInfo.fqdn || osInfo.hostname,
        build: osInfo.build || '',
        uefi: osInfo.uefi || false,
        hypervisor: system.virtual || false
    };
    
    return data;
}