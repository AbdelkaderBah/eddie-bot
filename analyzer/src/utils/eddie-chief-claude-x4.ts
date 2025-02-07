import {StrategyInputClaudeX1} from "./eddie-chief-claude-x1";
type Signal = 'BUY' | 'SELL' | 'HOLD';

export class TradingStrategyClaudeX4 {
    // Core strategy parameters
    private readonly TREND_STRENGTH = 0.65;  // Required trend strength (0-1)
    private readonly MOMENTUM_THRESHOLD = 0.02;  // 2% change for momentum
    private readonly VOLUME_CONFIRMATION = 1.2;  // 20% above average
    private readonly MIN_TRADES_GAP = 3;  // Minimum candles between trades

    private lastSignalIndex = -10;
    private trendDirection: 'UP' | 'DOWN' | 'NONE' = 'NONE';

    public analyze(input: StrategyInputClaudeX1): Signal {
        // Wait for minimum gap between trades
        if (this.lastSignalIndex < this.MIN_TRADES_GAP) {
            this.lastSignalIndex++;
            return 'HOLD';
        }

        // 1. Identify market phase
        const marketPhase = this.identifyMarketPhase(input);
        if (marketPhase === 'CHOPPY') {
            return 'HOLD';
        }

        // 2. Detect trend strength and direction
        const trendSignal = this.analyzeTrendStrength(input);
        if (trendSignal === 'HOLD') {
            return 'HOLD';
        }

        // 3. Check for momentum confirmation
        if (!this.confirmMomentum(input, trendSignal)) {
            return 'HOLD';
        }

        // 4. Validate entry conditions
        // Check if signal aligns with overall trend direction
        if ((trendSignal === 'BUY' && this.trendDirection !== 'UP') ||
            (trendSignal === 'SELL' && this.trendDirection !== 'DOWN')) {
            return 'HOLD';
        }

        if (!this.validateEntry(input, trendSignal)) {
            return 'HOLD';
        }

        this.lastSignalIndex = 0;
        return trendSignal;
    }

    private identifyMarketPhase(input: StrategyInputClaudeX1): 'TRENDING' | 'CHOPPY' {
        const prices = input.prices.slice(-20);
        const bb = input.bollingerBands;
        const currentPrice = prices[prices.length - 1];

        // Calculate price volatility
        const priceChanges = prices.slice(1).map((p, i) => Math.abs(p - prices[i]) / prices[i]);
        const volatility = priceChanges.reduce((a, b) => a + b) / priceChanges.length;

        // Check if price is ranging between Bollinger Bands
        const bbWidth = (bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1]) /
            bb.middle[bb.middle.length - 1];

        return (volatility < 0.008 && bbWidth < 0.03) ? 'CHOPPY' : 'TRENDING';
    }

    private analyzeTrendStrength(input: StrategyInputClaudeX1): Signal {
        const ema = this.calculateTrendStrength(input.shortEma, input.longEma);
        const macd = this.analyzeMacdTrend(input.macd);
        const volume = this.analyzeVolumeStrength(input.buyVolumes, input.sellVolumes);

        // Require agreement between indicators
        if (ema === macd && macd === volume && ema !== 'HOLD') {
            this.trendDirection = ema === 'BUY' ? 'UP' : 'DOWN';
            return ema;
        }

        this.trendDirection = 'NONE';
        return 'HOLD';
    }

    private calculateTrendStrength(shortEma: number[], longEma: number[]): Signal {
        const shortLast = shortEma.slice(-3);
        const longLast = longEma.slice(-3);

        const shortSlope = (shortLast[2] - shortLast[0]) / shortLast[0];
        const longSlope = (longLast[2] - longLast[0]) / longLast[0];

        if (shortSlope > this.TREND_STRENGTH && longSlope > 0) {
            return 'BUY';
        }
        if (shortSlope < -this.TREND_STRENGTH && longSlope < 0) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private analyzeMacdTrend(macd: number[]): Signal {
        const recent = macd.slice(-3);
        const slope = (recent[2] - recent[0]) / Math.abs(recent[0]);

        if (recent[2] > 0 && slope > this.MOMENTUM_THRESHOLD) {
            return 'BUY';
        }
        if (recent[2] < 0 && slope < -this.MOMENTUM_THRESHOLD) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private analyzeVolumeStrength(buyVol: number[], sellVol: number[]): Signal {
        const recentBuy = buyVol.slice(-3).reduce((a, b) => a + b) / 3;
        const avgBuy = buyVol.slice(-10).reduce((a, b) => a + b) / 10;
        const recentSell = sellVol.slice(-3).reduce((a, b) => a + b) / 3;
        const avgSell = sellVol.slice(-10).reduce((a, b) => a + b) / 10;

        if (recentBuy > avgBuy * this.VOLUME_CONFIRMATION &&
            recentBuy > recentSell * this.VOLUME_CONFIRMATION) {
            return 'BUY';
        }
        if (recentSell > avgSell * this.VOLUME_CONFIRMATION &&
            recentSell > recentBuy * this.VOLUME_CONFIRMATION) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private confirmMomentum(input: StrategyInputClaudeX1, signal: Signal): boolean {
        const rsi = input.rsi[input.rsi.length - 1];
        const stoch = input.stochastic;
        const vwap = input.vwap[input.vwap.length - 1];
        const price = input.prices[input.prices.length - 1];

        if (signal === 'BUY') {
            return (
                rsi > 45 && rsi < 65 &&  // Not overbought
                stoch.k[stoch.k.length - 1] > stoch.d[stoch.d.length - 1] &&  // Stochastic crossover
                price > vwap  // Above VWAP
            );
        }

        if (signal === 'SELL') {
            return (
                rsi < 55 && rsi > 35 &&  // Not oversold
                stoch.k[stoch.k.length - 1] < stoch.d[stoch.d.length - 1] &&  // Stochastic crossover
                price < vwap  // Below VWAP
            );
        }

        return false;
    }

    private validateEntry(input: StrategyInputClaudeX1, signal: Signal): boolean {
        // Early exit if trend direction doesn't match signal
        if ((signal === 'BUY' && this.trendDirection !== 'UP') ||
            (signal === 'SELL' && this.trendDirection !== 'DOWN')) {
            return false;
        }
        const bb = input.bollingerBands;
        const price = input.prices[input.prices.length - 1];
        const middleBB = bb.middle[bb.middle.length - 1];

        // Calculate distance from middle BB
        const bbDeviation = Math.abs(price - middleBB) / middleBB;

        // Don't enter if too far from middle BB (risk management)
        if (bbDeviation > 0.02) {
            return false;
        }

        // Check kNN trend confirmation
        const knnTrend = this.analyzeKnnTrend(input.knn);
        if ((signal === 'BUY' && knnTrend < 0) ||
            (signal === 'SELL' && knnTrend > 0)) {
            return false;
        }

        return true;
    }

    private analyzeKnnTrend(knn: number[]): number {
        const recent = knn.slice(-3);
        const previous = knn.slice(-6, -3);

        const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
        const previousAvg = previous.reduce((a, b) => a + b) / previous.length;

        return recentAvg - previousAvg;
    }
}