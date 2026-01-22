"use client";

import React from "react";
import { useNotification } from "@/notifications/useNotification";
import { Bell, BellOff, Loader2, CheckCircle, XCircle } from "lucide-react";

interface NotificationSubscriptionStatusProps {
    /** Whether to show as a compact inline button */
    compact?: boolean;
    /** Additional CSS classes */
    className?: string;
}

export default function NotificationSubscriptionStatus({
    compact = false,
    className = ""
}: NotificationSubscriptionStatusProps) {
    const {
        isSupported,
        isSubscribed,
        isGranted,
        isDenied,
        isLoading,
        errorMessage,
        handleSubscribe
    } = useNotification();

    // Don't render anything if notifications aren't supported
    if (!isSupported) {
        if (compact) return null;

        return (
            <div className={`p-4 rounded-xl bg-destructive/10 border border-destructive/20 ${className}`}>
                <div className="flex items-center gap-3">
                    <BellOff className="w-5 h-5 text-destructive" />
                    <div>
                        <p className="text-sm font-medium text-destructive">Notifications Not Supported</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Your browser doesn't support push notifications. Try adding this app to your home screen.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Compact mode - just show a button/icon
    if (compact) {
        return (
            <button
                onClick={handleSubscribe}
                disabled={isLoading || isSubscribed || isDenied}
                className={`relative p-2 rounded-full transition-colors ${isSubscribed
                    ? "bg-primary/10 text-primary"
                    : isDenied
                        ? "bg-destructive/10 text-destructive cursor-not-allowed"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    } ${className}`}
                title={
                    isSubscribed
                        ? "Notifications enabled"
                        : isDenied
                            ? "Notifications blocked - enable in browser settings"
                            : "Enable notifications"
                }
            >
                {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : isSubscribed ? (
                    <Bell className="w-5 h-5" />
                ) : isDenied ? (
                    <BellOff className="w-5 h-5" />
                ) : (
                    <Bell className="w-5 h-5" />
                )}
                {!isSubscribed && !isDenied && !isLoading && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                )}
            </button>
        );
    }

    // Full card view
    return (
        <div className={`rounded-xl border bg-card p-4 ${className}`}>
            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Push Notifications
            </h3>

            {/* Permission Denied Warning */}
            {isDenied && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-destructive">Permission Denied</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            You've blocked notifications. To enable them, update your browser settings for this site.
                        </p>
                    </div>
                </div>
            )}

            {/* Error Message - Only show if not denied and there's an actual error */}
            {errorMessage && !isDenied && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
                    <XCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">Subscription Issue</p>
                        <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
                    </div>
                </div>
            )}

            {/* Subscribed Success State */}
            {isSubscribed && isGranted && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-primary">Notifications Enabled</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            You'll receive reminders for your challenges.
                        </p>
                    </div>
                </div>
            )}

            {/* Subscribe Button */}
            {!isSubscribed && (
                <button
                    onClick={handleSubscribe}
                    disabled={isLoading || isDenied}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Enabling...</span>
                        </>
                    ) : (
                        <>
                            <Bell className="w-4 h-4" />
                            <span>Enable Notifications</span>
                        </>
                    )}
                </button>
            )}

            {/* Info text */}
            {!isSubscribed && !isDenied && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                    Get reminders 15 minutes before your challenges start
                </p>
            )}
        </div>
    );
}
