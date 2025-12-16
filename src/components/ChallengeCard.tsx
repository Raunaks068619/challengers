"use client";

import { Challenge } from "@/types";
import { Check, Clock, MapPin, Users, X, ChevronRight } from "lucide-react";
import Link from "next/link";

interface ChallengeCardProps {
    challenge: Challenge & { participants_count?: number };
    logs: any[]; // User's logs for this week
    userId: string;
}

export default function ChallengeCard({ challenge, logs, userId }: ChallengeCardProps) {
    // Helper to get week days (Sun-Sat)
    const getWeekDays = () => {
        const today = new Date();
        const currentDay = today.getDay(); // 0 (Sun) - 6 (Sat)
        const days = [];

        // Start from last Sunday
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - currentDay);

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const weekDays = getWeekDays();
    const todayStr = new Date().toISOString().split('T')[0];
    console.log({ challenge });


    return (
        <Link href={`/challenges/${challenge.id}`} className="group block bg-card rounded-3xl overflow-hidden shadow-sm border border-border hover:shadow-md hover:border-primary/50 transition-all duration-300 active:scale-[0.98]">
            {/* Banner */}
            {/* <div className="h-25 bg-muted relative">
                {challenge.banner_url ? (
                    <img src={challenge.banner_url} alt={challenge.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
                        Banner image
                    </div>
                )}
            </div> */}

            {/* Content */}
            <div className="p-5 relative">
                {/* Title & Icon */}
                <div className="flex items-start gap-4 mb-4 pr-6">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0 border border-border/50">
                        {/* Placeholder Icon if no specific icon field */}
                        <span className="text-2xl">🔥</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-card-foreground leading-tight">{challenge.title}</h3>
                        <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{challenge.description}</p>
                    </div>
                </div>

                {/* Navigation Arrow */}
                <div className="absolute top-5 right-5 text-muted-foreground/50 group-hover:text-primary transition-colors">
                    <ChevronRight className="w-5 h-5" />
                </div>

                {/* Consistency Tracker */}
                <div className="flex justify-between items-center mb-4">
                    {weekDays.map((date, index) => {
                        const dateStr = date.toISOString().split('T')[0];
                        const dayLabel = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][index];

                        // Pre-calculate common conditions
                        const hasLog = logs.some(log => log.challenge_id === challenge.id && log.date === dateStr);
                        const isRestDay = challenge.rest_days?.includes(index);
                        const isToday = dateStr === todayStr;
                        const isFuture = date > new Date();
                        const startDateStr = challenge.start_date || challenge.created_at?.split('T')[0];
                        const isBeforeStart = startDateStr ? dateStr < startDateStr : false;

                        // Check status from points_history
                        const history = (challenge as any).participant?.points_history || [];
                        const historyEntryIndex = history.findIndex((h: any) => h.date === dateStr);
                        const historyEntry = historyEntryIndex !== -1 ? history[historyEntryIndex] : null;

                        let status: 'completed' | 'missed' | 'pending' | 'future' | 'rest' | 'none' = 'none';

                        if (isFuture) status = 'future';
                        else if (isRestDay) status = 'rest';
                        else if (historyEntry) {
                            if (historyEntry.taskStatus) {
                                status = historyEntry.taskStatus;
                            } else {
                                // Infer from points
                                const prevEntry = historyEntryIndex > 0 ? history[historyEntryIndex - 1] : null;
                                if (!prevEntry) {
                                    status = 'completed'; // First entry (start)
                                } else {
                                    if (historyEntry.points < prevEntry.points) status = 'missed';
                                    else status = 'completed';
                                }
                            }
                        } else if (hasLog) {
                            status = 'completed'; // Fallback to logs
                        } else if (isToday) {
                            status = 'pending';
                        } else if (isBeforeStart) {
                            status = 'future'; // Treat before start as future/dimmed
                        } else {
                            status = 'missed'; // Past, no history, no log, not rest -> Missed
                        }

                        // Render Logic
                        const baseClasses = "w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all";

                        if (status === 'completed') {
                            return (
                                <div key={index} className={`${baseClasses} bg-primary text-primary-foreground`}>
                                    <Check className="w-4 h-4" />
                                </div>
                            );
                        }

                        if (status === 'missed') {
                            return (
                                <div key={index} className={`${baseClasses} bg-red-500/10 border border-red-500/20 text-red-500`}>
                                    <X className="w-4 h-4" />
                                </div>
                            );
                        }

                        if (status === 'pending') {
                            return (
                                <div key={index} className={`${baseClasses} border-2 border-dashed border-muted-foreground text-foreground font-bold`}>
                                    {dayLabel}
                                </div>
                            );
                        }

                        if (status === 'rest') {
                            return (
                                <div key={index} className={`${baseClasses} bg-muted text-muted-foreground`}>
                                    {dayLabel}
                                </div>
                            );
                        }

                        // Future or Before Start
                        return (
                            <div key={index} className={`${baseClasses} border border-border text-muted-foreground/30`}>
                                {dayLabel}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium pt-4 border-t border-border">
                    <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{challenge.participants_count || 0} Participants</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                            {challenge.time_window_start && challenge.time_window_end
                                ? `${challenge.time_window_start} - ${challenge.time_window_end}`
                                : 'Anytime'}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
