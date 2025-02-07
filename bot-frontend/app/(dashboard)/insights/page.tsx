import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import BotAnalytics, {Bot} from "./analytics";
import {redisClient} from "@/lib/redis";

export default async function InsightsPage() {
    const sampleBotData: Bot[] = [
        {
            id: "bot-1",
            name: "BTC Scalper",
            totalPnl: 15234.50,
            winRate: 65.8,
            averageTradeDuration: 45, // minutes
            bestTrade: 1250.00,
            worstTrade: -820.30,
            activeTime: 168, // hours
            profitFactor: 1.85,
            maxDrawdown: 12.5,
            averageWin: 425.50,
            averageLoss: -285.20,
            trades: [
                {
                    id: "trade-1",
                    botId: "bot-1",
                    type: "LONG",
                    entryPrice: 42150.00,
                    exitPrice: 42950.00,
                    quantity: 0.5,
                    leverage: 10,
                    openTime: new Date('2024-01-10T10:00:00'),
                    closeTime: new Date('2024-01-10T14:30:00'),
                    pnl: 400.00,
                    pnlPercentage: 1.90,
                    status: "WIN"
                },
                {
                    id: "trade-2",
                    botId: "bot-1",
                    type: "SHORT",
                    entryPrice: 43500.00,
                    exitPrice: 43100.00,
                    quantity: 0.4,
                    leverage: 10,
                    openTime: new Date('2024-01-11T09:15:00'),
                    closeTime: new Date('2024-01-11T11:45:00'),
                    pnl: 160.00,
                    pnlPercentage: 0.92,
                    status: "WIN"
                },
                // Add more recent trades...
            ]
        },
        {
            id: "bot-2",
            name: "ETH Trend Follower",
            totalPnl: 8925.30,
            winRate: 58.2,
            averageTradeDuration: 120,
            bestTrade: 980.00,
            worstTrade: -650.40,
            activeTime: 336,
            profitFactor: 1.62,
            maxDrawdown: 15.8,
            averageWin: 380.20,
            averageLoss: -220.50,
            trades: [
                {
                    id: "trade-3",
                    botId: "bot-2",
                    type: "LONG",
                    entryPrice: 2250.00,
                    exitPrice: 2310.00,
                    quantity: 2.0,
                    leverage: 5,
                    openTime: new Date('2024-01-09T15:20:00'),
                    closeTime: new Date('2024-01-10T03:45:00'),
                    pnl: 120.00,
                    pnlPercentage: 2.67,
                    status: "WIN"
                }
                // Add more trades...
            ]
        },
        {
            id: "bot-3",
            name: "BNB Reversal Hunter",
            totalPnl: -2150.80,
            winRate: 42.5,
            averageTradeDuration: 30,
            bestTrade: 580.00,
            worstTrade: -920.30,
            activeTime: 72,
            profitFactor: 0.85,
            maxDrawdown: 22.4,
            averageWin: 290.40,
            averageLoss: -340.60,
            trades: [
                {
                    id: "trade-4",
                    botId: "bot-3",
                    type: "SHORT",
                    entryPrice: 320.50,
                    exitPrice: 318.20,
                    quantity: 10.0,
                    leverage: 3,
                    openTime: new Date('2024-01-11T18:30:00'),
                    closeTime: new Date('2024-01-11T19:15:00'),
                    pnl: 69.00,
                    pnlPercentage: 0.72,
                    status: "WIN"
                }
                // Add more trades...
            ]
        },
        {
            id: "bot-4",
            name: "XRP Breakout Trader",
            totalPnl: 5680.20,
            winRate: 52.3,
            averageTradeDuration: 60,
            bestTrade: 820.00,
            worstTrade: -450.20,
            activeTime: 240,
            profitFactor: 1.35,
            maxDrawdown: 18.2,
            averageWin: 310.50,
            averageLoss: -280.30,
            trades: [
                {
                    id: "trade-5",
                    botId: "bot-4",
                    type: "LONG",
                    entryPrice: 0.55,
                    exitPrice: 0.58,
                    quantity: 10000,
                    leverage: 5,
                    openTime: new Date('2024-01-10T20:45:00'),
                    closeTime: new Date('2024-01-11T02:30:00'),
                    pnl: 300.00,
                    pnlPercentage: 5.45,
                    status: "WIN"
                }
                // Add more trades...
            ]
        }
    ];

    const botData = {};

    const res = await redisClient.hGetAll('trade:closed');

        const botNames = {};

        for (const [key, value] of Object.entries(res)) {
            const [name, tradeId] = key.split(':');

            //@ts-ignore
            botNames[name] = name;


            //@ts-ignore
            if (!botData[name]) {
                //@ts-ignore
                botData[name] = {
                    id: tradeId,
                    name: name,
                    totalPnl: 0,
                    winRate: 0,
                    averageTradeDuration: (10*16 / 60).toFixed(2),
                    bestTrade: 0,
                    worstTrade: 0,
                    activeTime: 0,
                    profitFactor: 0,
                    maxDrawdown: 0,
                    averageWin: 0,
                    averageLoss: 0,
                    trades: []
                };
            }

            const pnlSnapshots = Object.values(value.pnlSnapshots);


            // @ts-ignore
            const lastPnl = pnlSnapshots[pnlSnapshots.length - 1][1];

            //@ts-ignore
            botData[name].trades.push(                {
                id: tradeId,
                botId: name,
                type: value.side,
                entryPrice: value.price,
                exitPrice: lastPnl,
                quantity: value.quantity,
                leverage: value.leverage,
                openTime: value.timestamp,
                closeTime: value.closedAt,
                pnl: lastPnl,
                pnlPercentage: lastPnl / value.price,
                status: lastPnl > 0 ? "WIN" : "LOSS"
            });
        }

        for(const name of Object.keys(botNames)){
            //@ts-ignore
            botData[name].activeTime = ((10*16 / 60) * botData[name].trades.length / 60).toFixed(2);
            //@ts-ignore
            botData[name].totalPnl = (botData[name].trades.reduce((acc, trade) => acc + trade.pnl, 0)).toFixed(3) * 1;
            //@ts-ignore
            botData[name].averageWin = botData[name].trades.filter(trade => trade.status === "WIN").reduce((acc, trade) => acc + trade.pnl, 0) / botData[name].trades.filter(trade => trade.status === "WIN").length;
            //@ts-ignore
            botData[name].averageLoss = botData[name].trades.filter(trade => trade.status === "LOSS").reduce((acc, trade) => acc + trade.pnl, 0) / botData[name].trades.filter(trade => trade.status === "LOSS").length;
            //@ts-ignore
            botData[name].winRate = (botData[name].trades.filter(trade => trade.status === "WIN").length / botData[name].trades.length * 100).toFixed(3) * 1;
            //@ts-ignore
            botData[name].bestTrade = Math.max(...botData[name].trades.map(trade => trade.pnl));
            //@ts-ignore
            botData[name].maxDrawdown = Math.max(...botData[name].trades.map(trade => trade.pnl));
            //@ts-ignore
            botData[name].worstTrade = Math.min(...botData[name].trades.map(trade => trade.pnl));
            //@ts-ignore
            botData[name].profitFactor = botData[name].trades.filter(trade => trade.status === "WIN").reduce((acc, trade) => acc + trade.pnl, 0) / botData[name].trades.filter(trade => trade.status === "LOSS").reduce((acc, trade) => acc + trade.pnl, 0);
        }

    const data: Bot[] = Object.keys(botData).map((key) => {
        // @ts-ignore
        return botData[key];
    });

  console.log(data);


    return (
        <Card>
            <CardHeader>
                <CardTitle>Insights</CardTitle>
                <CardDescription>Provide more information about what's going on.</CardDescription>
            </CardHeader>
            <CardContent>
                <BotAnalytics bots={data}/>
            </CardContent>
        </Card>
    );
}
