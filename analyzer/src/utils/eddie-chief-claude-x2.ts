import {StrategyInputClaudeX1} from "./eddie-chief-claude-x1";

type Signal = 'BUY' | 'SELL' | 'HOLD';


export class TradingStrategyClaudeX2 {
    private readonly RSI_LOW = 35;
    private readonly RSI_HIGH = 65;
    private readonly BB_THRESHOLD = 0.85;
    private readonly STOCH_LOW = 25;
    private readonly STOCH_HIGH = 75;

    public analyze(input: StrategyInputClaudeX1): Signal {
        // Calculate price momentum
        const momentum = this.calculateMomentum(input.prices);

        // Check for oversold conditions
        if (this.isStrongOversold(input)) {
            return momentum > 0 ? 'BUY' : 'HOLD';
        }

        // Check for overbought conditions
        if (this.isStrongOverbought(input)) {
            return momentum < 0 ? 'SELL' : 'HOLD';
        }

        // Check for trend reversals
        const reversal = this.detectReversal(input);
        if (reversal !== 'HOLD') {
            return reversal;
        }

        return 'HOLD';
    }

    private calculateMomentum(prices: number[]): number {
        const recent = prices.slice(-5);
        const previous = prices.slice(-10, -5);
        return (recent.reduce((a, b) => a + b) / 5) - (previous.reduce((a, b) => a + b) / 5);
    }

    private isStrongOversold(input: StrategyInputClaudeX1): boolean {
        const price = input.prices[input.prices.length - 1];
        const bb = input.bollingerBands;
        const rsi = input.rsi[input.rsi.length - 1];
        const stoch = input.stochastic.k[input.stochastic.k.length - 1];
        const vwap = input.vwap[input.vwap.length - 1];

        const bbDistance = (price - bb.lower[bb.lower.length - 1]) /
            (bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1]);

        return (
            bbDistance < this.BB_THRESHOLD &&
            rsi < this.RSI_LOW &&
            stoch < this.STOCH_LOW &&
            price < vwap * 0.98
        );
    }

    private isStrongOverbought(input: StrategyInputClaudeX1): boolean {
        const price = input.prices[input.prices.length - 1];
        const bb = input.bollingerBands;
        const rsi = input.rsi[input.rsi.length - 1];
        const stoch = input.stochastic.k[input.stochastic.k.length - 1];
        const vwap = input.vwap[input.vwap.length - 1];

        const bbDistance = (price - bb.lower[bb.lower.length - 1]) /
            (bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1]);

        return (
            bbDistance > (1 - this.BB_THRESHOLD) &&
            rsi > this.RSI_HIGH &&
            stoch > this.STOCH_HIGH &&
            price > vwap * 1.02
        );
    }

    private detectReversal(input: StrategyInputClaudeX1): Signal {
        const macdCrossover = this.detectMacdCrossover(input.macd);
        const emaCrossover = this.detectEmaCrossover(input.shortEma, input.longEma);
        const volumeSpike = this.detectVolumeSpike(input.buyVolumes, input.sellVolumes);

        // Need at least 2 confirmation signals
        const signals = [macdCrossover, emaCrossover, volumeSpike].filter(s => s !== 'HOLD');
        if (signals.length >= 2 && signals.every(s => s === signals[0])) {
            return signals[0];
        }

        return 'HOLD';
    }

    private detectMacdCrossover(macd: number[]): Signal {
        const current = macd[macd.length - 1];
        const previous = macd[macd.length - 2];

        if (previous < 0 && current > 0) return 'BUY';
        if (previous > 0 && current < 0) return 'SELL';
        return 'HOLD';
    }

    private detectEmaCrossover(shortEma: number[], longEma: number[]): Signal {
        const currentShort = shortEma[shortEma.length - 1];
        const previousShort = shortEma[shortEma.length - 2];
        const currentLong = longEma[longEma.length - 1];
        const previousLong = longEma[longEma.length - 2];

        if (previousShort <= previousLong && currentShort > currentLong) return 'BUY';
        if (previousShort >= previousLong && currentShort < currentLong) return 'SELL';
        return 'HOLD';
    }

    private detectVolumeSpike(buyVolumes: number[], sellVolumes: number[]): Signal {
        const recentBuyVol = buyVolumes.slice(-3).reduce((a, b) => a + b) / 3;
        const avgBuyVol = buyVolumes.slice(-10).reduce((a, b) => a + b) / 10;
        const recentSellVol = sellVolumes.slice(-3).reduce((a, b) => a + b) / 3;
        const avgSellVol = sellVolumes.slice(-10).reduce((a, b) => a + b) / 10;

        if (recentBuyVol > avgBuyVol * 1.5) return 'BUY';
        if (recentSellVol > avgSellVol * 1.5) return 'SELL';
        return 'HOLD';
    }
}