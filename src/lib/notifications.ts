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
