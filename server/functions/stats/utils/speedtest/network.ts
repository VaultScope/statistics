import https from 'https';
import http from 'http';
import { URL } from 'url';

export function measurePing(serverUrl: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const url = new URL(serverUrl);
        const protocol = url.protocol === 'https:' ? https : http;
        
        const startTime = process.hrtime.bigint();
        
        const req = protocol.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'GET',
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            res.on('data', () => {});
            res.on('end', () => {
                const endTime = process.hrtime.bigint();
                const latency = Number((endTime - startTime) / BigInt(1000000));
                resolve(latency);
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Ping timeout'));
        });
        
        req.end();
    });
}

export function measureDownload(serverUrl: string, duration: number = 10): Promise<number> {
    return new Promise((resolve, reject) => {
        const baseUrl = serverUrl.replace('/upload.php', '');
        const sizes = ['350x350', '500x500', '750x750', '1000x1000', '1500x1500', '2000x2000', '2500x2500', '3000x3000', '3500x3500', '4000x4000'];
        
        let totalBytes = 0;
        let startTime = Date.now();
        const activeDownloads = new Set<Promise<void>>();
        const maxConcurrent = 4;
        let shouldContinue = true;
        
        const downloadFile = async (size: string): Promise<void> => {
            const testUrl = `${baseUrl}/random${size}.jpg`;
            
            return new Promise((res, rej) => {
                const url = new URL(testUrl);
                const protocol = url.protocol === 'https:' ? https : http;
                
                const req = protocol.get({
                    hostname: url.hostname,
                    port: url.port || (url.protocol === 'https:' ? 443 : 80),
                    path: url.pathname,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                        'Accept-Encoding': 'identity',
                        'Cache-Control': 'no-cache'
                    },
                    timeout: 30000
                }, (response) => {
                    if (response.statusCode !== 200) {
                        rej(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }
                    
                    response.on('data', (chunk: Buffer) => {
                        if (shouldContinue) {
                            totalBytes += chunk.length;
                        }
                    });
                    
                    response.on('end', () => res());
                    response.on('error', rej);
                });
                
                req.on('error', rej);
                req.on('timeout', () => {
                    req.destroy();
                    rej(new Error('Download timeout'));
                });
            });
        };
        
        const runTest = async () => {
            const testEndTime = Date.now() + (duration * 1000);
            
            try {
                while (Date.now() < testEndTime && shouldContinue) {
                    while (activeDownloads.size < maxConcurrent && Date.now() < testEndTime) {
                        const size = sizes[Math.floor(Math.random() * sizes.length)];
                        const downloadPromise = downloadFile(size)
                            .catch(err => {
                                console.error(`Download error: ${err.message}`);
                            })
                            .finally(() => {
                                activeDownloads.delete(downloadPromise);
                            });
                        
                        activeDownloads.add(downloadPromise);
                    }
                    
                    await new Promise(r => setTimeout(r, 100));
                }
                
                shouldContinue = false;
                await Promise.all(Array.from(activeDownloads));
                
                const totalTime = (Date.now() - startTime) / 1000;
                if (totalBytes === 0 || totalTime === 0) {
                    throw new Error('No data downloaded');
                }
                
                const speedBps = (totalBytes * 8) / totalTime;
                const speedMbps = speedBps / (1024 * 1024);
                
                resolve(speedMbps);
            } catch (error) {
                reject(error);
            }
        };
        
        runTest().catch(reject);
    });
}

export function measureUpload(serverUrl: string, duration: number = 10): Promise<number> {
    return new Promise((resolve, reject) => {
        let totalBytes = 0;
        const startTime = Date.now();
        const activeUploads = new Set<Promise<void>>();
        const maxConcurrent = 4;
        let shouldContinue = true;
        
        const generateRandomData = (sizeKB: number): Buffer => {
            const buffer = Buffer.alloc(sizeKB * 1024);
            const chunkSize = 1024;
            const pattern = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
            
            for (let i = 0; i < buffer.length; i += chunkSize) {
                const remaining = Math.min(chunkSize, buffer.length - i);
                for (let j = 0; j < remaining; j++) {
                    buffer[i + j] = pattern[j % pattern.length];
                }
            }
            
            return buffer;
        };
        
        const uploadData = async (sizeKB: number): Promise<void> => {
            const data = generateRandomData(sizeKB);
            const url = new URL(serverUrl);
            const protocol = url.protocol === 'https:' ? https : http;
            
            return new Promise((res, rej) => {
                const req = protocol.request({
                    hostname: url.hostname,
                    port: url.port || (url.protocol === 'https:' ? 443 : 80),
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': data.length
                    },
                    timeout: 30000
                }, (response) => {
                    response.on('data', () => {});
                    response.on('end', () => {
                        if (shouldContinue) {
                            totalBytes += data.length;
                        }
                        res();
                    });
                    response.on('error', rej);
                });
                
                req.on('error', rej);
                req.on('timeout', () => {
                    req.destroy();
                    rej(new Error('Upload timeout'));
                });
                
                req.write(data);
                req.end();
            });
        };
        
        const runTest = async () => {
            const sizes = [32, 64, 128, 256, 512, 1024, 2048];
            const testEndTime = Date.now() + (duration * 1000);
            
            try {
                while (Date.now() < testEndTime && shouldContinue) {
                    while (activeUploads.size < maxConcurrent && Date.now() < testEndTime) {
                        const size = sizes[Math.floor(Math.random() * sizes.length)];
                        const uploadPromise = uploadData(size)
                            .catch(err => {
                                console.error(`Upload error: ${err.message}`);
                            })
                            .finally(() => {
                                activeUploads.delete(uploadPromise);
                            });
                        
                        activeUploads.add(uploadPromise);
                    }
                    
                    await new Promise(r => setTimeout(r, 100));
                }
                
                shouldContinue = false;
                await Promise.all(Array.from(activeUploads));
                
                const totalTime = (Date.now() - startTime) / 1000;
                if (totalBytes === 0 || totalTime === 0) {
                    throw new Error('No data uploaded');
                }
                
                const speedBps = (totalBytes * 8) / totalTime;
                const speedMbps = speedBps / (1024 * 1024);
                
                resolve(speedMbps);
            } catch (error) {
                reject(error);
            }
        };
        
        runTest().catch(reject);
    });
}