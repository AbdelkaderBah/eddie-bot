// services/MarketAnalyzer.ts
import { WebSocket } from 'ws';
import { Redis } from 'ioredis';
import {
    MarketEvent,
    BinanceKline,
    MarketAnalysis,
    IntervalVariations,
    IntervalVolumes,
    IntervalVariationsBySeconds
} from '@/types/market';
import {PriceVariationTracker} from "../services";
import {PriceVariationTrackerBySeconds} from "../services";
import { VolumeTracker } from '../services';

export class MarketAnalyzer {
    private priceTracker: PriceVariationTracker;
    private priceTrackerByS: PriceVariationTrackerBySeconds;

    private volumeTracker: VolumeTracker;

    private readonly VOLUME_THRESHOLDS = {
        '5m': { volume: 100, pressure: 70 },    // 100 BTC volume with 70% pressure
        '10m': { volume: 200, pressure: 65 },
        '15m': { volume: 300, pressure: 65 },
        '20m': { volume: 400, pressure: 60 },
        '25m': { volume: 500, pressure: 60 },
        '30m': { volume: 600, pressure: 55 },
        '60m': { volume: 1000, pressure: 55 }
    };

    // @ts-ignore
    private ws: WebSocket;
    private redis: Redis;
    private analysisWindows: Map<string, MarketAnalysis[]>;
    private readonly WINDOW_SIZE = 100; // Number of data points to keep
    private readonly VOLUME_THRESHOLD = 2; // Volume multiplier for mass events
    private readonly PRICE_VARIANCE_THRESHOLD = 0.035; // 3.5% price change threshold

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
        this.analysisWindows = new Map();
        this.initializeWebSocket();
        this.priceTracker = new PriceVariationTracker();
        this.priceTrackerByS = new PriceVariationTrackerBySeconds();
        this.volumeTracker = new VolumeTracker();
    }

    private initializeWebSocket() {
        this.ws = new WebSocket('wss://stream.binance.com:9443/ws');

        this.ws.on('open', () => {
            // Subscribe to multiple symbols
            const symbols = ['btcusdt'];
            const intervals = ['1s'];

            const subscriptions = symbols.flatMap(symbol =>
                intervals.map(interval => `${symbol}@kline_${interval}`)
            );

            this.ws.send(JSON.stringify({
                method: 'SUBSCRIBE',
                params: subscriptions,
                id: 1
            }));
        });

        this.ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.e === 'kline') {
                this.analyzeKline(message.k);
            }
        });
    }

    private async checkPriceVariations(symbol: string, variations: IntervalVariations) {
        const VARIATION_THRESHOLDS = {
            '5m': 0.1,   // 0.1% in 5 minutes
            '10m': 0.2,  // 0.2% in 10 minutes
            '15m': 0.3,  // 0.3% in 15 minutes
            '20m': 0.35,  // 0.35% in 20 minutes
            '25m': 0.4,  // 0.4% in 25 minutes
            '30m': 0.45,  // 0.45% in 30 minutes
            '60m': 0.5  // 0.5% in 60 minutes
        };

        for (const [interval, variation] of Object.entries(variations)) {
            const threshold = VARIATION_THRESHOLDS[interval as keyof typeof VARIATION_THRESHOLDS];

            if (Math.abs(variation.variation) >= threshold) {
                await this.publishEvent({
                    type: variation.variation > 0 ? 'PRICE_JUMP' : 'PRICE_DROP',
                    symbol,
                    price: variation.currentPrice,
                    volume: 0, // You might want to calculate volume for the interval
                    timestamp: variation.timestamp,
                    percentage: variation.variation,
                    timeFrame: interval,
                    additionalData: {
                        startPrice: variation.startPrice,
                        threshold
                    }
                });
            }
        }
    }

    private async checkPriceVariationsBySeconds(symbol: string, variations: IntervalVariationsBySeconds) {
        const VARIATION_THRESHOLDS = {
            '1s': 1,   // 0.1% in 1s
            '2s': 2,  // 0.2% in 2s
            '3s': 3,  // 0.3% in 3s
            '4s': 3.5,  // 0.35% in 4s
            '5s': 4,  // 0.4% in 5s
            '6s': 45,  // 0.45% in 6s
            '7s': 5,  // 0.5% in 7s
            '8s': 5.5,  // 0.5% in 8s
            '9s': 6, // 0.5% in 9s
            '10s': 6.5,  // 0.5% in 10s
        };

        for (const [interval, variation] of Object.entries(variations)) {
            const threshold = VARIATION_THRESHOLDS[interval as keyof typeof VARIATION_THRESHOLDS];

            if (Math.abs(variation.variation) >= threshold) {
                await this.publishEvent({
                    type: variation.variation > 0 ? 'PRICE_JUMP_SECOND' : 'PRICE_DROP_SECOND',
                    symbol,
                    price: variation.currentPrice,
                    volume: 0, // You might want to calculate volume for the interval
                    timestamp: variation.timestamp,
                    percentage: variation.variation,
                    timeFrame: interval,
                    additionalData: {
                        startPrice: variation.startPrice,
                        threshold
                    }
                });
            }
        }
    }

    // Add method to get current variations
    public async getSymbolVariations(symbol: string): Promise<IntervalVariations | undefined> {
        return this.priceTracker.getVariations(symbol);
    }

    private async analyzeKline(kline: BinanceKline) {
        const symbol = kline.s;
        const currentWindow = this.analysisWindows.get(symbol) || [];

        const analysis: MarketAnalysis = {
            symbol,
            price: parseFloat(kline.c), // Add price to MarketAnalysis
            buyPressure: parseFloat(kline.V) / parseFloat(kline.v), // Taker buy volume ratio
            sellPressure: 1 - (parseFloat(kline.V) / parseFloat(kline.v)), // Taker sell volume ratio
            priceVariance: (parseFloat(kline.c) - parseFloat(kline.o)) / parseFloat(kline.o),
            volume: parseFloat(kline.v),
            timestamp: kline.t
        };



        this.publishEvent({
            type: 'PRICE_UPDATE',
            symbol,
            price: analysis.price,
            volume: analysis.volume,
            timestamp: analysis.timestamp,
            percentage: 0,
            timeFrame: '1m'
        }, true).then(() => '')

        // Calculate buy/sell volumes from kline data
        const buyVolume = parseFloat(kline.V);  // Taker buy volume
        const sellVolume = parseFloat(kline.v) - buyVolume;  // Total volume - buy volume

        // Track volumes
        const volumes = this.volumeTracker.trackVolume(
            symbol,
            buyVolume,
            sellVolume,
            analysis.timestamp
        );

        // Check for volume events
        await this.checkVolumeEvents(symbol, volumes as IntervalVolumes);

        // Track price variations
        const variations = this.priceTracker.trackPrice(symbol, analysis.price, analysis.timestamp);

        // Check for significant variations
        await this.checkPriceVariations(symbol, variations as IntervalVariations);

        // Track price variations
        const variationsS = this.priceTrackerByS.trackPrice(symbol, analysis.price, analysis.timestamp);

        // Check for significant variations
        await this.checkPriceVariationsBySeconds(symbol, variationsS as IntervalVariationsBySeconds);

        // Update sliding window
        currentWindow.push(analysis);
        if (currentWindow.length > this.WINDOW_SIZE) {
            currentWindow.shift();
        }
        this.analysisWindows.set(symbol, currentWindow);

        // Detect market events
        await this.detectEvents(symbol, currentWindow);
    }

    // Add method to get current volumes
    public async getSymbolVolumes(symbol: string): Promise<IntervalVolumes | undefined> {
        return this.volumeTracker.getVolumes(symbol);
    }

    private async checkVolumeEvents(symbol: string, volumes: IntervalVolumes) {
        for (const [interval, volumeData] of Object.entries(volumes)) {
            const threshold = this.VOLUME_THRESHOLDS[interval as keyof typeof this.VOLUME_THRESHOLDS];

            // Check for mass buying
            // if (volumeData.totalVolume >= threshold.volume &&
            //     volumeData.buyPressure >= threshold.pressure) {
            //     await this.publishEvent({
            //         type: 'MASS_BUY',
            //         symbol,
            //         price: 0, // You'll need to pass current price here
            //         volume: volumeData.totalVolume,
            //         timestamp: volumeData.timestamp,
            //         percentage: volumeData.buyPressure,
            //         timeFrame: interval,
            //         additionalData: {
            //             buyVolume: volumeData.buyVolume,
            //             sellVolume: volumeData.sellVolume,
            //             threshold: threshold.pressure
            //         }
            //     });
            // }
            //
            // // Check for mass selling
            // if (volumeData.totalVolume >= threshold.volume &&
            //     volumeData.sellPressure >= threshold.pressure) {
            //     await this.publishEvent({
            //         type: 'MASS_SELL',
            //         symbol,
            //         price: 0, // You'll need to pass current price here
            //         volume: volumeData.totalVolume,
            //         timestamp: volumeData.timestamp,
            //         percentage: volumeData.sellPressure,
            //         timeFrame: interval,
            //         additionalData: {
            //             buyVolume: volumeData.buyVolume,
            //             sellVolume: volumeData.sellVolume,
            //             threshold: threshold.pressure
            //         }
            //     });
            // }
        }
    }

    private async detectEvents(symbol: string, window: MarketAnalysis[]) {
        if (window.length < 2) return;

        const current = window[window.length - 1];
        const previous = window[window.length - 2];

        // Calculate average volume
        const avgVolume = window.reduce((sum, w) => sum + w.volume, 0) / window.length;

        // Detect mass buy
        if (
            current.buyPressure > 0.85 && // 85% buy pressure
            current.volume > avgVolume * this.VOLUME_THRESHOLD
        ) {
            await this.publishEvent({
                type: 'MASS_BUY',
                symbol,
                price: current.price,
                volume: current.volume,
                timestamp: current.timestamp,
                percentage: current.buyPressure * 100,
                timeFrame: '1m'
            });
        }

        // Detect mass sell
        if (
            current.sellPressure > 0.7 && // 70% sell pressure
            current.volume > avgVolume * this.VOLUME_THRESHOLD
        ) {
            await this.publishEvent({
                type: 'MASS_SELL',
                symbol,
                price: current.price,
                volume: current.volume,
                timestamp: current.timestamp,
                percentage: current.sellPressure * 100,
                timeFrame: '1m'
            });
        }

        // Detect price variance
        const priceChange = Math.abs(current.priceVariance);
        if (priceChange > this.PRICE_VARIANCE_THRESHOLD) {
            await this.publishEvent({
                type: current.priceVariance > 0 ? 'PRICE_JUMP' : 'PRICE_DROP',
                symbol,
                price: current.price,
                volume: current.volume,
                timestamp: current.timestamp,
                percentage: priceChange * 100,
                timeFrame: '1m'
            });
        }
    }

    private async publishEvent(event: MarketEvent, isPrice = false) {
        try {
            // Publish to Redis
            await this.redis.publish('market_events', JSON.stringify(event));

            // Keep only last 1000 events
            if(!isPrice){
                // Store event for history
                await this.redis.zadd(
                    `events:${event.symbol}`,
                    event.timestamp,
                    JSON.stringify(event)
                );

                await this.redis.zremrangebyrank(`events:${event.symbol}`, 0, -1001);

                console.log(`Published event: ${event.type} for ${event.symbol}`);
            }else {
                // Store event for history
                await this.redis.zadd(
                    `price:${event.symbol}`,
                    event.timestamp,
                    JSON.stringify(event)
                );

                await this.redis.zremrangebyrank(`price:${event.symbol}`, 0, -301);
            }
        } catch (error) {
            console.error('Error publishing event:', error);
        }
    }

    public close() {
        this.ws.close();
        this.redis.disconnect();
    }
}