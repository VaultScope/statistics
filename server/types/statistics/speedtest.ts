export interface SpeedtestResult {
    ping: number;
    download: {
        speed: number;
        serverLocation: string;
    };
    upload: {
        speed: number;
        serverLocation: string;
    };
    timestamp: Date;
}

export interface Location {
    lat: number;
    lon: number;
}

export interface SpeedtestServer {
    url: string;
    lat: string;
    lon: string;
    name: string;
    country: string;
    cc: string;
    sponsor: string;
    id: string;
    host: string;
    distance?: number;
}