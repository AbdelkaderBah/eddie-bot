import {IntervalVariations} from "@/types/market";

export class PriceVariationTracker {
    private priceHistory: Map<string, { price: number; timestamp: number }[]>;
    private variations: Map<string, IntervalVariations>;
    private readonly INTERVALS = [5, 10, 15, 20, 25, 30, 60];  // minutes
    private readonly MAX_HISTORY = 60; // Store 60 minutes of data

    constructor() {
        this.priceHistory = new Map();
        this.variations = new Map();
    }

    public trackPrice(symbol: string, price: number, timestamp: number) {
        // Initialize if needed
        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
            this.variations.set(symbol, this.initializeVariations());
        }

        // Add new price to history
        const history = this.priceHistory.get(symbol)!;
        history.push({ price, timestamp });

        // Remove old data
        const cutoffTime = timestamp - (this.MAX_HISTORY * 60 * 1000);
        while (history.length > 0 && history[0].timestamp < cutoffTime) {
            history.shift();
        }

        // Update variations for all intervals
        this.updateVariations(symbol, price, timestamp);

        return this.variations.get(symbol);
    }

    private initializeVariations(): IntervalVariations {
        const now = Date.now();
        return {
            '5m': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '10m': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '15m': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '20m': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '25m': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '30m': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '60m': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
        };
    }

    private updateVariations(symbol: string, currentPrice: number, currentTime: number) {
        const history = this.priceHistory.get(symbol)!;
        const variations = this.variations.get(symbol)!;

        this.INTERVALS.forEach(minutes => {
            const intervalKey = `${minutes}m` as keyof IntervalVariations;
            const cutoffTime = currentTime - (minutes * 60 * 1000);

            // Find the oldest price within this interval
            const startPricePoint = history.find(point => point.timestamp >= cutoffTime);

            if (startPricePoint) {
                const startPrice = startPricePoint.price;
                const variation = ((currentPrice - startPrice) / startPrice) * 100;

                variations[intervalKey] = {
                    startPrice,
                    currentPrice,
                    variation,
                    timestamp: currentTime
                };
            }
        });
    }

    public getVariations(symbol: string): IntervalVariations | undefined {
        return this.variations.get(symbol);
    }
}

export default PriceVariationTracker;