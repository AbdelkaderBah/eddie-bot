import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import PriceMonitor from "./component";

export default function InsightsPage() {

    return (
        <Card>
            <CardHeader>
                <CardTitle>Monitor</CardTitle>
                <CardDescription>Provide more information about what's going on.</CardDescription>
            </CardHeader>
            <CardContent>
                <PriceMonitor />
            </CardContent>
        </Card>
    );
}
