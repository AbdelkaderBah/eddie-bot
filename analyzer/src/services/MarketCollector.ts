import {WebSocket} from 'ws';
import {Redis} from 'ioredis';
import {
    MarketEvent,
    BinanceKline,
    MarketAnalysis, BriefKline,
} from '@/types/market';
import DepthCollector from "../collectors/DepthCollector";
import IndicatorCollector from "../collectors/IndicatorCollector";

export class MarketCollector {
    private lastPrice: number;

    // @ts-ignore
    private ws: WebSocket;
    private redis: Redis;
    private indicatorCollector: IndicatorCollector = new IndicatorCollector();

    constructor(redisUrl: string) {
        this.lastPrice = 0;
        this.redis = new Redis(redisUrl);
        this.initializeWebSocket();
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

            subscriptions.push('btcusdt@depth');

            this.ws.send(JSON.stringify({
                method: 'SUBSCRIBE',
                params: subscriptions,
                id: 1
            }));
        });

        this.ws.on('message', (data) => {
            const message = JSON.parse(data.toString());

            if (message.e === 'kline') {
                this.collectPrice(message.k);
            }

            if (message.e === 'kline') {
                this.collectIndicators(message.k);
            }

            if (message.e === 'depthUpdate') {
                this.publishEvent(DepthCollector(this.lastPrice, message))
            }
        });
    }

    private async collectPrice(kline: BinanceKline) {
        const symbol = kline.s;
        this.lastPrice = parseFloat(kline.c);

        this.redis.set('BTCUSDT:price', this.lastPrice.toString());

        const analysis: MarketAnalysis = {
            symbol,
            price: this.lastPrice, // Add price to MarketAnalysis
            buyPressure: parseFloat(kline.V) / parseFloat(kline.v), // Taker buy volume ratio
            sellPressure: 1 - (parseFloat(kline.V) / parseFloat(kline.v)), // Taker sell volume ratio
            priceVariance: (this.lastPrice - parseFloat(kline.o)) / parseFloat(kline.o),
            volume: parseFloat(kline.v),
            timestamp: kline.t
        };


        this.publishEvent({
            name: 'prices',
            type: 'PRICE_UPDATE',
            symbol,
            price: analysis.price,
            volume: analysis.volume,
            timestamp: analysis.timestamp,
            percentage: 0,
            timeFrame: ''
        })
    }

    private async publishEvent(event: MarketEvent) {
        try {
            // Publish to Redis
            await this.redis.publish('market_events', JSON.stringify(event));

            // Store event for history
            await this.redis.zadd(
                `events:${event.symbol}:${event.name}`,
                event.timestamp,
                JSON.stringify(event)
            );

            await this.redis.zremrangebyrank(`events:${event.symbol}:${event.name}`, 0, -10001);
        } catch (error) {
            console.error('Error publishing event:', error);
        }
    }

    public close() {
        this.ws.close();
        this.redis.disconnect();
    }

    private async collectIndicators(kline: BinanceKline) {
        if(!kline.x) {
            return;
        }

        const candle: BriefKline = {
            time: kline.t,
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
            open: parseFloat(kline.o),
            volume: parseFloat(kline.v)
        }

        const result = this.indicatorCollector.collect(candle);

        if(!result) {
            return;
        }

        // Store event for history
        await this.redis.zadd(
            `indicators:${kline.s}`,
            kline.t,
            JSON.stringify(result)
        );

        await this.redis.zremrangebyrank(`indicators:${kline.s}`, 0, -181);
    }
}