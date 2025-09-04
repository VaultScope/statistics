import listProcesses from "./list";

export default async function killProcess(pid: number): Promise<boolean> {
    const processes = await listProcesses();
    const processX = processes.find(p => p.pid === pid);
    if (!processX) return false;
    try {
        process.kill(pid);
        return true;
    } catch (error) {
        console.error(`Failed to kill process ${pid}:`, error);
        return false;
    }
}