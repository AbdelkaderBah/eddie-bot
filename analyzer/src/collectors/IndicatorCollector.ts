import * as indicators from '../utils/indicators';
import {BriefKline} from "@/types";

export default class IndicatorCollector {
    private candles: BriefKline[] = [];

    public collect(candle: BriefKline) {
        if (this.candles.length > 120) {
            this.candles.shift();
        }

        this.candles.push(candle);

        if (this.candles.length < 25) {
            return;
        }

        // RSI Calculation:
        const rsiValues = indicators.rsiIndicator(this.candles);
        const latestRSI = rsiValues[rsiValues.length - 1];

        // MACD Calculation:
        const macdData = indicators.macdIndicator(this.candles);
        // macdData is typically an array of objects containing {macd, signal, histogram} (depending on d3fc version)
        const latestMACD = macdData[macdData.length - 1];

        // Bollinger Bands Calculation:
        const bbData = indicators.bbIndicator(this.candles);
        const latestBB = bbData[bbData.length - 1]; // {upper, middle, lower}

        // EMA Calculations for Crossovers:
        const shortEmaData = indicators.shortEma(this.candles);
        const longEmaData = indicators.longEma(this.candles);
        const latestShortEma = shortEmaData[shortEmaData.length - 1];
        const latestLongEma = longEmaData[longEmaData.length - 1];

        // Detect an EMA crossover signal:
        let emaSignal = 0;
        if (shortEmaData.length > 1 && longEmaData.length > 1) {
            const prevShort = shortEmaData[shortEmaData.length - 2];
            const prevLong = longEmaData[longEmaData.length - 2];
            if (prevShort <= prevLong && latestShortEma > latestLongEma) {
                emaSignal = 1;  // Bullish crossover
            } else if (prevShort >= prevLong && latestShortEma < latestLongEma) {
                emaSignal = -1; // Bearish crossover
            }
        }

        let stochasticOscillatorSignal = indicators.stochasticOscillator(this.candles.slice(-10));

        // VWAP Calculation:
        const vwapData = indicators.vwapIndicator(this.candles);
        const latestVWAP = vwapData[vwapData.length - 1];

        const mlKnn = indicators.mlKnn(this.candles);


        return {
            mlKnn: mlKnn && Array.isArray(mlKnn) ? mlKnn[mlKnn.length - 1] : mlKnn,
            latestRSI,
            latestMACD,
            shortEma: shortEmaData[shortEmaData.length - 1],
            longEma: longEmaData[longEmaData.length - 1],
            latestBB,
            emaSignal,
            latestVWAP,
            stochasticOscillatorSignal: stochasticOscillatorSignal.slice(-1)[0]
        }
    }
}