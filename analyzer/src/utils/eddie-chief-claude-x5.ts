import {StrategyInputClaudeX1} from "./eddie-chief-claude-x1";
type Signal = 'BUY' | 'SELL' | 'HOLD';

export interface MultiStrategyInputClaudeX1 {
    inputs: StrategyInputClaudeX1[];  // Array of 10 strategy inputs
}

export class TradingStrategyClaudeX5 {
    private readonly CONFIDENCE_THRESHOLD = 0.75;
    private readonly REVERSION_STRENGTH = 2.0;
    private readonly MIN_PATTERN_STRENGTH = 0.65;
    private readonly LOOKBACK_WINDOW = 10;

    private historicalPatterns: { pattern: number[], result: 'BUY' | 'SELL' | 'HOLD' }[] = [];
    private lastCalculatedEntropy: number = 0;
    private marketRegime: 'MEAN_REVERTING' | 'TRENDING' | 'UNKNOWN' = 'UNKNOWN';

    public analyze(multiInput: MultiStrategyInputClaudeX1): Signal {
        this.updateMarketRegime(multiInput);
        const currentPattern = this.detectCurrentPattern(multiInput);
        const edge = this.calculateStatisticalEdge(multiInput, currentPattern);

        if (edge.confidence < this.CONFIDENCE_THRESHOLD) {
            return 'HOLD';
        }

        // Pattern strength validation using MIN_PATTERN_STRENGTH
        const patternStrength = this.calculatePatternStrength(currentPattern);
        if (patternStrength < this.MIN_PATTERN_STRENGTH) {
            return 'HOLD';
        }

        // Apply reversion analysis using REVERSION_STRENGTH
        if (this.marketRegime === 'MEAN_REVERTING') {
            const reversionScore = this.calculateReversionScore(multiInput);
            if (Math.abs(reversionScore) < this.REVERSION_STRENGTH) {
                return 'HOLD';
            }
            if (reversionScore > this.REVERSION_STRENGTH) {
                return 'SELL';
            }
            if (reversionScore < -this.REVERSION_STRENGTH) {
                return 'BUY';
            }
        }

        return this.generateSignal(edge, multiInput);
    }

    private calculatePatternStrength(pattern: number[]): number {
        if (this.historicalPatterns.length < 10) return 0;

        const similarPatterns = this.historicalPatterns
            .map(hp => ({
                pattern: hp.pattern,
                similarity: 1 - this.calculateEuclideanDistance(pattern, hp.pattern)
            }))
            .filter(p => p.similarity > 0.8);

        return similarPatterns.length / this.historicalPatterns.length;
    }

    private calculateReversionScore(multiInput: MultiStrategyInputClaudeX1): number {
        const mainInput = multiInput.inputs[0];
        const price = mainInput.prices[mainInput.prices.length - 1];
        const vwap = mainInput.vwap[mainInput.vwap.length - 1];
        const bb = mainInput.bollingerBands;
        const middleBB = bb.middle[bb.middle.length - 1];

        const priceDeviation = (price - middleBB) / middleBB;
        const vwapDeviation = (price - vwap) / vwap;

        return (priceDeviation + vwapDeviation) * 100;
    }

    private calculateHurstExponent(prices: number[]): number {
        const periods = [2, 4, 8, 16];
        const ranges: number[] = [];
        const deviations: number[] = [];

        periods.forEach(period => {
            const segments = Math.floor(prices.length / period);
            let rangeSum = 0;
            let devSum = 0;

            for (let i = 0; i < segments; i++) {
                const segment = prices.slice(i * period, (i + 1) * period);
                const range = Math.max(...segment) - Math.min(...segment);
                const std = this.calculateStandardDeviation(segment);

                rangeSum += range;
                devSum += std;
            }

            ranges.push(Math.log(rangeSum / segments));
            deviations.push(Math.log(devSum / segments));
        });

        const x = deviations;
        const y = ranges;
        const slope = this.calculateLinearRegression(x, y);

        return slope;
    }

