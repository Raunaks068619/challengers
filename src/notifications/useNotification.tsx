"use client";

import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
    useCallback
} from "react";
import {
    isNotificationSupported,
    isPermissionDenied,
    isPermissionGranted,
    registerAndSubscribe,
    restoreExistingToken
} from "./NotificationPush";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, arrayUnion } from "firebase/firestore";

interface NotificationContextType {
    /** Whether push notifications are supported in this browser */
    isSupported: boolean;
    /** Whether the user has an active subscription */
    isSubscribed: boolean;
    /** Whether notification permission is granted */
    isGranted: boolean;
    /** Whether notification permission is denied */
    isDenied: boolean;
    /** The current FCM token (null if not subscribed) */
    fcmToken: string | null;
    /** Error message if subscription failed */
    errorMessage: string | null;
    /** Loading state during subscription process */
    isLoading: boolean;
    /** Function to initiate subscription */
    handleSubscribe: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
    const { user } = useAuth();

    const [isSupported, setIsSupported] = useState<boolean>(false);
    const [isGranted, setIsGranted] = useState<boolean>(false);
    const [isDenied, setIsDenied] = useState<boolean>(false);
    const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Save token to Firestore when user is authenticated
    const saveTokenToFirestore = useCallback(async (userId: string, token: string) => {
        try {
            const userRef = doc(db, "users", userId);
            await setDoc(userRef, {
                fcmTokens: arrayUnion(token),
                lastTokenUpdate: new Date().toISOString()
            }, { merge: true });
            console.info("[NotificationProvider] Token saved to Firestore");
        } catch (error) {
            console.error("[NotificationProvider] Error saving token:", error);
        }
    }, []);

    // Handle subscription process
    const handleSubscribe = useCallback(() => {
        if (isLoading) return;

        setIsLoading(true);
        setErrorMessage(null);

        const onSubscribe = async (token: string | null) => {
            if (token) {
                setIsSubscribed(true);
                setFcmToken(token);

                // Save token to Firestore if user is logged in
                if (user?.uid) {
                    await saveTokenToFirestore(user.uid, token);
                }
            }
            setIsGranted(isPermissionGranted());
            setIsDenied(isPermissionDenied());
            setIsLoading(false);
        };

        const onError = (error: Error) => {
            console.error("[NotificationProvider] Subscription failed:", error);
            const granted = isPermissionGranted();
            const denied = isPermissionDenied();
            setIsGranted(granted);
            setIsDenied(denied);
            setIsSubscribed(false);
            
            // Only show error message if it's not a permission denied error
            // Permission denied errors are handled by the isDenied state
            if (denied) {
                setErrorMessage(null); // Clear error message, let isDenied handle the UI
            } else {
                // For other errors (token, SW, etc.), show a user-friendly message
                const friendlyMessage = error.message.includes("permission")
                    ? "Failed to enable notifications. Please try again."
                    : error.message.includes("token")
                    ? "Failed to get notification token. Tap Enable to retry."
                    : error.message.includes("service worker")
                    ? "Service worker issue. Tap Enable to retry."
                    : "Failed to enable notifications. Tap Enable to retry.";
                setErrorMessage(friendlyMessage);
            }
            setIsLoading(false);
        };

        registerAndSubscribe(onSubscribe, onError);
    }, [isLoading, user?.uid, saveTokenToFirestore]);

    // Restore existing token on mount if permission is already granted
    const restoreToken = useCallback(async () => {
        if (isLoading || isSubscribed) return;

        setIsLoading(true);
        setErrorMessage(null);

        const onSubscribe = async (token: string | null) => {
            if (token) {
                setIsSubscribed(true);
                setFcmToken(token);

                // Save token to Firestore if user is logged in
                if (user?.uid) {
                    await saveTokenToFirestore(user.uid, token);
                }
            }
            setIsGranted(isPermissionGranted());
            setIsDenied(isPermissionDenied());
            setIsLoading(false);
        };

        const onError = (error: Error) => {
            console.warn("[NotificationProvider] Token restoration failed (this is OK):", error.message);
            // Don't set error message for restoration failures - just leave isSubscribed as false
            // User can manually tap "Enable Notifications" if they want
            setIsGranted(isPermissionGranted());
            setIsDenied(isPermissionDenied());
            setIsSubscribed(false);
            setErrorMessage(null); // No error message for restoration failures
            setIsLoading(false);
        };

        restoreExistingToken(onSubscribe, onError);
    }, [isLoading, isSubscribed, user?.uid, saveTokenToFirestore]);

    // Check support and restore token if permission is already granted
    useEffect(() => {
        if (typeof window === "undefined") return;

        const checkSupport = () => {
            const supported = isNotificationSupported();
            setIsSupported(supported);

            if (supported) {
                const granted = isPermissionGranted();
                const denied = isPermissionDenied();
                setIsGranted(granted);
                setIsDenied(denied);

                // Try to restore existing token if permission is already granted
                // This happens silently without showing errors if it fails
                if (granted && !isSubscribed && !isLoading) {
                    restoreToken();
                }
            }
        };

        checkSupport();
    }, [restoreToken, isSubscribed, isLoading]);

    // Re-save token when user logs in (if already subscribed)
    useEffect(() => {
        if (user?.uid && fcmToken) {
            saveTokenToFirestore(user.uid, fcmToken);
        }
    }, [user?.uid, fcmToken, saveTokenToFirestore]);

    const contextValue = useMemo(
        () => ({
            isSupported,
            isSubscribed,
            isGranted,
            isDenied,
            fcmToken,
            errorMessage,
            isLoading,
            handleSubscribe,
        }),
        [isSupported, isSubscribed, isGranted, isDenied, fcmToken, errorMessage, isLoading, handleSubscribe]
    );

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
        </NotificationContext.Provider>
    );
};

/**
 * Hook to access notification context
 * Must be used within a NotificationProvider
 */
export const useNotification = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
};
