"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { Challenge, ChallengeParticipant } from "@/types";
import { ChevronLeft, Share2, MapPin, Trophy, Flame, Copy, Camera } from "lucide-react";
import { toast } from "sonner";

import { useGetChallengeQuery, useGetParticipantDataQuery, useJoinChallengeMutation, useGetUserChallengeLogsQuery } from "@/lib/features/api/apiSlice";

export default function ChallengeDetailsPage() {
    const { id } = useParams();
    const { user } = useAuth();

    // RTK Query Hooks
    const { data: challengeData, isLoading: challengeLoading } = useGetChallengeQuery(id as string, {
        skip: !id,
    });
    const challenge = challengeData;

    const { data: participantData, isLoading: participantLoading } = useGetParticipantDataQuery(
        { challengeId: id as string, userId: user?.id || '' },
        { skip: !id || !user?.id }
    );

    const { data: logs = [] } = useGetUserChallengeLogsQuery(
        { challengeId: id as string, userId: user?.id || '' },
        { skip: !id || !user?.id }
    );

    const [joinChallenge, { isLoading: joining }] = useJoinChallengeMutation();

    const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const autoJoin = searchParams.get('auto_join');

    const loading = challengeLoading || participantLoading;

    // Auto Join Effect
    useEffect(() => {
        if (autoJoin && user && challenge && !participantData && !joining && !loading) {
            handleJoin();
        }
    }, [autoJoin, user, challenge, participantData, joining, loading]);

    const handleJoin = async () => {
        if (!user || !challenge || !challenge.id) return;
        try {
            await joinChallenge({ challengeId: challenge.id, userId: user.id }).unwrap();
            toast.success("Joined challenge! +500 pts");
        } catch (error) {
            console.error(error);
            toast.error("Failed to join");
        }
    };

    const handleShare = async () => {
        if (!challenge) return;
        const url = new URL(window.location.href);
        url.searchParams.set('auto_join', 'true');

        const shareData = {
            title: challenge.title,
            text: `Join me in the "${challenge.title}" challenge!`,
            url: url.toString(),
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error(err);
            }
        } else {
            handleCopyLink();
        }
    };

    const handleCopyLink = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('auto_join', 'true');
        navigator.clipboard.writeText(url.toString());
        toast.success("Invite link copied!");
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
    if (!challenge) return <div className="p-4 text-white">Challenge not found</div>;

    const startDate = new Date(challenge.start_date);
    const endDate = new Date(challenge.end_date);
    const durationDays = Math.max(
        1,
        Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    return (
        <AuthGuard>
            <div className="min-h-screen bg-zinc-950 text-white p-4 pb-20">
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-xl font-bold truncate max-w-[200px]">{challenge.title}</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCopyLink} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 text-zinc-400">
                            <Copy className="w-5 h-5" />
                        </button>
                        <button onClick={handleShare} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 text-indigo-400">
                            <Share2 className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <div className="space-y-6">
                    {/* Info Card */}
                    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                        <p className="text-zinc-400 mb-6">{challenge.description}</p>

                        <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm">
                            <div>
                                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Time Window</p>
                                <p className="font-medium text-white">
                                    {challenge.time_window_start && challenge.time_window_end
                                        ? `${challenge.time_window_start} - ${challenge.time_window_end}`
                                        : "Anytime"}
                                </p>
                            </div>
                            <div>
                                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Duration</p>
                                <p className="font-medium text-white">{durationDays} Days</p>
                            </div>
                            <div>
                                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Location</p>
                                <div className="flex items-center gap-1">
                                    {challenge.requires_location ? (
                                        <>
                                            <MapPin className="w-3 h-3 text-green-400" />
                                            <span className="font-medium text-green-400">Required</span>
                                        </>
                                    ) : (
                                        <span className="font-medium text-zinc-400">Anywhere</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Participants</p>
                                <p className="font-medium text-white">{challenge.participants_count || 0}</p>
                            </div>
                            <div>
                                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Created On</p>
                                <p className="font-medium text-white">
                                    {challenge.created_at
                                        ? new Date(challenge.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                        : 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Start Date</p>
                                <p className="font-medium text-white">
                                    {new Date(challenge.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* My Stats (If Participant) */}
                    {participantData && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex flex-col items-center justify-center text-center">
                                <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center mb-2">
                                    <Flame className="w-4 h-4 text-orange-500" />
                                </div>
                                <p className="text-2xl font-bold text-white">{participantData.streak_current}</p>
                                <p className="text-xs text-zinc-500">Day Streak</p>
                            </div>
                            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex flex-col items-center justify-center text-center">
                                <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center mb-2">
                                    <Trophy className="w-4 h-4 text-yellow-500" />
                                </div>
                                <p className="text-2xl font-bold text-white">{participantData.current_points}</p>
                                <p className="text-xs text-zinc-500">Points</p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    {!participantData ? (
                        <button
                            onClick={handleJoin}
                            disabled={joining}
                            className="w-full py-4 bg-indigo-600 rounded-xl font-bold text-lg hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
                        >
                            {joining ? "Joining..." : "Join Challenge (+500 pts)"}
                        </button>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Link
                                    href={`/challenges/${challenge.id}/check-in`}
                                    className="block w-full py-4 bg-green-600 rounded-xl font-bold text-lg text-center hover:bg-green-500 shadow-lg shadow-green-500/20"
                                >
                                    Check In Now
                                </Link>
                                <p className="text-center text-xs text-zinc-500">
                                    {challenge.time_window_start && challenge.time_window_end
                                        ? `Check-in available between ${challenge.time_window_start} and ${challenge.time_window_end}`
                                        : "Check-in available anytime today"}
                                </p>
                            </div>

                            {/* Logs Section */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Your Logs</h3>
                                {logs.length === 0 ? (
                                    <p className="text-zinc-500 text-sm">No logs yet. Check in to start your streak!</p>
                                ) : (
                                    <div className="space-y-4">
                                        {logs.map((log) => (
                                            <div key={log.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex gap-4">
                                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                                                    {log.proof_url ? (
                                                        <img src={log.proof_url} alt="Proof" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                                            <Camera className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                                                    <p className="text-sm text-green-400 mt-1">Verified</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthGuard>
    );
}
