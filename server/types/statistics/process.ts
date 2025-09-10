export interface Process {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  ppid?: number;
  uid?: number;
  command?: string;
}

export interface ProcessList {
  processes: Process[];
  total: number;
}

export default Process;
