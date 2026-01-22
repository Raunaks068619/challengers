import { getMessagingInstance } from "@/lib/firebase";
import { getToken } from "firebase/messaging";

const PWA_SERVICE_WORKER_FILE_PATH = "/sw.js";
const FALLBACK_SERVICE_WORKER_FILE_PATH = "/firebase-messaging-sw.js";

export async function getNotificationServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
    if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported in this browser");
    }

    try {
        const registration = await navigator.serviceWorker.register(PWA_SERVICE_WORKER_FILE_PATH);
        await navigator.serviceWorker.ready;
        return registration;
    } catch (error) {
        console.warn(
            "[NotificationPush] Failed to register PWA service worker. Falling back to Firebase SW.",
            error
        );
        const registration = await navigator.serviceWorker.register(FALLBACK_SERVICE_WORKER_FILE_PATH);
        await navigator.serviceWorker.ready;
        return registration;
    }
}

/**
 * Check if push notifications are supported in the current browser
 */
export function isNotificationSupported(): boolean {
    if (typeof window === "undefined") return false;

    if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        !("showNotification" in ServiceWorkerRegistration.prototype)
    ) {
        return false;
    }
    return true;
}

/**
 * Check if notification permission is granted
 */
export function isPermissionGranted(): boolean {
    if (typeof window === "undefined") return false;
    return Notification.permission === "granted";
}

/**
 * Check if notification permission is denied
 */
export function isPermissionDenied(): boolean {
    if (typeof window === "undefined") return false;
    return Notification.permission === "denied";
}

/**
 * Get the current notification permission status
 */
export function getPermissionStatus(): NotificationPermission | null {
    if (typeof window === "undefined") return null;
    return Notification.permission;
}

/**
 * Restore existing FCM token without requesting permission
 * Use this when permission is already granted to silently restore subscription
 */
export async function restoreExistingToken(
    onSubscribe: (token: string | null) => void,
    onError: (error: Error) => void
): Promise<void> {
    try {
        // Check if notifications are supported
        if (!isNotificationSupported()) {
            onError(new Error("Push notifications are not supported in this browser"));
            return;
        }

        // Only restore if permission is already granted
        if (Notification.permission !== "granted") {
            onError(new Error(`Cannot restore: permission is ${Notification.permission}`));
            return;
        }

        // Get Firebase messaging instance
        const messaging = await getMessagingInstance();
        if (!messaging) {
            onError(new Error("Firebase messaging not available"));
            return;
        }

        // Register service worker (prefer the PWA worker, fallback to Firebase SW)
        const serviceWorkerRegistration = await getNotificationServiceWorkerRegistration();

        // Get FCM token
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            onError(new Error("VAPID key is missing"));
            return;
        }

        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration
        });

        if (token) {
            console.info("[NotificationPush] FCM Token restored:", token.substring(0, 20) + "...");
            onSubscribe(token);
        } else {
            onError(new Error("Failed to get FCM token - service worker may need to be re-registered"));
        }
    } catch (error: any) {
        console.error("[NotificationPush] Error during token restoration:", error);
        onError(error);
    }
}

/**
 * Register service worker and subscribe to push notifications
 * Uses Firebase Cloud Messaging under the hood
 * Only requests permission if it hasn't been set yet (default state)
 */
export async function registerAndSubscribe(
    onSubscribe: (token: string | null) => void,
    onError: (error: Error) => void
): Promise<void> {
    try {
        // Check if notifications are supported
        if (!isNotificationSupported()) {
            onError(new Error("Push notifications are not supported in this browser"));
            return;
        }

        // Only request permission if the browser hasn't decided yet
        if (Notification.permission === "default") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                onError(new Error(`Notification permission ${permission}`));
                return;
            }
        } else if (Notification.permission !== "granted") {
            // Permission was explicitly denied
            onError(new Error(`Notification permission ${Notification.permission}`));
            return;
        }

        // If we get here, permission is granted - proceed to get token
        // Get Firebase messaging instance
        const messaging = await getMessagingInstance();
        if (!messaging) {
            onError(new Error("Firebase messaging not available"));
            return;
        }

        // Register service worker (prefer the PWA worker, fallback to Firebase SW)
        const serviceWorkerRegistration = await getNotificationServiceWorkerRegistration();

        // Get FCM token
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            onError(new Error("VAPID key is missing"));
            return;
        }

        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration
        });

        if (token) {
            console.info("[NotificationPush] FCM Token retrieved:", token.substring(0, 20) + "...");
            onSubscribe(token);
        } else {
            onError(new Error("Failed to get FCM token"));
        }
    } catch (error: any) {
        console.error("[NotificationPush] Error during registration:", error);
        onError(error);
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
            console.log("[NotificationPush] Successfully unsubscribed from push notifications");
            return true;
        }
        return false;
    } catch (error) {
        console.error("[NotificationPush] Error unsubscribing:", error);
        return false;
    }
}

/**
 * Reset all push notification subscriptions and service workers
 * Useful when PWA has been removed/re-added multiple times
 */
export async function resetPushSubscription(): Promise<{
    unsubscribed: boolean;
    serviceWorkersUnregistered: number;
    cachesCleared: number;
}> {
    const result = {
        unsubscribed: false,
        serviceWorkersUnregistered: 0,
        cachesCleared: 0
    };

    try {
        // 1. Unsubscribe from push notifications
        if ("serviceWorker" in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();
                    result.unsubscribed = true;
                    console.log("[NotificationPush] Unsubscribed from push notifications");
                }
            } catch (error) {
                console.warn("[NotificationPush] Error unsubscribing:", error);
            }
        }

        // 2. Unregister all service workers
        if ("serviceWorker" in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                    result.serviceWorkersUnregistered++;
                    console.log("[NotificationPush] Unregistered service worker:", registration.scope);
                }
            } catch (error) {
                console.warn("[NotificationPush] Error unregistering service workers:", error);
            }
        }

        // 3. Clear all caches
        if ("caches" in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
                result.cachesCleared = cacheNames.length;
                console.log("[NotificationPush] Cleared caches:", cacheNames);
            } catch (error) {
                console.warn("[NotificationPush] Error clearing caches:", error);
            }
        }

        return result;
    } catch (error) {
        console.error("[NotificationPush] Error resetting subscription:", error);
        throw error;
    }
}
