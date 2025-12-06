"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import InstallPrompt from "@/components/InstallPrompt";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export default function InstallOnboardingPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSkip = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, "profiles", user.uid), {
                install_prompt_seen: true
            });
            // Force reload or just push to clear the context state effectively if it doesn't auto-update fast enough
            // But context listens to auth state, so we might need to manually update local state or just push.
            // Since we updated firestore, the context might not know immediately unless we invalidate cache or similar.
            // For now, just push. The context check might run again, but if it fetches fresh data it will see true.
            // Actually, AuthContext only fetches on load. We might need to reload the page to be safe or update context.
            // But let's try simple push first. If it redirects back, we know we need to update context.
            window.location.href = "/";
        } catch (error) {
            console.error("Error skipping:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full space-y-8">
                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight">Install Challengers</h1>
                    <p className="text-muted-foreground">
                        For the best experience, install the app on your home screen. You'll get full screen access and easier navigation.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        (You can always do this later from your Profile page)
                    </p>
                </div>

                <div className="py-8">
                    <InstallPrompt />
                </div>

                <button
                    onClick={handleSkip}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    Skip for now
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
