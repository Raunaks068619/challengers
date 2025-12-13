"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGetProfileQuery, useUpdateProfileMutation } from "@/lib/features/api/apiSlice";

export default function ThemeSync() {
    const { theme, setTheme } = useTheme();
    const { user } = useAuth();
    const { data: profile } = useGetProfileQuery(user?.uid || '', { skip: !user?.uid });
    const [updateProfile] = useUpdateProfileMutation();

    // Use refs to track if the change was initiated by the user or the DB sync
    // to avoid infinite loops or race conditions.
    const isSyncingFromDb = useRef(false);

    // Track the last theme we saw from the DB to avoid re-applying it on refetches
    // unless it actually changed.
    const lastDbTheme = useRef<string | undefined>(undefined);

    // 1. Sync from DB to Local (Initial Load & Remote Changes)
    useEffect(() => {
        // Only act if we have a theme from DB
        if (profile?.theme) {
            // If the DB theme is different from what we last saw from DB
            if (profile.theme !== lastDbTheme.current) {
                lastDbTheme.current = profile.theme;

                // And if it's different from current local theme, apply it
                if (profile.theme !== theme) {
                    isSyncingFromDb.current = true;
                    setTheme(profile.theme);
                    setTimeout(() => {
                        isSyncingFromDb.current = false;
                    }, 100);
                }
            }
        }
    }, [profile?.theme, setTheme, theme]);

    // 2. Sync from Local to DB (User Change)
    useEffect(() => {
        if (!user?.uid || !theme || isSyncingFromDb.current) return;

        // Only update if profile is loaded and different
        if (profile && profile.theme !== theme) {
            const timer = setTimeout(() => {
                updateProfile({
                    userId: user.uid,
                    updates: { theme: theme as 'light' | 'dark' | 'system' }
                });
            }, 1000); // Debounce updates

            return () => clearTimeout(timer);
        }
    }, [theme, user?.uid, profile, updateProfile]);

    return null;
}
