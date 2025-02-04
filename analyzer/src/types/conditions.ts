export interface Condition {
    type: 'PRICE' | 'VOLUME';
    percentage?: number;
    period?: number;
    side?: 'BUY' | 'SELL';
}