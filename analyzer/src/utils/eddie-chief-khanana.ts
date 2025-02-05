// types.ts

// Define a type for the Bollinger Band record.
export interface BollingerRecord {
    upper: number;
    middle: number; // often a moving average
    lower: number;
    // Optionally, you might pass the current price if available.
    currentPrice?: number;
}

// tradeSignal.ts

export type TradeSignal = 'BUY' | 'SELL' | 'HOLD';

/**
 * Returns the last element of an array.
 */
function last<T>(arr: T[]): T | null {
    return arr.length ? arr[arr.length - 1] : null;
}

/**
 * Given the last 100 records for various indicators, decide whether to issue a BUY, SELL, or HOLD signal.
 *
 * @param knn1s - Array of kNN signals for 1-second interval (each value positive suggests bullish, negative bearish)
 * @param knn10s - Array of kNN signals for 10-second interval
 * @param knn1m - Array of kNN signals for 1-minute interval
 * @param rsi - Array of RSI values (typically 0-100; oversold < 30, overbought > 70)
 * @param shortEma - Array of short period EMA values
 * @param longEma - Array of long period EMA values
 * @param bollingerBands - Array of Bollinger records. (currentPrice may be provided as a property or assumed to be the middle value)
 * @param macd - Array of MACD values (positive typically indicates bullish momentum)
 * @returns A TradeSignal: 'BUY', 'SELL', or 'HOLD'
 */
export function DoKhanana(
    knn1s: number[],
    knn10s: number[],
    knn1m: number[],
    rsi: number[],
    shortEma: number[],
    longEma: number[],
    bollingerBands: BollingerRecord[],
    macd: number[]
): TradeSignal {
    // We use a simple voting system from each indicator.
    let bullishVotes = 0;
    let bearishVotes = 0;

    // Helper: get the last value from each array.
    const knn1sLatest = last(knn1s);
    const knn10sLatest = last(knn10s);
    const knn1mLatest = last(knn1m);
    const rsiLatest = last(rsi);
    const shortEmaLatest = last(shortEma);
    const longEmaLatest = last(longEma);
    const bbLatest = last(bollingerBands);
    const macdLatest = last(macd);

    // Check that we have valid data.
    if (
        knn1sLatest === null ||
        knn10sLatest === null ||
        knn1mLatest === null ||
        rsiLatest === null ||
        shortEmaLatest === null ||
        longEmaLatest === null ||
        bbLatest === null ||
        macdLatest === null
    ) {
        // Not enough data – default to HOLD.
        return 'HOLD';
    }

    // --- kNN Voting ---
    // Combine the three kNN values. (Assume positive values are bullish.)
    const knnSum = knn1sLatest + knn10sLatest + knn1mLatest;
    if (knnSum > 0) {
        bullishVotes++;
    } else if (knnSum < 0) {
        bearishVotes++;
    }
    // You could also add additional logic (or weight each interval differently).

    // --- RSI Voting ---
    // Typically, an RSI below 30 is considered oversold (bullish signal) and above 70 overbought (bearish).
    if (rsiLatest < 30) {
        bullishVotes++;
    } else if (rsiLatest > 70) {
        bearishVotes++;
    }

    // --- EMA Crossover Voting ---
    // If the short EMA is above the long EMA then the market is trending upward.
    if (shortEmaLatest > longEmaLatest) {
        bullishVotes++;
    } else if (shortEmaLatest < longEmaLatest) {
        bearishVotes++;
    }

    // --- Bollinger Bands Voting ---
    // We assume that if the current price (if provided) or the middle value (as a proxy)
    // is below the lower band then the asset may be oversold (bullish); if above the upper band then overbought (bearish).
    const currentPrice = bbLatest.currentPrice ?? bbLatest.middle;
    if (currentPrice < bbLatest.lower) {
        bullishVotes++;
    } else if (currentPrice > bbLatest.upper) {
        bearishVotes++;
    }

    // --- MACD Voting ---
    // A positive MACD value generally indicates bullish momentum.
    if (macdLatest > 0) {
        bullishVotes++;
    } else if (macdLatest < 0) {
        bearishVotes++;
    }

    // --- Final Decision ---
    // Here we simply compare the number of bullish vs. bearish votes.
    if (bullishVotes > bearishVotes) {
        return 'BUY';
    } else if (bearishVotes > bullishVotes) {
        return 'SELL';
    } else {
        return 'HOLD';
    }
}
