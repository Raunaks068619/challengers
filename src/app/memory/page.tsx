"use client";

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import CalendarView from '@/components/memory/CalendarView';
import LogDetailModal from '@/components/memory/LogDetailModal';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/PageHeader';

interface Log {
    id: string;
    date: string;
    status: 'completed' | 'missed' | 'rest';
    proof_url?: string;
    points?: number;
    streak?: number;
    note?: string;
    challenge_id?: string;
    lat?: number;
    lng?: number;
}

export default function MemoryPage() {
    const { user } = useAuth();
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedLog, setSelectedLog] = useState<Log | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchLogs = async () => {
            try {
                const response = await fetch(`/api/logs/all?userId=${user.uid}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch logs');
                }
                const data = await response.json();
                setLogs(data);
            } catch (error) {
                console.error('Error fetching logs:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [user]);

    const handleDateClick = (date: Date, log?: Log) => {
        if (log?.status === 'completed') {
            setSelectedDate(date);
            setSelectedLog(log);
            setIsModalOpen(true);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground pb-24">
            <PageHeader title="Memories" backbutton={false} className='mb-4 px-6' rightContent={<div />} />

            <main className="max-w-4xl mx-auto pb-6">
                <CalendarView logs={logs} onDateClick={handleDateClick} />
            </main>

            {selectedDate && (
                <LogDetailModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    date={selectedDate}
                    log={selectedLog}
                    allLogs={logs}
                />
            )}
        </div>
    );
}
