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
    const botData = {};

    // const res = await redisClient.hGetAll('trade:closed');
    const res = require('./../../../server-data.json');
    // console.log(res);


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

          // @ts-ignore
            const pnlSnapshots = Object.values(value.pnlSnapshots);



            // @ts-ignore
            const lastPnl = pnlSnapshots[pnlSnapshots.length - 1][1];

            let i = 10;

          // @ts-ignore
            for (const [price, pnl] of pnlSnapshots.reverse()) {
                //@ts-ignore
                botData[name].trades.push({
                    id: tradeId + i,
                    botId: name,
                    index: i,
                  // @ts-ignore
                    type: value.side,
                  // @ts-ignore
                    entryPrice: value.price,
                    exitPrice: price,
                  // @ts-ignore

                    quantity: value.quantity,
                  // @ts-ignore

                    leverage: value.leverage,
                  // @ts-ignore

                    openTime: value.timestamp - i,
                  // @ts-ignore

                    closeTime: value.closedAt - i,
                    pnl: pnl,
                  // @ts-ignore

                    pnlPercentage: pnl / value.price,
                    status: pnl > 0 ? "WIN" : "LOSS"
                });

                i += 10;
            }

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
