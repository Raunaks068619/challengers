"use client";

import { Challenge } from "@/types";
import { Check, Clock, MapPin, Users } from "lucide-react";
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
        <Link href={`/challenges/${challenge.id}`} className="block bg-card rounded-3xl overflow-hidden shadow-sm border border-border hover:shadow-md transition-shadow">
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
            <div className="p-5">
                {/* Title & Icon */}
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-8 h-8 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                        {/* Placeholder Icon if no specific icon field */}
                        <span className="text-xl">🔥</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-card-foreground leading-tight">{challenge.title}</h3>
                        <p className="text-muted-foreground text-xs mt-1 line-clamp-1">{challenge.description}</p>
                    </div>
                </div>

                {/* Consistency Tracker */}
                <div className="flex justify-between items-center mb-4">
                    {weekDays.map((date, index) => {
                        const dateStr = date.toISOString().split('T')[0];
                        const dayLabel = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][index];

                        // Check status
                        const hasLog = logs.some(log => log.challenge_id === challenge.id && log.date === dateStr);
                        const isRestDay = challenge.rest_days?.includes(index);
                        const isToday = dateStr === todayStr;
                        const isFuture = date > new Date();

                        // Render Logic
                        if (hasLog) {
                            return (
                                <div key={index} className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                                    <Check className="w-4 h-4" />
                                </div>
                            );
                        }

                        if (isToday) {
                            return (
                                <div key={index} className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center text-foreground font-bold text-xs">
                                    {dayLabel}
                                </div>
                            );
                        }

                        if (isRestDay) {
                            return (
                                <div key={index} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
                                    {dayLabel}
                                </div>
                            );
                        }

                        // Default / Missed / Future
                        return (
                            <div key={index} className={`w-8 h-8 rounded-full border border-border flex items-center justify-center text-xs ${isFuture ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
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
