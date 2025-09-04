import ProcessInfo from "@server/types/statistics/process";
import psList from "ps-list";

export default async function listProcesses(): Promise<ProcessInfo[]> {
    const processes = await psList();
    return processes.map(proc => ({
        pid: proc.pid,
        name: proc.name,
        cpu: proc.cpu,
        memory: proc.memory,
        ppid: proc.ppid
    }));
}
