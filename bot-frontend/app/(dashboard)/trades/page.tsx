import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { File, PlusCircle } from 'lucide-react';
import {getTrades} from '@/lib/db';
import {TradesTable} from "./trades-table";
import PositionsTable, {Position} from "./table";

export default async function TradesPage(props: {
  searchParams: Promise<{ q: string; offset: string }>;
}) {
  const searchParams = await props.searchParams;
  const search = searchParams.q ?? '';
  const offset = searchParams.offset ?? 0;
  const { trades, newOffset, totalTrades } = await getTrades(
    search,
    Number(offset)
  );

  const positions = [
    {
      id: '1',
      symbol: 'BTC/USDT',
      type: 'LONG',
      entryPrice: 45000,
      quantity: 0.1,
      leverage: 10,
      openTime: new Date(),
      liquidationPrice: 41000,
      status: 'ACTIVE'
    },
    {
      id: '2',
      symbol: 'BTC/USDT',
      type: 'SHORT',
      entryPrice: 2500,
      exitPrice: 2400,
      quantity: 1,
      leverage: 5,
      openTime: new Date(Date.now() - 86400000),
      closeTime: new Date(),
      pnl: 100,
      pnlPercentage: 4,
      status: 'CLOSED',
      liquidationPrice: 2800
    }
  ] as Position[];

  return (
    <Tabs defaultValue="all">
      <div className="flex items-center">
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Export
            </span>
          </Button>
        </div>
      </div>
      <TabsContent value="all">
        <PositionsTable positions={positions} />

        {/*<TradesTable*/}
        {/*  trades={trades}*/}
        {/*  offset={newOffset ?? 0}*/}
        {/*  totalTrades={totalTrades}*/}
        {/*/>*/}
      </TabsContent>
    </Tabs>
  );
}
