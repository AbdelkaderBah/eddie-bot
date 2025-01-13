// services/SupervisorService.ts
import { Redis } from 'ioredis';
import { MarketAnalyzer } from './MarketAnalyzer';
import { MarketEvent } from '../types/market';

export class SupervisorService {
    private redis: Redis;
    private analyzer: MarketAnalyzer;

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
        this.analyzer = new MarketAnalyzer(redisUrl);
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
            // Get all supervisors watching this symbol
            const supervisors = await this.redis.hgetall('supervisors');

            for (const [id, supervisorStr] of Object.entries(supervisors)) {
                const supervisor = JSON.parse(supervisorStr);

                if (!supervisor.active || !this.matchesConditions(event, supervisor)) {
                    continue;
                }

                // Execute supervisor actions
                await this.executeActions(supervisor, event);
            }
        } catch (error) {
            console.error('Error processing event:', error);
        }
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
}