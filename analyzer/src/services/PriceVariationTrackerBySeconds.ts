// types/market.ts
import {PriceVariation} from "@/types";

export interface IntervalVariationsBySeconds {
    '1s': PriceVariation;
    '2s': PriceVariation;
    '3s': PriceVariation;
    '4s': PriceVariation;
    '5s': PriceVariation;
    '6s': PriceVariation;
    '7s': PriceVariation;
    '8s': PriceVariation;
    '9s': PriceVariation;
    '10s': PriceVariation;
}

// PriceVariationTrackerBySeconds.ts
export class PriceVariationTrackerBySeconds {
    private priceHistory: Map<string, { price: number; timestamp: number }[]>;
    private variations: Map<string, IntervalVariationsBySeconds>;
    private readonly INTERVALS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];  // seconds
    private readonly MAX_HISTORY = 10; // Store 10 seconds of data

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
        const cutoffTime = timestamp - (this.MAX_HISTORY * 1000); // Convert to milliseconds
        while (history.length > 0 && history[0].timestamp < cutoffTime) {
            history.shift();
        }

        // Update variations for all intervals
        this.updateVariations(symbol, price, timestamp);

        return this.variations.get(symbol);
    }

    private initializeVariations(): IntervalVariationsBySeconds {
        const now = Date.now();
        return {
            '1s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '2s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '3s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '4s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '5s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '6s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '7s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '8s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '9s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
            '10s': { startPrice: 0, currentPrice: 0, variation: 0, timestamp: now },
        };
    }

    private updateVariations(symbol: string, currentPrice: number, currentTime: number) {
        const history = this.priceHistory.get(symbol)!;
        const variations = this.variations.get(symbol)!;

        this.INTERVALS.forEach(seconds => {
            const intervalKey = `${seconds}s` as keyof IntervalVariationsBySeconds;
            const cutoffTime = currentTime - (seconds * 1000); // Convert to milliseconds

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

    public getVariations(symbol: string): IntervalVariationsBySeconds | undefined {
        return this.variations.get(symbol);
    }

    // Helper method to get the most recent price history
    public getRecentHistory(symbol: string, seconds: number = 10): { price: number; timestamp: number }[] {
        const history = this.priceHistory.get(symbol);
        if (!history) return [];

        const cutoffTime = Date.now() - (seconds * 1000);
        return history.filter(point => point.timestamp >= cutoffTime);
    }
}

export default PriceVariationTrackerBySeconds;