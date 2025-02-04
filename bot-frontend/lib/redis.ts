// lib/redis.ts
import { Redis } from 'ioredis';

if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not defined in environment variables');
}

console.log('Connecting redis!')

// Create Redis instance
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err: { message: string | string[] }) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
});

console.log('Connecting redis!')

// Error handling
redis.on('error', (error: any) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
    console.log('Successfully connected to Redis');
});

// Helper functions for common operations
export const redisClient = {
    // Basic operations
    async set(key: string, value: any, expireSeconds?: number) {
        try {
            const serialized = JSON.stringify(value);
            if (expireSeconds) {
                await redis.setex(key, expireSeconds, serialized);
            } else {
                await redis.set(key, serialized);
            }
        } catch (error) {
            console.error('Redis SET error:', error);
            throw error;
        }
    },

    async get(key: string) {
        try {
            const value = await redis.get(key);
            if (value) {
                return JSON.parse(value);
            }
            return null;
        } catch (error) {
            console.error('Redis GET error:', error);
            throw error;
        }
    },

    // Hash operations
    async hSet(hash: string, field: string, value: any) {
        try {
            const serialized = JSON.stringify(value);
            await redis.hset(hash, field, serialized);
        } catch (error) {
            console.error('Redis HSET error:', error);
            throw error;
        }
    },

    async hGet(hash: string, field: string) {
        try {
            const value = await redis.hget(hash, field);
            if (value) {
                return JSON.parse(value);
            }
            return null;
        } catch (error) {
            console.error('Redis HGET error:', error);
            throw error;
        }
    },

    async hGetAll(hash: string) {
        try {
            const values = await redis.hgetall(hash);
            return Object.entries(values).reduce((acc, [key, value]) => {
                if (typeof value === "string") {
                    acc[key] = JSON.parse(value);
                }
                return acc;
            }, {} as Record<string, any>);
        } catch (error) {
            console.error('Redis HGETALL error:', error);
            throw error;
        }
    },

    // Pub/Sub operations
    async publish(channel: string, message: any) {
        try {
            const serialized = JSON.stringify(message);
            await redis.publish(channel, serialized);
        } catch (error) {
            console.error('Redis PUBLISH error:', error);
            throw error;
        }
    },

    subscribe(channel: string, callback: (message: any) => void) {
        const subscriber = redis.duplicate();

        subscriber.subscribe(channel, (err) => {
            if (err) {
                console.error('Redis SUBSCRIBE error:', err);
                return;
            }
        });

        subscriber.on('message', (ch, message) => {
            if (ch === channel) {
                try {
                    const parsed = JSON.parse(message);
                    callback(parsed);
                } catch (error) {
                    console.error('Redis message parsing error:', error);
                }
            }
        });

        return () => {
            subscriber.unsubscribe(channel);
            subscriber.quit();
        };
    },

    // Utility functions
    async exists(key: string) {
        return await redis.exists(key);
    },

    async delete(key: string) {
        return await redis.del(key);
    },

    async deleteHash(hash: string, field: string) {
        return await redis.hdel(hash, field);
    },

    async zrange(name: string, start: number, stop: number) {
        return await redis.zrange(name, start, stop);
    }
};

export { redis };