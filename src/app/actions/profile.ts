'use server'

import redis from '@/lib/redis';

export async function getProfileFromCache(uid: string) {
    if (!redis) return null;
    try {
        // Timeout after 2 seconds
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), 2000)
        );

        const data = await Promise.race([
            redis.get(`profile:${uid}`),
            timeoutPromise
        ]) as string | null;

        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error("Redis get error:", e);
        return null;
    }
}

export async function cacheProfile(uid: string, data: any) {
    if (!redis) return;
    try {
        // Timeout after 2 seconds
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), 2000)
        );

        // Cache for 1 hour (3600 seconds)
        await Promise.race([
            redis.set(`profile:${uid}`, JSON.stringify(data), 'EX', 3600),
            timeoutPromise
        ]);
    } catch (e) {
        console.error("Redis set error:", e);
    }
}

export async function invalidateProfileCache(uid: string) {
    if (!redis) return;
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), 2000)
        );

        await Promise.race([
            redis.del(`profile:${uid}`),
            timeoutPromise
        ]);
        console.log(`Profile cache invalidated for ${uid}`);
    } catch (e) {
        console.error("Redis del error:", e);
    }
}

