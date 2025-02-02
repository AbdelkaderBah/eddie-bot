import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import TradingBotsManager from "./manager";
import EddieChiefManager from "./supervisor";

export default function BotsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bots</CardTitle>
        <CardDescription>View all bots.</CardDescription>
      </CardHeader>
        <CardContent>
            <EddieChiefManager availableBots={[]}/>
            <hr className="my-10"/>
            <TradingBotsManager/>
        </CardContent>
    </Card>
  );
}
