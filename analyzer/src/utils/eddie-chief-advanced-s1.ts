export type TradeDecision = "BUY" | "SELL" | "HOLD";

export interface TradeSignal {
    decision: TradeDecision;
    stopLoss?: number;      // Price level for stop-loss
    takeProfit?: number;    // Price level for take-profit
    holdDuration?: number;  // Time to hold the position (in seconds)
}

export interface BollingerData {
    upper: number;
    middle: number;
    lower: number;
    currentPrice?: number;
}

export interface VolumeData {
    currentVolume: number;
    avgVolume: number;
}

export function DoAdvancedS1(
    mlKnn1s: number[],
    mlKnn10s: number[],
    mlKnn1m: number[],
    rsi: number,
    shortEma: number,
    longEma: number,
    bollinger: BollingerData,
    macd: number,
    atr: number,
    volumeData: VolumeData
): TradeSignal {
    const last = <T>(arr: T[]): T | null => (arr.length ? arr[arr.length - 1] : null);
    const k1 = last(mlKnn1s), k10 = last(mlKnn10s), k1m = last(mlKnn1m);
    if (k1 === null || k10 === null || k1m === null) return { decision: "HOLD" };

    const mlAvg = (k1 + k10 + k1m) / 3;
    const emaBullish = shortEma > longEma;
    const emaBearish = shortEma < longEma;
    const price = bollinger.currentPrice ?? bollinger.middle;
    const bbWidth = bollinger.upper - bollinger.lower;
    const nearLower = price - bollinger.lower < bbWidth * 0.1;
    const nearUpper = bollinger.upper - price < bbWidth * 0.1;
    const bbSqueeze = bbWidth / bollinger.middle < 0.05;
    const volumeSurge = volumeData.currentVolume > volumeData.avgVolume * 1.5;
    const atrThreshold = 0.02;

    if (atr > atrThreshold) return { decision: "HOLD" };

    let bullishVotes = 0, bearishVotes = 0;
    if (mlAvg > 0.5) bullishVotes++;
    if (mlAvg < -0.5) bearishVotes++;
    if (rsi < 40) bullishVotes++;
    if (rsi > 60) bearishVotes++;
    if (emaBullish) bullishVotes++;
    if (emaBearish) bearishVotes++;
    if (bbSqueeze || nearLower) bullishVotes++;
    if (nearUpper) bearishVotes++;
    if (macd > 0) bullishVotes++;
    if (macd < 0) bearishVotes++;
    if (volumeSurge) bullishVotes++;

    const profitMultiplier = 1.5;
    const stopLossMultiplier = 1;

    const setRiskManagement = (isBuy: boolean) => {
        const stopLoss = isBuy ? price - (atr * stopLossMultiplier) : price + (atr * stopLossMultiplier);
        const takeProfit = isBuy ? price + (atr * profitMultiplier) : price - (atr * profitMultiplier);
        const holdDuration = atr < 0.01 ? 1800 : 600; // Hold longer in low volatility
        return { stopLoss, takeProfit, holdDuration };
    };

    if (bullishVotes >= 5 && bullishVotes - bearishVotes >= 2) {
        return { decision: "BUY", ...setRiskManagement(true) };
    }
    if (bearishVotes >= 5 && bearishVotes - bullishVotes >= 2) {
        return { decision: "SELL", ...setRiskManagement(false) };
    }

    return { decision: "HOLD" };
}
