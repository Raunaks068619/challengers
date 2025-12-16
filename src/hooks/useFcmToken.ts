"use client";

import { useEffect, useState } from "react";
import { getMessagingInstance } from "@/lib/firebase";
import { getToken } from "firebase/messaging";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, arrayUnion } from "firebase/firestore";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export default function useFcmToken() {
    const { user } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

    useEffect(() => {
        const retrieveToken = async () => {
            try {
                if (typeof window !== "undefined" && "serviceWorker" in navigator) {
                    const messaging = await getMessagingInstance();
                    if (!messaging) return;

                    const permission = await Notification.requestPermission();
                    setNotificationPermission(permission);

                    if (permission === "granted") {
                        // Explicitly register service worker to ensure it exists even if unregistered
                        let serviceWorkerRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
                        if (!serviceWorkerRegistration) {
                            serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                        }

                        const currentToken = await getToken(messaging, {
                            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                            serviceWorkerRegistration
                        });

                        if (currentToken) {
                            setToken(currentToken);
                            if (user) {
                                await saveTokenToFirestore(user.uid, currentToken);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("An error occurred while retrieving token:", error);
            }
        };

        retrieveToken();
    }, [user]);

    const saveTokenToFirestore = async (userId: string, token: string) => {
        try {
            const userRef = doc(db, "users", userId);
            await setDoc(userRef, {
                fcmTokens: arrayUnion(token)
            }, { merge: true });
        } catch (error) {
            console.error("Error saving FCM token:", error);
        }
    };

    return { token, notificationPermission };
}
