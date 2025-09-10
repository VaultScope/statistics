import https from 'https';
import { SpeedtestServer, Location } from '@server/types/statistics/speedtest';
import { calculateDistance } from './location';

export function fetchOoklaServers(): Promise<SpeedtestServer[]> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.speedtest.net',
            path: '/speedtest-servers-static.php',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        https.get(options, (res) => {
            let xmlData = '';
            
            res.on('data', (chunk) => {
                xmlData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const servers = parseServerXML(xmlData);
                    resolve(servers);
                } catch (error) {
                    reject(new Error('Failed to parse server data'));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function parseServerXML(xml: string): SpeedtestServer[] {
    const servers: SpeedtestServer[] = [];
    const serverRegex = /<server\s+([^>]+)>/g;
    const attrRegex = /(\w+)="([^"]*)"/g;
    
    let match;
    while ((match = serverRegex.exec(xml)) !== null) {
        const attrs = match[1];
        const server: any = {};
        
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrs)) !== null) {
            server[attrMatch[1]] = attrMatch[2];
        }
        
        if (server.url && server.lat && server.lon) {
            servers.push(server as SpeedtestServer);
        }
    }
    
    return servers;
}

export function sortServersByDistance(servers: SpeedtestServer[], userLocation: Location): SpeedtestServer[] {
    return servers
        .map(server => ({
            ...server,
            distance: calculateDistance(
                userLocation.lat,
                userLocation.lon,
                parseFloat(String(server.lat)),
                parseFloat(String(server.lon))
            )
        }))
        .sort((a, b) => (a.distance || 0) - (b.distance || 0))
        .slice(0, 10);
}