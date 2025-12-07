"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { Challenge, ChallengeParticipant } from "@/types";
import { ChevronLeft, Share2, MapPin, Trophy, Flame, Camera, LogOut, Edit } from "lucide-react";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";

import { useGetChallengeQuery, useGetParticipantDataQuery, useJoinChallengeMutation, useGetUserChallengeLogsQuery, useLeaveChallengeMutation } from "@/lib/features/api/apiSlice";

import StoryViewer from "@/components/StoryViewer";

import ShareModal from "@/components/ShareModal"; // Assuming this import was also missing and needed for ShareModal component

export default function ChallengeDetailsPage() {
    const { id } = useParams();
    const { user } = useAuth();

    // RTK Query Hooks
    const { data: challengeData, isLoading: challengeLoading } = useGetChallengeQuery(id as string, {
        skip: !id,
    });
    const challenge = challengeData;

    const { data: participantData, isLoading: participantLoading } = useGetParticipantDataQuery(
        { challengeId: id as string, userId: user?.uid || '' },
        { skip: !id || !user?.uid }
    );

    const { data: logs = [] } = useGetUserChallengeLogsQuery(
        { challengeId: id as string, userId: user?.uid || '' },
        { skip: !id || !user?.uid }
    );

    const [joinChallenge, { isLoading: joining }] = useJoinChallengeMutation();
    const [leaveChallenge, { isLoading: leaving }] = useLeaveChallengeMutation();

    const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const autoJoin = searchParams.get('auto_join');

    const loading = challengeLoading || participantLoading;

    const [showShareModal, setShowShareModal] = useState(false);
    const [showStoryViewer, setShowStoryViewer] = useState(false);
    const [selectedLogIndex, setSelectedLogIndex] = useState(0);

    // Auto Join Effect
    useEffect(() => {
        if (autoJoin && user && challenge && !participantData && !joining && !loading) {
            handleJoin();
        }
    }, [autoJoin, user, challenge, participantData, joining, loading]);

    const handleJoin = async () => {
        if (!user || !challenge || !challenge.id) return;
        try {
            console.log("handleJoin Challenge", { challengeId: challenge.id, userId: user.uid })
            await joinChallenge({ challengeId: challenge.id, userId: user.uid }).unwrap();
            toast.success("Joined challenge! +500 pts");

            // Clear auto_join param to prevent loops
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('auto_join');
            window.history.replaceState({}, '', newUrl.toString());

        } catch (error) {
            console.error(error);
            toast.error("Failed to join");
        }
    };

    const [showLeaveModal, setShowLeaveModal] = useState(false);

    const handleLeaveClick = () => {
        setShowLeaveModal(true);
    };

    const router = useRouter();

    const confirmLeave = async () => {
        if (!user || !challenge || !challenge.id) return;
        try {
            await leaveChallenge({ challengeId: challenge.id, userId: user.uid }).unwrap();
            toast.success("Left challenge successfully");
            setShowLeaveModal(false);
            router.push('/challenges');
        } catch (error) {
            console.error("Leave error:", error);
            toast.error("Failed to leave challenge");
        }
    };

    const handleLogClick = (index: number) => {
        setSelectedLogIndex(index);
        setShowStoryViewer(true);
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
            <div className="min-h-screen bg-background text-foreground p-6 pb-20">
                <PageHeader
                    title={challenge.title}
                    backbutton={true}
                    backbuttonAction="/challenges"
                    // showNotificationComponent={true}
                    showOptionButton={[
                        {
                            title: "Share Challenge",
                            icon: <Share2 className="w-4 h-4" />,
                            runFunction: () => setShowShareModal(true)
                        },
                        ...(participantData ? [{
                            title: "Leave Challenge",
                            icon: <LogOut className="w-4 h-4" />,
                            runFunction: handleLeaveClick
                        }] : []),
                        ...(challenge && user && challenge.creator_id === user.uid ? [{
                            title: "Edit Challenge",
                            icon: <Edit className="w-4 h-4" />,
                            runFunction: () => router.push(`/challenges/${challenge.id}/edit`)
                        }] : [])
                    ]}
                    className="mb-6"
                />

                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    challengeTitle={challenge.title}
                    joinCode={challenge.join_code}
                    url={`${window.location.origin}/challenges/${challenge.id}?auto_join=true`}
                />

                {/* Leave Confirmation Modal */}
                {showLeaveModal && (
                    <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border shadow-xl">
                            <h3 className="text-lg font-bold mb-2 text-foreground">Leave Challenge?</h3>
                            <p className="text-muted-foreground text-sm mb-6">
                                Are you sure you want to leave? Your progress and points for this challenge will be lost.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowLeaveModal(false)}
                                    className="flex-1 py-3 bg-muted rounded-xl font-medium hover:bg-muted/80 text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmLeave}
                                    disabled={leaving}
                                    className="flex-1 py-3 bg-red-600 rounded-xl font-medium hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {leaving ? "Leaving..." : "Leave"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <StoryViewer
                    isOpen={showStoryViewer}
                    onClose={() => setShowStoryViewer(false)}
                    logs={logs}
                    initialIndex={selectedLogIndex}
                />

                {/* Banner Image */}
                {challenge.banner_url && (
                    <div className="w-full h-48 rounded-2xl overflow-hidden mb-6 border border-border">
                        <img src={challenge.banner_url} alt={challenge.title} className="w-full h-full object-cover" />
                    </div>
                )}

                <div className="space-y-6">
                    {/* Info Card */}
                    <div className="bg-card rounded-2xl p-4 border border-border">
                        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{challenge.description}</p>

                        <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm">
                            <div>
                                <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">Time Window</p>
                                <p className="font-medium text-foreground text-sm">
                                    {challenge.time_window_start && challenge.time_window_end
                                        ? `${challenge.time_window_start} - ${challenge.time_window_end}`
                                        : "Anytime"}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">Duration</p>
                                <p className="font-medium text-foreground text-sm">{durationDays} Days</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">Location</p>
                                <div className="flex items-center gap-1">
                                    {challenge.requires_location ? (
                                        <>
                                            <MapPin className="w-3 h-3 text-green-500" />
                                            <span className="font-medium text-green-500 text-sm">Required</span>
                                        </>
                                    ) : (
                                        <span className="font-medium text-muted-foreground text-sm">Anywhere</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">Participants</p>
                                <p className="font-medium text-foreground text-sm">{challenge.participants_count || 0}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">Created On</p>
                                <p className="font-medium text-foreground text-sm">
                                    {challenge.created_at
                                        ? new Date(challenge.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                        : 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">Start Date</p>
                                <p className="font-medium text-foreground text-sm">
                                    {new Date(challenge.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* My Stats (If Participant) */}
                    {participantData && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-card rounded-2xl p-4 border border-border flex flex-col items-center justify-center text-center">
                                <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center mb-2">
                                    <Flame className="w-4 h-4 text-orange-500" />
                                </div>
                                <p className="text-xl font-bold text-foreground">{participantData.streak_current}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Day Streak</p>
                            </div>
                            <div className="bg-card rounded-2xl p-4 border border-border flex flex-col items-center justify-center text-center">
                                <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center mb-2">
                                    <Trophy className="w-4 h-4 text-yellow-500" />
                                </div>
                                <p className="text-xl font-bold text-foreground">{participantData.current_points}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Points</p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    {!participantData ? (
                        <button
                            onClick={handleJoin}
                            disabled={joining}
                            className="w-full py-4 bg-primary rounded-xl font-bold text-base text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 transition-opacity"
                        >
                            {joining ? "Joining..." : "Join Challenge (+500 pts)"}
                        </button>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Link
                                    href={`/challenges/${challenge.id}/check-in`}
                                    className="block w-full py-4 bg-green-600 rounded-xl font-bold text-base text-white text-center hover:bg-green-500 shadow-lg shadow-green-500/20 transition-colors"
                                >
                                    Check In Now
                                </Link>
                                <p className="text-center text-xs text-muted-foreground">
                                    {challenge.time_window_start && challenge.time_window_end
                                        ? `Check-in available between ${challenge.time_window_start} and ${challenge.time_window_end}`
                                        : "Check-in available anytime today"}
                                </p>
                            </div>

                            {/* Logs Section */}
                            <div>
                                <h3 className="text-base font-semibold mb-4 text-foreground">Your Logs</h3>
                                {logs.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">No logs yet. Check in to start your streak!</p>
                                ) : (
                                    <div className="space-y-4">
                                        {logs.map((log: any, index: number) => (
                                            <div
                                                key={log.id}
                                                onClick={() => handleLogClick(index)}
                                                className="bg-card rounded-xl p-4 border border-border flex gap-4 cursor-pointer hover:bg-muted transition-colors"
                                            >
                                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
                                                    {log.proof_url ? (
                                                        <img src={log.proof_url} alt="Proof" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                            <Camera className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground text-sm">{new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                                                    <p className="text-xs text-green-500 mt-1 font-medium">Verified</p>
                                                    {log.note && <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">{log.note}</p>}
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
