// Import d3fc-technical-indicator functions
import {
    indicatorRelativeStrengthIndex as rsi,
    indicatorMacd as macd,
    indicatorBollingerBands as bollingerBand,
    indicatorExponentialMovingAverage as ema,
    indicatorStochasticOscillator as sO,
} from 'd3fc-technical-indicator';

// Import WebSocket library (install via npm if needed)
import WebSocket from 'ws';


// Symbol and interval configuration
const symbol = 'btcusdt';
const interval = '1s';
const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;
const ws = new WebSocket(wsUrl);

// Configure RSI with a period of 14, using the close price.
const rsiIndicator = rsi()
    .period(14)
    .value(d => d.close);

// Configure MACD with fast period 12, slow period 26, and signal period 9.
const macdIndicator = macd()
    .fastPeriod(12)
    .slowPeriod(26)
    .signalPeriod(9)
    .value(d => d.close);

// Configure Bollinger Bands with a window size of 20 and multiplier of 2.
const bbIndicator = bollingerBand()
    .period(20)
    .multiplier(2)
    .value(d => d.close);

// Short-term EMA
const shortEma = ema()
    .period(9)
    .value(d => d.close);

// Short-term EMA
const longEma = ema()
    .period(21)
    .value(d => d.close);

// Short-term EMA
const stochasticOscillator = sO()
    .closeValue(d => d.close)
    .highValue(d => d.high)
    .lowValue(d => d.low);

/**
 * Calculate VWAP for an array of candlestick data.
 * @param {Array} data - Array of candlestick data with 'high', 'low', 'close', 'volume'.
 * @returns {Array} - Array of VWAP values.
 */
function vwapIndicator(data) {
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


// Array to store historical candle data
let candles = [];

ws.on('open', () => {
    console.log('Connected to Binance WebSocket.');
});

ws.on('message', (message) => {
    const data = JSON.parse(message);
    const kline = data.k;

    // Create a candle object. Convert numeric values appropriately.
    const candle = {
        openTime: kline.t,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v),
        closeTime: kline.T
    };

    // Process only closed candles
    if (kline.x) {
        candles.push(candle);

        // Optionally, maintain a fixed-length array (e.g., last 500 candles)
        if (candles.length > 500) {
            candles.shift();
        }

        // Calculate indicators using d3fc-technical-indicator functions:

        // RSI Calculation:
        const rsiValues = rsiIndicator(candles);
        const latestRSI = rsiValues[rsiValues.length - 1];

        // MACD Calculation:
        const macdData = macdIndicator(candles);
        // macdData is typically an array of objects containing {macd, signal, histogram} (depending on d3fc version)
        const latestMACD = macdData[macdData.length - 1];

        // Bollinger Bands Calculation:
        const bbData = bbIndicator(candles);
        const latestBB = bbData[bbData.length - 1]; // {upper, middle, lower}

        // EMA Calculations for Crossovers:
        const shortEmaData = shortEma(candles);
        const longEmaData = longEma(candles);
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

        let stochasticOscillatorSignal = stochasticOscillator(candles.slice(-10));

        // VWAP Calculation:
        const vwapData = vwapIndicator(candles);
        const latestVWAP = vwapData[vwapData.length - 1];

        // Now you can use these indicator values for your trading logic.
        console.log('Latest RSI:', latestRSI);
        console.log('Latest MACD:', latestMACD);
        console.log('Latest Bollinger Bands:', latestBB);
        console.log('EMA Crossover Signal:', emaSignal);
        console.log('Latest VWAP:', latestVWAP);
        console.log('Stochastic Oscillator:', stochasticOscillatorSignal.slice(-1)[0]);

        // Example: if RSI is below 30 and there's a bullish EMA crossover, consider buying.
        // (This is only an illustrative example – please develop your own risk management.)
        // if (latestRSI < 30 && emaSignal === 1) {
        //   executeBuyOrder();
        // }
    }
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
});
