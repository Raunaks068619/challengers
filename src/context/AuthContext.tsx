"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

    const initialized = useRef(false);

    useEffect(() => {
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
                // Profile exists (could be from Trigger or previous login)
                console.log("Profile exists. Points:", existing.current_points);

                // If new user (0 points), give Welcome Bonus
                if (existing.current_points === 0 && existing.total_earned === 0) {
                    console.log("New user detected (0 points). Applying Welcome Bonus...");
                    const { error: updateError } = await supabase
                        .from("profiles")
                        .update({
                            current_points: 500,
                            total_earned: 500,
                            display_name: u.user_metadata?.full_name || u.email,
                            photo_url: u.user_metadata?.avatar_url || null,
                        })
                        .eq("id", u.id);

                    if (updateError) console.error("Error applying bonus:", updateError);
                } else {
                    // Existing user, just update metadata
                    await supabase
                        .from("profiles")
                        .update({
                            display_name: u.user_metadata?.full_name || u.email,
                            photo_url: u.user_metadata?.avatar_url || null,
                        })
                        .eq("id", u.id);
                }
            } else {
                // Profile missing (No trigger?), create it
                console.log("Profile missing. Creating new...");
                const { error: insertError } = await supabase.from("profiles").insert({
                    id: u.id,
                    email: u.email,
                    display_name: u.user_metadata?.full_name || u.email,
                    photo_url: u.user_metadata?.avatar_url || null,
                    current_points: 500,
                    total_earned: 500,
                    total_lost: 0,
                });

                if (insertError) console.error("Profile creation error:", insertError);
            }
        };

        const initSession = async () => {
            if (initialized.current) return;
            initialized.current = true;

            console.log("Auth: Initializing session...");
            console.log("Auth: Supabase URL present?", !!process.env.NEXT_PUBLIC_SUPABASE_URL);

            try {
                // Just check session. Supabase client handles the code exchange automatically
                // because we re-enabled detectSessionInUrl.
                console.log("Auth: Calling getSession...");
                const { data: { session }, error } = await supabase.auth.getSession();
                console.log("Auth: getSession result:", session ? "Session found" : "No session", error);

                if (error) throw error;

                setUser(session?.user ?? null);
                if (session?.user) {
                    await upsertProfile(session.user);
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("*")
                        .eq("id", session.user.id)
                        .single();
                    setUserProfile(profile);

                    // Check for returnUrl
                    const returnUrl = sessionStorage.getItem("returnUrl");
                    if (returnUrl) {
                        sessionStorage.removeItem("returnUrl");
                        router.push(decodeURIComponent(returnUrl));
                    }
                }
            } catch (err) {
                console.error("Auth: Init error", err);
                setUser(null);
                setUserProfile(null);
            } finally {
                console.log("Auth: Loading complete. Setting loading=false");
                setLoading(false);
            }
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                // Only handle SIGNED_IN or SIGNED_OUT events to avoid race with initSession
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    setUser(session?.user ?? null);
                    if (session?.user) {
                        try {
                            await upsertProfile(session.user);
                            const { data: profile } = await supabase
                                .from("profiles")
                                .select("*")
                                .eq("id", session.user.id)
                                .single();
                            setUserProfile(profile);
                        } catch (error) {
                            console.log("Profile fetch error:", error);
                            setUserProfile(null);
                        }
                    }
                    setLoading(false);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setUserProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => subscription.unsubscribe();

    }, []);


    const signInWithGoogle = async () => {
        return await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };

    const logout = async () => {
        await supabase.auth.signOut();
        router.push('/login'); // Redirect to login after sign out
    };

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
