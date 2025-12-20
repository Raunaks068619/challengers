import { ChevronRight } from "lucide-react";
import Link from "next/link";

interface GroupChatCardProps {
    challengeId: string;
    participants: {
        id: string;
        photo_url?: string;
        display_name?: string;
    }[];
    isLoading?: boolean;
}

import Skeleton from "./Skeleton";

export default function GroupChatCard({ challengeId, participants, isLoading }: GroupChatCardProps) {
    if (isLoading) {
        return (
            <div className="bg-card rounded-2xl p-4 border border-border flex items-center justify-between mb-6">
                <div className="flex flex-row gap-3 items-center">
                    <div className="flex items-center">
                        <Skeleton className="w-10 h-10 rounded-full border-2 border-background" />
                        <Skeleton className="w-10 h-10 rounded-full border-2 border-background -ml-3" />
                        <Skeleton className="w-10 h-10 rounded-full border-2 border-background -ml-3" />
                    </div>
                    <Skeleton className="h-4 w-24 rounded" />
                </div>
                <Skeleton className="w-5 h-5 rounded-full" />
            </div>
        );
    }

    // Show up to 4 avatars
    const displayParticipants = participants.slice(0, 4);

    return (
        <Link href={`/challenges/${challengeId}/chat`} className="block mb-6">
            <div className="bg-card rounded-2xl p-4 border border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
                <div className="flex flex-row gap-3 items-center">

                    <div className="flex items-center">
                        {displayParticipants.map((p, i) => (
                            <div
                                key={p.id}
                                className={`w-10 h-10 rounded-full border-2 border-background overflow-hidden bg-muted -ml-3 first:ml-0 z-[${10 - i}]`}
                            >
                                {p.photo_url ? (
                                    <img src={p.photo_url} alt={p.display_name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                                        {p.display_name?.[0] || "?"}
                                    </div>
                                )}
                            </div>
                        ))}
                        {participants.length > 4 && (
                            <div className="w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground -ml-3 z-0">
                                +{participants.length - 4}
                            </div>
                        )}
                    </div>
                    <span className="text-sm font-medium">Group chat</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
        </Link>
    );
}
