"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowRight, Bell, BellOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { invalidateProfileCache } from "@/app/actions/profile";
import { useNotification } from "@/notifications/useNotification";

export default function NotificationOnboardingPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const {
        isSupported,
        isSubscribed,
        isDenied,
        isLoading: subscriptionLoading,
        handleSubscribe
    } = useNotification();

    const markPromptSeen = async () => {
        if (!user) return;
        try {
            await updateDoc(doc(db, "profiles", user.uid), {
                notification_prompt_seen: true
            });
            await invalidateProfileCache(user.uid);
            localStorage.removeItem('challengers_profile');
        } catch (error) {
            console.error("Error updating notification prompt status:", error);
        }
    };

    const handleEnable = async () => {
        setLoading(true);
        try {
            handleSubscribe();
            // Wait a bit for subscription to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            await markPromptSeen();
            window.location.href = "/";
        } catch (error) {
            console.error("Error enabling notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        setLoading(true);
        try {
            await markPromptSeen();
            window.location.href = "/";
        } catch (error) {
            console.error("Error skipping:", error);
        } finally {
            setLoading(false);
        }
    };

    // If already subscribed, mark as seen and redirect
    if (isSubscribed && user) {
        markPromptSeen().then(() => {
            window.location.href = "/";
        });
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="h-[100dvh] overflow-hidden bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full space-y-8">
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="p-4 rounded-full bg-primary/10">
                        <Bell className="w-12 h-12 text-primary" />
                    </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight">Stay on Track</h1>
                    <p className="text-muted-foreground">
                        Get reminders 15 minutes before your challenges start. Never miss a check-in!
                    </p>
                </div>

                {/* Benefits */}
                <div className="space-y-3 text-left">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                        <span className="text-xl">⏰</span>
                        <p className="text-sm">Timely reminders before challenges</p>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                        <span className="text-xl">🔥</span>
                        <p className="text-sm">Keep your streak alive</p>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                        <span className="text-xl">💪</span>
                        <p className="text-sm">Stay motivated with daily nudges</p>
                    </div>
                </div>

                {/* Not Supported Message */}
                {!isSupported && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-center gap-3">
                            <BellOff className="w-5 h-5 text-amber-500 flex-shrink-0" />
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                                Push notifications aren't supported in this browser. Try adding the app to your home screen.
                            </p>
                        </div>
                    </div>
                )}

                {/* Permission Denied Message */}
                {isDenied && (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                        <div className="flex items-center gap-3">
                            <BellOff className="w-5 h-5 text-destructive flex-shrink-0" />
                            <p className="text-sm text-destructive">
                                Notifications are blocked. Enable them in your browser settings to receive reminders.
                            </p>
                        </div>
                    </div>
                )}

                {/* Buttons */}
                <div className="space-y-4 pt-4">
                    {isSupported && !isDenied && (
                        <button
                            onClick={handleEnable}
                            disabled={loading || subscriptionLoading}
                            className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 disabled:opacity-50"
                        >
                            {loading || subscriptionLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Enabling...</span>
                                </>
                            ) : (
                                <>
                                    <Bell className="w-5 h-5" />
                                    <span>Enable Notifications</span>
                                </>
                            )}
                        </button>
                    )}

                    <button
                        onClick={handleSkip}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {isDenied || !isSupported ? "Continue" : "Skip for now"}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                <p className="text-xs text-muted-foreground">
                    You can change this later in your Profile settings
                </p>
            </div>
        </div>
    );
}
