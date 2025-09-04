import { SpeedtestResult, SpeedtestServer } from '@server/types/statistics/speedtest';
import { getUserLocation } from './utils/speedtest/location';
import { fetchOoklaServers, sortServersByDistance } from './utils/speedtest/servers';
import { measurePing, measureDownload, measureUpload } from './utils/speedtest/network';

async function testServerConnectivity(server: SpeedtestServer): Promise<boolean> {
    try {
        const testUrl = server.url.replace('/upload.php', '/latency.txt');
        const https = require('https');
        const http = require('http');
        const { URL } = require('url');
        
        return new Promise((resolve) => {
            const url = new URL(testUrl);
            const protocol = url.protocol === 'https:' ? https : http;
            
            const req = protocol.get({
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                timeout: 3000,
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            }, (res: any) => {
                res.on('data', () => {});
                res.on('end', () => resolve(true));
            });
            
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    } catch {
        return false;
    }
}

async function findBestServer(servers: SpeedtestServer[]): Promise<SpeedtestServer | null> {
    console.log(`Testing ${Math.min(servers.length, 5)} nearest servers...`);
    
    for (let i = 0; i < Math.min(servers.length, 5); i++) {
        const server = servers[i];
        console.log(`Testing server ${i + 1}: ${server.sponsor} - ${server.name}`);
        
        const isReachable = await testServerConnectivity(server);
        if (isReachable) {
            try {
                const ping = await measurePing(server.url);
                console.log(`  Ping: ${ping}ms`);
                
                if (ping < 500) {
                    return server;
                }
            } catch (error) {
                console.log(`  Server test failed: ${error}`);
            }
        } else {
            console.log(`  Server unreachable`);
        }
    }
    
    if (servers.length > 0) {
        console.log('Using first available server despite high ping');
        return servers[0];
    }
    
    return null;
}

export default async function runSpeedtest(): Promise<SpeedtestResult> {
    try {
        console.log('Getting user location...');
        const userLocation = await getUserLocation();
        console.log(`Location: ${userLocation.lat.toFixed(2)}, ${userLocation.lon.toFixed(2)}`);
        
        console.log('Fetching speedtest servers...');
        const allServers = await fetchOoklaServers();
        console.log(`Found ${allServers.length} servers`);
        
        console.log('Finding nearest servers...');
        const nearestServers = sortServersByDistance(allServers, userLocation);
        
        console.log('Testing server connectivity...');
        const bestServer = await findBestServer(nearestServers);
        
        if (!bestServer) {
            throw new Error('No responsive speedtest servers found');
        }
        
        const serverInfo = `${bestServer.sponsor} - ${bestServer.name}, ${bestServer.country}`;
        console.log(`\nUsing server: ${serverInfo}`);
        console.log(`Server URL: ${bestServer.url}`);
        
        console.log('\nMeasuring ping...');
        const pingResults: number[] = [];
        for (let i = 0; i < 3; i++) {
            try {
                const ping = await measurePing(bestServer.url);
                pingResults.push(ping);
                console.log(`  Ping ${i + 1}: ${ping}ms`);
            } catch (error) {
                console.log(`  Ping attempt ${i + 1} failed`);
            }
        }
        
        if (pingResults.length === 0) {
            throw new Error('Failed to measure ping');
        }
        
        const avgPing = Math.round(
            pingResults.reduce((a, b) => a + b, 0) / pingResults.length
        );
        
        console.log(`Average Ping: ${avgPing}ms`);
        
        console.log('\nTesting download speed (10 seconds)...');
        let downloadSpeed = 0;
        try {
            downloadSpeed = await measureDownload(bestServer.url, 10);
            console.log(`Download: ${downloadSpeed.toFixed(2)} Mbps`);
        } catch (error) {
            console.error('Download test failed:', error);
            console.log('Retrying with shorter duration...');
            try {
                downloadSpeed = await measureDownload(bestServer.url, 5);
                console.log(`Download: ${downloadSpeed.toFixed(2)} Mbps`);
            } catch (retryError) {
                console.error('Download retry failed:', retryError);
            }
        }
        
        console.log('\nTesting upload speed (10 seconds)...');
        let uploadSpeed = 0;
        try {
            uploadSpeed = await measureUpload(bestServer.url, 10);
            console.log(`Upload: ${uploadSpeed.toFixed(2)} Mbps`);
        } catch (error) {
            console.error('Upload test failed:', error);
            console.log('Retrying with shorter duration...');
            try {
                uploadSpeed = await measureUpload(bestServer.url, 5);
                console.log(`Upload: ${uploadSpeed.toFixed(2)} Mbps`);
            } catch (retryError) {
                console.error('Upload retry failed:', retryError);
            }
        }
        
        return {
            ping: avgPing,
            download: {
                speed: parseFloat(downloadSpeed.toFixed(2)),
                serverLocation: serverInfo
            },
            upload: {
                speed: parseFloat(uploadSpeed.toFixed(2)),
                serverLocation: serverInfo
            },
            timestamp: new Date()
        };
        
    } catch (error) {
        console.error('Speedtest failed:', error);
        throw error;
    }
}