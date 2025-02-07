import {StrategyInputClaudeX1} from "./eddie-chief-claude-x1";
type Signal = 'BUY' | 'SELL' | 'HOLD';

interface MicroSignal {
    signal: Signal;
    confidence: number;
    type: 'reversal' | 'continuation' | 'breakout';
}

export class TradingStrategyClaudeX7 {
    private readonly PRICE_LEVELS = 33;
    private readonly MIN_CONFIDENCE = 0.77;
    private priceMap: Map<number, number> = new Map();

    public analyze(input: StrategyInputClaudeX1): Signal[] {
        this.updatePriceMap(input.prices);

        const signals: MicroSignal[] = [
            ...this.analyzePriceClusters(input),
            ...this.detectMicroDivergences(input),
            ...this.findVolumeImbalances(input),
            ...this.spotPriceInefficiencies(input)
        ];

        return this.aggregateSignals(signals);
    }

    private updatePriceMap(prices: number[]): void {
        const recent = prices.slice(-100);
        const min = Math.min(...recent);
        const max = Math.max(...recent);
        const step = (max - min) / this.PRICE_LEVELS;

        this.priceMap.clear();
        recent.forEach(price => {
            const level = Math.floor((price - min) / step);
            this.priceMap.set(level, (this.priceMap.get(level) || 0) + 1);
        });
    }

    private analyzePriceClusters(input: StrategyInputClaudeX1): MicroSignal[] {
        const signals: MicroSignal[] = [];
        const currentPrice = input.prices[input.prices.length - 1];
        const vwap = input.vwap[input.vwap.length - 1];

        // Find price clusters and potential reversal points
        const sortedLevels = Array.from(this.priceMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        sortedLevels.forEach(([level, count]) => {
            const strength = count / 100;
            if (currentPrice > vwap && strength > 0.3) {
                signals.push({
                    signal: 'SELL',
                    confidence: strength,
                    type: 'reversal'
                });
            } else if (currentPrice < vwap && strength > 0.3) {
                signals.push({
                    signal: 'BUY',
                    confidence: strength,
                    type: 'reversal'
                });
            }
        });

        return signals;
    }

    private detectMicroDivergences(input: StrategyInputClaudeX1): MicroSignal[] {
        const signals: MicroSignal[] = [];
        const prices = input.prices.slice(-20);
        const rsi = input.rsi.slice(-20);
        const macd = input.macd.slice(-20);

        // Price making higher highs but indicators making lower highs
        const priceHighs = this.findLocalExtremes(prices, 'high');
        const rsiHighs = this.findLocalExtremes(rsi, 'high');
        const macdHighs = this.findLocalExtremes(macd, 'high');

        if (this.isDiverging(priceHighs, rsiHighs, 'bearish') &&
            this.isDiverging(priceHighs, macdHighs, 'bearish')) {
            signals.push({
                signal: 'SELL',
                confidence: 0.8,
                type: 'reversal'
            });
        }

        // Price making lower lows but indicators making higher lows
        const priceLows = this.findLocalExtremes(prices, 'low');
        const rsiLows = this.findLocalExtremes(rsi, 'low');
        const macdLows = this.findLocalExtremes(macd, 'low');

        if (this.isDiverging(priceLows, rsiLows, 'bullish') &&
            this.isDiverging(priceLows, macdLows, 'bullish')) {
            signals.push({
                signal: 'BUY',
                confidence: 0.8,
                type: 'reversal'
            });
        }

        return signals;
    }

    private findVolumeImbalances(input: StrategyInputClaudeX1): MicroSignal[] {
        const signals: MicroSignal[] = [];
        const buyVol = input.buyVolumes.slice(-10);
        const sellVol = input.sellVolumes.slice(-10);

        const buyAccumulation = this.calculateAccumulation(buyVol);
        const sellAccumulation = this.calculateAccumulation(sellVol);
        const deltaAccumulation = buyAccumulation - sellAccumulation;

        if (Math.abs(deltaAccumulation) > 0.3) {
            signals.push({
                signal: deltaAccumulation > 0 ? 'BUY' : 'SELL',
                confidence: Math.min(Math.abs(deltaAccumulation), 0.9),
                type: 'continuation'
            });
        }

        return signals;
    }

    private spotPriceInefficiencies(input: StrategyInputClaudeX1): MicroSignal[] {
        const signals: MicroSignal[] = [];
        const bb = input.bollingerBands;
        const knn = input.knn.slice(-5);
        const price = input.prices[input.prices.length - 1];

        // Detect potential price inefficiencies using BB and kNN
        const bbMiddle = bb.middle[bb.middle.length - 1];
        const bbWidth = bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1];
        const knnTrend = this.calculateKnnTrend(knn);

        const priceDeviation = Math.abs(price - bbMiddle) / bbWidth;

        if (priceDeviation > 0.8) {
            const signal: Signal = price > bbMiddle ? 'SELL' : 'BUY';
            const knnConfirmation = (signal === 'BUY' && knnTrend > 0) ||
                (signal === 'SELL' && knnTrend < 0);

            if (knnConfirmation) {
                signals.push({
                    signal,
                    confidence: 0.7 + Math.min(Math.abs(knnTrend), 0.2),
                    type: 'breakout'
                });
            }
        }

        return signals;
    }

