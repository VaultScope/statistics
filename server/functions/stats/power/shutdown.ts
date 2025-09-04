import { exec } from "child_process";
import { platform } from "os";

/**
 * Shuts down the current system.
 * Supports Windows, Linux, macOS (Darwin).
 */
export default async function shutdownSystem(): Promise<void> {
    const pf = platform();
    let command: string;

    if (pf === "win32") {
        command = "shutdown /s /t 0";
    } else if (pf === "linux" || pf === "darwin") {
        command = "sudo shutdown -h now";
    } else {
        throw new Error(`Unsupported platform for shutdown: ${pf}`);
    }

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(error);
            resolve();
        });
    });
}
