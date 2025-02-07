import {StrategyInputClaudeX1} from "./eddie-chief-claude-x1";
type Signal = 'BUY' | 'SELL' | 'HOLD';

export class TradingStrategyClaudeX3 {
    private readonly MIN_TRADES_GAP = 5; // Minimum candles between trades
    private lastTradeIndex = -10;

    public analyze(input: StrategyInputClaudeX1): Signal {
        if (this.isWithinCooldown()) {
            return 'HOLD';
        }

        const vwapSignal = this.analyzeVwapProfile(input);
        const volumeSignal = this.analyzeVolumeProfile(input);
        const rsiSignal = this.analyzeRsiDivergence(input);
        const confirmation = this.getConfirmation(input);

        if (this.isValidSetup(vwapSignal, volumeSignal, rsiSignal, confirmation)) {
            this.lastTradeIndex = 0;
            return vwapSignal;
        }

        this.lastTradeIndex++;
        return 'HOLD';
    }

    private isWithinCooldown(): boolean {
        return this.lastTradeIndex < this.MIN_TRADES_GAP;
    }

    private analyzeVwapProfile(input: StrategyInputClaudeX1): Signal {
        const price = input.prices[input.prices.length - 1];
        const vwap = input.vwap[input.vwap.length - 1];
        const bbMiddle = input.bollingerBands.middle[input.bollingerBands.middle.length - 1];

        const vwapDeviation = Math.abs((price - vwap) / vwap);
        const bbDeviation = Math.abs((price - bbMiddle) / bbMiddle);

        if (vwapDeviation > 0.015 && bbDeviation > 0.01) {
            return price < vwap ? 'BUY' : 'SELL';
        }

        return 'HOLD';
    }

    private analyzeVolumeProfile(input: StrategyInputClaudeX1): Signal {
        const recentBuyVol = input.buyVolumes.slice(-3);
        const recentSellVol = input.sellVolumes.slice(-3);
        const prevBuyVol = input.buyVolumes.slice(-6, -3);
        const prevSellVol = input.sellVolumes.slice(-6, -3);

        const buyVolChange = this.calculateVolumeTrend(recentBuyVol, prevBuyVol);
        const sellVolChange = this.calculateVolumeTrend(recentSellVol, prevSellVol);

        if (buyVolChange > 1.3 && sellVolChange < 0.8) return 'BUY';
        if (sellVolChange > 1.3 && buyVolChange < 0.8) return 'SELL';
        return 'HOLD';
    }

    private calculateVolumeTrend(recent: number[], previous: number[]): number {
        const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
        const prevAvg = previous.reduce((a, b) => a + b) / previous.length;
        return recentAvg / prevAvg;
    }

    private analyzeRsiDivergence(input: StrategyInputClaudeX1): Signal {
        const prices = input.prices.slice(-5);
        const rsi = input.rsi.slice(-5);

        const priceDirection = this.calculateTrend(prices);
        const rsiDirection = this.calculateTrend(rsi);

        if (priceDirection < 0 && rsiDirection > 0) return 'BUY';
        if (priceDirection > 0 && rsiDirection < 0) return 'SELL';
        return 'HOLD';
    }

    private calculateTrend(values: number[]): number {
        const first = values.slice(0, Math.floor(values.length / 2));
        const second = values.slice(Math.floor(values.length / 2));

        const firstAvg = first.reduce((a, b) => a + b) / first.length;
        const secondAvg = second.reduce((a, b) => a + b) / second.length;

        return secondAvg - firstAvg;
    }

    private getConfirmation(input: StrategyInputClaudeX1): boolean {
        const macd = input.macd[input.macd.length - 1];
        const prevMacd = input.macd[input.macd.length - 2];
        const stochK = input.stochastic.k[input.stochastic.k.length - 1];
        const stochD = input.stochastic.d[input.stochastic.d.length - 1];

        // Conservative confirmation criteria
        const isStochOverextended = stochK > 80 || stochK < 20;
        const isStochCrossing = Math.abs(stochK - stochD) < 3;
        const isMacdCrossing = (macd * prevMacd) < 0;

        return isStochOverextended && isStochCrossing && isMacdCrossing;
    }

    private isValidSetup(
        vwapSignal: Signal,
        volumeSignal: Signal,
        rsiSignal: Signal,
        confirmation: boolean
    ): boolean {
        return (
            vwapSignal !== 'HOLD' &&
            vwapSignal === volumeSignal &&
            vwapSignal === rsiSignal &&
            confirmation
        );
    }
}