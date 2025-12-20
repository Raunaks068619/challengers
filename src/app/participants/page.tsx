"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { useGetAllParticipantsQuery } from "@/lib/features/api/apiSlice";
import { ChevronLeft, Trophy } from "lucide-react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import BackButton from "@/common/BackButton";
import PageHeader from "@/components/PageHeader";
import { UserProfile } from "@/types";
import Loader from "@/components/Loader";

export default function ParticipantsPage() {
    const { user } = useAuth();
    const { data: participants = [], isLoading } = useGetAllParticipantsQuery(user?.uid || '', {
        skip: !user?.uid,
    });

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground p-6 pb-20">
                <PageHeader title="Participants" backbutton={true} backbuttonAction="/" className="mb-4" />

                <main className="space-y-6">
                    {isLoading ? (
                        <Loader fullscreen={false} className="h-8 w-8" />
                    ) : participants.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No participants found yet.</p>
                            <p className="text-sm mt-2">Invite friends to your challenges!</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {participants.map((participant: UserProfile) => (
                                <div key={participant.id} className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4">
                                    <Avatar
                                        src={participant.photo_url}
                                        alt={participant.display_name}
                                        fallback={participant.display_name?.[0]?.toUpperCase() || "?"}
                                        className="w-12 h-12 border-2 border-border flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-foreground truncate">{participant.display_name}</h3>
                                        <p className="text-xs text-muted-foreground truncate">{participant.bio || "No bio available"}</p>
                                    </div>
                                    <div className="flex flex-col items-end flex-shrink-0">
                                        <div className="flex items-center gap-1 text-primary font-bold">
                                            <Trophy className="w-3 h-3" />
                                            <span>{participant.current_points || 0}</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Points</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
