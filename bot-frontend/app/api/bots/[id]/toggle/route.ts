// app/api/bots/[id]/toggle/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import {apiAuth, authConfig} from '@/lib/auth';
import {Bot} from "@/lib/types/bot";


export const POST = authConfig(async (    req: NextRequest,
                                          { params }: { params: { id: string } }) => {
    try {
        const userId = await apiAuth(req);

        const { status } = await req.json();

        if (!['ACTIVE', 'INACTIVE'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status' },
                { status: 400 }
            );
        }

        const existingBot = await redis.hget(`bots:${userId}`, params.id);

        if (!existingBot) {
            return NextResponse.json(
                { error: 'Bot not found' },
                { status: 404 }
            );
        }

        const bot = JSON.parse(existingBot);

        const updatedBot: Bot = {
            ...bot,
            status,
            updated: new Date()
        };

        await redis.hset(
            `bots:${userId}`,
            params.id,
            JSON.stringify(updatedBot)
        );

        await redis.publish('bot.status_changed', JSON.stringify(updatedBot));

        return NextResponse.json(updatedBot);
    } catch (error) {
        console.error('Toggle bot status error:', error);
        return NextResponse.json(
            { error: 'Failed to toggle bot status' },
            { status: 500 }
        );
    }
});