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
        `Speed: ${cpu.speed} GHz`,
        `Cores: ${cpu.cores} (${cpu.physicalCores} physical)`
    ]]);

    // RAM Info
    const ram = await INDEX.getRAMInfo();
    const memoryInfo = [
        `Total: ${formatBytes(ram.total)}`,
        `Used: ${formatBytes(ram.used)} (${Math.round(ram.used/ram.total*100)}%)`,
        `Free: ${formatBytes(ram.free)}`,
        `Active: ${formatBytes(ram.active)}`,
        `Available: ${formatBytes(ram.available)}`,
        `Memory Modules:`
    ];
    
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
        'BIOS Information:',
        `  Vendor: ${mb.bios.vendor}`,
        `  Version: ${mb.bios.version}`,
        `  Release Date: ${mb.bios.releaseDate}`,
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
    ]]);

    // Storage Info
    const disks = await INDEX.getDiskInfo();
    const storageInfo = disks.map((disk, diskIndex) => {
        return [
            `Drive ${diskIndex + 1}:`,
            `  Device: ${disk.device}`,
            `  Type: ${disk.type}`,
            `  Name: ${disk.name}`,
            `  Size: ${formatBytes(disk.size)}`,
            `  Used: ${formatBytes(disk.used)} (${Math.round(disk.used/disk.size*100)}%)`,
            `  Mount: ${disk.mount}`
        ];
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