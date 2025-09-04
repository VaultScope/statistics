import https from 'https';
import { Location } from '@server/types/statistics/speedtest';

export function getUserLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'ipapi.co',
            path: '/json/',
            method: 'GET',
            headers: {
                'User-Agent': 'speedtest-cli/1.0'
            }
        };

        https.get(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({
                        lat: parsed.latitude,
                        lon: parsed.longitude
                    });
                } catch (error) {
                    reject(new Error('Failed to parse location data'));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}