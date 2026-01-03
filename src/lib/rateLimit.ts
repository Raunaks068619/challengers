// NOTE: ioredis is NOT compatible with Next.js Edge runtime (where middleware runs)
// This causes errors like "Cannot read properties of undefined (reading 'charCodeAt')"
// TODO: Replace with Edge-compatible Redis like @vercel/kv or @upstash/redis
// import redis from './redis';

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
 * Rate limiting using sliding window counter algorithm
 * @param identifier - User ID or IP address
 * @param limit - Maximum requests allowed
 * @param window - Time window in seconds (default: 60)
 */
export async function rateLimit(
    identifier: string,
    limit: number,
    window: number = 60
): Promise<RateLimitResult> {
    // Temporarily disable Redis until we migrate to Edge-compatible solution
    const redis = null;

    // Fallback if Redis is unavailable
    if (!redis) {
        console.warn('[RateLimit] Redis unavailable, allowing request through');
        return {
            success: true,
            remaining: limit,
            reset: Date.now() + window * 1000,
            limit
        };
    }

    // TODO: When migrating to Edge-compatible Redis (e.g., @upstash/redis), 
    // uncomment and update the code below
    return {
        success: true,
        remaining: limit,
        reset: Date.now() + window * 1000,
        limit
    };
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
