export type TradeDecision = "BUY" | "SELL" | "HOLD";

export interface TradeSignal {
    decision: TradeDecision;
    stopLoss?: number;      // Price level for stop-loss
    takeProfit?: number;    // Price level for take-profit
    holdDuration?: number;  // Hold duration in seconds
}

/**
 * Computes the average of an array of numbers.
 */
const average = (arr: number[]): number =>
    arr.reduce((sum, v) => sum + v, 0) / arr.length;

/**
 * Given the last 10 ML KNN values, 10 RSI values, 10 buy volumes, 10 sell volumes,
 * and 60 prices (all in descending order), this function votes on whether to BUY, SELL, or HOLD.
 * It also computes a hold duration along with stop loss and take profit levels.
 *
 * Voting is based on:
 *   - ML KNN: Positive if average > 0.3 (bullish) and negative if average < -0.3.
 *   - RSI: Bullish if average < 40 (oversold) and bearish if average > 60 (overbought).
 *   - Volumes: Bullish if average buy volume is at least 10% higher than average sell volume,
 *              bearish if average sell volume is at least 10% higher than average buy volume.
 *   - Price Trend: Bullish if current price (first price in prices array) is above the median
 *                  of the 60 prices, bearish otherwise.
 *
 * Risk management is computed as follows:
 *   - The highest and lowest prices among the last 60 prices define the recent range.
 *   - For a BUY, stop loss is set at halfway between the current price and the low,
 *     while take profit is set at halfway between the current price and the high.
 *   - For a SELL, the levels are reversed.
 *   - The hold duration is longer in periods of low relative volatility.
 *
 * @param mlKnn - Last 10 ML KNN values.
 * @param rsiValues - Last 10 RSI values.
 * @param buyVolumes - Last 10 buy volume percentages.
 * @param sellVolumes - Last 10 sell volume percentages.
 * @param prices - Last 60 prices.
 * @returns A TradeSignal containing the decision along with risk management levels.
 */
export function HelpAfterGod(
    mlKnn: number[],
    rsiValues: number[],
    buyVolumes: number[],
    sellVolumes: number[],
    prices: number[]
): TradeSignal {
    // Validate input lengths.
    if (mlKnn.length < 10 || rsiValues.length < 10 || buyVolumes.length < 10 ||
        sellVolumes.length < 10 || prices.length < 60) {
        return { decision: "HOLD" };
    }

    // Calculate averages.
    const avgMLKnn = average(mlKnn);
    const avgRSI = average(rsiValues);
    const avgBuyVol = average(buyVolumes);
    const avgSellVol = average(sellVolumes);

    // Price trend analysis.
    // Prices are in descending order: prices[0] is the most recent.
    const currentPrice = prices[0];
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

    // Recent high and low for risk management.
    const recentHigh = Math.max(...prices);
    const recentLow = Math.min(...prices);

    // Voting mechanism.
    let bullishVotes = 0;
    let bearishVotes = 0;

    // ML KNN vote.
    if (avgMLKnn > 0.5) bullishVotes++;
    else if (avgMLKnn < -0.5) bearishVotes++;

    // RSI vote.
    if (avgRSI < 35) bullishVotes++;
    else if (avgRSI > 65) bearishVotes++;

    // Volume vote.
    if (avgBuyVol > avgSellVol * 1.15) bullishVotes++;
    else if (avgSellVol > avgBuyVol * 1.15) bearishVotes++;

    // Price trend vote.
    // Require current price to be above median by at least 0.5% to count as bullish.
    if (currentPrice > medianPrice * 1.005) bullishVotes++;
    else bearishVotes++;

    // Decide on the trade.
    let decision: TradeDecision = "HOLD";
    if (bullishVotes >= 4 && bullishVotes - bearishVotes >= 2) {
        decision = "BUY";
    } else if (bearishVotes >= 4 && bearishVotes - bullishVotes >= 2) {
        decision = "SELL";
    }

    // If no clear decision, return HOLD.
    if (decision === "HOLD") {
        return { decision };
    }

    // Risk management calculations.
    // Use a risk factor of 0.4 for more conservative stop loss/take profit levels.
    const riskFactor = 0.4;
    let stopLoss: number, takeProfit: number;

    if (decision === "BUY") {
        stopLoss = currentPrice - (currentPrice - recentLow) * riskFactor;
        takeProfit = currentPrice + (recentHigh - currentPrice) * riskFactor;
    } else {
        stopLoss = currentPrice + (recentHigh - currentPrice) * riskFactor;
        takeProfit = currentPrice - (currentPrice - recentLow) * riskFactor;
    }

    // Determine hold duration based on relative volatility.
    const relativeVolatility = (recentHigh - recentLow) / currentPrice;
    let holdDuration: number;
    if (relativeVolatility < 0.02) {
        holdDuration = 1800;
    } else if (relativeVolatility < 0.03) {
        holdDuration = 900;
    } else {
        holdDuration = 600;
    }

    return {
        decision,
        stopLoss,
        takeProfit,
        holdDuration,
    };
}
