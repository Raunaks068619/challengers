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
 * Send a notification to a single FCM token
 */
export async function sendNotificationToToken(
    token: string,
    payload: NotificationPayload
): Promise<string> {
    const message: Message = {
        token,
        notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.image,
        },
        data: {
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icon-192x192.png',
            badge: payload.badge || '/icon-192x192.png',
            url: payload.url || '/',
            type: payload.type || 'info',
            tag: payload.tag || `notification-${Date.now()}`,
            requireInteraction: payload.requireInteraction ? 'true' : 'false',
            ...(payload.data || {})
        },
        webpush: {
            fcmOptions: {
                link: payload.url || '/'
            },
            notification: {
                icon: payload.icon || '/icon-192x192.png',
                badge: payload.badge || '/icon-192x192.png',
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
): Promise<{ successCount: number; failureCount: number; failedTokens: string[] }> {
    if (tokens.length === 0) {
        return { successCount: 0, failureCount: 0, failedTokens: [] };
    }

    const message: MulticastMessage = {
        tokens,
        notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.image,
        },
        data: {
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icon-192x192.png',
            badge: payload.badge || '/icon-192x192.png',
            url: payload.url || '/',
            type: payload.type || 'info',
            tag: payload.tag || `notification-${Date.now()}`,
            requireInteraction: payload.requireInteraction ? 'true' : 'false',
            ...(payload.data || {})
        },
        webpush: {
            fcmOptions: {
                link: payload.url || '/'
            },
            notification: {
                icon: payload.icon || '/icon-192x192.png',
                badge: payload.badge || '/icon-192x192.png',
                requireInteraction: payload.requireInteraction
            }
        }
    };

    const response = await adminMessaging.sendEachForMulticast(message);

    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
        if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.error("[NotificationSender] Failed to send to token:", tokens[idx], resp.error);
        }
    });

    console.log(`[NotificationSender] Sent to ${response.successCount}/${tokens.length} tokens`);

    return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        failedTokens
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
 */
export async function sendNotificationToAllUsers(
    payload: NotificationPayload
): Promise<{ successCount: number; failureCount: number; userCount: number; tokenCount: number }> {
    const pageSize = 500;
    let lastDoc: QueryDocumentSnapshot | null = null;
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalUsers = 0;
    let totalTokens = 0;
    const tokenBuffer: string[] = [];

    const flushBuffer = async () => {
        while (tokenBuffer.length >= 500) {
            const chunk = tokenBuffer.splice(0, 500);
            const result = await sendNotificationToTokens(chunk, payload);
            totalSuccess += result.successCount;
            totalFailure += result.failureCount;
        }
    };

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
            tokenBuffer.push(...tokens);
            await flushBuffer();
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < pageSize) break;
    }

    if (tokenBuffer.length > 0) {
        const result = await sendNotificationToTokens(tokenBuffer, payload);
        totalSuccess += result.successCount;
        totalFailure += result.failureCount;
    }

    return {
        successCount: totalSuccess,
        failureCount: totalFailure,
        userCount: totalUsers,
        tokenCount: totalTokens
    };
}
