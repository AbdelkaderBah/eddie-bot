"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface KlineWebsocketData {
    e: string;  // Event type
    E: number;  // Event time
    s: string;  // Symbol
    k: {
        t: number;    // Kline start time
        T: number;    // Kline close time
        s: string;    // Symbol
        i: string;    // Interval
        f: number;    // First trade ID
        L: number;    // Last trade ID
        o: string;    // Open price
        c: string;    // Close price
        h: string;    // High price
        l: string;    // Low price
        v: string;    // Base asset volume
        n: number;    // Number of trades
        x: boolean;   // Is this kline closed?
        q: string;    // Quote asset volume
        V: string;    // Taker buy base asset volume
        Q: string;    // Taker buy quote asset volume
        B: string;    // Ignore
    };
}

interface ChartDataPoint {
    time: string;
    timestamp: number;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
}

const BinanceChart: React.FC = () => {
    const [priceData, setPriceData] = useState<ChartDataPoint[]>([]);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [error, setError] = useState<string>('');
    const [currentPrice, setCurrentPrice] = useState<number>(0);

    const MAX_DATA_POINTS = 100;

    const formatTime = (timestamp: number): string => {
        const date = new Date(timestamp);
        return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    };

    const processData = useCallback((data: string) => {
        try {
            const parsed = JSON.parse(data) as KlineWebsocketData;
            if (parsed.e === 'kline') {
                const kline = parsed.k;
                const newDataPoint: ChartDataPoint = {
                    time: formatTime(kline.t),
                    timestamp: kline.t,
                    open: parseFloat(kline.o),
                    close: parseFloat(kline.c),
                    high: parseFloat(kline.h),
                    low: parseFloat(kline.l),
                    volume: parseFloat(kline.v),
                };

                // change page title (nextjs)
                // NextJS
                document.title = `BTC/USDT: ${newDataPoint.close} USDT/BTC`;


                setCurrentPrice(newDataPoint.close);

                setPriceData(prevData => {
                    const newData = [...prevData, newDataPoint];
                    return newData.slice(-MAX_DATA_POINTS);
                });
            }
        } catch (err) {
            setError(`Error processing data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }, []);

    useEffect(() => {
        const socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1s');

        socket.onopen = () => {
            setError('');
            console.log('WebSocket Connected');
        };

        socket.onmessage = (event: MessageEvent) => {
            // console.log(event.data);

            processData(event.data);
        };

        socket.onerror = (error: Event) => {
            setError('WebSocket Error: Connection failed');
        };

        socket.onclose = () => {
            setError('WebSocket Disconnected');
        };

        setWs(socket);

        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [processData]);

    return (
        <Card className="w-full max-w-4xl">
            <CardHeader>
                <CardTitle>BTC/USDT Real-time Chart: {currentPrice} USDT/BTC</CardTitle>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="text-red-500 mb-4">
                        {error}
                    </div>
                )}
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={priceData}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="time"
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                yAxisId="price"
                                domain={['auto', 'auto']}
                                tick={{ fontSize: 12 }}
                                orientation="left"
                                label={{ value: 'Price (USDT)', angle: -90, position: 'insideLeft' }}
                            />
                            <YAxis
                                yAxisId="volume"
                                domain={['auto', 'auto']}
                                tick={{ fontSize: 12 }}
                                orientation="right"
                                label={{ value: 'Volume', angle: 90, position: 'insideRight' }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                                formatter={(value: number, name: string) => [
                                    name === 'Price' ? value.toFixed(2) : value.toFixed(0),
                                    name
                                ]}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="close"
                                stroke="#8884d8"
                                dot={false}
                                name="Price"
                                yAxisId="price"
                            />
                            {/*<Line*/}
                            {/*    type="monotone"*/}
                            {/*    dataKey="volume"*/}
                            {/*    stroke="#82ca9d"*/}
                            {/*    dot={false}*/}
                            {/*    name="Volume"*/}
                            {/*    yAxisId="volume"*/}
                            {/*/>*/}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default BinanceChart;