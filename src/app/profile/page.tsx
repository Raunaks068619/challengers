"use client";

import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";

export default function ProfilePage() {
    const { user, userProfile, logout } = useAuth();

    return (
        <AuthGuard>
            <div className="min-h-screen bg-zinc-950 text-white p-4 pb-20">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-xl font-bold">Profile</h1>
                </div>

                <div className="space-y-6">
                    {/* User Info */}
                    <div className="flex flex-col items-center p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                        <div className="h-24 w-24 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700 mb-4">
                            {userProfile?.photo_url || user?.user_metadata?.avatar_url ? (
                                <img src={(userProfile?.photo_url || user?.user_metadata?.avatar_url) as string} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-2xl">?</div>
                            )}
                        </div>
                        <h2 className="text-xl font-bold">{userProfile?.display_name || user?.email}</h2>
                        <p className="text-zinc-400 text-sm">{user?.email}</p>
                    </div>



                    {/* Sign Out */}
                    <button
                        onClick={logout}
                        className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-medium hover:bg-red-500/20 transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </AuthGuard>
    );
}
