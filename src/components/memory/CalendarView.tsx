"use client";

import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths } from 'date-fns';
import Image from 'next/image';

interface Log {
    id: string;
    date: string;
    status: 'completed' | 'missed' | 'rest';
    proof_url?: string;
    points?: number;
    streak?: number;
    note?: string;
    challenge_id?: string;
}

interface CalendarViewProps {
    logs: Log[];
    onDateClick: (date: Date, log?: Log) => void;
}

// Generate an array of months from the oldest log to current month
const generateMonthsToShow = (logs: Log[]) => {
    const now = new Date();

    if (logs.length === 0) {
        // If no logs, show last 6 months
        return Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i));
    }

    // Find the oldest log date
    const oldestDate = logs.reduce((oldest, log) => {
        const logDate = new Date(log.date);
        return logDate < oldest ? logDate : oldest;
    }, now);
    console.log({ logs });


    const months: Date[] = [];
    let current = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 1);

    while (current <= endDate) {
        months.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }

    return months.reverse(); // Most recent first
};

const CalendarView: React.FC<CalendarViewProps> = ({ logs, onDateClick }) => {
    const monthsToShow = useMemo(() => generateMonthsToShow(logs), [logs]);
    console.log({ monthsToShow });


    const getLogForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return logs.find(log => log.date === dateStr);
    };

    const renderMonth = (monthDate: Date) => {
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);
        const dateRange = eachDayOfInterval({ start, end });

        // Sunday is 0 in getDay()
        const firstDayOfWeek = getDay(start);
        const padding = Array.from({ length: firstDayOfWeek }).map((_, i) => null);

        const days = [...padding, ...dateRange];

        return (
            <div key={monthDate.toString()} className="mb-8">
                {/* Month Title */}
                <h2 className="text-base font-medium text-start mb-6">{format(monthDate, 'MMMM yyyy')}</h2>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-4">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-[11px] font-medium text-muted-foreground py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7">
                    {days.map((date, index) => {
                        if (!date) return <div key={`empty-${index}`} className="aspect-square" />;

                        const log = getLogForDate(date);
                        const hasStory = log?.status === 'completed' && log.proof_url;

                        return (
                            <div
                                key={date.toString()}
                                onClick={() => onDateClick(date, log)}
                                className="aspect-square flex items-center justify-center relative cursor-pointer"
                            >
                                {hasStory ? (
                                    <div className="relative w-[80%] h-[80%] flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full overflow-hidden opacity-70">
                                            <Image
                                                src={log.proof_url!}
                                                alt=""
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <span className="relative z-10 text-white text-sm drop-shadow-md">
                                            {format(date, 'd')}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-sm font-medium">
                                        {format(date, 'd')}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-background text-foreground select-none px-6 pb-8">
            {monthsToShow.map(month => renderMonth(month))}
        </div>
    );
};

export default CalendarView;
