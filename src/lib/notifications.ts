import { getMessagingInstance } from "./firebase";
import { getToken } from "firebase/messaging";

export const requestNotificationPermission = async () => {
    try {
        const messaging = await getMessagingInstance();
        if (!messaging) {
            console.log("Messaging not supported");
            return null;
        }

        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
            if (!vapidKey) {
                console.warn("VAPID key is missing. Notifications will not work.");
                return null;
            }

            // Ensure Service Worker is registered and ready
            if ("serviceWorker" in navigator) {
                await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                const serviceWorkerRegistration = await navigator.serviceWorker.ready;

                const token = await getToken(messaging, {
                    vapidKey: vapidKey,
                    serviceWorkerRegistration
                });
                return token;
            }

            // Fallback if no SW support (unlikely for Push)
            const token = await getToken(messaging, {
                vapidKey: vapidKey
            });
            return token;
        } else {
            console.log("Notification permission denied");
            return null;
        }
    } catch (error) {
        console.error("Error requesting notification permission:", error);
        return null;
    }
};
