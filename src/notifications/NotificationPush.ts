import { getMessagingInstance } from "@/lib/firebase";
import { getToken } from "firebase/messaging";

const SERVICE_WORKER_FILE_PATH = "/firebase-messaging-sw.js";

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
 * Register service worker and subscribe to push notifications
 * Uses Firebase Cloud Messaging under the hood
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

        // Request permission
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            onError(new Error(`Notification permission ${permission}`));
            return;
        }

        // Get Firebase messaging instance
        const messaging = await getMessagingInstance();
        if (!messaging) {
            onError(new Error("Firebase messaging not available"));
            return;
        }

        // Register service worker
        await navigator.serviceWorker.register(SERVICE_WORKER_FILE_PATH);
        const serviceWorkerRegistration = await navigator.serviceWorker.ready;

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
            return true;
        }
        return false;
    } catch (error) {
        console.error("[NotificationPush] Error unsubscribing:", error);
        return false;
    }
}
