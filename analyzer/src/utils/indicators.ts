import {
    indicatorRelativeStrengthIndex as rsi,
    indicatorMovingAverage as mavg,
    indicatorMacd as macd,
    indicatorBollingerBands as bollingerBand,
    indicatorExponentialMovingAverage as ema,
    indicatorStochasticOscillator as stochastic,
} from 'd3fc-technical-indicator';
import {BriefKline} from "@/types";
import {processKlines} from "../utils/ml-knn";

export function mlKnn(candles: BriefKline[]) {
    return processKlines(candles, {
        startDate: Date.now() - 64800,
        stopDate: Date.now() + 64800,
        indicator: "All",
        shortWindow: 14,
        longWindow: 28,
        baseK: 252,
        filter: false,
        bars: 300,
    });
}


// Configure RSI with a period of 14, using the close price.
export const rsiIndicator = (data: any[], period: number = 14) => {
    const indicator = rsi()
        .period(period)
        .value((d: any) => d.close);;

    return indicator(data);
}


// Configure Moving Average with a period of 14, using the close price.
export const movingAverage = (data: any[], period: number = 14) => {
    const indicator = mavg()
        .period(period)
        .value((d: any) => d.close);

    return indicator(data);
}

// Configure MACD with fast period 12, slow period 26, and signal period 9.
export const macdIndicator = (data: any[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
    const indicator = macd()
        .fastPeriod(fastPeriod)
        .slowPeriod(slowPeriod)
        .signalPeriod(signalPeriod)
        .value((d: any) => d.close);

    return indicator(data);
};

// Configure Bollinger Bands with a window size of 20 and multiplier of 2.
export const bbIndicator = (data: any[], period: number = 20, multiplier: number = 2) => {
    const indicator = bollingerBand()
        .period(period)
        .multiplier(multiplier)
        .value((d: any) => d.close);

    return indicator(data);
};

// Short-term EMA
export const shortEma = (data: any[], period: number = 9) => {
    const indicator = ema()
        .period(period)
        .value((d: any) => d.close);

    return indicator(data);
};

// Short-term EMA
export const longEma = (data: any[], period: number = 21) => {
    const indicator = ema()
        .period(period)
        .value((d: any) => d.close);

    return indicator(data);
};

// Short-term EMA
export const stochasticOscillator = (data: any[]) => {
    const indicator = stochastic()
        .closeValue((d : any) => d.close)
        .highValue((d: any) => d.high)
        .lowValue((d: any) => d.low);

    return indicator(data);
}

export function vwapIndicator(data: BriefKline[]) {
    const vwapArray = new Array(data.length).fill(null);
    let cumulativeTPV = 0; // Cumulative Typical Price * Volume
    let cumulativeVolume = 0;

    data.forEach((candle, index) => {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        cumulativeTPV += typicalPrice * candle.volume;
        cumulativeVolume += candle.volume;
        vwapArray[index] = cumulativeVolume === 0 ? null : cumulativeTPV / cumulativeVolume;
    });

    return vwapArray;
}