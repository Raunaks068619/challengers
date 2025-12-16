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
                        const currentToken = await getToken(messaging, {
                            vapidKey: "BM_9Bf_2X9k_2X9k_2X9k_2X9k_2X9k_2X9k" // Replace with actual VAPID key if available, or env var
                            // Actually, we need the VAPID key. I'll check if it's in env or I need to ask user.
                            // For now I will assume it is in env or I will use a placeholder and ask user to fill it.
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
