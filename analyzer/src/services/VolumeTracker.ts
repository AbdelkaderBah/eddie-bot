import {IntervalVolumes, VolumeData} from "@/types/market";

export class VolumeTracker {
    private volumeHistory: Map<string, {
        timestamp: number;
        buyVolume: number;
        sellVolume: number;
    }[]>;
    private volumes: Map<string, IntervalVolumes>;
    private readonly INTERVALS = [5, 10, 15, 20, 25, 30, 60];  // minutes
    private readonly MAX_HISTORY = 60; // Store 60 minutes of data

    constructor() {
        this.volumeHistory = new Map();
        this.volumes = new Map();
    }

    public trackVolume(
        symbol: string,
        buyVolume: number,
        sellVolume: number,
        timestamp: number
    ) {
        // Initialize if needed
        if (!this.volumeHistory.has(symbol)) {
            this.volumeHistory.set(symbol, []);
            this.volumes.set(symbol, this.initializeVolumes());
        }

        // Add new volume data to history
        const history = this.volumeHistory.get(symbol)!;
        history.push({ timestamp, buyVolume, sellVolume });

        // Remove old data
        const cutoffTime = timestamp - (this.MAX_HISTORY * 60 * 1000);
        while (history.length > 0 && history[0].timestamp < cutoffTime) {
            history.shift();
        }

        // Update volumes for all intervals
        this.updateVolumes(symbol, timestamp);

        return this.volumes.get(symbol);
    }

    private initializeVolumes(): IntervalVolumes {
        const now = Date.now();
        const emptyVolume: VolumeData = {
            buyVolume: 0,
            sellVolume: 0,
            totalVolume: 0,
            buyPressure: 0,
            sellPressure: 0,
            timestamp: now
        };

        return {
            '5m': { ...emptyVolume },
            '10m': { ...emptyVolume },
            '15m': { ...emptyVolume },
            '20m': { ...emptyVolume },
            '25m': { ...emptyVolume },
            '30m': { ...emptyVolume },
            '60m': { ...emptyVolume }
        };
    }

    private updateVolumes(symbol: string, currentTime: number) {
        const history = this.volumeHistory.get(symbol)!;
        const volumes = this.volumes.get(symbol)!;

        this.INTERVALS.forEach(minutes => {
            const intervalKey = `${minutes}m` as keyof IntervalVolumes;
            const cutoffTime = currentTime - (minutes * 60 * 1000);

            // Calculate volumes for this interval
            const intervalData = history.filter(point => point.timestamp >= cutoffTime);

            if (intervalData.length > 0) {
                const buyVolume = intervalData.reduce((sum, data) => sum + data.buyVolume, 0);
                const sellVolume = intervalData.reduce((sum, data) => sum + data.sellVolume, 0);
                const totalVolume = buyVolume + sellVolume;

                volumes[intervalKey] = {
                    buyVolume,
                    sellVolume,
                    totalVolume,
                    buyPressure: totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0,
                    sellPressure: totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 0,
                    timestamp: currentTime
                };
            }
        });
    }

    public getVolumes(symbol: string): IntervalVolumes | undefined {
        return this.volumes.get(symbol);
    }
}

export default VolumeTracker;