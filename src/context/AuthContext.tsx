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

    // 1. Initialization Effect
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const hasCode = params.has('code');

        // Helper to load from storage
        const loadFromStorage = () => {
            try {
                const cachedUser = localStorage.getItem(STORAGE_KEY_USER);
                const cachedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);

                if (cachedUser) {
                    console.log("Auth: Found cached user");
                    const parsedUser = JSON.parse(cachedUser);
                    setUser(parsedUser);

                    if (cachedProfile) {
                        setUserProfile(JSON.parse(cachedProfile));
                        setLoading(false);
                    } else {
                        console.log("Auth: Cached user found but no profile. Keeping loading true.");
                    }
                } else {
                    setLoading(false);
                }
            } catch (e) {
                console.error("Auth: Error reading local storage", e);
                setLoading(false);
            }
        };

        const upsertProfile = async (u: User) => {
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

                if (existing.current_points === 0 && existing.total_earned === 0) {
                    await supabase.from("profiles").update({ current_points: 500, total_earned: 500 }).eq("id", u.id);
                }
            } else {
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
                // Add 5s timeout to getSession
                const sessionPromise = supabase.auth.getSession();
                // const timeoutPromise = new Promise((_, reject) =>
                //     setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
                // );
                console.log("Auth: Session result:", sessionPromise);


                const { data: { session }, error } = await Promise.race([
                    sessionPromise,
                    // timeoutPromise
                ]) as any;

                console.log("Auth: Session result:", session ? "Found" : "Null");

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

                    // Clean URL if code was present
                    if (hasCode) {
                        console.log("Auth: Session established. Cleaning URL...");
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.delete('code');
                        window.history.replaceState({}, '', newUrl.toString());
                    }
                }
            } catch (err) {
                console.error("Auth: Init error", err);
            } finally {
                setLoading(false);
            }
        };

        if (!hasCode) {
            loadFromStorage();
            // Still run initSession in background to validate cache
            initSession();
        } else {
            // If code exists, ONLY run initSession (bypass cache to avoid conflicts)
            console.log("Auth: Code detected. Waiting for session exchange.");
            initSession();
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    setUser(session?.user ?? null);
                    if (session?.user) {
                        // Ensure profile exists before stopping loading
                        await upsertProfile(session.user);

                        // Fetch latest to be sure
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

    // 2. Persist State to LocalStorage
    useEffect(() => {
        if (user) {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        } else if (!loading) {
            localStorage.removeItem(STORAGE_KEY_USER);
        }
    }, [user, loading]);

    useEffect(() => {
        if (userProfile) {
            localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(userProfile));
        } else if (!loading) {
            localStorage.removeItem(STORAGE_KEY_PROFILE);
        }
    }, [userProfile, user, loading, params]);

    const signInWithGoogle = async () => {
        return await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };

    const logout = async () => {
        console.log("Auth: Logging out...");
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_PROFILE);
        try {
            await supabase.auth.signOut();
            setUser(null);
            setUserProfile(null);
            localStorage.removeItem(STORAGE_KEY_USER);
            localStorage.removeItem(STORAGE_KEY_PROFILE);
            router.push('/login');
        } catch (error) {
            console.error("Auth: Error signing out", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
