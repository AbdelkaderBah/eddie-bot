import {Redis} from 'ioredis';
import {convertToBtc, executeTrade, TradeData, updateTradePNL} from "../utils/trader";

export class TradeService {
    private redis: Redis;

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
        this.update();
        this.executeTrades();

        console.log('Trade service started.');
    }

    public close() {
        this.redis.disconnect();
    }

    private async getCurrentPrice() {
        // @ts-ignore
        return (await this.redis.get('BTCUSDT:price')) * 1;
    }

    private async update() {
        const subscriber = this.redis.duplicate();

        subscriber.subscribe('trades:dispatched');

        subscriber.on('message', async (channel, message) => {
            console.log(`Trade ${message} received.`);

            updateTradePNL(
                message,
                async () => await this.getCurrentPrice(),
                [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
            ).then(() => {
                console.log(`Trade ${message} updated.`);
            });
        });
    }

    private async executeTrades() {
        const subscriber = this.redis.duplicate();

        subscriber.subscribe('trades:waiting');

        subscriber.on('message', async (channel, message) => {
            console.log(`Trade ${message} processing.`);

            let {name, side, leverage, amountInUSD, stopLoss, takeProfit} = JSON.parse(message);

            const tradeId = `${name}:${Math.random().toString(8).substring(7)}`;

            const currentPrice = await this.getCurrentPrice();
            const quantity = convertToBtc(currentPrice, amountInUSD);

            if (stopLoss !== undefined && 1 > stopLoss) {
                if (side === 'LONG') {
                    stopLoss = currentPrice * (1 - stopLoss);
                } else {
                    stopLoss = currentPrice * (1 + stopLoss);
                }
            }

            if (takeProfit !== undefined && 1 > takeProfit) {
                if (side === 'LONG') {
                    takeProfit = currentPrice * (1 + takeProfit);
                } else {
                    takeProfit = currentPrice * (1 - takeProfit);
                }
            }

            const tradeData: TradeData = {
                price: currentPrice,            // Entry price in USD
                quantity: quantity,           // Position size (in BTC)
                timestamp: Date.now(),
                status: 'open',
                side,            // Trade direction: 'LONG' or 'SHORT'
                leverage,            // Leverage factor
                stopLoss,         // Optional stop loss level
                takeProfit        // Optional take profit level
            };

            // Execute the trade by saving it in Redis.
            executeTrade(tradeId, tradeData).then();
        });


    }
}