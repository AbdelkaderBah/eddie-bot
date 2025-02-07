import {StrategyInputClaudeX1} from "./eddie-chief-claude-x1";
type Signal = 'BUY' | 'SELL' | 'HOLD';

interface ScalpSignal {
    strategy: string;
    signal: Signal;
    confidence: number;
    timeframe: string;
    consecutiveSignals: number;
}

export class TradingStrategyClaudeX6 {
    private readonly PROFIT_TARGET = 0.002;
    private readonly STOP_LOSS = 0.001;
    private readonly MIN_CONSECUTIVE_SIGNALS = 3;
    private readonly CONFIDENCE_THRESHOLD = 0.85;
    private signalHistory: Map<string, ScalpSignal[]> = new Map();

    public analyze(input: StrategyInputClaudeX1): Signal[] {
        const currentSignals = this.generateSignals(input);
        this.updateSignalHistory(currentSignals);
        return this.filterHighQualitySignals();
    }

    private generateSignals(input: StrategyInputClaudeX1): ScalpSignal[] {
        return [
            ...this.strongMomentumSignals(input),
            ...this.confirmedOrderFlowSignals(input),
            ...this.validatedBreakoutSignals(input)
        ];
    }

    private strongMomentumSignals(input: StrategyInputClaudeX1): ScalpSignal[] {
        const signals: ScalpSignal[] = [];
        const rsi = input.rsi.slice(-3);
        const price = input.prices.slice(-3);
        const vwap = input.vwap.slice(-3);
        const macd = input.macd.slice(-3);

        // Strong momentum with multiple confirmations
        if (rsi.every(r => r < 30) &&
            price.every((p, i) => p < vwap[i]) &&
            macd.every((m, i) => i > 0 && m > macd[i-1])) {
            signals.push({
                strategy: 'momentum',
                signal: 'BUY',
                confidence: 0.9,
                timeframe: 'ultra-short',
                consecutiveSignals: 1
            });
        }

        if (rsi.every(r => r > 70) &&
            price.every((p, i) => p > vwap[i]) &&
            macd.every((m, i) => i > 0 && m < macd[i-1])) {
            signals.push({
                strategy: 'momentum',
                signal: 'SELL',
                confidence: 0.9,
                timeframe: 'ultra-short',
                consecutiveSignals: 1
            });
        }

        return signals;
    }

    private confirmedOrderFlowSignals(input: StrategyInputClaudeX1): ScalpSignal[] {
        const signals: ScalpSignal[] = [];
        const buyVol = input.buyVolumes.slice(-5);
        const sellVol = input.sellVolumes.slice(-5);

        const buyTrend = this.calculateVolumeTrend(buyVol);
        const sellTrend = this.calculateVolumeTrend(sellVol);

        if (buyTrend > 0.8 && sellTrend < 0.3) {
            signals.push({
                strategy: 'orderflow',
                signal: 'BUY',
                confidence: buyTrend,
                timeframe: 'micro',
                consecutiveSignals: 1
            });
        }

        return signals;
    }

    private calculateAvgVolume(buyVol: number[], sellVol: number[], period: number): number {
        const totalVol = buyVol.slice(-period).map((buy, i) =>
            buy + sellVol[sellVol.length - period + i]
        );
        return totalVol.reduce((a, b) => a + b) / period;
    }

    private validatedBreakoutSignals(input: StrategyInputClaudeX1): ScalpSignal[] {
        const signals: ScalpSignal[] = [];
        const bb = input.bollingerBands;
        const prices = input.prices.slice(-3);
        const volumes = this.calculateRecentVolumes(input, 3);
        const avgVolume = this.calculateAvgVolume(input.buyVolumes, input.sellVolumes, 20);

        if (prices.every(p => p > bb.upper[bb.upper.length - 1]) &&
            volumes.every(v => v > avgVolume * 2)) {
            signals.push({
                strategy: 'breakout',
                signal: 'BUY',
                confidence: 0.85,
                timeframe: 'short',
                consecutiveSignals: 1
            });
        }

        return signals;
    }

    private calculateVolumeTrend(volumes: number[]): number {
        const changes = volumes.map((vol, i) =>
            i > 0 ? (vol - volumes[i-1]) / volumes[i-1] : 0
        ).slice(1);
        return changes.filter(c => c > 0).length / changes.length;
    }

    private calculateRecentVolumes(input: StrategyInputClaudeX1, period: number): number[] {
        return input.buyVolumes.slice(-period).map((buy, i) =>
            buy + input.sellVolumes[input.sellVolumes.length - period + i]
        );
    }

    private updateSignalHistory(currentSignals: ScalpSignal[]) {
        currentSignals.forEach(signal => {
            const key = `${signal.strategy}-${signal.signal}`;
            const history = this.signalHistory.get(key) || [];

            if (history.length > 0 &&
                this.isConsistentSignal(history[history.length - 1], signal)) {
                signal.consecutiveSignals = history[history.length - 1].consecutiveSignals + 1;
            }

            history.push(signal);
            if (history.length > 10) history.shift();
            this.signalHistory.set(key, history);
        });
    }

    private isConsistentSignal(prev: ScalpSignal, current: ScalpSignal): boolean {
        return prev.strategy === current.strategy &&
            prev.signal === current.signal &&
            Math.abs(prev.confidence - current.confidence) < 0.1;
    }

    private filterHighQualitySignals(): Signal[] {
        const highQualitySignals: Signal[] = [];

        this.signalHistory.forEach((history, key) => {
            const recentSignals = history.slice(-this.MIN_CONSECUTIVE_SIGNALS);

            if (recentSignals.length === this.MIN_CONSECUTIVE_SIGNALS &&
                recentSignals.every(s => s.confidence >= this.CONFIDENCE_THRESHOLD) &&
                recentSignals[recentSignals.length - 1].consecutiveSignals >= this.MIN_CONSECUTIVE_SIGNALS) {

                highQualitySignals.push(recentSignals[0].signal);
            }
        });

        return highQualitySignals.length > 0 ? highQualitySignals : ['HOLD'];
    }
}