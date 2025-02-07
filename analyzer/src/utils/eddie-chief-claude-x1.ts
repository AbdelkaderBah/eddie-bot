export interface StrategyInputClaudeX1 {
    prices: number[];        // Last 100 prices
    buyVolumes: number[];    // Last 100 buy volumes
    sellVolumes: number[];   // Last 100 sell volumes
    knn: number[];          // Last 10 kNN values
    macd: number[];         // Last 10 MACD values
    rsi: number[];          // Last 10 RSI values
    bollingerBands: {       // Last 10 Bollinger Bands values
        upper: number[];
        middle: number[];
        lower: number[];
    };
    shortEma: number[];     // Short-term EMA
    longEma: number[];      // Long-term EMA
    stochastic: {           // Stochastic oscillator values
        k: number[];
        d: number[];
    };
    vwap: number[];         // VWAP values
}

type Signal = 'BUY' | 'SELL' | 'HOLD';

export class TradingStrategyClaudeX1 {
    private readonly OVERSOLD_RSI = 30;
    private readonly OVERBOUGHT_RSI = 70;
    private readonly VOLUME_THRESHOLD = 1.5; // 50% increase in volume

    public analyze(input: StrategyInputClaudeX1): Signal {
        const signals: Signal[] = [];

        // 1. Trend Analysis using EMAs
        signals.push(this.analyzeEMACrossover(input.shortEma, input.longEma));

        // 2. Volume Analysis
        signals.push(this.analyzeVolume(input.buyVolumes, input.sellVolumes));

        // 3. Technical Indicators Analysis
        signals.push(this.analyzeRSI(input.rsi));
        signals.push(this.analyzeMacd(input.macd));
        signals.push(this.analyzeBollingerBands(input.bollingerBands, input.prices));
        signals.push(this.analyzeStochastic(input.stochastic));
        signals.push(this.analyzeVWAP(input.vwap, input.prices));

        // 4. Pattern Recognition using kNN
        signals.push(this.analyzeKNN(input.knn));

        // Aggregate signals and make final decision
        return this.aggregateSignals(signals);
    }

    private analyzeEMACrossover(shortEma: number[], longEma: number[]): Signal {
        const currentShortEma = shortEma[shortEma.length - 1];
        const previousShortEma = shortEma[shortEma.length - 2];
        const currentLongEma = longEma[longEma.length - 1];
        const previousLongEma = longEma[longEma.length - 2];

        // Golden Cross (Short EMA crosses above Long EMA)
        if (previousShortEma <= previousLongEma && currentShortEma > currentLongEma) {
            return 'BUY';
        }
        // Death Cross (Short EMA crosses below Long EMA)
        if (previousShortEma >= previousLongEma && currentShortEma < currentLongEma) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private analyzeVolume(buyVolumes: number[], sellVolumes: number[]): Signal {
        const recentBuyVol = buyVolumes.slice(-5).reduce((a, b) => a + b, 0);
        const previousBuyVol = buyVolumes.slice(-10, -5).reduce((a, b) => a + b, 0);
        const recentSellVol = sellVolumes.slice(-5).reduce((a, b) => a + b, 0);
        const previousSellVol = sellVolumes.slice(-10, -5).reduce((a, b) => a + b, 0);

        if (recentBuyVol > previousBuyVol * this.VOLUME_THRESHOLD) {
            return 'BUY';
        }
        if (recentSellVol > previousSellVol * this.VOLUME_THRESHOLD) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private analyzeRSI(rsi: number[]): Signal {
        const currentRSI = rsi[rsi.length - 1];

        if (currentRSI < this.OVERSOLD_RSI) {
            return 'BUY';
        }
        if (currentRSI > this.OVERBOUGHT_RSI) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private analyzeMacd(macd: number[]): Signal {
        const currentMacd = macd[macd.length - 1];
        const previousMacd = macd[macd.length - 2];

        if (previousMacd < 0 && currentMacd > 0) {
            return 'BUY';
        }
        if (previousMacd > 0 && currentMacd < 0) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private analyzeBollingerBands(
        bands: { upper: number[]; middle: number[]; lower: number[] },
        prices: number[]
    ): Signal {
        const currentPrice = prices[prices.length - 1];
        const upperBand = bands.upper[bands.upper.length - 1];
        const lowerBand = bands.lower[bands.lower.length - 1];

        if (currentPrice < lowerBand) {
            return 'BUY';
        }
        if (currentPrice > upperBand) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private analyzeStochastic(stochastic: { k: number[]; d: number[] }): Signal {
        const currentK = stochastic.k[stochastic.k.length - 1];
        const currentD = stochastic.d[stochastic.d.length - 1];

        if (currentK < 20 && currentD < 20) {
            return 'BUY';
        }
        if (currentK > 80 && currentD > 80) {
            return 'SELL';
        }

        return 'HOLD';
    }

    private analyzeVWAP(vwap: number[], prices: number[]): Signal {
        const currentPrice = prices[prices.length - 1];
        const currentVWAP = vwap[vwap.length - 1];

        if (currentPrice < currentVWAP * 0.95) { // 5% below VWAP
            return 'BUY';
        }
        if (currentPrice > currentVWAP * 1.05) { // 5% above VWAP
            return 'SELL';
        }

        return 'HOLD';
    }

    private analyzeKNN(knn: number[]): Signal {
        // Simple trend analysis using kNN values
        const recentAvg = knn.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const previousAvg = knn.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;

        if (recentAvg > previousAvg * 1.1) { // 10% increase
            return 'BUY';
        }
        if (recentAvg < previousAvg * 0.9) { // 10% decrease
            return 'SELL';
        }

        return 'HOLD';
    }

    private aggregateSignals(signals: Signal[]): Signal {
        const counts = {
            BUY: signals.filter(s => s === 'BUY').length,
            SELL: signals.filter(s => s === 'SELL').length,
            HOLD: signals.filter(s => s === 'HOLD').length
        };

        // Require strong consensus for BUY/SELL signals
        const totalSignals = signals.length;
        if (counts.BUY > totalSignals * 0.5) {
            return 'BUY';
        }
        if (counts.SELL > totalSignals * 0.5) {
            return 'SELL';
        }

        return 'HOLD';
    }
}