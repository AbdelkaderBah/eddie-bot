'use client';

import React, { useMemo, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Timer,
  Activity,
  BarChart2,
  PieChart as PieChartIcon,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface Trade {
  id: string;
  botId: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  leverage: number;
  openTime: Date;
  closeTime: Date;
  pnl: number;
  pnlPercentage: number;
  status: 'WIN' | 'LOSS';
}

export interface Bot {
  id: string;
  name: string;
  trades: Trade[];
  totalPnl: number;
  winRate: number;
  averageTradeDuration: number;
  bestTrade: number;
  worstTrade: number;
  activeTime: number;
  profitFactor: number;
  maxDrawdown: number;
  averageWin: number;
  averageLoss: number;
}

interface BotAnalyticsProps {
  bots: Bot[];
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1'];

const BotAnalytics: React.FC<BotAnalyticsProps> = ({ bots }) => {
  const [selectedBotId, setSelectedBotId] = useState<string | 'all'>('all');
  const [timeRange, setTimeRange] = useState<'1d' | '1w' | '1m' | '3m' | '1y'>(
    '1m'
  );
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);

  // Calculate aggregated metrics for all bots
  const aggregatedMetrics = useMemo(() => {
    const allTrades = bots.flatMap((bot) => bot.trades);
    return {
      totalPnl: bots.reduce((sum, bot) => sum + bot.totalPnl, 0),
      winRate: bots.reduce((sum, bot) => sum + bot.winRate, 0) / bots.length,
      profitFactor:
        bots.reduce((sum, bot) => sum + bot.profitFactor, 0) / bots.length,
      maxDrawdown: Math.max(...bots.map((bot) => bot.maxDrawdown)),
      totalTrades: allTrades.length,
      bestBot: bots.reduce((best, bot) =>
        bot.totalPnl > (best?.totalPnl || -Infinity) ? bot : best
      ),
      worstBot: bots.reduce((worst, bot) =>
        bot.totalPnl < (worst?.totalPnl || Infinity) ? bot : worst
      )
    };
  }, [bots]);

  // Get current bot or all bots data
  const currentData = useMemo(() => {
    if (selectedBotId === 'all') {
      return {
        totalPnl: aggregatedMetrics.totalPnl,
        winRate: aggregatedMetrics.winRate,
        profitFactor: aggregatedMetrics.profitFactor,
        maxDrawdown: aggregatedMetrics.maxDrawdown,
        trades: bots.flatMap((bot) => bot.trades),
        averageWin:
          bots.reduce((sum, bot) => sum + bot.averageWin, 0) / bots.length,
        averageLoss:
          bots.reduce((sum, bot) => sum + bot.averageLoss, 0) / bots.length,
        bestTrade: Math.max(...bots.map((bot) => bot.bestTrade)),
        worstTrade: Math.min(...bots.map((bot) => bot.worstTrade)),
        averageTradeDuration:
          bots.reduce((sum, bot) => sum + bot.averageTradeDuration, 0) /
          bots.length,
        activeTime: Math.max(...bots.map((bot) => bot.activeTime))
      };
    }
    return bots.find((bot) => bot.id === selectedBotId);
  }, [selectedBotId, bots, aggregatedMetrics]);

  // Render bot comparison chart
  const renderBotComparison = () => {
    const comparisonData = bots.map((bot) => ({
      name: bot.name,
      pnl: bot.totalPnl,
      winRate: bot.winRate,
      trades: bot.trades.length
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={comparisonData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis yAxisId="left" orientation="left" stroke="#10B981" />
          <YAxis yAxisId="right" orientation="right" stroke="#6366F1" />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="pnl" name="Total P&L" fill="#10B981" />
          <Bar
            yAxisId="right"
            dataKey="winRate"
            name="Win Rate %"
            fill="#6366F1"
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderMetricCard = (
    title: string,
    value: string | number,
    icon: React.ReactNode,
    trend?: number
  ) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h2 className="text-2xl font-bold mt-2">{value}</h2>
            {trend !== undefined && (
              <p
                className={`text-sm mt-1 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}
              >
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </p>
            )}
          </div>
          <div className="p-2 bg-secondary rounded-md">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  const selectBot = (botId: string) => {
    setSelectedBotId(botId);

    if (botId !== 'all') {
      // @ts-ignore
      setSelectedBot(bots.find((bot) => bot.id === botId));
    } else {
      setSelectedBot(null);
    }
  };

  const renderProfitChart = () => {
    if (!selectedBot) return null;

    // Accumulate profit over time
    const profitData = selectedBot.trades.map((trade, index) => ({
      trade: index + 1,
      profit: trade.pnl,
      accumulatedProfit: selectedBot.trades
        .slice(0, index + 1)
        .reduce((sum, t) => sum + t.pnl, 0)
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={profitData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="trade" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="accumulatedProfit"
            stroke="#10B981"
            name="Cumulative P&L"
          />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#6366F1"
            name="Trade P&L"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderTradeDistribution = () => {
    if (!selectedBot) return null;

    const distribution = {
      long: selectedBot.trades.filter((t) => t.type === 'LONG').length,
      short: selectedBot.trades.filter((t) => t.type === 'SHORT').length,
      wins: selectedBot.trades.filter((t) => t.status === 'WIN').length,
      losses: selectedBot.trades.filter((t) => t.status === 'LOSS').length
    };

    const data = [
      { name: 'Long', value: distribution.long },
      { name: 'Short', value: distribution.short },
      { name: 'Wins', value: distribution.wins },
      { name: 'Losses', value: distribution.losses }
    ];

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={5}
            dataKey="value"
            label
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Bot Analytics</h1>
        <div className="flex gap-4">
          <Select
            value={selectedBotId}
            onValueChange={(value) => selectBot(value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Bot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bots</SelectItem>
              {bots.map((bot) => (
                <SelectItem key={bot.id} value={bot.id}>
                  {bot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={timeRange}
            onValueChange={(value: '1d' | '1w' | '1m' | '3m' | '1y') =>
              setTimeRange(value)
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">24 Hours</SelectItem>
              <SelectItem value="1w">1 Week</SelectItem>
              <SelectItem value="1m">1 Month</SelectItem>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {currentData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderMetricCard(
              'Total P&L',
              `$${currentData.totalPnl.toFixed(2)}`,
              <DollarSign className="h-4 w-4" />,
              0
            )}
            {renderMetricCard(
              'Win Rate',
              `${currentData.winRate.toFixed(1)}%`,
              <Activity className="h-4 w-4" />,
              0
            )}
            {renderMetricCard(
              'Profit Factor',
              currentData.profitFactor.toFixed(2),
              <BarChart2 className="h-4 w-4" />
            )}
            {renderMetricCard(
              'Max Drawdown',
              `${currentData.maxDrawdown.toFixed(1)}%`,
              <TrendingDown className="h-4 w-4" />,
              0
            )}
          </div>

          {selectedBotId === 'all' && (
            <Card>
              <CardHeader>
                <CardTitle>Bot Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {renderBotComparison()}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2 p-4 bg-secondary rounded-lg">
                    <h3 className="font-medium">Best Performing Bot</h3>
                    <div className="flex justify-between items-center">
                      <span>{aggregatedMetrics.bestBot?.name}</span>
                      <span className="text-green-500">
                        ${aggregatedMetrics.bestBot?.totalPnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 p-4 bg-secondary rounded-lg">
                    <h3 className="font-medium">Worst Performing Bot</h3>
                    <div className="flex justify-between items-center">
                      <span>{aggregatedMetrics.worstBot?.name}</span>
                      <span className="text-red-500">
                        ${aggregatedMetrics.worstBot?.totalPnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedBot && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Metrics</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Average Win
                          </span>

                          <span className="text-green-500">
                            ${selectedBot.averageWin.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Average Loss
                          </span>

                          <span className="text-red-500">
                            ${selectedBot.averageLoss.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Best Trade
                          </span>

                          <span className="text-green-500">
                            ${selectedBot.bestTrade.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Worst Trade
                          </span>

                          <span className="text-red-500">
                            ${selectedBot.worstTrade.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Avg Duration
                          </span>

                          <span>{selectedBot.averageTradeDuration}m</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Active Time
                          </span>

                          <span>{selectedBot.activeTime}h</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Trades
                          </span>

                          <span>{selectedBot.trades.length}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Trade Distribution</CardTitle>
                  </CardHeader>

                  <CardContent>{renderTradeDistribution()}</CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Chart</CardTitle>
                </CardHeader>

                <CardContent>
                  <Tabs defaultValue="profit">
                    <TabsList>
                      <TabsTrigger value="profit">Profit Over Time</TabsTrigger>

                      <TabsTrigger value="trades">Trade History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profit" className="h-[300px]">
                      {renderProfitChart()}
                    </TabsContent>

                    <TabsContent value="trades">
                      <div className="space-y-4">
                        {selectedBot.trades.slice(0, 5).map((trade) => (
                          <div
                            key={trade.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <Badge
                                variant={
                                  trade.type === 'LONG'
                                    ? 'default'
                                    : 'destructive'
                                }
                              >
                                {trade.type}
                              </Badge>

                              <div>
                                <p className="font-medium">
                                  Entry: ${trade.entryPrice.toFixed(2)} | Exit:
                                  ${trade.exitPrice.toFixed(2)}
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  {new Date(trade.closeTime).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <Badge
                                variant={
                                  trade.status === 'WIN'
                                    ? 'default'
                                    : 'destructive'
                                }
                              >
                                {trade.pnlPercentage.toFixed(2)}%
                              </Badge>

                              <span
                                className={
                                  trade.pnl >= 0
                                    ? 'text-green-500'
                                    : 'text-red-500'
                                }
                              >
                                ${trade.pnl.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default BotAnalytics;
