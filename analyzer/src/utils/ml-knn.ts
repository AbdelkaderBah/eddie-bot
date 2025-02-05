// kNNStrategy.ts
// This module implements a kNN–based strategy that mimics the Pine Script logic,
// working on Binance Kline data (no charting; only numerical results).
// You may install/use your own technical indicator libraries if you wish.

import {BriefKline} from "@/types";

export interface Options {
    // Date filtering: Unix timestamp (ms) for start/stop.
    startDate: number;
    stopDate: number;
    // Which indicator to use for feature calculation. Options: "RSI", "CCI", "ROC", "Volume", "All"
    indicator: "RSI" | "CCI" | "ROC" | "Volume" | "All";
    shortWindow: number;
    longWindow: number;
    baseK: number;      // Base number of neighbours
    filter: boolean;    // Use volatility filter (ATR-based)
    bars: number;       // Bar threshold for trade duration
}

export interface SignalOutput {
    time: number;
    signal: number;       // 1 = BUY, -1 = SELL, 0 = CLEAR
    prediction: number;   // The sum of the neighbours’ directions
    f1: number;           // Feature 1 value used in prediction
    f2: number;           // Feature 2 value used in prediction
}

/* =========================
   Technical Indicator Functions
   ========================= */

// A simple RSI calculation using the “simple” method. (Not exponentially weighted.)
function computeRSI(values: number[], period: number): number | null {
    if (values.length < period + 1) return null;
    let gains = 0;
    let losses = 0;
    // Calculate changes for the last "period" changes.
    for (let i = values.length - period; i < values.length; i++) {
        const change = values[i] - values[i - 1];
        if (change > 0) gains += change;
        else losses += -change;
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
}

// A simple CCI (Commodity Channel Index) calculation.
function computeCCI(highs: number[], lows: number[], closes: number[], period: number): number | null {
    if (closes.length < period) return null;
    const typicals: number[] = [];
    for (let i = closes.length - period; i < closes.length; i++) {
        typicals.push((highs[i] + lows[i] + closes[i]) / 3);
    }
    const ma = typicals.reduce((a, b) => a + b, 0) / period;
    const meanDeviation = typicals.reduce((acc, tp) => acc + Math.abs(tp - ma), 0) / period;
    if (meanDeviation === 0) return 0;
    // Use the last typical value
    return (typicals[typicals.length - 1] - ma) / (0.015 * meanDeviation);
}

// A simple ROC (Rate of Change) calculation in percentage.
function computeROC(closes: number[], period: number): number | null {
    if (closes.length <= period) return null;
    const prev = closes[closes.length - period - 1];
    if (prev === 0) return 0;
    return ((closes[closes.length - 1] - prev) / prev) * 100;
}

// A simple ATR (Average True Range) calculation.
function computeATR(highs: number[], lows: number[], closes: number[], period: number): number | null {
    if (closes.length < period + 1) return null;
    const trs: number[] = [];
    // Compute True Range for the last "period" bars.
    for (let i = closes.length - period; i < closes.length; i++) {
        const currentHigh = highs[i];
        const currentLow = lows[i];
        const prevClose = closes[i - 1];
        const tr = Math.max(
            currentHigh - currentLow,
            Math.abs(currentHigh - prevClose),
            Math.abs(currentLow - prevClose)
        );
        trs.push(tr);
    }
    return trs.reduce((a, b) => a + b, 0) / trs.length;
}

// The “minimax” normalization function: it looks back over period p,
// finds the highest and lowest values, and scales the current value to [min, max].
function minimax(values: number[], period: number, normMin: number, normMax: number): number | null {
    if (values.length < period) return null;
    const slice = values.slice(-period);
    const hi = Math.max(...slice);
    const lo = Math.min(...slice);
    const x = values[values.length - 1];
    if (hi === lo) return normMin; // avoid division by zero
    return (normMax - normMin) * (x - lo) / (hi - lo) + normMin;
}

/* =========================
   Main Processing Function
   ========================= */

export function processKlines(klines: BriefKline[], options: Options): SignalOutput[] {
    // “Magic” constants (from the Pine script)
    const BUY = 1;
    const SELL = -1;
    const CLEAR = 0;
    const k = Math.floor(Math.sqrt(options.baseK));

    // Arrays to store “training” data (features and corresponding class labels)
    const trainingFeature1: number[] = [];
    const trainingFeature2: number[] = [];
    const trainingDirections: number[] = [];

    // For kNN neighbours collected for the current bar:
    let predictions: number[] = [];

    // Bar counter for trade duration (we use a single number)
    let barCounter = 0;

    // For indicator calculation, we build arrays of closes, highs, lows and volumes.
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    // Output signals
    const outputs: SignalOutput[] = [];

    // Process each kline in order.
    // (We start at index 0 but many indicators require a minimum number of bars.)
    for (let i = 0; i < klines.length; i++) {
        const bar = klines[i];
        // Push the current bar’s values into our arrays.
        closes.push(bar.close);
        highs.push(bar.high);
        lows.push(bar.low);
        volumes.push(bar.volume);

        // We need at least 2 bars for a “change” calculation.
        if (i < 1) continue;

        // Compute our technical indicators – if there isn’t enough history, skip this bar.
        const rsiLong = computeRSI(closes, options.longWindow);
        const rsiShort = computeRSI(closes, options.shortWindow);
        const cciLong = computeCCI(highs, lows, closes, options.longWindow);
        const cciShort = computeCCI(highs, lows, closes, options.shortWindow);
        const rocLong = computeROC(closes, options.longWindow);
        const rocShort = computeROC(closes, options.shortWindow);
        const volLong = minimax(volumes, options.longWindow, 0, 99);
        const volShort = minimax(volumes, options.shortWindow, 0, 99);

        // If any are null, skip this bar.
        if (
            rsiLong === null ||
            rsiShort === null ||
            cciLong === null ||
            cciShort === null ||
            rocLong === null ||
            rocShort === null ||
            volLong === null ||
            volShort === null
        ) {
            continue;
        }

        // For each bar, select feature values f1 and f2 based on the chosen indicator.
        let f1: number, f2: number;
        switch (options.indicator) {
            case "RSI":
                f1 = rsiLong;
                f2 = rsiShort;
                break;
            case "CCI":
                f1 = cciLong;
                f2 = cciShort;
                break;
            case "ROC":
                f1 = rocLong;
                f2 = rocShort;
                break;
            case "Volume":
                f1 = volLong;
                f2 = volShort;
                break;
            case "All":
            default:
                f1 = (rsiLong + cciLong + rocLong + volLong) / 4;
                f2 = (rsiShort + cciShort + rocShort + volShort) / 4;
                break;
        }

        // The “class label” for the bar is based on the change from the previous close:
        // sign(close[previous] - close[current]). (Note that in Pine “close[1]” is the previous bar.)
        const prevClose = closes[closes.length - 2];
        const currClose = closes[closes.length - 1];
        const classLabel = Math.sign(prevClose - currClose); // 1, -1, or 0

        // Check if the bar’s time is inside our “training window”
        if (bar.time >= options.startDate && bar.time <= options.stopDate) {
            trainingFeature1.push(f1);
            trainingFeature2.push(f2);
            trainingDirections.push(classLabel);
        }

        // ---- kNN Core Logic ----
        // Here we look at all training data (so far) and collect “neighbours”
        const nTrain = trainingDirections.length;
        let maxdist = -Infinity;
        predictions = []; // reset for current bar
        for (let j = 0; j < nTrain; j++) {
            const diff1 = f1 - trainingFeature1[j];
            const diff2 = f2 - trainingFeature2[j];
            const d = Math.sqrt(diff1 * diff1 + diff2 * diff2);
            // (Note: the Pine code uses a “if d > maxdist” condition. That is a non‐standard
            // way to collect k–nearest neighbours; here we mimic that logic exactly.)
            if (d > maxdist) {
                maxdist = d;
                if (predictions.length >= k) {
                    // remove the oldest neighbour (FIFO)
                    predictions.shift();
                }
                predictions.push(trainingDirections[j]);
            }
        }
        // Overall “prediction” is the sum of the collected neighbours’ directions.
        const prediction = predictions.reduce((a, b) => a + b, 0);

        // ---- Volatility Filter ----
        // If the filter option is turned on, then we only allow trading if ATR(10) > ATR(40).
        let filterPassed = true;
        if (options.filter) {
            const atr10 = computeATR(highs, lows, closes, 10);
            const atr40 = computeATR(highs, lows, closes, 40);
            if (atr10 === null || atr40 === null) {
                filterPassed = false;
            } else {
                filterPassed = atr10 > atr40;
            }
        }

        // ---- Signal determination ----
        let signal: number;
        if (prediction > 0 && filterPassed) {
            signal = BUY;
        } else if (prediction < 0 && filterPassed) {
            signal = SELL;
        } else {
            signal = CLEAR;
        }
        // Manage the bar counter: if the counter equals the threshold then clear the signal.
        if (barCounter >= options.bars) {
            signal = CLEAR;
            barCounter = 0;
        } else {
            barCounter++;
        }

        // (Optionally, one might detect a change in signal from the previous bar to mark trade entries.)
        // For now we simply output the computed numbers.
        outputs.push({
            time: bar.time,
            signal,
            prediction,
            f1,
            f2,
        });
    }

    return outputs;
}