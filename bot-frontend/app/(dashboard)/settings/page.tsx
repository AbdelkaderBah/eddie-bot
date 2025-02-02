// app/settings/page.tsx
import { redis } from '@/lib/redis';
import { auth } from '@/lib/auth';
import { SettingsForm } from './settings-form';
import {Bot} from "@/lib/types/bot";

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user) return null;

    const bots = await redis.hgetall(`bots:${session.user.id}`);
    const botsData: Bot[] = Object.values(bots).map(bot => JSON.parse(bot));

    return (
        <div className="container mx-auto py-6">
            <SettingsForm initialBots={botsData} />
        </div>
    );
}