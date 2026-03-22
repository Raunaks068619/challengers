import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';
import { rateLimit, getRateLimitConfig } from './rateLimit';

export async function enforceRateLimit(req: NextRequest, identifier: string): Promise<NextResponse | null> {
    const { pathname } = req.nextUrl;
    const config = getRateLimitConfig(pathname);
    const result = await rateLimit(identifier, config.limit, config.window);

    if (!result.success) {
        return NextResponse.json(
            { error: 'Too many requests', message: 'Rate limit exceeded.' },
            { status: 429, headers: { 'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString() } }
        );
    }
    return null;
}

/**
 * Verifies the Firebase ID token from the Authorization header of an API request.
 * Returns null if authorized, or a NextResponse with an error if unauthorized.
 * 
 * @param req The incoming NextRequest
 * @returns {Promise<{ uid: string } | NextResponse>} The decoded token uid if valid, else an error response
 */
export async function verifyApiAuth(req: NextRequest): Promise<{ uid: string } | NextResponse> {
    const authHeader = req.headers.get('Authorization');
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const rlError = await enforceRateLimit(req, `ip:${ip}`);
        if (rlError) return rlError;
        return NextResponse.json(
            { error: 'Unauthorized: Missing or invalid Authorization header' },
            { status: 401 }
        );
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Rate limit by User ID
        const rlError = await enforceRateLimit(req, `user:${decodedToken.uid}`);
        if (rlError) return rlError;

        return { uid: decodedToken.uid };
    } catch (error) {
        // Still rate limit the IP heavily if they send invalid tokens
        const rlError = await enforceRateLimit(req, `ip:${ip}`);
        if (rlError) return rlError;

        console.error('[verifyApiAuth] Token verification failed:', error);
        return NextResponse.json(
            { error: 'Unauthorized: Invalid or expired token' },
            { status: 401 }
        );
    }
}

/**
 * Enforces that the authenticated user matches the provided userId (e.g. from query params or body).
 * 
 * @param uid The authenticated user's ID
 * @param targetUserId The user ID the request is attempting to act upon
 * @returns A NextResponse error if they do not match, otherwise null
 */
export function enforceUserMatch(uid: string, targetUserId: string | null): NextResponse | null {
    if (!targetUserId) {
        return NextResponse.json({ error: 'Missing target userId' }, { status: 400 });
    }

    if (uid !== targetUserId) {
        return NextResponse.json(
            { error: 'Forbidden: You do not have permission to perform this action for this user' },
            { status: 403 }
        );
    }

    return null;
}
