"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface KlineWebsocketData {
    e: string;  // Event type
    E: number;  // Event time
    s: string;  // Symbol
    b: [string, string][],  // Bids
    a: [string, string][],  // Asks
}

interface ChartDataPoint {
    time: string;
    timestamp: number;
    askVolume: number;
    bidVolume: number;
}

const DepthChart: React.FC = () => {
    const [depthData, setDepthData] = useState<ChartDataPoint[]>([]);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [error, setError] = useState<string>('');

    const MAX_DATA_POINTS = 100;

    const formatTime = (timestamp: number): string => {
        const date = new Date(timestamp);
        return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    };

    const processData = useCallback((data: string) => {
        try {
            const parsed = JSON.parse(data) as KlineWebsocketData;
            if (parsed.e === 'depthUpdate') {
                const bids = parsed.b;
                const asks = parsed.a;

                // Calculate volumes and weighted prices
                let bidVolume = 0;
                let askVolume = 0;
                let weightedBidSum = 0;
                let weightedAskSum = 0;

                bids.forEach(([price, quantity]) => {
                    const numPrice = parseFloat(price);

                    // if(numPrice < lastPrice - 200) {
                    //     return;
                    // }

                    const numQuantity = parseFloat(quantity);
                    bidVolume += numQuantity;
                    weightedBidSum += numPrice * numQuantity;
                });

                asks.forEach(([price, quantity]) => {
                    const numPrice = parseFloat(price);

                    // if(numPrice < lastPrice + 200) {
                    //     return;
                    // }

                    const numQuantity = parseFloat(quantity);
                    askVolume += numQuantity;
                    weightedAskSum += numPrice * numQuantity;
                });

                const totalVolume = bidVolume + askVolume;
                const weightedBidPrice = weightedBidSum / bidVolume;
                const weightedAskPrice = weightedAskSum / askVolume;

                const newDataPoint: ChartDataPoint = {
                    time: formatTime(parsed.E),
                    timestamp: parsed.E,
                    askVolume: askVolume,
                    bidVolume: bidVolume,
                };

                setDepthData(prevData => {
                    const newData = [...prevData, newDataPoint];
                    return newData.slice(-MAX_DATA_POINTS);
                });
            }
        } catch (err) {
            setError(`Error processing data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }, []);

    useEffect(() => {
        const socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@depth');

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
                <CardTitle>BTC/USDT Depth</CardTitle>
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
                            data={depthData}
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
                            <YAxis />
                            <Line type="monotone" dataKey="askVolume" stroke="#FF585D" activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="bidVolume" stroke="#3253ff" />

                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                                formatter={(value: number, name: string) => [
                                    value.toFixed(2),
                                    name
                                ]}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default DepthChart;