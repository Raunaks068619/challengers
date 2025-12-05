import React from "react";
import { cn } from "@/lib/utils";

interface TaskProgressCardProps {
    completed: number;
    total: number;
    className?: string;
}

export default function TaskProgressCard({ completed, total, className }: TaskProgressCardProps) {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className={cn("bg-card rounded-2xl p-4 border border-border shadow-sm flex items-center gap-5", className)}>
            <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="5"
                        fill="transparent"
                        className="text-muted"
                    />
                    {/* Progress Circle */}
                    <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="5"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="text-primary transition-all duration-1000 ease-out"
                    />
                </svg>
                <span className="absolute text-xs font-bold text-foreground">{percentage}%</span>
            </div>

            <div className="flex-1">
                <h3 className="text-base font-bold text-foreground leading-tight mb-1">Your daily goals almost done!</h3>
                <p className="text-sm text-muted-foreground">
                    <span className="text-primary font-bold">{completed}</span> of {total} completed
                </p>
            </div>
        </div>
    );
}
