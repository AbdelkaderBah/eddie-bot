// lib/redis-subscriber.ts
import { Redis } from 'ioredis';
import {redis} from "@/lib/redis";

let subscriber: Redis | null = null;

export function createSubscriber() {
    console.log('Creating Redis Subscriber');
    if (!subscriber) {
        subscriber = redis;

        subscriber.on('error', (error) => {
            console.error('Redis Subscriber Error:', error);
        });

        subscriber.on('connect', () => {
            console.log('Redis Subscriber Connected');
        });
    }
    return subscriber;
}

export function getSubscriber() {
    if (!subscriber) {
        return createSubscriber();
    }
    return subscriber;
}

export async function closeSubscriber() {
    if (subscriber) {
        await subscriber.quit();
        subscriber = null;
    }
}