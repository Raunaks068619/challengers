'use server'

import redis from '@/lib/redis';

export async function getProfileFromCache(uid: string) {
    if (!redis) return null;
    try {
        const data = await redis.get(`profile:${uid}`);
        console.log({ data });

        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error("Redis get error:", e);
        return null;
    }
}

export async function cacheProfile(uid: string, data: any) {
    if (!redis) return;
    try {
        // Cache for 1 hour (3600 seconds)
        await redis.set(`profile:${uid}`, JSON.stringify(data), 'EX', 3600);
    } catch (e) {
        console.error("Redis set error:", e);
    }
}
