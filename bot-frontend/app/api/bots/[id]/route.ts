// app/api/bots/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import {apiAuth, authConfig} from '@/lib/auth';
import {Bot} from "@/lib/types/bot";

// Get Single Bot
export const GET = authConfig(async (    req: NextRequest,
                                          { params }: { params: { id: string } }) => {
    try {
        const userId = await apiAuth(req);

        const bot = await redis.hget(`bots:${userId}`, params.id);

        if (!bot) {
            return NextResponse.json(
                { error: 'Bot not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(JSON.parse(bot));
    } catch (error) {
        console.error('Get bot error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bot' },
            { status: 500 }
        );
    }
});

// Update Bot
export const PUT = authConfig(async (    req: NextRequest,
                                          { params }: { params: { id: string } }) => {
    try {
        const userId = await apiAuth(req);

        const updates = await req.json();
        const existingBot = await redis.hget(`bots:${userId}`, params.id);

        if (!existingBot) {
            return NextResponse.json(
                { error: 'Bot not found' },
                { status: 404 }
            );
        }

        const bot = JSON.parse(existingBot);

        if (updates.strategy) {
            if (
                updates.strategy.scale < 1 ||
                updates.strategy.scale > 125 ||
                updates.strategy.takeProfit < 0 ||
                updates.strategy.stopLoss < 0
            ) {
                return NextResponse.json(
                    { error: 'Invalid strategy parameters' },
                    { status: 400 }
                );
            }
        }

        const updatedBot: Bot = {
            ...bot,
            ...updates,
            updated: new Date()
        };

        await redis.hset(
            `bots:${userId}`,
            params.id,
            JSON.stringify(updatedBot)
        );

        await redis.publish('bot.updated', JSON.stringify(updatedBot));

        return NextResponse.json(updatedBot);
    } catch (error) {
        console.error('Update bot error:', error);
        return NextResponse.json(
            { error: 'Failed to update bot' },
            { status: 500 }
        );
    }
});

// Delete Bot
export const DELETE = authConfig(async (    req: NextRequest,
                                          { params }: { params: { id: string } }) => {
    try {
        const userId = await apiAuth(req);

        const bot = await redis.hget(`bots:${userId}`, params.id);

        if (!bot) {
            return NextResponse.json(
                { error: 'Bot not found' },
                { status: 404 }
            );
        }

        await redis.hdel(`bots:${userId}`, params.id);
        await redis.publish('bot.deleted', JSON.stringify({ userId, botId: params.id }));

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Delete bot error:', error);
        return NextResponse.json(
            { error: 'Failed to delete bot' },
            { status: 500 }
        );
    }
});