import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rateLimit';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only apply rate limiting to API routes
    if (!pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Skip rate limiting for health checks or specific excluded endpoints if needed
    // if (pathname === '/api/health') {
    //     return NextResponse.next();
    // }

    try {
        // Get identifier: try to extract userId from body/query, fallback to IP
        let identifier = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';

        // Try to get userId from request (common patterns)
        const url = new URL(request.url);
        const userIdFromQuery = url.searchParams.get('userId');

        if (userIdFromQuery) {
            identifier = `user:${userIdFromQuery}`;
        } else if (request.method === 'POST') {
            // Try to get userId from request body (clone to avoid consuming the stream)
            try {
                const body = await request.clone().json();
                if (body.userId) {
                    identifier = `user:${body.userId}`;
                } else if (body.senderId) {
                    identifier = `user:${body.senderId}`;
                }
            } catch {
                // Body might not be JSON, use IP fallback
            }
        }

        // Get rate limit config for this endpoint
        const config = getRateLimitConfig(pathname);

        // Check rate limit
        const result = await rateLimit(identifier, config.limit, config.window);

        // Create response with rate limit headers
        const response = result.success
            ? NextResponse.next()
            : NextResponse.json(
                {
                    error: 'Too many requests',
                    message: `Rate limit exceeded. Please try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`
                },
                { status: 429 }
            );

        // Add rate limit headers to response
        response.headers.set('X-RateLimit-Limit', result.limit.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.reset.toString());

        // Add Retry-After header for 429 responses
        if (!result.success) {
            response.headers.set('Retry-After', Math.ceil((result.reset - Date.now()) / 1000).toString());
        }

        return response;
    } catch (error) {
        console.error('[Middleware] Rate limiting error:', error);
        // On error, allow the request through to maintain availability
        return NextResponse.next();
    }
}

// Configure which routes this middleware applies to
export const config = {
    matcher: '/api/:path*',
};
