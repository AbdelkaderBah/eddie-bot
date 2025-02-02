import {redis} from "@/lib/redis";
import {NextResponse} from "next/server";
import bcrypt from "bcryptjs";

export const GET = (async (req: Request) => {
    try {
        const email = process.env.TEST_USER_EMAIL!;
        const password = process.env.TEST_USER_PASSWORD!;
        const hashedPassword = await bcrypt.hash(password, 12);

        const testUser = {
            id: crypto.randomUUID(),
            email: email,
            name: 'Test User',
            password: hashedPassword,
            created: new Date(),
            updated: new Date()
        };

        await redis.hset('users', testUser.email, JSON.stringify(testUser));

        return NextResponse.json("Created!");
    } catch (error) {
        console.error('error:', error);

        return NextResponse.json(
            {error: 'Failed to fetch bots'},
            {status: 500}
        );
    }
});