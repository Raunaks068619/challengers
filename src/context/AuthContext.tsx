"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getProfileFromCache, cacheProfile } from "@/app/actions/profile";

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

    // Keys for LocalStorage
    const STORAGE_KEY_USER = 'challengers_user';
    const STORAGE_KEY_PROFILE = 'challengers_profile';

    const upsertProfile = async (u: User) => {
        console.log("Checking profile for:", u.uid);

        try {
            // 1. Try to get from Redis Cache first
            const cachedProfile = await getProfileFromCache(u.uid);
            if (cachedProfile) {
                console.log("Profile found in Redis cache");
                setUserProfile(cachedProfile);
                return;
            }

            // 2. If not in cache, fetch from Firestore
            const userRef = doc(db, "profiles", u.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const existing = userSnap.data();
                setUserProfile(existing);
                // Cache it
                await cacheProfile(u.uid, existing);

                if (existing.current_points === 0 && existing.total_earned === 0) {
                    await updateDoc(userRef, { current_points: 500, total_earned: 500 });
                    // Update cache after modification
                    await cacheProfile(u.uid, { ...existing, current_points: 500, total_earned: 500 });
                }
            } else {
                const newProfile = {
                    id: u.uid,
                    email: u.email,
                    display_name: u.displayName || u.email,
                    photo_url: u.photoURL || null,
                    current_points: 500,
                    total_earned: 500,
                    total_lost: 0,
                    bio: "",
                    contact_phone: "",
                    contact_email: u.email || "",
                    first_name: u.displayName?.split(' ')[0] || "",
                    last_name: u.displayName?.split(' ').slice(1).join(' ') || "",
                    install_prompt_seen: false,
                    notification_prompt_seen: false,
                };
                await setDoc(userRef, newProfile);
                setUserProfile(newProfile);
                // Cache new profile
                await cacheProfile(u.uid, newProfile);
            }
        } catch (error) {
            console.error("Error upserting profile:", error);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user);
                try {
                    await upsertProfile(user);
                } catch (e) {
                    console.error("Profile load error:", e);
                }

                // Check for returnUrl
                const returnUrl = sessionStorage.getItem("returnUrl");
                if (returnUrl) {
                    sessionStorage.removeItem("returnUrl");
                    if (returnUrl.includes("/challenge")) {
                        router.push(decodeURIComponent(returnUrl));
                    }
                }
            } else {
                setUser(null);
                setUserProfile(null);
                localStorage.removeItem(STORAGE_KEY_USER);
                localStorage.removeItem(STORAGE_KEY_PROFILE);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Redirect to onboarding if needed
    useEffect(() => {
        if (userProfile) {
            const currentPath = window.location.pathname;

            // First check install prompt
            if (userProfile.install_prompt_seen === false) {
                if (currentPath !== '/onboarding/install') {
                    router.push('/onboarding/install');
                }
            }
            // Then check notification prompt (after install is done)
            else if (userProfile.notification_prompt_seen === false) {
                if (currentPath !== '/onboarding/notifications') {
                    router.push('/onboarding/notifications');
                }
            }
        }
    }, [userProfile, router]);

    // Persist State to LocalStorage
    useEffect(() => {
        if (user) {
            // We can't stringify the full Firebase User object easily due to circular refs or internal props, 
            // but for basic persistence we might just rely on Firebase Auth's internal persistence 
            // and the onAuthStateChanged listener which fires on load.
            // However, to match previous behavior:
            const safeUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            };
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(safeUser));
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
    }, [userProfile, user, loading]);

    const signInWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result;
        } catch (error) {
            console.error("Error signing in with Google", error);
            throw error;
        }
    };

    const logout = async () => {
        console.log("Auth: Logging out...");
        try {
            await signOut(auth);
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
