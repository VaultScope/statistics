import * as INDEX from "../functions/stats/utils/system/index";

const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    red: "\x1b[31m",
    white: "\x1b[37m"
};

const formatBytes = (bytes: number, decimals = 2): string => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${sizes[i]}`;
};

// Get terminal width (with fallback)
const getTerminalWidth = (): number => {
    try {
        return process.stdout.columns || 80;
    } catch {
        return 80;
    }
};

const createBox = (title: string, color: string, content: string[], width: number): string[] => {
    const padding = 2;
    const innerWidth = width - 2; // Account for borders

    const lines: string[] = [];
    lines.push(`${color}╭${'─'.repeat(innerWidth)}╮${colors.reset}`);
    lines.push(`${color}│${' '.repeat(padding)}${title.padEnd(innerWidth - padding)}${colors.reset}│`);
    lines.push(`${color}├${'─'.repeat(innerWidth)}┤${colors.reset}`);

    content.forEach(text => {
        const words = text.split(/\s+/);
        let currentLine = '';

        words.forEach(word => {
            if ((currentLine + ' ' + word).length > innerWidth - (padding * 2)) {
                lines.push(`${color}│${' '.repeat(padding)}${currentLine.padEnd(innerWidth - padding)}${colors.reset}│`);
                currentLine = word;
            } else {
                currentLine = currentLine ? `${currentLine} ${word}` : word;
            }
        });
        if (currentLine) {
            lines.push(`${color}│${' '.repeat(padding)}${currentLine.padEnd(innerWidth - padding)}${colors.reset}│`);
        }
    });

    lines.push(`${color}╰${'─'.repeat(innerWidth)}╯${colors.reset}`);
    return lines;
};

const mergeBoxesHorizontally = (boxes: string[][], spacing: number): string[] => {
    const maxHeight = Math.max(...boxes.map(box => box.length));
    const result: string[] = [];

    for (let i = 0; i < maxHeight; i++) {
        let line = '';
        boxes.forEach((box, index) => {
            const boxLine = box[i] || ' '.repeat(box[0].length);
            line += boxLine + ' '.repeat(spacing);
        });
        result.push(line);
    }
    return result;
};

const printSystemInfo = async () => {
    console.clear();
    const terminalWidth = getTerminalWidth();
    const spacing = 2;
    const boxesPerRow = terminalWidth > 160 ? 4 : terminalWidth > 120 ? 3 : terminalWidth > 80 ? 2 : 1;
    const boxWidth = Math.floor((terminalWidth - (spacing * (boxesPerRow - 1))) / boxesPerRow);
    
    const sections: [string, string, string[]][] = [];

    // CPU Info
    const cpu = await INDEX.getCPUInfo();
    sections.push(['CPU Information', colors.cyan, [
        `Manufacturer: ${cpu.manufacturer}`,
        `Processor: ${cpu.brand}`,
        `Family: ${cpu.family}`,
        `Speed: ${cpu.speed} GHz (${cpu.speedMin}-${cpu.speedMax} GHz)`,
        `Cores: ${cpu.cores} (${cpu.physicalCores} physical)`,
        `Performance Cores: ${cpu.performanceCores}`,
        `Efficiency Cores: ${cpu.efficiencyCores}`,
        `Socket: ${cpu.socket}`,
        `Virtualization: ${cpu.virtualization ? 'Enabled' : 'Disabled'}`,
        `Cache:`,
        `  L1d: ${formatBytes(cpu.cache.l1d)}`,
        `  L1i: ${formatBytes(cpu.cache.l1i)}`,
        `  L2: ${formatBytes(cpu.cache.l2)}`,
        `  L3: ${formatBytes(cpu.cache.l3)}`
    ]]);

    // RAM Info
    const ram = await INDEX.getRAMInfo();
    const memoryInfo = [
        `Total: ${formatBytes(ram.total)}`,
        `Used: ${formatBytes(ram.used)} (${Math.round(ram.used/ram.total*100)}%)`,
        `Free: ${formatBytes(ram.free)}`,
        `Active: ${formatBytes(ram.active)}`,
        `Available: ${formatBytes(ram.available)}`,
        `Swap Total: ${formatBytes(ram.swapTotal)}`,
        `Swap Used: ${formatBytes(ram.swapUsed)}`,
        `Swap Free: ${formatBytes(ram.swapFree)}`,
        `Memory Modules:`
    ];
    
    ram.layout?.forEach((stick: any, index: number) => {
        memoryInfo.push(`  Module ${index + 1}:`);
        memoryInfo.push(`    Size: ${formatBytes(stick.size)}`);
        memoryInfo.push(`    Type: ${stick.type}`);
        memoryInfo.push(`    Speed: ${stick.clockSpeed} MHz`);
        memoryInfo.push(`    Form Factor: ${stick.formFactor}`);
    });
    sections.push(['Memory Information', colors.blue, memoryInfo]);

    // GPU Info
    const gpu = await INDEX.getGPUInfo();
    const gpuInfo = (gpu[0] as any).controllers?.map((controller: any, index: number) => [
        `GPU ${index + 1}:`,
        `  Vendor: ${controller.vendor}`,
        `  Model: ${controller.model}`,
        `  Bus: ${controller.bus}`,
        `  VRAM: ${formatBytes(controller.vram * 1024 * 1024)}`,
        `  Dynamic VRAM: ${controller.vramDynamic ? 'Yes' : 'No'}`
    ]).flat();
    sections.push(['Graphics', colors.green, gpuInfo]);

    // Mainboard Info
    const mb = await INDEX.getMainboardInfo();
    sections.push(['Motherboard', colors.magenta, [
        `Manufacturer: ${mb.manufacturer}`,
        `Model: ${mb.model}`,
        `Version: ${mb.version}`,
        `Serial: ${mb.serial}`,
        `Virtual: ${mb.virtual ? 'Yes' : 'No'}`,
        'BIOS Information:',
        `  Vendor: ${mb.bios.vendor}`,
        `  Version: ${mb.bios.version}`,
        `  Release Date: ${mb.bios.releaseDate}`,
        `  Revision: ${mb.bios.revision}`,
        `  Serial: ${mb.bios.serial}`
    ]]);

    // OS Info
    const os = await INDEX.getOSInfo();
    sections.push(['Operating System', colors.red, [
        `Platform: ${os.platform}`,
        `Distribution: ${os.distro}`,
        `Release: ${os.release}`,
        `Codename: ${os.codename}`,
        `Kernel: ${os.kernel}`,
        `Architecture: ${os.arch}`,
        `Hostname: ${os.hostname}`,
        `FQDN: ${os.fqdn}`,
        `Build: ${os.build}`,
        `UEFI: ${os.uefi ? 'Yes' : 'No'}`,
        `Hypervisor: ${os.hypervisor ? 'Yes' : 'No'}`
    ]]);

    // Storage Info
    const disks = await INDEX.getDiskInfo();
    const storageInfo = disks.map((disk, diskIndex) => {
        return disk.devices.map((device, deviceIndex) => [
            `Drive ${diskIndex + 1}:`,
            `  Name: ${device.name}`,
            `  Vendor: ${device.vendor}`,
            `  Type: ${device.type}`,
            `  Size: ${formatBytes(device.size)}`,
            `  Interface: ${device.interfaceType}`,
            `  Firmware: ${device.firmwareRevision}`,
            `  Status: ${device.smartStatus}`
        ]).flat();
    }).flat();
    sections.push(['Storage Devices', colors.yellow, storageInfo]);

    // Print sections in dynamic rows
    for (let i = 0; i < sections.length; i += boxesPerRow) {
        const rowSections = sections.slice(i, i + boxesPerRow);
        const boxes = rowSections.map(([title, color, content]) => 
            createBox(title, color, content, boxWidth)
        );
        
        const mergedRow = mergeBoxesHorizontally(boxes, spacing);
        console.log(mergedRow.join('\n'));
        console.log(); // Add space between rows
    }
};

(async () => {
    try {
        await printSystemInfo();
    } catch (error) {
        console.error(`${colors.red}${colors.bright}Error: ${error}${colors.reset}`);
    }
})();