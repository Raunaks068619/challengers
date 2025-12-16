"use client";

import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import PageHeader from "@/components/PageHeader";
import ConversationList from "@/components/chat/ConversationList";
import { useRouter } from "next/navigation";

export default function MessagesPage() {
    const { user } = useAuth();
    const router = useRouter();

    const handleSelectConversation = (id: string, type: 'challenge' | 'dm') => {
        if (type === 'challenge') {
            router.push(`/challenges/${id}`);
        } else {
            router.push(`/messages/${id}`);
        }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground pb-20">
                <div className="p-6 h-full flex flex-col">

                    <PageHeader
                        title="Messages"
                        backbutton={true}
                        backbuttonAction="/"
                    />


                    <div className="flex-1 overflow-hidden flex flex-col">
                        <ConversationList
                            userId={user?.uid || ''}
                            onSelect={handleSelectConversation}
                        />
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
