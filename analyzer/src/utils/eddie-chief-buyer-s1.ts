// tradeStrategy.ts

export type TradeDecision = "BUY" | "HOLD";

/**
 * Determines if a BUY should be executed based on the following conditions:
 *  - The ML kNN indicator signals BUY.
 *  - RSI is lower than 40.
 *  - The average of the last 20 sell volume percentages is greater than 65.
 *  - The average of the last 5 buy volume percentages is greater than 65.
 *
 * @param mlKnnSignal  The machine learning kNN signal ("BUY", "SELL", "HOLD", etc.).
 * @param rsi          The current RSI value.
 * @param last20SellVolumes  An array of the last 20 sell volume percentages.
 * @param last5BuyVolumes    An array of the last 5 buy volume percentages.
 * @returns "BUY" if all conditions are met; otherwise, "HOLD".
 */
export function DoBuyerS1(
    mlKnnSignal: "BUY" | "SELL" | "HOLD",
    rsi: number,
    last20SellVolumes: number[],
    last5BuyVolumes: number[]
): TradeDecision {
    // Condition 1: ML kNN signal must be BUY.
    if (mlKnnSignal !== "BUY") {
        return "HOLD";
    }

    // Condition 2: RSI must be lower than 40.
    if (rsi >= 40) {
        return "HOLD";
    }

    // Check that we have enough data.
    if (last20SellVolumes.length < 20 || last5BuyVolumes.length < 5) {
        return "HOLD";
    }

    // Calculate average sell volume percentage for the last 20 records.
    const avgSellVolume =
        last20SellVolumes.reduce((sum, vol) => sum + vol, 0) / last20SellVolumes.length;

    // Calculate average buy volume percentage for the last 5 records.
    const avgBuyVolume =
        last5BuyVolumes.reduce((sum, vol) => sum + vol, 0) / last5BuyVolumes.length;

    // Condition 3: The average of the last 20 sell volumes must be greater than 65%.
    if (avgSellVolume <= 65) {
        return "HOLD";
    }

    // Condition 4: The average of the last 5 buy volumes must be greater than 65%.
    if (avgBuyVolume <= 65) {
        return "HOLD";
    }

    // If all conditions are met, return BUY.
    return "BUY";
}
