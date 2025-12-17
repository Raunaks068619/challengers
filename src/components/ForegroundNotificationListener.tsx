"use client";

import { useEffect } from "react";
import { getMessagingInstance } from "@/lib/firebase";
import { onMessage } from "firebase/messaging";
import { toast } from "sonner";

export default function ForegroundNotificationListener() {
    useEffect(() => {
        const setupListener = async () => {
            try {
                const messaging = await getMessagingInstance();
                if (!messaging) return;

                const unsubscribe = onMessage(messaging, (payload) => {
                    console.log("Foreground message received:", payload);
                    const title = payload.notification?.title || "New Message";
                    const body = payload.notification?.body || "";

                    toast(title, {
                        description: body,
                        action: {
                            label: "View",
                            onClick: () => console.log("Notification clicked")
                        },
                    });
                });

                return () => unsubscribe();
            } catch (error) {
                console.error("Error setting up foreground listener:", error);
            }
        };

        setupListener();
    }, []);

    return null;
}
