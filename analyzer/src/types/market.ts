// types/market.ts
export interface MarketEvent {
    name: string;
    type: 'PRICE_UPDATE' | 'VOLUME';
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
        threshold?: number
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
    x?: boolean;      // Is this kline closed?
}

export interface BriefKline {
    time: number;
    high: number;
    low: number;
    close: number;
    open: number;
    volume: number;
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