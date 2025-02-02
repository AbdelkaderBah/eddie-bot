export interface Bot {
    id: string;
    name: string;
    userId: string;
    symbol: string;
    type: 'MANUAL' | 'EDDIE';
    status: 'ACTIVE' | 'INACTIVE';
    strategy: {
        type: 'BUY' | 'SELL' | 'SHORT' | 'LONG';
        scale: number;
        takeProfit: number;
        stopLoss: number;
        term: 'SHORT_TERM' | 'LONG_TERM';
    };
    created: Date;
    updated: Date;
}

export interface CreateBotDTO {
    name: string;
    symbol: string;
    type: 'MANUAL' | 'EDDIE';
    strategy: {
        type: 'BUY' | 'SELL' | 'SHORT' | 'LONG';
        scale: number;
        takeProfit: number;
        stopLoss: number;
        term: 'SHORT_TERM' | 'LONG_TERM';
    };
}