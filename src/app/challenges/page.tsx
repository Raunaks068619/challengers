"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import ChallengeCard from "@/components/ChallengeCard";
import { useGetActiveChallengesQuery, useJoinChallengeByCodeMutation, useGetUserWeeklyLogsQuery } from "@/lib/features/api/apiSlice";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Loader from "@/components/Loader";

export default function ChallengesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { data: challenges = [], isLoading: challengesLoading } = useGetActiveChallengesQuery(user?.uid || '', {
        skip: !user?.uid,
    });

    const { data: weeklyLogs = [], isLoading: logsLoading } = useGetUserWeeklyLogsQuery(user?.uid || '', {
        skip: !user?.uid,
    });

    const isLoading = challengesLoading || logsLoading;

    const [joinByCode, { isLoading: joining }] = useJoinChallengeByCodeMutation();
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState("");

    const handleJoinByCode = async () => {
        if (!joinCode || joinCode.length < 6) {
            toast.error("Please enter a valid 6-character code");
            return;
        }

        try {
            const result = await joinByCode({ code: joinCode.toUpperCase(), userId: user?.uid || '' }).unwrap();
            toast.success("Joined challenge successfully!");
            setShowJoinModal(false);
            setJoinCode("");
            router.push(`/challenges/${result}`);
        } catch (error: any) {
            console.error("Join error:", error);
            toast.error(error.data?.error || "Failed to join challenge. Check the code.");
        }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground p-6 pb-24">
                <PageHeader title="My Challenges" className="mb-6" />

                {/* Actions Row */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={() => setShowJoinModal(true)}
                        className="py-3 bg-card border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors text-foreground"
                    >
                        Join with Code
                    </button>
                    <Link
                        href="/challenges/create"
                        className="py-3 bg-primary rounded-xl text-sm font-medium text-center text-primary-foreground hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
                    >
                        + New Challenge
                    </Link>
                </div>

                {
                    isLoading ? (
                        <div className="space-y-6">
                            {[...Array(3)].map((_, i) => (
                                <ChallengeCard
                                    key={i}
                                    isLoading={true}
                                    challenge={{} as any}
                                    logs={[]}
                                    userId=""
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {challenges.length === 0 ? (
                                <div className="bg-card/50 rounded-2xl p-8 text-center border border-border border-dashed">
                                    <p className="text-muted-foreground text-sm">You haven't joined any challenges yet.</p>
                                </div>
                            ) : (
                                challenges.map((ch) => (
                                    <ChallengeCard
                                        key={ch.id}
                                        challenge={ch}
                                        logs={weeklyLogs}
                                        userId={user?.uid || ''}
                                    />
                                ))
                            )}
                        </div>
                    )
                }

                {/* Join Modal */}
                {
                    showJoinModal && (
                        <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                            <div className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border shadow-xl">
                                <h3 className="text-lg font-bold mb-4 text-foreground">Join Challenge</h3>
                                <p className="text-muted-foreground text-sm mb-4">Enter the 6-character code shared by your friend.</p>

                                <input
                                    type="text"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    placeholder="E.G. A1B2C3"
                                    className="w-full bg-background border border-border rounded-xl p-3 text-center text-2xl font-mono tracking-widest mb-6 focus:outline-none focus:ring-2 focus:ring-primary uppercase placeholder:text-muted-foreground/50 text-foreground"
                                    maxLength={6}
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowJoinModal(false)}
                                        className="flex-1 py-3 bg-muted rounded-xl font-medium hover:bg-muted/80 text-foreground transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleJoinByCode}
                                        disabled={joining || joinCode.length < 6}
                                        className="flex-1 py-3 bg-primary rounded-xl font-medium hover:opacity-90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
                                    >
                                        {joining ? (
                                            <>
                                                <Loader size={16} className="text-primary-foreground p-0" />
                                                <span>Joining...</span>
                                            </>
                                        ) : "Join"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        </AuthGuard >
    );
}
