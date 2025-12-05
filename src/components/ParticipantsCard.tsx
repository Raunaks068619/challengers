import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UserProfile } from "@/types";
import { cn } from "@/lib/utils";
import Avatar from "@/components/Avatar";

interface ParticipantsCardProps {
    participants: UserProfile[];
    className?: string;
}

export default function ParticipantsCard({ participants, className }: ParticipantsCardProps) {
    const displayParticipants = participants.slice(0, 4);
    const count = participants.length;

    return (
        <Link href="/participants" className={cn("bg-card rounded-2xl p-4 border border-border shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors cursor-pointer", className)}>
            <div>
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-2">Participants</p>
                <p className="text-3xl font-medium text-foreground">{count}</p>
            </div>

            <div className="flex items-center justify-between mt-4">
                <div className="flex -space-x-3">
                    {displayParticipants.map((p, i) => (
                        <Avatar
                            key={p.id || i}
                            src={p.photo_url}
                            alt={p.display_name}
                            fallback={p.display_name?.[0]?.toUpperCase() || "?"}
                            className="w-8 h-8 border-2 border-card"
                        />
                    ))}
                    {count > 4 && (
                        <div className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            +{count - 4}
                        </div>
                    )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
        </Link>
    );
}
