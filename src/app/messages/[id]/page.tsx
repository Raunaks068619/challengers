"use client";

import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import ChatWindow from "@/components/chat/ChatWindow";
import PageHeader from "@/components/PageHeader";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Video, Info, User } from "lucide-react";
import Loader from "@/components/Loader";
import Skeleton from "@/components/Skeleton";

export default function DMChatPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const [participant, setParticipant] = useState<any>(null);
    const [participants, setParticipants] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && id) {
            setLoading(true);
            fetch(`/api/chat/conversations?userId=${user.uid}`)
                .then(res => res.json())
                .then(data => {
                    const conv = data.find((c: any) => c.id === id);
                    if (conv) {
                        setParticipants(conv.participants || []);
                        const otherId = conv.participants.find((p: string) => p !== user.uid);
                        if (otherId) {
                            fetch(`/api/participants?userId=${user.uid}`)
                                .then(res => res.json())
                                .then(users => {
                                    const p = users.find((u: any) => u.id === otherId);
                                    setParticipant(p);
                                    setLoading(false);
                                })
                                .catch(() => setLoading(false));
                        } else {
                            setLoading(false);
                        }
                    } else {
                        setLoading(false);
                    }
                })
                .catch(() => setLoading(false));
        }
    }, [user, id]);

    return (
        <AuthGuard>
            <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col">
                <div className="px-6 pt-4 border-b border-border/50 bg-background z-10">
                    <PageHeader
                        title=""
                        backbutton={true}
                        backbuttonAction="/messages"
                        leftContent={
                            <div className="flex items-center gap-3">
                                {loading ? (
                                    <>
                                        <Skeleton className="w-8 h-8 rounded-full" />
                                        <Skeleton className="h-4 w-24 rounded" />
                                    </>
                                ) : (
                                    <>
                                        {participant?.photo_url ? (
                                            <img src={participant.photo_url} alt={participant.display_name} className="w-8 h-8 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <User className="w-4 h-4" />
                                            </div>
                                        )}
                                        <span className="font-semibold text-sm">{participant?.display_name || "Unknown"}</span>
                                    </>
                                )}
                            </div>
                        }
                        rightContent={
                            <div className="flex items-center gap-4 text-foreground">
                                <Video className="w-6 h-6" />
                                <Info className="w-6 h-6" />
                            </div>
                        }
                    />
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <ChatWindow
                        conversationId={id as string}
                        currentUserId={user?.uid || ''}
                        participants={participants}
                        isLoading={loading}
                    />
                </div>
            </div>
        </AuthGuard>
    );
}
