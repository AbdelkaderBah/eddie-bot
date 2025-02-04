'use client';

import { useRedisSubscription } from '../../../hooks/useRedisSubscription';
import { useCallback, useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function PriceMonitor() {
    const [prices, setPrices] = useState<any[]>([]);

    const handlePriceUpdate = useCallback((data: any) => {
        setPrices(prev => [data, ...prev].slice(0, 100)); // Keep last 100 updates
        console.log('Price update:', data);
    }, []);

    const { isConnected, error } = useRedisSubscription({
        channel: 'prices',
        onMessage: handlePriceUpdate
    });

    return (
        <div className="p-4">
            <Card>
                <CardHeader>
                    <CardTitle>Price Monitor</CardTitle>
                    <CardDescription>
                        Status: {isConnected ?
                        <span className="text-green-500">Connected</span> :
                        <span className="text-red-500">Disconnected</span>
                    }
                        {error && <div className="text-red-500">Error: {error.message}</div>}
                    </CardDescription>
                </CardHeader>
                <CardContent>

                    {/*<div className="space-y-4">*/}
                    {/*    {prices.map((price, index) => (*/}
                    {/*        <div key={index} className="flex justify-between p-2 border rounded">*/}
                    {/*            <span>{price.symbol}</span>*/}
                    {/*            <span className="font-mono">*/}
                    {/*                ${Number(price.price).toFixed(2)}*/}
                    {/*            </span>*/}
                    {/*            <span className="text-sm text-muted-foreground">*/}
                    {/*                Vol: {Number(price.volume).toFixed(4)}*/}
                    {/*            </span>*/}
                    {/*        </div>*/}
                    {/*    ))}*/}
                    {/*</div>*/}
                </CardContent>
            </Card>
        </div>
    );
}