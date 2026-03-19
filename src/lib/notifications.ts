import { getMessagingInstance } from "./firebase";
import { getNotificationServiceWorkerRegistration } from "@/notifications/NotificationPush";
import { getToken } from "firebase/messaging";
import { db } from "./firebase";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";

export const requestNotificationPermission = async (userId?: string) => {
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

            let token: string | null = null;

            // Ensure Service Worker is registered and ready (PWA worker preferred)
            if ("serviceWorker" in navigator) {
                const serviceWorkerRegistration = await getNotificationServiceWorkerRegistration();
                token = await getToken(messaging, {
                    vapidKey: vapidKey,
                    serviceWorkerRegistration
                });
            } else {
                // Fallback if no SW support (unlikely for Push)
                token = await getToken(messaging, {
                    vapidKey: vapidKey
                });
            }

            // Update Firestore with the token if userId is provided
            if (token && userId) {
                try {
                    const userRef = doc(db, "users", userId);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        const storedTokens: string[] = userData?.fcmTokens || [];

                        if (!storedTokens.includes(token)) {
                            // Add new token to array, keep last 5 tokens max
                            const updatedTokens = [...storedTokens, token].slice(-5);
                            await updateDoc(userRef, {
                                fcmTokens: updatedTokens,
                                lastTokenUpdate: new Date().toISOString()
                            });
                            console.log("[notifications] FCM token added to Firestore");
                        } else {
                            console.log("[notifications] FCM token already stored, skipping update");
                        }
                    } else {
                        // User document doesn't exist, create it with token array
                        await setDoc(userRef, {
                            fcmTokens: [token],
                            lastTokenUpdate: new Date().toISOString()
                        }, { merge: true });
                        console.log("[notifications] FCM token created in Firestore");
                    }
                } catch (error) {
                    console.error("[notifications] Error updating FCM token:", error);
                    // Don't fail the function if DB update fails, still return token
                }
            }

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
