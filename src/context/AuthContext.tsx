"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

interface AuthContextType {
    user: User | null;
    userProfile: any | null;
    loading: boolean;
    signInWithGoogle: () => Promise<any>;
    logout: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userProfile: null,
    loading: true,
    signInWithGoogle: async () => { },
    logout: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const params = useSearchParams();

    const initialized = useRef(false);

    // Keys for LocalStorage
    const STORAGE_KEY_USER = 'challengers_user';
    const STORAGE_KEY_PROFILE = 'challengers_profile';

    // 1. Load from LocalStorage on Mount (Optimistic Load)
    useEffect(() => {
        try {
            const cachedUser = localStorage.getItem(STORAGE_KEY_USER);
            const cachedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);

            if (cachedUser) {
                console.log("Auth: Found cached user");
                setUser(JSON.parse(cachedUser));
                if (cachedProfile) {
                    setUserProfile(JSON.parse(cachedProfile));
                }
                setLoading(false); // Immediate load
            }
        } catch (e) {
            console.error("Auth: Error reading local storage", e);
        }
    }, []);

    // 2. Persist State to LocalStorage
    useEffect(() => {
        if (user) {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        } else if (!loading) {
            // Only clear if we are sure we are not loading (to avoid clearing on initial empty state)
            localStorage.removeItem(STORAGE_KEY_USER);
        }
    }, [user, loading]);

    useEffect(() => {
        if (userProfile) {
            localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(userProfile));
        } else if (!loading) {
            localStorage.removeItem(STORAGE_KEY_PROFILE);
        }
    }, [userProfile, loading]);


    useEffect(() => {
        const upsertProfile = async (u: User) => {
            // ... (upsert logic remains same) ...
            // Copying existing upsert logic for brevity, but ensuring it updates state
            console.log("Checking profile for:", u.id);

            // 1. Check if profile exists
            const { data: existing, error: fetchError } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", u.id)
                .maybeSingle();

            if (fetchError) {
                console.error("Error checking profile:", fetchError);
                return;
            }

            if (existing) {
                // Update local state immediately to keep UI fresh
                setUserProfile(existing);

                // ... (rest of update logic) ...
                if (existing.current_points === 0 && existing.total_earned === 0) {
                    // ... welcome bonus logic ...
                    await supabase.from("profiles").update({ current_points: 500, total_earned: 500 }).eq("id", u.id);
                }
            } else {
                // ... create profile logic ...
                const newProfile = {
                    id: u.id,
                    email: u.email,
                    display_name: u.user_metadata?.full_name || u.email,
                    photo_url: u.user_metadata?.avatar_url || null,
                    current_points: 500,
                    total_earned: 500,
                    total_lost: 0,
                };
                await supabase.from("profiles").insert(newProfile);
                setUserProfile(newProfile); // Optimistic update
            }
        };

        const initSession = async () => {
            if (initialized.current) return;
            initialized.current = true;

            console.log("Auth: Initializing session (Background)...");

            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) throw error;

                // Sync state with Supabase (Source of Truth)
                setUser(session?.user ?? null);

                if (session?.user) {
                    await upsertProfile(session.user);

                    // Fetch latest profile to ensure we have everything
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("*")
                        .eq("id", session.user.id)
                        .single();
                    if (profile) setUserProfile(profile);

                    // Check for returnUrl
                    const returnUrl = sessionStorage.getItem("returnUrl");
                    if (returnUrl) {
                        sessionStorage.removeItem("returnUrl");
                        if (returnUrl.includes("/challenge")) {
                            router.push(decodeURIComponent(returnUrl));
                        }
                    }
                }
            } catch (err) {
                console.error("Auth: Init error", err);
                // If error, we might want to clear local storage if it's a critical auth error
                // But for now, let's keep the cached version to avoid jarring UI
            } finally {
                setLoading(false);
            }
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    setUser(session?.user ?? null);
                    if (session?.user) {
                        // We can skip full upsert here if we just did it in initSession
                        // But let's fetch profile to be safe
                        const { data: profile } = await supabase
                            .from("profiles")
                            .select("*")
                            .eq("id", session.user.id)
                            .single();
                        if (profile) setUserProfile(profile);
                    }
                    setLoading(false);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setUserProfile(null);
                    setLoading(false);
                    localStorage.removeItem(STORAGE_KEY_USER);
                    localStorage.removeItem(STORAGE_KEY_PROFILE);
                }
            }
        );

        return () => subscription.unsubscribe();

    }, []);

    // Redirect to home if 'code' param exists to clean URL
    useEffect(() => {
        if (loading) {
            const params = new URLSearchParams(window.location.search);
            if (params.has('code')) {
                console.log("Auth code detected. Redirecting to home...");
                router.push('/');
            }
        }
    }, [loading, router]);

    const signInWithGoogle = async () => {
        return await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setUserProfile(null);
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_PROFILE);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
