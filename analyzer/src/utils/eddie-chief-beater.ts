export type TradeDecision = "BUY" | "SELL" | "HOLD";

export interface TradeSignal {
    decision: TradeDecision;
    stopLoss?: number;      // Price level for stop loss
    takeProfit?: number;    // Price level for take profit
    holdDuration?: number;  // Hold duration in seconds
    trailingStop?: number;  // Trailing stop level
}

/**
 * Computes the average of an array of numbers.
 */
const average = (arr: number[]): number =>
    arr.reduce((sum, v) => sum + v, 0) / arr.length;

/**
 * A refined, creative market-beater strategy that uses:
 *   - Confluence from ML KNN, RSI, volume, and price trend/fractal extremes.
 *   - ATR-based risk management to compute stop loss, take profit, and hold duration.
 *
 * All inputs are expected in descending order (most recent first).
 *
 * @param mlKnn - Last 10 ML KNN signals.
 * @param rsiValues - Last 10 RSI values.
 * @param buyVolumes - Last 10 buy volume values.
 * @param sellVolumes - Last 10 sell volume values.
 * @param prices - Last 60 prices.
 * @param atr - Current ATR value.
 * @param avgVolume - Overall average volume (for surge comparisons).
 * @returns A TradeSignal containing the decision and risk management parameters.
 */
export function marketBeaterStrategy(
    mlKnn: number[],
    rsiValues: number[],
    buyVolumes: number[],
    sellVolumes: number[],
    prices: number[],
    atr: number,
    avgVolume: number
): TradeSignal {
    // Validate input lengths.
    if (
        mlKnn.length < 10 ||
        rsiValues.length < 10 ||
        buyVolumes.length < 10 ||
        sellVolumes.length < 10 ||
        prices.length < 60
    ) {
        return { decision: "HOLD" };
    }

    // Compute averages.
    const avgMLKnn = average(mlKnn);
    const avgRSI = average(rsiValues);
    const avgBuyVol = average(buyVolumes);
    const avgSellVol = average(sellVolumes);
    const currentPrice = prices[0];

    // Price trend: sort the prices (ascending) to get the median.
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

    // Define recent extremes.
    const recentHigh = Math.max(...prices);
    const recentLow = Math.min(...prices);

    // Build the confluence score.
    let score = 0;

    // 1. ML KNN Signal:
    if (avgMLKnn > 0.3) score += 2;
    else if (avgMLKnn < -0.3) score -= 2;

    // 2. RSI:
    if (avgRSI < 35) score += 1;
    else if (avgRSI > 65) score -= 1;

    // 3. Volume:
    // Bullish if buy volumes exceed sell volumes by at least 15%
    if (avgBuyVol > avgSellVol * 1.15) score += 1;
    else if (avgSellVol > avgBuyVol * 1.15) score -= 1;

    // 4. Price Trend:
    // Bullish if current price is above the median.
    if (currentPrice > medianPrice) score += 1;
    else score -= 1;

    // 5. Fractal Extremes:
    // If the current price is very close to the recent low (within one ATR), add bullish weight.
    if (currentPrice - recentLow < atr) score += 1;
    // If the current price is very close to the recent high (within one ATR), add bearish weight.
    if (recentHigh - currentPrice < atr) score -= 1;

    // Determine final decision based on score.
    // Require a confluence score of at least +3 for BUY, -3 for SELL.
    let decision: TradeDecision = "HOLD";
    if (score >= 3) decision = "BUY";
    else if (score <= -3) decision = "SELL";

    // If no clear signal, hold.
    if (decision === "HOLD") return { decision };

    // Risk management using ATR.
    // Use a risk factor (here 0.5) for the stop loss.
    const riskFactor = 0.5;
    let stopLoss: number, takeProfit: number;

    if (decision === "BUY") {
        stopLoss = currentPrice - atr * riskFactor;
        takeProfit = currentPrice + atr * 3;
    } else {
        stopLoss = currentPrice + atr * riskFactor;
        takeProfit = currentPrice - atr * 3;
    }

    // Ensure stop loss and take profit are not negative.
    stopLoss = Math.max(stopLoss, 0.0001);
    takeProfit = Math.max(takeProfit, 0.0001);

    // Determine hold duration based on relative volatility.
    const relativeVolatility = (recentHigh - recentLow) / currentPrice;
    let holdDuration: number;
    if (relativeVolatility < 0.02) holdDuration = 3600;    // 1 hour for very low volatility.
    else if (relativeVolatility < 0.03) holdDuration = 1800; // 30 minutes for moderate volatility.
    else holdDuration = 900;                               // 15 minutes for high volatility.

    // Set a trailing stop (for example, equal to the initial stop loss level).
    const trailingStop = stopLoss;

    return {
        decision,
        stopLoss,
        takeProfit,
        holdDuration,
        trailingStop,
    };
}