    private findLocalExtremes(data: number[], type: 'high' | 'low'): number[] {
        const result: number[] = [];
        const compare = type === 'high' ?
            (a: number, b: number) => a > b :
            (a: number, b: number) => a < b;

        for (let i = 1; i < data.length - 1; i++) {
            if (compare(data[i], data[i - 1]) && compare(data[i], data[i + 1])) {
                result.push(data[i]);
            }
        }
        return result;
    }

    private isDiverging(
        priceExtremes: number[],
        indicatorExtremes: number[],
        type: 'bullish' | 'bearish'
    ): boolean {
        if (priceExtremes.length < 2 || indicatorExtremes.length < 2) return false;

        const priceTrend = priceExtremes[priceExtremes.length - 1] -
            priceExtremes[priceExtremes.length - 2];
        const indicatorTrend = indicatorExtremes[indicatorExtremes.length - 1] -
            indicatorExtremes[indicatorExtremes.length - 2];

        return type === 'bullish' ?
            (priceTrend < 0 && indicatorTrend > 0) :
            (priceTrend > 0 && indicatorTrend < 0);
    }

    private calculateAccumulation(volumes: number[]): number {
        const recent = volumes.slice(-3);
        const previous = volumes.slice(-6, -3);
        return (recent.reduce((a, b) => a + b, 0) / 3) /
            (previous.reduce((a, b) => a + b, 0) / 3);
    }

    private calculateKnnTrend(knn: number[]): number {
        const changes = knn.slice(1).map((val, i) => val - knn[i]);
        return changes.reduce((a, b) => a + b, 0) / knn[0];
    }

    private aggregateSignals(signals: MicroSignal[]): Signal[] {
        const typeWeights = {
            reversal: 0.4,
            continuation: 0.3,
            breakout: 0.3
        };

        const aggregated: Signal[] = [];

        ['reversal', 'continuation', 'breakout'].forEach(type => {
            const typeSignals = signals.filter(s => s.type === type);
            if (typeSignals.length === 0) {
                aggregated.push('HOLD');
                return;
            }

            const buyConf = typeSignals
                .filter(s => s.signal === 'BUY')
                .reduce((acc, s) => acc + s.confidence * typeWeights[s.type], 0);

            const sellConf = typeSignals
                .filter(s => s.signal === 'SELL')
                .reduce((acc, s) => acc + s.confidence * typeWeights[s.type], 0);

            if (buyConf > this.MIN_CONFIDENCE && buyConf > sellConf) {
                aggregated.push('BUY');
            } else if (sellConf > this.MIN_CONFIDENCE && sellConf > buyConf) {
                aggregated.push('SELL');
            } else {
                aggregated.push('HOLD');
            }
        });

        return aggregated;
    }
}