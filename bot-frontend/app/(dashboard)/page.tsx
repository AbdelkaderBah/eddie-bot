import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import kline from "./kline";
import BinanceChart from "./kline";
import DepthChart from "./depth";
import { RedisData } from './redis-data';

export default async function DashboardPage() {
  return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>View all stats.</CardDescription>
        </CardHeader>
        <CardContent>
            <BinanceChart />
            <DepthChart />
            <RedisData />
        </CardContent>
      </Card>
  );
}
