// services/SupervisorService.ts
import {Redis} from 'ioredis';
import {MarketCollector} from './MarketCollector';
import {MarketEvent} from '../types/market';
import {Condition} from "../types/conditions";
import ConditionMatch from "../utils/condition_match";
import {BollingerRecord, DoKhanana} from "../utils/eddie-chief-khanana";
import {DoBuyerS1} from "../utils/eddie-chief-buyer-s1";
import {DOSellerS1} from "../utils/eddie-chief-seller-s1";
import {DoAdvancedS1} from "../utils/eddie-chief-advanced-s1";
import {HelpAfterGod} from "../utils/eddie-chief-help-after-god";
import {marketBeaterStrategy} from "../utils/eddie-chief-beater";
import {StrategyInputClaudeX1, TradingStrategyClaudeX1} from "../utils/eddie-chief-claude-x1";
import {TradingStrategyClaudeX2} from "../utils/eddie-chief-claude-x2";
import {TradingStrategyClaudeX3} from "../utils/eddie-chief-claude-x3";
import {TradingStrategyClaudeX4} from "../utils/eddie-chief-claude-x4";
import {TradingStrategyClaudeX5} from "../utils/eddie-chief-claude-x5";
import {TradingStrategyClaudeX6} from "../utils/eddie-chief-claude-x6";
import {TradingStrategyClaudeX7} from "../utils/eddie-chief-claude-x7";
import {TradingStrategyClaudeX8} from "../utils/eddie-chief-claude-x8";

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
            this.gatherChatgptData();
        }, 1500);

        setInterval(() => {
            this.gatherBuyerX1Data();
        }, 7500);

        setInterval(() => {
            this.gatherClaudeX1Data();
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
            // disabled...
            active: true,
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
        if(this.bots.every(bot => bot.active)) return;

        const lastPrices = await this.getLastPrices();
        const lastVolumes = await this.getLastVolumes();

        if (lastPrices.length < 80 || lastVolumes.length < 80) return;

        this.bots.filter(bot => {
            if (bot.active) return false;

            const name = bot.name;
            const conditions = bot.conditions;

            const conditionsMet = conditions.every((condition: Condition) => {
                return (new ConditionMatch(condition, lastPrices, lastVolumes)).check();
            });

            if (conditionsMet) {
                bot.active = true;

                this.redis.publish('trades:waiting', JSON.stringify({
                    name,
                    side: 'LONG',
                    leverage: 1,
                    amountInUSD: 100,
                    stopLoss: undefined,
                    takeProfit: undefined,
                }));
            }
        });
    }

    private async gatherChatgptData() {
        const indicators = (await this.redis.zrange('indicators:BTCUSDT', 0, 100, 'REV')).map(indicator => JSON.parse(indicator));

        if (indicators.length < 60) return;

        const currentPrice = (await this.redis.zrange('events:BTCUSDT:prices', 0, 1, 'REV')).map(price => JSON.parse(price))[0].price;

        const volumes = (await this.redis.zrange('events:BTCUSDT:depths', 0, 20, 'REV')).map(indicator => JSON.parse(indicator));

        const bb: BollingerRecord[] = [
            {
                upper: indicators[0]?.latestBB?.upper ?? 0,
                lower: indicators[0]?.latestBB?.lower ?? 0,
                middle: indicators[0]?.latestBB?.average ?? 0,
                currentPrice: currentPrice,
            }
        ]

        const outputKhanana = DoKhanana(
            indicators[0]?.mlKnn?.signal ?? 0,
            indicators[9]?.mlKnn?.signal ?? 0,
            indicators[59]?.mlKnn?.signal ?? 0,
            indicators[0]?.latestRSI ?? 0,
            indicators[0]?.shortEma ?? 0,
            indicators[0]?.longEma ?? 0,
            bb,
            indicators[0]?.latestMACD ?? 0,
        );

        const outputHelpAfterGod = HelpAfterGod(
            indicators.slice(0, 10).map(indicator => indicator?.mlKnn?.signal),
            indicators.slice(0, 10).map(indicator => indicator?.latestRSI),
            volumes.slice(0, 10).map(volume => volume.additionalData.buyVolume),
            volumes.slice(0, 10).map(volume => volume.additionalData.sellVolume),
            (await this.redis.zrange('events:BTCUSDT:prices', 0, 60, 'REV')).map(price => JSON.parse(price).price)
        );


        const outputMarketBeaterStrategy = marketBeaterStrategy(
            indicators.slice(0, 10).map(indicator => indicator?.mlKnn?.signal),
            indicators.slice(0, 10).map(indicator => indicator?.latestRSI),
            volumes.slice(0, 10).map(volume => volume.additionalData.buyVolume),
            volumes.slice(0, 10).map(volume => volume.additionalData.sellVolume),
            (await this.redis.zrange('events:BTCUSDT:prices', 0, 60, 'REV')).map(price => JSON.parse(price).price),
            indicators[0]?.movingAverage ?? 0,
            volumes.reduce((acc, volume) => acc + volume.volume, 0) / volumes.length,
        );

        const outputAdvancedS1 = DoAdvancedS1(
            indicators[0]?.mlKnn?.signal ?? 0,
            indicators[9]?.mlKnn?.signal ?? 0,
            indicators[59]?.mlKnn?.signal ?? 0,
            indicators[0]?.latestRSI ?? 0,
            indicators[0]?.shortEma ?? 0,
            indicators[0]?.longEma ?? 0,
            bb[0],
            indicators[0]?.latestMACD ?? 0,
            indicators[0]?.movingAverage ?? 0,
            //@ts-ignore
            {
                currentVolume: volumes[0]?.volume,
                avgVolume: volumes.reduce((acc, volume) => acc + volume.volume, 0) / volumes.length
            }
        );

        if (outputHelpAfterGod.decision !== 'HOLD') {
            this.createTrade('help-after-god', outputHelpAfterGod.decision);
        }

        if (outputAdvancedS1.decision !== 'HOLD') {
            this.createTrade('advanced-s1', outputAdvancedS1.decision);
        }

        if (outputKhanana !== 'HOLD') {
            this.createTrade('khanana', outputKhanana);
        }

        this.marketBeaterStrategy(outputMarketBeaterStrategy.decision);

        // Store event for history
        await this.redis.zadd(
            `eddie-chief-advanced:BTCUSDT`,
            Date.now(),
            JSON.stringify({
                outputKhanana,
                outputAdvancedS1,
                outputHelpAfterGod,
                outputMarketBeaterStrategy,
                timestamp: Date.now(),
            })
        );

        await this.redis.zremrangebyrank(`eddie-chief-advanced:BTCUSDT`, 0, -181);
    }

    private async gatherBuyerX1Data() {
        const indicators = (await this.redis.zrange('indicators:BTCUSDT', 0, 1, 'REV')).map(indicator => JSON.parse(indicator));
        const volumes = (await this.redis.zrange('events:BTCUSDT:depths', 0, 20, 'REV')).map(indicator => JSON.parse(indicator));

        // @ts-ignore
        const mlKNN = {
            '1': 'BUY',
            '-1': 'SELL',
            '0': 'HOLD',
        }[(indicators[0]?.mlKnn?.signal ?? 0).toString()];

        const rsi = indicators[0]?.latestRSI ?? 0;

        let BuyVolumes = [];
        let SellVolumes = [];

        let i = 0;
        for (const volume of volumes) {
            if (i < 5) BuyVolumes.push(volume.additionalData.buyVolume);

            SellVolumes.push(volume.additionalData.sellVolume);

            i++;
        }

        const outputBuyerS1 = DoBuyerS1(mlKNN, rsi, BuyVolumes, SellVolumes);
        const outputSellerS1 = DOSellerS1(mlKNN, rsi, BuyVolumes, SellVolumes);

        if (outputBuyerS1 !== 'HOLD' || outputSellerS1 !== 'HOLD') {
            console.log('Eddie chief', {
                outputBuyerS1,
                outputSellerS1,
                timestamp: Date.now(),
            });
        }

        if (outputBuyerS1 === 'BUY') {
            this.createTrade('buyer-s1', outputBuyerS1);
        }

        if (outputSellerS1 === 'SELL') {
            this.createTrade('buyer-s1', outputSellerS1);
        }

        // Store event for history
        await this.redis.zadd(
            `eddie-chief-s1:BTCUSDT`,
            Date.now(),
            JSON.stringify({
                outputBuyerS1,
                outputSellerS1,
                timestamp: Date.now()
            })
        );

        await this.redis.zremrangebyrank(`eddie-chief-s1:BTCUSDT`, 0, -181);
    }

    private async createTrade(name: string, decision: "BUY" | "SELL") {
        const [cursor, elements] = await this.redis.hscan('trade:active', 0, 'MATCH', `${name}*`)

        if (elements.length) {
            console.log('Trade already active', name);
            return;
        }

        this.redis.publish('trades:waiting', JSON.stringify({
            name,
            side: decision === 'BUY' ? 'LONG' : 'SHORT',
            leverage: 1,
            amountInUSD: 100,
            stopLoss: undefined,
            takeProfit: undefined,
        }));
    }

    private marketBeats = {'BUY': 0, 'SELL': 0, 'HOLD': 0};
    private marketBeatsCount = 0;

    private marketBeaterStrategy(decision: 'HOLD' | 'BUY' | 'SELL') {
        this.marketBeatsCount++;

        this.marketBeats[decision]++;

        if (this.marketBeatsCount < 10) return;

        this.marketBeatsCount = -60;

        if (this.marketBeats['BUY'] > 4 && this.marketBeats['SELL'] > 2) {
            this.createTrade('market-beater', 'BUY');
        } else if (this.marketBeats['SELL'] > 4 && this.marketBeats['BUY'] > 2) {
            this.createTrade('market-beater', 'SELL');
        }

        this.marketBeats = {'BUY': 0, 'SELL': 0, 'HOLD': 0};
    }

    private claudeData: StrategyInputClaudeX1[] = [];

    private async gatherClaudeX1Data() {
        const claude = new TradingStrategyClaudeX1();

        const prices = (await this.getLastPrices()).reverse();
        const volumes = (await this.getLastVolumes()).reverse();
        const indicators = (await this.redis.zrange('indicators:BTCUSDT', 0, 100, 'REV')).map(indicator => JSON.parse(indicator)).reverse();

        if (prices.length < 60 || volumes.length < 60 || indicators.length < 10) return;

        const data: StrategyInputClaudeX1 = {
            prices,
            buyVolumes: volumes.slice(0, 10).map(volume => volume.additionalData.buyVolume),
            sellVolumes: volumes.slice(0, 10).map(volume => volume.additionalData.sellVolume),
            knn: indicators.slice(0, 10).map(indicator => indicator?.mlKnn?.signal),
            macd: indicators.slice(0, 10).map(indicator => indicator?.latestMACD),
            rsi: indicators.slice(0, 10).map(indicator => indicator?.latestRSI),
            bollingerBands: indicators.slice(-1).map(indicator => ({
                upper: [indicator?.latestBB?.upper ?? 0],
                middle: [indicator?.latestBB?.average ?? 0],
                lower: [indicator?.latestBB?.lower ?? 0],
            }))[0],
            shortEma: indicators.slice(0, 10).map(indicator => indicator?.shortEma),
            longEma: indicators.slice(0, 10).map(indicator => indicator?.longEma),
            stochastic: indicators.slice(-1).map(indicator => ({
                k: [indicator?.stochasticOscillatorSignal.k],
                d: [indicator?.stochasticOscillatorSignal.d],
            }))[0],
            vwap: indicators.slice(0, 10).map(indicator => indicator?.latestVWAP),
        };

        this.claudeData.push(data);

        // @todo: make expensive calculations Promise

        const outputX1 = claude.analyze(data);

        if (outputX1 !== 'HOLD') {
            this.createTrade('claude-x1', outputX1);
        }

        const claudeX2 = new TradingStrategyClaudeX2();

        const outputX2 = claudeX2.analyze(data);

        if (outputX2 !== 'HOLD') {
            this.createTrade('claude-x2', outputX2);
        }

        const claudeX3 = new TradingStrategyClaudeX3();

        const outputX3 = claudeX3.analyze(data);

        if (outputX3 !== 'HOLD') {
            this.createTrade('claude-x3', outputX3);
        }

        const claudeX4 = new TradingStrategyClaudeX4();

        const outputX4 = claudeX4.analyze(data);

        if (outputX4 !== 'HOLD') {
            this.createTrade('claude-x4', outputX4);
        }

        const claudeX5 = new TradingStrategyClaudeX5();

        const outputX5 = claudeX5.analyze({
            inputs: this.claudeData
        });

        if(this.claudeData.length > 30){
            this.claudeData.shift();
        }

        if (outputX5 !== 'HOLD') {
            this.createTrade('claude-x5', outputX5);
        }

        const claudeX6 = new TradingStrategyClaudeX6();

        const outputX6 = claudeX6.analyze(data);

        let i = 0;

        for (const signal of outputX6) {
            i++;
            if (signal !== 'HOLD') {
                this.createTrade('claude-x6:' + i, signal);
            }
        }

        const claudeX7 = new TradingStrategyClaudeX7();

        const outputX7 = claudeX7.analyze(data);

        let x = 0;

        for (const signal of outputX7) {
            x++;
            if (signal !== 'HOLD') {
                this.createTrade('claude-x7:' + x, signal);
            }
        }

        const claudeX8 = new TradingStrategyClaudeX8();

        const outputX8 = claudeX8.analyze(data);

        let z = 0;

        for (const signal of outputX8) {
            z++;
            if (signal !== 'HOLD') {
                this.createTrade('claude-x8:' + z, signal);
            }
        }
    }
}