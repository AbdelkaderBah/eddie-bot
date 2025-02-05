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
    const [data, setData] = useState<any[]>([]);

    const handlePriceUpdate = useCallback((data: any) => {
        setData(prev => [data, ...prev].slice(0, 8)); // Keep last 100 updates
    }, []);

    const { isConnected, error } = useRedisSubscription({
        channel: 'market_events',
        onMessage: handlePriceUpdate
    });

    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Price Monitor (14 periods)</CardTitle>
            <CardDescription>
              Status:{' '}
              {isConnected ? (
                <span className="text-green-500">Connected</span>
              ) : (
                <span className="text-red-500">Disconnected</span>
              )}
              {error && (
                <div className="text-red-500">Error: {error.message}</div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between p-2 border rounded"
                >
                  <span>{item.symbol}</span>
                  <span className="font-mono">
                    Open: {Number(item.price.open).toFixed(2)}
                  </span>
                  <span className="font-mono">
                    Close: {Number(item.price.close).toFixed(2)}
                  </span>
                  <span className="font-mono">
                    {Number(item.price.change).toFixed(2)}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Vol: {Number(item.volume.totalVolume).toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Buy: {Number(item.volume.buyPercentage).toFixed(2)}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Sell: {Number(item.volume.sellPercentage).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
}