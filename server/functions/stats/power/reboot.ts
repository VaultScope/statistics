import { exec } from "child_process";
import { platform } from "os";

/**
 * Reboots the current system.
 * Supports Windows, Linux, macOS (Darwin).
 */
export default async function rebootSystem(): Promise<void> {
    const pf = platform();
    let command: string;

    if (pf === "win32") {
        command = "shutdown /r /t 0";
    } else if (pf === "linux" || pf === "darwin") {
        command = "sudo shutdown -r now";
    } else {
        throw new Error(`Unsupported platform for reboot: ${pf}`);
    }

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(error);
            resolve();
        });
    });
}
