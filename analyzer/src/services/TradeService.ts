import {Redis} from 'ioredis';
import {convertToBtc, executeTrade, TradeData, updateTradePNL} from "../utils/trader";

export class TradeService {
    private redis: Redis;
    private tradeIds: string[] = [];

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
        this.update();
        this.executeTrades();
    }

    public close() {
        this.redis.disconnect();
    }

    private async getCurrentPrice() {
        // @ts-ignore
        return (await this.redis.get('BTCUSDT:price')) * 1;
    }

    private async update() {
        for (const tradeId of this.tradeIds) {
            await updateTradePNL(tradeId, async () => await this.getCurrentPrice());
            this.tradeIds.shift()
        }
    }

    private async executeTrades() {
        const tradeId = 'trade_001';

        const currentPrice = await this.getCurrentPrice();
        const quantity = convertToBtc(currentPrice, 100);

        const tradeData: TradeData = {
            price: (await this.getCurrentPrice()),            // Entry price in USD
            quantity: quantity,           // Position size (in BTC)
            side: 'LONG',            // Trade direction: 'LONG' or 'SHORT'
            leverage: 1,            // Leverage factor
            timestamp: Date.now(),
            status: 'open',
            stopLoss: currentPrice - 100,         // Optional stop loss level
            takeProfit: currentPrice + 200        // Optional take profit level
        };

        // Execute the trade by saving it in Redis.
        await executeTrade(tradeId, tradeData);

        this.update();
    }
}