    private updateMarketRegime(multiInput: MultiStrategyInputClaudeX1): void {
        const hurstValues = multiInput.inputs.map(input =>
            this.calculateHurstExponent(input.prices)
        );

        const averageHurst = hurstValues.reduce((a, b) => a + b) / hurstValues.length;

        if (averageHurst < 0.45) {
            this.marketRegime = 'MEAN_REVERTING';
        } else if (averageHurst > 0.55) {
            this.marketRegime = 'TRENDING';
        } else {
            this.marketRegime = 'UNKNOWN';
        }
    }

    private calculateMarketEntropy(multiInput: MultiStrategyInputClaudeX1): number {
        const entropyValues = multiInput.inputs.map(input => {
            const priceChanges = input.prices.slice(1).map((p, i) => p - input.prices[i]);
            const volumeChanges = input.buyVolumes.slice(1).map((v, i) => v - input.buyVolumes[i]);
            const rsiChanges = input.rsi.slice(1).map((r, i) => r - input.rsi[i]);

            const priceEntropy = this.calculateShannonEntropy(this.discretize(priceChanges));
            const volumeEntropy = this.calculateShannonEntropy(this.discretize(volumeChanges));
            const rsiEntropy = this.calculateShannonEntropy(this.discretize(rsiChanges));

            return (priceEntropy + volumeEntropy + rsiEntropy) / 3;
        });

        this.lastCalculatedEntropy = entropyValues.reduce((a, b) => a + b) / entropyValues.length;
        return this.lastCalculatedEntropy;
    }

    private detectCurrentPattern(multiInput: MultiStrategyInputClaudeX1): number[] {
        return multiInput.inputs.flatMap(input => {
            const window = 5;
            return [
                ...this.normalizeArray(input.prices.slice(-window)),
                ...this.normalizeArray(input.rsi.slice(-window)),
                ...this.normalizeArray(input.macd.slice(-window)),
                ...this.normalizeArray(input.knn.slice(-window))
            ];
        });
    }

    private calculateStatisticalEdge(
        multiInput: MultiStrategyInputClaudeX1,
        currentPattern: number[]
    ): { signal: Signal; confidence: number } {
        const edges = multiInput.inputs.map(input => ({
            knn: this.predictUsingKNN(currentPattern),
            technical: this.analyzeTechnicals(input),
            volume: this.analyzeVolumeProfile(input)
        }));

        const signalStrength = {
            BUY: 0,
            SELL: 0,
            HOLD: 0
        };

        edges.forEach((edge, index) => {
            const timeframeWeight = 1 / Math.pow(1.5, index); // Higher timeframes have less weight

            if (this.marketRegime === 'MEAN_REVERTING') {
                signalStrength[edge.knn.signal] += edge.knn.confidence * 0.4 * timeframeWeight;
                signalStrength[edge.technical] += 0.3 * timeframeWeight;
                signalStrength[edge.volume] += 0.3 * timeframeWeight;
            } else if (this.marketRegime === 'TRENDING') {
                signalStrength[edge.knn.signal] += edge.knn.confidence * 0.3 * timeframeWeight;
                signalStrength[edge.technical] += 0.4 * timeframeWeight;
                signalStrength[edge.volume] += 0.3 * timeframeWeight;
            } else {
                signalStrength[edge.knn.signal] += edge.knn.confidence * 0.33 * timeframeWeight;
                signalStrength[edge.technical] += 0.33 * timeframeWeight;
                signalStrength[edge.volume] += 0.34 * timeframeWeight;
            }
        });

        const totalWeight = edges.reduce((sum, _, i) => sum + 1 / Math.pow(1.5, i), 0);
        Object.keys(signalStrength).forEach(key => {
            signalStrength[key as Signal] /= totalWeight;
        });

        const strongest = Object.entries(signalStrength).reduce((a, b) =>
            a[1] > b[1] ? a : b
        );

        return {
            signal: strongest[0] as Signal,
            confidence: strongest[1]
        };
    }

