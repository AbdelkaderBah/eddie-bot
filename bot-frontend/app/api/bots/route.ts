import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import {apiAuth, authConfig} from '@/lib/auth';
import {Bot} from "@/lib/types/bot";

// GET ALL BOTS
export const GET = authConfig(async (req: Request) => {
    try {
        const userId = await apiAuth(req);

        const botsMap = await redis.hgetall(`bots:${userId}`);
        const bots = Object.values(botsMap).map(bot => JSON.parse(<string>bot));

        return NextResponse.json(bots);
    } catch (error) {
        console.error('Get bots error:', error);
        return NextResponse.json(
            {error: 'Failed to fetch bots'},
            {status: 500}
        );
    }
});

// Create Bot
export const POST = authConfig(async (req: Request) => {
    try {
        // Check authentication
        const userId = await apiAuth(req);

        const body = await req.json();

        // Validate required fields
        if (!body.name || !body.symbol || !body.strategy) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate strategy parameters
        if (
            body.strategy.scale < 1 ||
            body.strategy.scale > 125 ||
            body.strategy.takeProfit < 0 ||
            body.strategy.stopLoss < 0
        ) {
            return NextResponse.json(
                { error: 'Invalid strategy parameters' },
                { status: 400 }
            );
        }

        const bot: Bot = {
            id: crypto.randomUUID(),
            userId,
            status: 'INACTIVE',
            created: new Date(),
            updated: new Date(),
            ...body
        };

        // Store in Redis
        await redis.hset(
            `bots:${userId}`,
            bot.id,
            JSON.stringify(bot)
        );

        // Publish bot creation event
        await redis.publish('bot.created', JSON.stringify(bot));

        return NextResponse.json(bot, { status: 201 });
    } catch (error) {
        console.error('Bot creation error:', error);
        return NextResponse.json(
            { error: 'Failed to create bot' },
            { status: 500 }
        );
    }
});