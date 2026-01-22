import "server-only";
import { adminMessaging, adminDb } from "./firebase-admin";
import { FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { Message, MulticastMessage } from "firebase-admin/messaging";

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    image?: string;
    badge?: string;
    url?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    tag?: string;
    requireInteraction?: boolean;
    data?: Record<string, string>;
}

/**
 * Get the base URL for the application
 * Uses VERCEL_URL in production, falls back to NEXT_PUBLIC_APP_URL or defaults to production domain
 */
function getBaseUrl(): string {
    // Default to production domain
    return "https://challengers-theta.vercel.app";
}

/**
 * Convert a relative URL to an absolute URL
 */
function toAbsoluteUrl(path: string): string {
    // If already absolute, return as-is
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }

    // Ensure path starts with /
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getBaseUrl()}${normalizedPath}`;
}

/**
 * Send a notification to a single FCM token
 */
export async function sendNotificationToToken(
    token: string,
    payload: NotificationPayload
): Promise<string> {
    // Convert relative URLs to absolute URLs for click actions
    const baseUrl = getBaseUrl();
    const notificationUrl = payload.url ? toAbsoluteUrl(payload.url) : baseUrl;
    
    // Icon and badge should be relative paths (service worker resolves them)
    // But we also include absolute URLs in data for compatibility
    const iconPath = payload.icon || '/icon-192x192.png';
    const badgePath = payload.badge || '/icon-192x192.png';
    const imagePath = payload.image;
    
    // Absolute URLs for data payload (for service worker compatibility)
    const iconUrl = toAbsoluteUrl(iconPath);
    const badgeUrl = toAbsoluteUrl(badgePath);
    const imageUrl = imagePath ? toAbsoluteUrl(imagePath) : undefined;

    const message: Message = {
        token,
        notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: imageUrl, // Can be absolute for notification.imageUrl
        },
        data: {
            title: payload.title,
            body: payload.body,
            icon: iconUrl, // Absolute URL in data
            badge: badgeUrl, // Absolute URL in data
            url: notificationUrl, // Absolute URL for click action
            type: payload.type || 'info',
            tag: payload.tag || `notification-${Date.now()}`,
            requireInteraction: payload.requireInteraction ? 'true' : 'false',
            ...(payload.data || {})
        },
        webpush: {
            fcmOptions: {
                link: notificationUrl // Absolute URL for click action
            },
            notification: {
                // Use relative paths here - service worker will resolve them
                icon: iconPath,
                badge: badgePath,
                requireInteraction: payload.requireInteraction
            }
        }
    };

    const response = await adminMessaging.send(message);
    console.log("[NotificationSender] Sent to token:", response);
    return response;
}

/**
 * Send a notification to multiple FCM tokens
 */
export async function sendNotificationToTokens(
    tokens: string[],
    payload: NotificationPayload
): Promise<{ successCount: number; failureCount: number; failedTokens: string[]; errorDetails?: Array<{ token: string; error: any }> }> {
    if (tokens.length === 0) {
        return { successCount: 0, failureCount: 0, failedTokens: [] };
    }

    // Convert relative URLs to absolute URLs for click actions
    const baseUrl = getBaseUrl();
    const notificationUrl = payload.url ? toAbsoluteUrl(payload.url) : baseUrl;
    
    // Icon and badge should be relative paths (service worker resolves them)
    const iconPath = payload.icon || '/icon-192x192.png';
    const badgePath = payload.badge || '/icon-192x192.png';
    const imagePath = payload.image;
    
    // Absolute URLs for data payload (for service worker compatibility)
    const iconUrl = toAbsoluteUrl(iconPath);
    const badgeUrl = toAbsoluteUrl(badgePath);
    const imageUrl = imagePath ? toAbsoluteUrl(imagePath) : undefined;

    const message: MulticastMessage = {
        tokens,
        notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: imageUrl, // Can be absolute for notification.imageUrl
        },
        data: {
            title: payload.title,
            body: payload.body,
            icon: iconUrl, // Absolute URL in data
            badge: badgeUrl, // Absolute URL in data
            url: notificationUrl, // Absolute URL for click action
            type: payload.type || 'info',
            tag: payload.tag || `notification-${Date.now()}`,
            requireInteraction: payload.requireInteraction ? 'true' : 'false',
            ...(payload.data || {})
        },
        webpush: {
            fcmOptions: {
                link: notificationUrl // Absolute URL for click action
            },
            notification: {
                // Use relative paths here - service worker will resolve them
                icon: iconPath,
                badge: badgePath,
                requireInteraction: payload.requireInteraction
            }
        }
    };

    const response = await adminMessaging.sendEachForMulticast(message);

    const failedTokens: string[] = [];
    const errorDetails: Array<{ token: string; error: any }> = [];
    
    response.responses.forEach((resp, idx) => {
        if (!resp.success) {
            const token = tokens[idx];
            failedTokens.push(token);
            const error = resp.error;
            
            // Log detailed error information
            const errorCode = error?.code || 'unknown';
            const errorMessage = error?.message || 'Unknown error';
            
            console.error("[NotificationSender] Failed to send to token:", {
                token: token.substring(0, 20) + "...",
                errorCode,
                errorMessage,
                fullError: error
            });
            
            errorDetails.push({ token, error });
        }
    });

    console.log(`[NotificationSender] Sent to ${response.successCount}/${tokens.length} tokens`);
    if (failedTokens.length > 0) {
        console.warn(`[NotificationSender] ${failedTokens.length} tokens failed. Common reasons: invalid/expired tokens, unregistered tokens, or payload format issues.`);
    }

    return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        failedTokens,
        errorDetails
    };
}

/**
 * Send a notification to a user by looking up their FCM tokens from Firestore
 */
export async function sendNotificationToUser(
    userId: string,
    payload: NotificationPayload
): Promise<{ successCount: number; failureCount: number }> {
    try {
        // Get user's FCM tokens from Firestore
        const userDoc = await adminDb.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            console.warn("[NotificationSender] User not found:", userId);
            return { successCount: 0, failureCount: 0 };
        }

        const userData = userDoc.data();
        const tokens: string[] = userData?.fcmTokens || [];

        if (tokens.length === 0) {
            console.warn("[NotificationSender] No FCM tokens found for user:", userId);
            return { successCount: 0, failureCount: 0 };
        }

        const result = await sendNotificationToTokens(tokens, payload);

        // Clean up invalid tokens
        if (result.failedTokens.length > 0) {
            const validTokens = tokens.filter(t => !result.failedTokens.includes(t));
            await adminDb.collection('users').doc(userId).update({
                fcmTokens: validTokens
            });
            console.log("[NotificationSender] Cleaned up", result.failedTokens.length, "invalid tokens");
        }

        return {
            successCount: result.successCount,
            failureCount: result.failureCount
        };
    } catch (error) {
        console.error("[NotificationSender] Error sending to user:", error);
        throw error;
    }
}

/**
 * Send a notification to multiple users
 */
export async function sendNotificationToUsers(
    userIds: string[],
    payload: NotificationPayload
): Promise<{ successCount: number; failureCount: number }> {
    let totalSuccess = 0;
    let totalFailure = 0;

    for (const userId of userIds) {
        const result = await sendNotificationToUser(userId, payload);
        totalSuccess += result.successCount;
        totalFailure += result.failureCount;
    }

    return {
        successCount: totalSuccess,
        failureCount: totalFailure
    };
}

/**
 * Send a notification to all users that have at least one FCM token
 * Automatically cleans up invalid tokens from Firestore
 */
export async function sendNotificationToAllUsers(
    payload: NotificationPayload
): Promise<{ successCount: number; failureCount: number; userCount: number; tokenCount: number; cleanedTokens: number }> {
    const pageSize = 500;
    let lastDoc: QueryDocumentSnapshot | null = null;
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalUsers = 0;
    let totalTokens = 0;
    let totalCleaned = 0;
    const tokenBuffer: string[] = [];
    const userTokenMap = new Map<string, string[]>(); // userId -> tokens

    const flushBuffer = async () => {
        while (tokenBuffer.length >= 500) {
            const chunk = tokenBuffer.splice(0, 500);
            const result = await sendNotificationToTokens(chunk, payload);
            totalSuccess += result.successCount;
            totalFailure += result.failureCount;
        }
    };

    // First pass: collect all tokens and map them to users
    while (true) {
        let query = adminDb.collection("users").orderBy(FieldPath.documentId()).limit(pageSize);
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        if (snapshot.empty) break;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const tokens: string[] = Array.isArray(data?.fcmTokens) ? data.fcmTokens : [];
            if (tokens.length === 0) continue;
            totalUsers += 1;
            totalTokens += tokens.length;
            userTokenMap.set(doc.id, tokens);
            tokenBuffer.push(...tokens);
            await flushBuffer();
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < pageSize) break;
    }

    // Send to remaining tokens
    let allFailedTokens: string[] = [];
    if (tokenBuffer.length > 0) {
        const result = await sendNotificationToTokens(tokenBuffer, payload);
        totalSuccess += result.successCount;
        totalFailure += result.failureCount;
        allFailedTokens = result.failedTokens || [];
    }

    // Clean up invalid tokens from Firestore
    // Map failed tokens back to users and remove them
    for (const [userId, userTokens] of userTokenMap.entries()) {
        const failedUserTokens = userTokens.filter(token => allFailedTokens.includes(token));
        if (failedUserTokens.length > 0) {
            const validTokens = userTokens.filter(token => !failedUserTokens.includes(token));
            try {
                await adminDb.collection('users').doc(userId).update({
                    fcmTokens: validTokens.length > 0 ? validTokens : []
                });
                totalCleaned += failedUserTokens.length;
                console.log(`[NotificationSender] Cleaned ${failedUserTokens.length} invalid token(s) for user ${userId}`);
            } catch (error) {
                console.error(`[NotificationSender] Error cleaning tokens for user ${userId}:`, error);
            }
        }
    }

    if (totalCleaned > 0) {
        console.log(`[NotificationSender] Cleaned up ${totalCleaned} total invalid tokens from Firestore`);
    }

    return {
        successCount: totalSuccess,
        failureCount: totalFailure,
        userCount: totalUsers,
        tokenCount: totalTokens,
        cleanedTokens: totalCleaned
    };
}
