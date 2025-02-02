import {MarketEvent} from "@/types";

interface DepthWebsocketData {
    e: string;  // Event type
    E: number;  // Event time
    s: string;  // Symbol
    b: [string, string][],  // Bids
    a: [string, string][],  // Asks
}

export default function DepthCollector(lastPrice: number, message: DepthWebsocketData): MarketEvent {
    const bids = message.b;
    const asks = message.a;

    // Calculate volumes and weighted prices
    let bidVolume = 0;
    let askVolume = 0;
    let weightedBidSum = 0;
    let weightedAskSum = 0;

    bids.forEach(([price, quantity]) => {
        const numPrice = parseFloat(price);

        if (numPrice < lastPrice - 200) {
            return;
        }

        const numQuantity = parseFloat(quantity);
        bidVolume += numQuantity;
        weightedBidSum += numPrice * numQuantity;
    });

    asks.forEach(([price, quantity]) => {
        const numPrice = parseFloat(price);

        if (numPrice < lastPrice + 200) {
            return;
        }

        const numQuantity = parseFloat(quantity);
        askVolume += numQuantity;
        weightedAskSum += numPrice * numQuantity;
    });

    const totalVolume = bidVolume + askVolume;

    return {
        name: 'depths',
        type: 'VOLUME',
        symbol: message.s,
        price: lastPrice,
        volume: totalVolume,
        timestamp: message.E,
        percentage: 0,
        timeFrame: '',
        additionalData: {
            buyVolume: bidVolume,
            sellVolume: askVolume,
        }
    }
}