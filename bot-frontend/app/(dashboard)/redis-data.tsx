import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React from 'react';
import { Redis } from 'ioredis';

export const RedisData = async ()=> {
    // @ts-ignore
    let prices = [];

    const rd = new Redis('redis://localhost:6179');

    const p = await rd.zrange('events:BTCUSDT:prices', 0, 5, 'REV');

    prices = p.map(price => JSON.parse(price));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Realtime data</CardTitle>
      </CardHeader>
      <CardContent>
          <Table>
              <TableHeader>
                  <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Timestamp</TableHead>
                  </TableRow>
              </TableHeader>
                <TableBody>
                    {prices.map((price) => (
                        <TableRow key={price.timestamp}>
                            <TableCell>{price.symbol}</TableCell>
                            <TableCell>{price.price}</TableCell>
                            <TableCell>{price.volume}</TableCell>
                            <TableCell>{price.timestamp}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
}
