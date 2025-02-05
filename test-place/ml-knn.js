// Import d3fc-technical-indicator functions

// Import WebSocket library (install via npm if needed)
import WebSocket from 'ws';
import {processKlines} from "./lib-ml-knn.js";


// Symbol and interval configuration
const symbol = 'btcusdt';
const interval = '1s';
const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;
const ws = new WebSocket(wsUrl);

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
        time: kline.T,
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

        const output = processKlines(candles, {
            startDate: new Date().getTime() - 64800,
            stopDate: new Date().getTime() + 64800,
            indicator: "All",
            shortWindow: 14,
            longWindow: 28,
            baseK: 252,
            filter: false,
            bars: 300,
        });

        if(output && Array.isArray(output) && output.length > 0) {
            console.log('Output:', output[output.length - 1]);
        }
    }
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
});
