import redis from './redis';

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    reset: number;
    limit: number;
}

export interface RateLimitConfig {
    limit: number;
    window: number; // in seconds
}

/**
 * Rate limiting using fixed window counter algorithm via ioredis
 * @param identifier - User ID or IP address
 * @param limit - Maximum requests allowed
 * @param windowSecs - Time window in seconds (default: 60)
 */
export async function rateLimit(
    identifier: string,
    limit: number,
    windowSecs: number = 60
): Promise<RateLimitResult> {
    if (!redis) {
        return {
            success: true,
            remaining: limit,
            reset: Date.now() + windowSecs * 1000,
            limit
        };
    }

    try {
        const key = `ratelimit:${identifier}`;
        const current = await redis.incr(key);

        if (current === 1) {
            await redis.expire(key, windowSecs);
        }

        const success = current <= limit;
        const remaining = success ? limit - current : 0;
        const reset = Date.now() + windowSecs * 1000;

        return {
            success,
            limit,
            remaining,
            reset
        };
    } catch (error) {
        console.error('[RateLimit] Redis execution error:', error);
        // Fail open to maintain availability
        return {
            success: true,
            remaining: limit,
            reset: Date.now() + windowSecs * 1000,
            limit
        };
    }
}

/**
 * Get rate limit configuration based on URL pathname
 */
export function getRateLimitConfig(pathname: string): RateLimitConfig {
    // Chat endpoints - 30 req/min
    if (pathname.startsWith('/api/chat/send')) {
        return { limit: 30, window: 60 };
    }

    if (pathname.startsWith('/api/chat/')) {
        return { limit: 60, window: 60 };
    }

    // Mutation endpoints - 20 req/min
    if (
        pathname.includes('/create') ||
        pathname.includes('/join') ||
        pathname.includes('/leave') ||
        pathname === '/api/checkin'
    ) {
        return { limit: 20, window: 60 };
    }

    // Admin/Cron endpoints - 10 req/min (stricter)
    if (pathname.startsWith('/api/admin/') || pathname.startsWith('/api/cron/')) {
        return { limit: 10, window: 60 };
    }

    // Default for read endpoints - 60 req/min
    return { limit: 60, window: 60 };
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
    // Disabled for Edge runtime compatibility
    return false;
}
