"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { useGetActiveChallengesQuery, useGetUserWeeklyLogsQuery } from "@/lib/features/api/apiSlice";
import { CheckCircle, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Challenge } from "@/types";
import Loader from "@/components/Loader";

export default function CompletedGoalsPage() {
    const { user } = useAuth();

    const { data: activeChallenges = [], isLoading: challengesLoading } = useGetActiveChallengesQuery(user?.uid || '', {
        skip: !user?.uid,
    });

    const { data: weeklyLogs = [], isLoading: logsLoading } = useGetUserWeeklyLogsQuery(user?.uid || '', {
        skip: !user?.uid,
    });

    const isLoading = challengesLoading || logsLoading;

    // Get today's date info
    const today = new Date();
    const dayOfWeek = today.getDay();
    const todayStr = today.toLocaleDateString('en-CA');

    // Filter active challenges for today (started + not rest day)
    const activeChallengesToday = activeChallenges.filter((challenge: Challenge) => {
        if (challenge.start_date > todayStr) return false;
        const restDays = challenge.rest_days || [];
        return !restDays.includes(dayOfWeek);
    });

    // Get today's completed log challenge IDs
    const completedChallengeIds = new Set(
        weeklyLogs
            .filter((log: any) => log.date === todayStr && log.status === 'completed')
            .map((log: any) => log.challenge_id)
    );

    // Separate completed and pending challenges
    const completedChallenges = activeChallengesToday.filter((c: Challenge) => completedChallengeIds.has(c.id));
    const pendingChallenges = activeChallengesToday.filter((c: Challenge) => !completedChallengeIds.has(c.id));

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground p-6 pb-20">
                <PageHeader title="Today's Goals" backbutton={true} backbuttonAction="/" className="mb-6" />

                <main className="space-y-6">
                    {isLoading ? (
                        <Loader fullscreen={false} className="h-8 w-8" />
                    ) : activeChallengesToday.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No goals scheduled for today.</p>
                            <p className="text-sm mt-2">Enjoy your rest day! 🎉</p>
                        </div>
                    ) : (
                        <>
                            {/* Completed Section */}
                            {completedChallenges.length > 0 && (
                                <div>
                                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        Completed ({completedChallenges.length})
                                    </h2>
                                    <div className="flex flex-col gap-3">
                                        {completedChallenges.map((challenge: Challenge) => (
                                            <Link
                                                key={challenge.id}
                                                href={`/challenges/${challenge.id}`}
                                                className="bg-card rounded-2xl p-4 border border-green-500/30 bg-green-500/5 flex items-center gap-4 hover:border-green-500/50 transition-colors"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-foreground truncate">{challenge.title}</h3>
                                                    <p className="text-xs text-green-500 font-medium">Completed today ✓</p>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pending Section */}
                            {pendingChallenges.length > 0 && (
                                <div>
                                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-amber-500" />
                                        Pending ({pendingChallenges.length})
                                    </h2>
                                    <div className="flex flex-col gap-3">
                                        {pendingChallenges.map((challenge: Challenge) => (
                                            <Link
                                                key={challenge.id}
                                                href={`/challenges/${challenge.id}/check-in`}
                                                className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4 hover:border-primary/50 transition-colors"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                                    <Clock className="w-5 h-5 text-amber-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-foreground truncate">{challenge.title}</h3>
                                                    <p className="text-xs text-muted-foreground">Tap to check in</p>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
