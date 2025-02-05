// services/SupervisorService.ts
import { Redis } from 'ioredis';
import { MarketCollector } from './MarketCollector';
import { MarketEvent } from '../types/market';
import {Condition} from "../types/conditions";
import ConditionMatch from "../utils/condition_match";
import {BollingerRecord, DoKhanana} from "../utils/eddie-chief-khanana";

export class SupervisorService {
    private redis: Redis;
    private analyzer: MarketCollector;

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
        this.analyzer = new MarketCollector(redisUrl);
        this.initializeEventListener();
    }

    private async initializeEventListener() {
        const subscriber = this.redis.duplicate();

        await subscriber.subscribe('market_events');

        setInterval(() => {
            this.gatherKhananaData();
        }, 1000);

        subscriber.on('message', async (channel, message) => {
            if (channel === 'market_events') {
                const event: MarketEvent = JSON.parse(message);
                await this.processEvent(event);
            }
        });
    }

    private async processEvent(event: MarketEvent) {
        this.botActivation(event);

        // try {
        //     // Get all supervisors watching this symbol
        //     const supervisors = await this.redis.hgetall('supervisors');
        //
        //     for (const [id, supervisorStr] of Object.entries(supervisors)) {
        //         const supervisor = JSON.parse(supervisorStr);
        //
        //         if (!supervisor.active || !this.matchesConditions(event, supervisor)) {
        //             continue;
        //         }
        //
        //         // Execute supervisor actions
        //         await this.executeActions(supervisor, event);
        //     }
        // } catch (error) {
        //     console.error('Error processing event:', error);
        // }
    }

    private matchesConditions(event: MarketEvent, supervisor: any): boolean {
        return supervisor.conditions.some((condition: any) => {
            // Check if condition matches event type
            if (condition.type !== event.type) return false;

            // Check if percentage threshold is met
            if (event.percentage < condition.percentage) return false;

            // Check timeframe
            if (condition.timeFrame !== event.timeFrame) return false;

            return true;
        });
    }

    private async executeActions(supervisor: any, event: MarketEvent) {
        for (const action of supervisor.actions) {
            try {
                // Publish bot activation event
                await this.redis.publish('bot_activation', JSON.stringify({
                    supervisorId: supervisor.id,
                    botId: action.botId,
                    event,
                    action
                }));

                // Log supervisor activity
                await this.redis.zadd(
                    `supervisor_activity:${supervisor.id}`,
                    Date.now(),
                    JSON.stringify({
                        event,
                        action,
                        timestamp: Date.now()
                    })
                );

            } catch (error) {
                console.error('Error executing supervisor action:', error);
            }
        }
    }

    public close() {
        this.analyzer.close();
        this.redis.disconnect();
    }

    private bots = [
        {
            id: 1,
            name: 'Le Racheteur',
            active: false,
            conditions: [
                {
                    type: 'PRICE',
                    percentage: -0.05,
                    period: 28,
                },
                {
                    type: 'VOLUME',
                    side: 'BUY',
                    percentage: 60,
                    period: 14,
                }
            ] as Condition[]
        }
    ]

    private async getLastPrices() {
        const prices = await this.redis.zrange('events:BTCUSDT:prices', -100, -1);

        return prices.map(price => JSON.parse(price));
    }

    private async getLastVolumes() {
        const volumes = await this.redis.zrange('events:BTCUSDT:depths', -100, -1);

        return volumes.map(volume => JSON.parse(volume));
    }

    private async botActivation(event: MarketEvent) {
        const lastPrices = await this.getLastPrices();
        const lastVolumes = await this.getLastVolumes();

        this.bots.filter(bot => {
            if(bot.active) return false;

            const name = bot.name;
            const conditions = bot.conditions;

            const conditionsMet =  conditions.every((condition: Condition) => {
                return (new ConditionMatch(condition, lastPrices, lastVolumes)).check();
            });

            if (conditionsMet) {
                bot.active = true;

                console.log(`Bot ${name} activated!`, {
                    price: lastPrices[lastPrices.length - 1].price,
                });
            }
        });
    }

    private async gatherKhananaData() {
        const indicators = (await this.redis.zrange('indicators:BTCUSDT', 0, 100, 'REV')).map(indicator => JSON.parse(indicator));

        const currentPrice = (await this.redis.zrange('events:BTCUSDT:prices', 0, 1, 'REV')).map(price => JSON.parse(price))[0].price;

        const bb: BollingerRecord[] = [
            {
                upper: indicators[0]?.latestBB?.upper ?? 0,
                lower: indicators[0]?.latestBB?.lower ?? 0,
                middle: indicators[0]?.latestBB?.average ?? 0,
                currentPrice: currentPrice,
            }
        ]

        const output = DoKhanana(
            indicators[0]?.mlKnn?.signal ?? 0,
            indicators[9]?.mlKnn?.signal ?? 0,
            indicators[59]?.mlKnn?.signal ?? 0,
            indicators[0]?.latestRSI ?? 0,
            indicators[0]?.shortEma ?? 0,
            indicators[0]?.longEma ?? 0,
            bb,
            indicators[0]?.latestMACD ?? 0
        );

        // Store event for history
        await this.redis.zadd(
            `eddie-chief-khana:BTCUSDT`,
            Date.now(),
            JSON.stringify(output)
        );

        await this.redis.zremrangebyrank(`eddie-chief-khana:BTCUSDT`, 0, -181);
    }
}