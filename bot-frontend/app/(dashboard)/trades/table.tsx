"use client";

import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export interface Position {
    id: string;
    symbol: string;
    type: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice?: number;
    quantity: number;
    leverage: number;
    openTime: Date;
    closeTime?: Date;
    pnl?: number;
    pnlPercentage?: number;
    status: 'ACTIVE' | 'CLOSED';
    liquidationPrice: number;
}

interface PositionsTableProps {
    positions: Position[];
}


const formatPrice = (price: number): string => {
    return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDateTime = (date: Date): string => {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const PositionsTable: React.FC<PositionsTableProps> = ({ positions }) => {
    const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');

    const filteredPositions = positions.filter(
        (position) =>
            (activeTab === 'active' && position.status === 'ACTIVE') ||
            (activeTab === 'closed' && position.status === 'CLOSED')
    );

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Trading Positions</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs
                    defaultValue="active"
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as 'active' | 'closed')}
                >
                    <TabsList className="mb-4">
                        <TabsTrigger value="active">Active Positions</TabsTrigger>
                        <TabsTrigger value="closed">Closed Positions</TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab}>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Symbol</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Entry Price</TableHead>
                                        {activeTab === 'closed' && <TableHead>Exit Price</TableHead>}
                                        <TableHead>Quantity</TableHead>
                                        <TableHead>Leverage</TableHead>
                                        <TableHead>Open Time</TableHead>
                                        {activeTab === 'closed' && <TableHead>Close Time</TableHead>}
                                        <TableHead>Liquidation Price</TableHead>
                                        {activeTab === 'closed' && <TableHead>PnL</TableHead>}
                                        {activeTab === 'closed' && <TableHead>PnL %</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPositions.map((position) => (
                                        <TableRow key={position.id}>
                                            <TableCell>{position.symbol}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={position.type === 'LONG' ? 'default' : 'destructive'}
                                                >
                                                    {position.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatPrice(position.entryPrice)}</TableCell>
                                            {activeTab === 'closed' && (
                                                <TableCell>{formatPrice(position.exitPrice!)}</TableCell>
                                            )}
                                            <TableCell>{position.quantity}</TableCell>
                                            <TableCell>{position.leverage}x</TableCell>
                                            <TableCell>{formatDateTime(position.openTime)}</TableCell>
                                            {activeTab === 'closed' && (
                                                <TableCell>{formatDateTime(position.closeTime!)}</TableCell>
                                            )}
                                            <TableCell>{formatPrice(position.liquidationPrice)}</TableCell>
                                            {activeTab === 'closed' && (
                                                <>
                                                    <TableCell>
                            <span className={position.pnl! >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {formatPrice(position.pnl!)}
                            </span>
                                                    </TableCell>
                                                    <TableCell>
                            <span className={position.pnlPercentage! >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {position.pnlPercentage!.toFixed(2)}%
                            </span>
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))}
                                    {filteredPositions.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={activeTab === 'active' ? 7 : 10}
                                                className="text-center h-24 text-muted-foreground"
                                            >
                                                No {activeTab} positions found
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default PositionsTable;