"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, userProfile, loading, logout } = useAuth();
    const router = useRouter();
    const params = new URLSearchParams(window.location.search);
    const [code, setCode] = useState(false);

    useEffect(() => {
        if (params.has('code')) {
            setCode(true);
        }
    }, [params]);


    useEffect(() => {
        if (!loading && !user) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            router.push(`/login?returnUrl=${returnUrl}`);
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (code) {
            localStorage.removeItem('challengers_user');
            // localStorage.removeItem('challengers_profile');
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('code');
            const newSearch = newParams.toString();
            router.replace(`${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`);
        }
    }, [code, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                    <p className="text-zinc-500 text-sm animate-pulse">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    if (!userProfile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4 text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold mb-2">Profile Error</h1>
                <p className="text-zinc-400 mb-6 max-w-xs">
                    We couldn't load your profile. This usually happens if your account data was deleted.
                </p>
                <button
                    onClick={() => logout()}
                    className="px-6 py-3 bg-zinc-800 rounded-xl font-medium hover:bg-zinc-700 transition-colors"
                >
                    Logout & Reset
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
