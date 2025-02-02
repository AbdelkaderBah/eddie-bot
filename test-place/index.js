import { WebSocket } from 'ws';

const ws = new WebSocket('wss://stream.binance.com:9443/ws');

let lastPrice = 0;

ws.on('open', () => {
    // Subscribe to multiple symbols
    const symbols = ['btcusdt'];
    const intervals = ['1s'];

    const subscriptions = symbols.flatMap(symbol =>
        intervals.map(interval => `${symbol}@kline_${interval}`)
    );

    subscriptions.push('btcusdt@depth');

    ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: subscriptions,
        id: 1
    }));
});

const PRICE_LEVELS = 500;

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());

    if (message.e === 'kline') {
        // console.log('Kline', message.k);

        lastPrice = message.k.c * 1;

        console.log('Last price', lastPrice);
    }

    if (message.e === 'depthUpdate') {
        // Take top PRICE_LEVELS from each side
        const bids = message.b;
        const asks = message.a;

        // Calculate volumes and weighted prices
        let bidVolume = 0;
        let askVolume = 0;
        let weightedBidSum = 0;
        let weightedAskSum = 0;

        bids.forEach(([price, quantity]) => {
            const numPrice = parseFloat(price);

            if(numPrice < lastPrice - 200) {
                return;
            }

            const numQuantity = parseFloat(quantity);
            bidVolume += numQuantity;
            weightedBidSum += numPrice * numQuantity;
        });

        asks.forEach(([price, quantity]) => {
            const numPrice = parseFloat(price);

            if(numPrice < lastPrice + 200) {
                return;
            }

            const numQuantity = parseFloat(quantity);
            askVolume += numQuantity;
            weightedAskSum += numPrice * numQuantity;
        });

        const totalVolume = bidVolume + askVolume;
        const weightedBidPrice = weightedBidSum / bidVolume;
        const weightedAskPrice = weightedAskSum / askVolume;

        console.log('depth', {
            totalVolume,
            bidVolume,
            askVolume,
            buyPercentage: (bidVolume / totalVolume) * 100,
            askPercentage: (askVolume / totalVolume) * 100,
            weightedBidPrice,
            weightedAskPrice,
            spread: weightedAskPrice - weightedBidPrice,
            spreadPercent: ((weightedAskPrice - weightedBidPrice) / weightedBidPrice) * 100,
            lastPrice,
        });
    }
});