// engine/SlidingWindowEngine.js
import { FastQueue } from './FastQueue.js';
const CITY_DATA = {
    Karnal:      { lat: 29.6857, lon: 76.9905 },
    Mumbai:      { lat: 19.0760, lon: 72.8777 },
    Delhi:       { lat: 28.6139, lon: 77.2090 },
    Gangtok:     { lat: 27.3389, lon: 88.6065 },
    Pune:        { lat: 18.5204, lon: 73.8567 },
    Bangalore:   { lat: 12.9716, lon: 77.5946 },
    London:      { lat: 51.5072, lon: -0.1276 },
    Singapore:   { lat: 1.3521, lon: 103.8198 },
    Chandigarh:  { lat: 30.7333, lon: 76.7794 },
    Bangkok:     { lat: 13.7563, lon: 100.5018 }
};

class SlidingWindowEngine {
    constructor() {
        
        this.WINDOW_MS = 10000; 
        
        this.VELOCITY_THRESHOLD = 4;
    }

    calculateSpeed(cityA, cityB, timeDiffMs) {
        if (cityA === cityB || timeDiffMs <= 0) return 0;
        
        const locA = CITY_DATA[cityA];
        const locB = CITY_DATA[cityB];
        if (!locA || !locB) return 0;

        // Haversine formula calculation
        const R = 6371;
        const toRad = (deg) => deg * (Math.PI / 180);
        const dLat = toRad(locB.lat - locA.lat);
        const dLon = toRad(locB.lon - locA.lon);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(locA.lat)) * Math.cos(toRad(locB.lat)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;

        const timeHours = timeDiffMs / (1000 * 60 * 60);
        return distanceKm / timeHours; // Speed in KM per Hour
    }

    analyze(tx, historyQueue) {
        const flags = [];

       
        while (historyQueue.size > 0 && (tx.timestamp - historyQueue.peekFront().timestamp) > this.WINDOW_MS) {
            historyQueue.dequeue();
        }

        const lastTx = historyQueue.peekBack();
        if (lastTx) {
            const timeDiffMs = tx.timestamp - lastTx.timestamp;
            const speedKmh = this.calculateSpeed(lastTx.city, tx.city, timeDiffMs);

            if (speedKmh > 1200) {
                flags.push(`IMPOSSIBLE_TRAVEL (${Math.round(speedKmh)} KM/H)`);
            }
        }

        historyQueue.enqueue(tx);

     
        if (historyQueue.size > this.VELOCITY_THRESHOLD) {
            flags.push(`HIGH_VELOCITY (${historyQueue.size} tx/10s)`);
        }

        return flags;
    }
}

export { SlidingWindowEngine };