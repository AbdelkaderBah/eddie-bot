// tradeStrategyShort.ts

export type TradeDecision = "SELL" | "HOLD";

/**
 * Determines if a SHORT (sell) signal should be issued based on the following conditions:
 *  - The ML kNN indicator signals SELL.
 *  - RSI is above 60.
 *  - The average of the last 20 buy volume percentages is greater than 65.
 *  - The average of the last 5 sell volume percentages is greater than 65.
 *
 * @param mlKnnSignal       The machine learning kNN signal ("BUY", "SELL", or "HOLD").
 * @param rsi               The current RSI value.
 * @param last20BuyVolumes  An array of the last 20 buy volume percentages.
 * @param last5SellVolumes  An array of the last 5 sell volume percentages.
 * @returns "SELL" if all conditions are met; otherwise, "HOLD".
 */
export function DOSellerS1(
    mlKnnSignal: "BUY" | "SELL" | "HOLD",
    rsi: number,
    last20BuyVolumes: number[],
    last5SellVolumes: number[]
): TradeDecision {
    // Condition 1: ML kNN signal must be SELL.
    if (mlKnnSignal !== "SELL") {
        return "HOLD";
    }

    // Condition 2: RSI must be above 60 (overbought conditions).
    if (rsi <= 60) {
        return "HOLD";
    }

    // Ensure that sufficient volume data is provided.
    if (last20BuyVolumes.length < 20 || last5SellVolumes.length < 5) {
        return "HOLD";
    }

    // Condition 3: The average of the last 20 buy volumes must be greater than 65%.
    const avgBuyVolume =
        last20BuyVolumes.reduce((sum, vol) => sum + vol, 0) / last20BuyVolumes.length;
    if (avgBuyVolume <= 65) {
        return "HOLD";
    }

    // Condition 4: The average of the last 5 sell volumes must be greater than 65%.
    const avgSellVolume =
        last5SellVolumes.reduce((sum, vol) => sum + vol, 0) / last5SellVolumes.length;
    if (avgSellVolume <= 65) {
        return "HOLD";
    }

    // If all conditions are met, return SELL.
    return "SELL";
}
