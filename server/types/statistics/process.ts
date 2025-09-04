export default interface ProcessInfo {
    pid: number;
    name: string;
    cpu?: number;    // CPU usage % (if available)
    memory?: number; // Memory usage in bytes (if available)
    ppid?: number;   // Parent PID
}