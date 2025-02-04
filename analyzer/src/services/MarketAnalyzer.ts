import {Redis} from 'ioredis';
import {
    MarketEvent,
} from '@/types/market';

export class MarketAnalyzer {
    private redis: Redis;
    private currentPriceIndex = 0;
    private currentVolumeIndex = 0;
    private currentTrendIndex = 0;
    private trendIsReady: boolean = false;

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
        this.initializeEventListener();
    }

    private async initializeEventListener() {
        const subscriber = this.redis.duplicate();

        await subscriber.subscribe('market_events');

        subscriber.on('message', async (channel, message) => {
            if (channel === 'market_events') {
                const event: MarketEvent = JSON.parse(message);
                await this.processEvent(event);
            }
        });
    }

    private async processEvent(event: MarketEvent) {
        try {
            if (event.type === 'PRICE_UPDATE') {
                this.analyzePriceUpdate();
            }

            if (event.type === 'VOLUME') {
                this.analyzeVolumeUpdate();
            }

            this.analyzeTrend();
        } catch (error) {
            console.error('Error processing event:', error);
        }
    }

    public close() {
        this.redis.disconnect();
    }

    private async analyzePriceUpdate() {
        if (this.currentPriceIndex < 9) {
            this.currentPriceIndex++;
            return;
        }

        this.currentPriceIndex = 0;

        const readKey = "events:BTCUSDT:prices";
        const writeKey = "analyze:BTCUSDT:prices";

        // Get the last 10 elements from the sorted set
        const rawData = await this.redis.zrange(readKey, -10, -1);

        if (rawData.length === 0) {
            console.log("No data found.");
            return;
        }

        // Parse JSON and extract prices
        const prices = rawData.map(item => JSON.parse(item).price);

        const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const openPrice = prices[0]; // First price in the last 10
        const closePrice = prices[prices.length - 1]; // Last price in the last 10
        const variation = ((closePrice - openPrice) / openPrice) * 100; // % Change

        this.redis.zadd(writeKey, Date.now(), JSON.stringify({
            averagePrice,
            openPrice,
            closePrice,
            variation
        }));

        await this.redis.zremrangebyrank(writeKey, 0, -11);
    }

    private async analyzeVolumeUpdate() {
        if (this.currentVolumeIndex < 9) {
            this.currentVolumeIndex++;
            return;
        }

        this.currentVolumeIndex = 0;

        const readKey = "events:BTCUSDT:depths";
        const writeKey = "analyze:BTCUSDT:depths";

        // Get the last 10 elements from the sorted set
        const rawData = await this.redis.zrange(readKey, -10, -1);

        if (rawData.length === 0) {
            console.log("No data found.");
            return;
        }

        // Parse JSON and extract prices
        const volumes = rawData.map(item => {
            const data = JSON.parse(item);

            return {
                volume: data.additionalData.buyVolume + data.additionalData.sellVolume,
                buyVolume: data.additionalData.buyVolume,
                sellVolume: data.additionalData.sellVolume,
                buyPercentage: data.additionalData.buyVolume / (data.additionalData.buyVolume + data.additionalData.sellVolume) * 100,
                sellPercentage: data.additionalData.sellVolume / (data.additionalData.buyVolume + data.additionalData.sellVolume) * 100,
            };
        });

        const totalVolume = volumes.reduce((sum, {volume}) => sum + volume, 0);
        const totalBuyVolume = volumes.reduce((sum, {buyVolume}) => sum + buyVolume, 0);
        const totalSellVolume = volumes.reduce((sum, {sellVolume}) => sum + sellVolume, 0)
        const totalBuyPercentage = totalBuyVolume / totalVolume * 100;
        const totalSellPercentage = totalSellVolume / totalVolume * 100;

        this.redis.zadd(writeKey, Date.now(), JSON.stringify({
            totalVolume,
            totalBuyVolume,
            totalSellVolume,
            totalBuyPercentage,
            totalSellPercentage,
        }));

        await this.redis.zremrangebyrank(writeKey, 0, -11);
    }

    private async analyzeTrend() {
        if (this.currentTrendIndex < 9) {
            this.currentTrendIndex++;
            return;
        }

        if (!this.trendIsReady) {
            this.trendIsReady = (await this.redis.zcount('analyze:BTCUSDT:prices', '-inf', '+inf') + await this.redis.zcount('analyze:BTCUSDT:depths', '-inf', '+inf')) === 20;
            return;
        }

        this.currentTrendIndex = 0;

        const priceKey = "analyze:BTCUSDT:prices";

        const rawData = await this.redis.zrange(priceKey, -10, -1);

        const openPrice = JSON.parse(rawData[0]).openPrice;
        const closePrice = JSON.parse(rawData[9]).closePrice;

        const volumeKey = "analyze:BTCUSDT:depths";

        const rawVolumeData = await this.redis.zrange(volumeKey, -10, -1);

        const volumes = rawVolumeData.map(item => {
            const data = JSON.parse(item);

            return {
                buy: data.totalBuyVolume,
                sell: data.totalSellVolume,
            };
        });


        const trend = {
            price: (openPrice - closePrice).toFixed(2),
            buy: (volumes.reduce((sum, {buy}) => sum + buy, 0)).toFixed(2),
            sell: (volumes.reduce((sum, {sell}) => sum + sell, 0)).toFixed(2),
            direction: 'unsure',
        }

        if ((openPrice - closePrice) > 0) {
            if (trend.buy > trend.sell) {
                trend.direction = 'UP';
            }
        } else {
            if (trend.buy < trend.sell) {
                trend.direction = 'DOWN';
            }
        }

        const writeKey = "analyze:BTCUSDT:trend";

        this.redis.zadd(writeKey, Date.now(), JSON.stringify(trend));
        await this.redis.zremrangebyrank(writeKey, 0, -11);
    }
}