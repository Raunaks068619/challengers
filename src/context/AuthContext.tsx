"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

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
        const hasCode = params.has('code'); // Legacy Supabase code check (can keep for now)

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

        // FIREBASE AUTH LISTENER
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log("Auth: Firebase State Changed:", firebaseUser?.email);

            if (firebaseUser) {
                try {
                    // 1. Get ID Token from Firebase
                    const token = await firebaseUser.getIdToken();
                    console.log("Auth: Firebase Token:", token);

                    const tokenResult = await firebaseUser.getIdTokenResult();
                    console.log("Auth: Firebase Token Claims:", tokenResult.claims);
                    console.log("Auth: Expected Audience (Project ID):", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

                    // 2. Sign in to Supabase with the ID Token
                    const { data: { session }, error } = await supabase.auth.signInWithIdToken({
                        provider: 'google',
                        token: token,
                    });

                    if (error) {
                        console.error("Auth: Supabase Exchange Error:", error);
                        // Fallback: Try 'firebase' provider if 'google' fails
                        const { data: retrySession, error: retryError } = await supabase.auth.signInWithIdToken({
                            provider: 'firebase',
                            token: token,
                        });

                        if (retryError) throw retryError;
                        if (retrySession.session) {
                            setUser(retrySession.session.user);
                            await upsertProfile(retrySession.session.user);
                        }
                    } else if (session) {
                        console.log("Auth: Supabase Session Established via Firebase");
                        setUser(session.user);
                        await upsertProfile(session.user);
                    }

                } catch (err) {
                    console.error("Auth: Token Exchange Failed", err);
                    setLoading(false);
                }
            } else {
                // Signed out
                console.log("Auth: Signed out");
                setUser(null);
                setUserProfile(null);
                localStorage.removeItem(STORAGE_KEY_USER);
                localStorage.removeItem(STORAGE_KEY_PROFILE);
                await supabase.auth.signOut(); // Ensure Supabase is also cleared
            }
            setLoading(false);
        });

        // Initial load check
        loadFromStorage();

        return () => unsubscribe();

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
    }, [userProfile, loading, params]);

    const signInWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            console.log("Auth: Firebase Login Success", result.user.email);
            // The onAuthStateChanged listener will handle the rest (token exchange)
            return result;
        } catch (error) {
            console.error("Auth: Firebase Login Error", error);
            throw error;
        }
    };

    const logout = async () => {
        console.log("Auth: Logging out...");
        try {
            await signOut(auth); // Firebase SignOut
            await supabase.auth.signOut(); // Supabase SignOut
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
