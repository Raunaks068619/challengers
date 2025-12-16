"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

export default function BottomNav() {
    const pathname = usePathname();
    const { userProfile } = useAuth();


    if (!userProfile) return null;

    const isActive = (path: string) => pathname === path;


    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border pb-safe z-50">
            <div className="flex justify-around items-center h-16">
                <Link href="/" className={`flex flex-col items-center gap-1 ${isActive('/') ? 'text-primary' : 'text-muted-foreground'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span className="text-[10px] font-medium">Dashboard</span>
                </Link>

                <Link href="/challenges" className={`flex flex-col items-center gap-1 ${isActive('/challenges') ? 'text-primary' : 'text-muted-foreground'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="text-[10px] font-medium">Challenges</span>
                </Link>

                {/* <Link href="/social" className={`flex flex-col items-center gap-1 ${isActive('/social') ? 'text-primary' : 'text-muted-foreground'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-[10px] font-medium">Social</span>
                </Link> */}

                <Link href="/profile" className={`flex flex-col items-center gap-1 ${isActive('/profile') ? 'text-primary' : 'text-muted-foreground'}`}>
                    {userProfile?.photo_url ? (
                        <div className={`w-8 h-6 rounded-full overflow-hidden border-2 ${isActive('/profile') ? 'border-primary' : 'border-transparent'}`}>
                            <img
                                src={userProfile.photo_url}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    )}
                    <span className="text-[10px] font-medium">Profile</span>
                </Link>
            </div>
        </div>
    );
}
