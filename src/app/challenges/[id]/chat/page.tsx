"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import PageHeader from "@/components/PageHeader";
import ChatWindow from "@/components/chat/ChatWindow";
import { useGetChallengeQuery } from "@/lib/features/api/apiSlice";
import Loader from "@/components/Loader";

export default function ChallengeChatPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const router = useRouter();

    const { data: challenge, isLoading } = useGetChallengeQuery(id as string, {
        skip: !id,
    });

    if (isLoading) return <Loader fullscreen={true} />;
    if (!challenge) return <div className="p-4 text-white">Challenge not found</div>;

    return (
        <AuthGuard>
            <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col">
                <div className="px-6 pt-4 border-b border-border/50 bg-background z-10">
                    <PageHeader
                        title={challenge.title}
                        backbutton={true}
                        backbuttonAction={`/challenges/${id}`}
                    />
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <ChatWindow
                        conversationId={challenge.id || ''}
                        currentUserId={user?.uid || ''}
                        participants={challenge.participants || []}
                    />
                </div>
            </div>
        </AuthGuard>
    );
}
