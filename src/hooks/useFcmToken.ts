"use client";

import { useNotification } from "@/notifications/useNotification";

/**
 * @deprecated Use useNotification from @/notifications/useNotification instead
 * This hook is kept for backward compatibility
 */
export default function useFcmToken() {
    const { fcmToken, isGranted, isDenied, isLoading } = useNotification();

    // Map new state to old interface for backward compatibility
    const notificationPermission: NotificationPermission = isDenied
        ? "denied"
        : isGranted
            ? "granted"
            : "default";

    return {
        token: fcmToken,
        notificationPermission,
        isLoading
    };
}
