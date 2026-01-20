"use client";

import { useEffect } from "react";
import { getMessagingInstance } from "@/lib/firebase";
import { onMessage, MessagePayload } from "firebase/messaging";
import { toast } from "sonner";
import { useNotification } from "@/notifications/useNotification";
import { useRouter } from "next/navigation";

export default function ForegroundNotificationListener() {
    const { isSubscribed, isGranted } = useNotification();
    const router = useRouter();

    useEffect(() => {
        // Only set up listener if subscribed
        if (!isSubscribed || !isGranted) return;

        let unsubscribe: (() => void) | undefined;

        const setupListener = async () => {
            try {
                const messaging = await getMessagingInstance();
                if (!messaging) return;

                unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
                    console.log("[ForegroundNotificationListener] Message received:", payload);

                    // Extract notification details from payload
                    const title = payload.notification?.title || payload.data?.title || "New Notification";
                    const body = payload.notification?.body || payload.data?.body || "";
                    const url = payload.data?.url;
                    const type = payload.data?.type || "info";

                    // Map notification type to toast variant
                    const toastVariant = type === "error" ? "error"
                        : type === "success" ? "success"
                            : type === "warning" ? "warning"
                                : "info";

                    // Show toast notification
                    toast(title, {
                        description: body,
                        action: url ? {
                            label: "View",
                            onClick: () => {
                                router.push(url);
                            }
                        } : undefined,
                        duration: 5000,
                    });

                    // Also show browser notification if permission granted (for visibility when tab is active but not focused)
                    if ('Notification' in window && Notification.permission === 'granted') {
                        const notification = new Notification(title, {
                            body,
                            icon: '/icon-192x192.png',
                            badge: '/icon-192x192.png',
                            tag: `foreground-${Date.now()}`,
                            silent: true // Don't play sound since we're showing toast
                        });

                        notification.onclick = () => {
                            window.focus();
                            if (url) {
                                router.push(url);
                            }
                            notification.close();
                        };
                    }
                });
            } catch (error) {
                console.error("[ForegroundNotificationListener] Error:", error);
            }
        };

        setupListener();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [isSubscribed, isGranted, router]);

    return null;
}
