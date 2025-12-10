"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import InstallPrompt from "@/components/InstallPrompt";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { invalidateProfileCache } from "@/app/actions/profile";

export default function InstallOnboardingPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSkip = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Update Firestore
            await updateDoc(doc(db, "profiles", user.uid), {
                install_prompt_seen: true
            });
            // Invalidate Redis cache
            await invalidateProfileCache(user.uid);
            // Clear localStorage cache
            localStorage.removeItem('challengers_profile');
            // Full page reload to ensure AuthContext fetches fresh data from Firestore
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
