// types/market.ts
export interface MarketEvent {
    type: 'MASS_BUY' | 'MASS_SELL' | 'PRICE_JUMP' | 'PRICE_DROP' | 'PRICE_UPDATE' | 'PRICE_JUMP_SECOND' | 'PRICE_DROP_SECOND';
    symbol: string;
    price: number;
    volume: number;
    timestamp: number;
    percentage: number;
    timeFrame: string;
    additionalData?: {
        startPrice?: number,
        buyVolume?: number,
        sellVolume?: number,
        threshold: number
    }
}

export interface BinanceKline {
    t: number;      // Kline start time
    T: number;      // Kline close time
    s: string;      // Symbol
    i: string;      // Interval
    o: string;      // Open price
    c: string;      // Close price
    h: string;      // High price
    l: string;      // Low price
    v: string;      // Base asset volume
    q: string;      // Quote asset volume
    V: string;      // Taker buy base volume
    Q: string;      // Taker buy quote volume
}

export interface MarketAnalysis {
    symbol: string;
    price: number;    // Add this line
    buyPressure: number;
    sellPressure: number;
    priceVariance: number;
    volume: number;
    timestamp: number;
}

export interface PriceVariation {
    startPrice: number;
    currentPrice: number;
    variation: number;  // percentage
    timestamp: number;
}

export interface IntervalVariations {
    '5m': PriceVariation;
    '10m': PriceVariation;
    '15m': PriceVariation;
    '20m': PriceVariation;
    '25m': PriceVariation;
    '30m': PriceVariation;
    '60m': PriceVariation;
}

export interface IntervalVariationsBySeconds {
    '1s': PriceVariation;
    '2s': PriceVariation;
    '3s': PriceVariation;
    '4s': PriceVariation;
    '5s': PriceVariation;
    '6s': PriceVariation;
    '7s': PriceVariation;
    '8s': PriceVariation;
    '9s': PriceVariation;
    '10s': PriceVariation;
}

export interface VolumeData {
    buyVolume: number;
    sellVolume: number;
    totalVolume: number;
    buyPressure: number;    // Percentage of buy volume
    sellPressure: number;   // Percentage of sell volume
    timestamp: number;
}

export interface IntervalVolumes {
    '5m': VolumeData;
    '10m': VolumeData;
    '15m': VolumeData;
    '20m': VolumeData;
    '25m': VolumeData;
    '30m': VolumeData;
    '60m': VolumeData;
}