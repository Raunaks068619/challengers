"use client";

import { useState } from "react";
import { useNotification } from "@/notifications/useNotification";
import NotificationSubscriptionStatus from "@/components/NotificationSubscriptionStatus";
import { toast } from "sonner";
import { Send, RotateCcw, Trash2, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function TestNotificationsPage() {
    const { isSupported, isSubscribed, fcmToken, isLoading } = useNotification();
    const [title, setTitle] = useState("Test Notification");
    const [message, setMessage] = useState("This is a test notification from Challengers! 🚀");
    const [sending, setSending] = useState(false);
    const [resetting, setResetting] = useState(false);

    const sendNotification = async () => {
        if (!fcmToken) {
            toast.error("No FCM token available. Please subscribe first.");
            return;
        }

        if (!title.trim() || !message.trim()) {
            toast.error("Please enter both title and message");
            return;
        }

        setSending(true);
        try {
            const response = await fetch("/api/test-notification", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token: fcmToken,
                    title: title.trim(),
                    message: message.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to send notification");
            }

            toast.success("Notification sent! Check your device.", {
                description: "If you don't see it, check your notification settings.",
            });
        } catch (error: any) {
            console.error("[TestNotifications] Error:", error);
            toast.error("Failed to send notification", {
                description: error.message,
            });
        } finally {
            setSending(false);
        }
    };

    const resetSubscription = async () => {
        setResetting(true);
        try {
            // Import the reset function dynamically
            const { resetPushSubscription } = await import("@/notifications/NotificationPush");
            
            const result = await resetPushSubscription();
            
            console.log("[TestNotifications] Reset result:", result);

            toast.success("Subscription reset successfully", {
                description: `Unsubscribed: ${result.unsubscribed}, Service Workers: ${result.serviceWorkersUnregistered}, Caches: ${result.cachesCleared}`,
            });

            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error: any) {
            console.error("[TestNotifications] Reset error:", error);
            toast.error("Failed to reset subscription", {
                description: error.message,
            });
        } finally {
            setResetting(false);
        }
    };

    const clearServiceWorkers = async () => {
        setResetting(true);
        try {
            // Import the reset function dynamically
            const { resetPushSubscription } = await import("@/notifications/NotificationPush");
            
            const result = await resetPushSubscription();
            
            console.log("[TestNotifications] Clear result:", result);

            toast.success("Service workers and caches cleared", {
                description: `Unsubscribed: ${result.unsubscribed}, Service Workers: ${result.serviceWorkersUnregistered}, Caches: ${result.cachesCleared}`,
            });

            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error: any) {
            console.error("[TestNotifications] Clear error:", error);
            toast.error("Failed to clear service workers", {
                description: error.message,
            });
        } finally {
            setResetting(false);
        }
    };

    if (!isSupported) {
        return (
            <div className="min-h-screen bg-background text-foreground pb-24">
                <PageHeader title="Test Notifications" />
                <div className="p-4">
                    <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20">
                        <p className="text-destructive font-medium mb-2">
                            Push notifications are not supported in this browser.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Consider adding to the home screen (PWA) if on iOS. iOS 16+ is required for web push notifications.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground pb-24">
            <PageHeader title="Test Notifications" />

            <div className="p-4 space-y-6">
                {/* Subscription Status */}
                <NotificationSubscriptionStatus />

                {/* Test Notification Form */}
                {isSubscribed && (
                    <div className="bg-card border rounded-xl p-6 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Send className="w-5 h-5" />
                            Send a Test Notification
                        </h2>

                        {/* FCM Token Display */}
                        <div className="p-3 rounded-lg bg-muted/50 border border-border">
                            <p className="text-xs text-muted-foreground mb-1">FCM Token:</p>
                            <p className="text-xs font-mono break-all text-foreground">
                                {fcmToken ? `${fcmToken.substring(0, 40)}...` : "No token available"}
                            </p>
                        </div>

                        {/* Title Input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Notification Title</label>
                            <input
                                type="text"
                                placeholder="Notification Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        {/* Message Input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Notification Message</label>
                            <textarea
                                placeholder="Notification Message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            />
                        </div>

                        {/* Send Button */}
                        <button
                            onClick={sendNotification}
                            disabled={sending || isLoading || !fcmToken}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Send Notification</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Reset Section */}
                <div className="bg-card border rounded-xl p-6 space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <RotateCcw className="w-5 h-5" />
                        Reset & Troubleshooting
                    </h2>

                    <p className="text-sm text-muted-foreground">
                        If notifications aren't working after removing/re-adding the PWA, try resetting your subscription or clearing service workers.
                    </p>

                    <div className="space-y-3">
                        {/* Reset Subscription Button */}
                        <button
                            onClick={resetSubscription}
                            disabled={resetting || !isSubscribed}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-border"
                        >
                            {resetting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Resetting...</span>
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="w-4 h-4" />
                                    <span>Reset Push Subscription</span>
                                </>
                            )}
                        </button>

                        {/* Clear Service Workers Button */}
                        <button
                            onClick={clearServiceWorkers}
                            disabled={resetting}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-destructive/20"
                        >
                            {resetting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Clearing...</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    <span>Clear All Service Workers & Caches</span>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                        <p className="text-xs font-medium mb-2">Why reset?</p>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Removing/re-adding PWAs can leave stale service worker registrations</li>
                            <li>Push subscriptions can become invalid after multiple installs</li>
                            <li>Browser cache can cause notification issues</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
