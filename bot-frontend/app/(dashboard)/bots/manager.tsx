"use client"

import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import {
  PlayCircle,
  StopCircle,
  Settings,
  Trash2,
  Plus,
  AlertTriangle
} from 'lucide-react';

type TradingPair = 'BTCUSDT' | 'ETHUSDT';
type BotType = 'MANUAL' | 'EDDIE';
type StrategyType = 'BUY' | 'SELL' | 'SHORT' | 'LONG';
type TradingTerm = 'SHORT_TERM' | 'LONG_TERM';

interface Strategy {
  type: StrategyType;
  scale: number;
  takeProfit: number;
  stopLoss: number;
  term: TradingTerm;
}

interface Bot {
  id: string;
  name: string;
  symbol: TradingPair;
  active: boolean;
  type: BotType;
  strategy: Strategy;
  created: Date;
  lastTriggered?: Date;
  totalTrades: number;
  profitLoss: number;
}

interface NewBotFormData {
  name: string;
  symbol: TradingPair;
  type: BotType;
  strategy: Strategy;
}

const initialNewBotState: NewBotFormData = {
  name: '',
  symbol: 'BTCUSDT',
  type: 'MANUAL',
  strategy: {
    type: 'SHORT',
    scale: 1,
    takeProfit: 5,
    stopLoss: 3,
    term: 'SHORT_TERM'
  }
};

interface TradingBotsManagerProps {
  onCreateBot?: (bot: Omit<Bot, 'id'>) => void;
  onUpdateBot?: (id: string, active: boolean) => void;
  onDeleteBot?: (id: string) => void;
}

const TradingBotsManager: React.FC<TradingBotsManagerProps> = ({
                                                                 onCreateBot,
                                                                 onUpdateBot,
                                                                 onDeleteBot
                                                               }) => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newBot, setNewBot] = useState<NewBotFormData>(initialNewBotState);

  const handleCreateBot = () => {
    const bot: Bot = {
      id: crypto.randomUUID(),
      name: newBot.name,
      symbol: newBot.symbol,
      active: false,
      type: newBot.type,
      strategy: {
        type: newBot.strategy.type,
        scale: newBot.strategy.scale,
        takeProfit: newBot.strategy.takeProfit,
        stopLoss: newBot.strategy.stopLoss,
        term: newBot.strategy.term
      },
      created: new Date(),
      totalTrades: 0,
      profitLoss: 0
    };

    setBots(prevBots => [...prevBots, bot]);
    onCreateBot?.(bot);
    setIsCreating(false);
    setNewBot(initialNewBotState);
  };

  const handleStrategyUpdate = (key: keyof Strategy, value: Strategy[keyof Strategy]) => {
    setNewBot(prev => ({
      ...prev,
      strategy: {
        ...prev.strategy,
        [key]: value
      }
    }));
  };

  const handleBotUpdate = (id: string, active: boolean) => {
    setBots(prevBots =>
        prevBots.map(bot =>
            bot.id === id ? { ...bot, active } : bot
        )
    );
    onUpdateBot?.(id, active);
  };

  const handleBotDelete = (id: string) => {
    setBots(prevBots => prevBots.filter(bot => bot.id !== id));
    onDeleteBot?.(id);
  };

  return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Trading Bots</CardTitle>
                <CardDescription>Manage your automated trading strategies</CardDescription>
              </div>
              <Dialog open={isCreating} onOpenChange={setIsCreating}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Bot
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Trading Bot</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Bot Name</Label>
                      <Input
                          id="name"
                          value={newBot.name}
                          onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                          placeholder="e.g., BTC Scalper"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Trading Pair</Label>
                      <Select
                          value={newBot.symbol}
                          onValueChange={(value: TradingPair) =>
                              setNewBot({ ...newBot, symbol: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select trading pair" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BTCUSDT">BTC/USDT</SelectItem>
                          <SelectItem value="ETHUSDT">ETH/USDT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Bot Type</Label>
                      <Select
                          value={newBot.type}
                          onValueChange={(value: BotType) =>
                              setNewBot({ ...newBot, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select bot type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MANUAL">Manual Control</SelectItem>
                          <SelectItem value="EDDIE">Eddie Chief</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Strategy Type</Label>
                      <Select
                          value={newBot.strategy.type}
                          onValueChange={(value: StrategyType) =>
                              handleStrategyUpdate('type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select strategy type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BUY">Buy</SelectItem>
                          <SelectItem value="SELL">Sell</SelectItem>
                          <SelectItem value="SHORT">Short</SelectItem>
                          <SelectItem value="LONG">Long</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Leverage Scale (x1 - x125)</Label>
                      <Slider
                          value={[newBot.strategy.scale]}
                          min={1}
                          max={125}
                          step={1}
                          onValueChange={([value]) => handleStrategyUpdate('scale', value)}
                      />
                      <span className="text-sm text-muted-foreground">
                      Current: {newBot.strategy.scale}x
                    </span>
                    </div>

                    <div className="grid gap-2">
                      <Label>Take Profit (%)</Label>
                      <Input
                          type="number"
                          value={newBot.strategy.takeProfit}
                          onChange={(e) => handleStrategyUpdate('takeProfit', Number(e.target.value))}
                          min={0}
                          max={100}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Stop Loss (%)</Label>
                      <Input
                          type="number"
                          value={newBot.strategy.stopLoss}
                          onChange={(e) => handleStrategyUpdate('stopLoss', Number(e.target.value))}
                          min={0}
                          max={100}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Trading Term</Label>
                      <Select
                          value={newBot.strategy.term}
                          onValueChange={(value: TradingTerm) =>
                              handleStrategyUpdate('term', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select trading term" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SHORT_TERM">Short Term</SelectItem>
                          <SelectItem value="LONG_TERM">Long Term</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() => {
                          setIsCreating(false);
                          setNewBot(initialNewBotState);
                        }}
                    >
                      Cancel
                    </Button>
                    <Button
                        onClick={handleCreateBot}
                        disabled={!newBot.name.trim()}
                    >
                      Create Bot
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead>Total Trades</TableHead>
                  <TableHead>P/L</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bots.map((bot) => (
                    <TableRow key={bot.id}>
                      <TableCell className="font-medium">{bot.name}</TableCell>
                      <TableCell>{bot.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={bot.type === 'EDDIE' ? 'default' : 'secondary'}>
                          {bot.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={bot.active ? 'default' : 'secondary'}>
                          {bot.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{bot.strategy.type} ({bot.strategy.term})</div>
                          <div className="text-muted-foreground">
                            Scale: {bot.strategy.scale}x | TP: {bot.strategy.takeProfit}% | SL: {bot.strategy.stopLoss}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {bot.lastTriggered ? new Date(bot.lastTriggered).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell>{bot.totalTrades}</TableCell>
                      <TableCell>
                    <span className={bot.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {bot.profitLoss >= 0 ? '+' : ''}{bot.profitLoss.toFixed(2)} USDT
                    </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleBotUpdate(bot.id, !bot.active)}
                          >
                            {bot.active ? (
                                <StopCircle className="h-4 w-4 text-red-500" />
                            ) : (
                                <PlayCircle className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                              variant="ghost"
                              size="icon"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleBotDelete(bot.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                ))}
                {bots.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center h-24">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <AlertTriangle className="h-8 w-8" />
                          <p>No trading bots found. Create one to get started!</p>
                        </div>
                      </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
  );
};

export default TradingBotsManager;