    private predictUsingKNN(currentPattern: number[]): { signal: Signal; confidence: number } {
        if (this.historicalPatterns.length < 10) {
            return { signal: 'HOLD', confidence: 0 };
        }

        const neighbors = this.historicalPatterns
            .map(hp => ({
                pattern: hp.pattern,
                result: hp.result,
                distance: this.calculateEuclideanDistance(currentPattern, hp.pattern)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);

        const votes = {
            BUY: 0,
            SELL: 0,
            HOLD: 0
        };

        neighbors.forEach(n => {
            votes[n.result]++;
        });

        const winner = Object.entries(votes).reduce((a, b) =>
            a[1] > b[1] ? a : b
        );

        return {
            signal: winner[0] as Signal,
            confidence: winner[1] / 5
        };
    }

    private analyzeTechnicals(input: StrategyInputClaudeX1): Signal {
        const price = input.prices[input.prices.length - 1];
        const vwap = input.vwap[input.vwap.length - 1];
        const rsi = input.rsi[input.rsi.length - 1];
        const macd = input.macd[input.macd.length - 1];
        const bb = input.bollingerBands;

        const pricePosition = (price - bb.lower[bb.lower.length - 1]) /
            (bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1]);

        if (this.marketRegime === 'MEAN_REVERTING') {
            if (pricePosition > 0.8 && rsi > 70 && price > vwap * 1.02) {
                return 'SELL';
            }
            if (pricePosition < 0.2 && rsi < 30 && price < vwap * 0.98) {
                return 'BUY';
            }
        } else if (this.marketRegime === 'TRENDING') {
            if (price > vwap && macd > 0 && rsi > 45 && rsi < 75) {
                return 'BUY';
            }
            if (price < vwap && macd < 0 && rsi < 55 && rsi > 25) {
                return 'SELL';
            }
        }

        return 'HOLD';
    }

    private analyzeVolumeProfile(input: StrategyInputClaudeX1): Signal {
        const recentBuyVol = input.buyVolumes.slice(-3).reduce((a, b) => a + b);
        const recentSellVol = input.sellVolumes.slice(-3).reduce((a, b) => a + b);
        const totalVol = recentBuyVol + recentSellVol;

        const buyRatio = recentBuyVol / totalVol;
        const sellRatio = recentSellVol / totalVol;

        if (buyRatio > 0.6 && this.lastCalculatedEntropy < 0.5) {
            return 'BUY';
        }
        if (sellRatio > 0.6 && this.lastCalculatedEntropy < 0.5) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private generateSignal(
        edge: { signal: Signal; confidence: number },
        input: MultiStrategyInputClaudeX1
    ): Signal {
        if (edge.confidence > this.CONFIDENCE_THRESHOLD) {
            // Store pattern for future reference
            this.historicalPatterns.push({
                pattern: this.detectCurrentPattern(input),
                result: edge.signal
            });

            // Maintain pattern history size
            if (this.historicalPatterns.length > 100) {
                this.historicalPatterns.shift();
            }

            return edge.signal;
        }

        return 'HOLD';
    }

    // Utility functions
    private calculateStandardDeviation(values: number[]): number {
        const mean = values.reduce((a, b) => a + b) / values.length;
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        return Math.sqrt(squareDiffs.reduce((a, b) => a + b) / values.length);
    }

    private calculateLinearRegression(x: number[], y: number[]): number {
        const n = x.length;
        const xy = x.map((xi, i) => xi * y[i]).reduce((a, b) => a + b);
        const xx = x.map(xi => xi * xi).reduce((a, b) => a + b);
        const sumX = x.reduce((a, b) => a + b);
        const sumY = y.reduce((a, b) => a + b);

        return (n * xy - sumX * sumY) / (n * xx - sumX * sumX);
    }

    private calculateEuclideanDistance(a: number[], b: number[]): number {
        return Math.sqrt(
            a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
        );
    }

    private normalizeArray(arr: number[]): number[] {
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        return arr.map(v => (v - min) / (max - min));
    }

    private discretize(values: number[], bins: number = 10): number[] {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binSize = (max - min) / bins;

        return values.map(v => Math.floor((v - min) / binSize));
    }

    private calculateShannonEntropy(values: number[]): number {
        const counts: { [key: number]: number } = {};
        values.forEach(v => counts[v] = (counts[v] || 0) + 1);

        const probabilities = Object.values(counts).map(c => c / values.length);
        return -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0);
    }
}