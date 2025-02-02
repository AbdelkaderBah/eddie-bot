'use client';

import { useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Download,
    Upload,
    AlertCircle,
    Check
} from "lucide-react";
import {Bot} from "@/lib/types/bot";

interface SettingsFormProps {
    initialBots: Bot[];
}

export function SettingsForm({ initialBots }: SettingsFormProps) {
    const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string>('');

    const exportBots = () => {
        try {
            let dataStr = '';
            const timestamp = new Date().toISOString().split('T')[0];
            let filename = `trading-bots-${timestamp}`;

            if (exportFormat === 'json') {
                dataStr = JSON.stringify(initialBots, null, 2);
                filename += '.json';
            } else {
                // CSV Format
                const headers = [
                    'Name',
                    'Symbol',
                    'Type',
                    'Strategy Type',
                    'Scale',
                    'Take Profit',
                    'Stop Loss',
                    'Term',
                    'Status',
                    'Created',
                    'Updated'
                ].join(',');

                const rows = initialBots.map(bot => [
                    bot.name,
                    bot.symbol,
                    bot.type,
                    bot.strategy.type,
                    bot.strategy.scale,
                    bot.strategy.takeProfit,
                    bot.strategy.stopLoss,
                    bot.strategy.term,
                    bot.status,
                    new Date(bot.created).toISOString(),
                    new Date(bot.updated).toISOString()
                ].join(','));

                dataStr = [headers, ...rows].join('\n');
                filename += '.csv';
            }

            const blob = new Blob([dataStr], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError('Failed to export bots configuration');
            setTimeout(() => setError(''), 3000);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Export Configuration</CardTitle>
                    <CardDescription>
                        Export your trading bots configuration for backup or transfer
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Select
                            value={exportFormat}
                            onValueChange={(value: 'json' | 'csv') => setExportFormat(value)}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="json">JSON Format</SelectItem>
                                <SelectItem value="csv">CSV Format</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={exportBots}
                            disabled={initialBots.length === 0}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export Bots
                        </Button>
                    </div>

                    {initialBots.length === 0 && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                No bots configured yet. Create some bots first to export their configuration.
                            </AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="bg-green-50">
                            <Check className="h-4 w-4 text-green-500" />
                            <AlertDescription className="text-green-500">
                                Successfully exported bots configuration
                            </AlertDescription>
                        </Alert>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Additional settings cards can go here */}
            <Card>
                <CardHeader>
                    <CardTitle>Import Configuration</CardTitle>
                    <CardDescription>
                        Import trading bots configuration from a file
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="outline">
                        <Upload className="mr-2 h-4 w-4" />
                        Import Bots
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}