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
    registerAndSubscribe
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
            setIsGranted(isPermissionGranted());
            setIsDenied(isPermissionDenied());
            setIsSubscribed(false);
            setErrorMessage(error.message);
            setIsLoading(false);
        };

        registerAndSubscribe(onSubscribe, onError);
    }, [isLoading, user?.uid, saveTokenToFirestore]);

    // Check support and auto-subscribe if already granted
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

                // Auto-subscribe if permission is already granted
                if (granted && !isSubscribed && !isLoading) {
                    handleSubscribe();
                }
            }
        };

        checkSupport();
    }, [handleSubscribe, isSubscribed, isLoading]);

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
