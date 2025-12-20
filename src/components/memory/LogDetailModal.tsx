"use client";

import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { X, ChevronLeft, ChevronRight, MoreHorizontal, Send, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    lat?: number;
    lng?: number;
}

interface LogDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    log?: Log;
    allLogs: Log[];
}

const LogDetailModal: React.FC<LogDetailModalProps> = ({ isOpen, onClose, date, log, allLogs }) => {
    const [currentIndex, setCurrentIndex] = useState(-1);
    const completedLogs = allLogs.filter(l => l.status === 'completed' && l.proof_url);

    useEffect(() => {
        if (log) {
            const index = completedLogs.findIndex(l => l.id === log.id);
            setCurrentIndex(index);
        }
    }, [log, completedLogs]);

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex < completedLogs.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const currentLog = completedLogs[currentIndex] || log;

    if (!currentLog) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="fixed inset-0 z-[100] bg-black flex flex-col"
                >
                    {/* Progress Bars */}
                    <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
                        {completedLogs.map((_, i) => (
                            <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-white transition-all duration-300 ${i === currentIndex ? 'w-full' : i < currentIndex ? 'w-full' : 'w-0'}`}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Header */}
                    <div className="absolute top-6 left-0 right-0 p-4 flex items-center justify-between z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/20 overflow-hidden relative">
                                <Image src={currentLog.proof_url!} alt="" fill className="object-cover" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-white">Your Story</span>
                                <span className="text-xs text-white/60">{format(parseISO(currentLog.date), 'MMMM d')}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* <MoreHorizontal className="w-6 h-6 text-white" /> */}
                            <button onClick={onClose}>
                                <X className="w-7 h-7 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Main Content / Image */}
                    <div className="flex-1 relative flex items-center justify-center bg-zinc-900 overflow-hidden">
                        <Image
                            src={currentLog.proof_url!}
                            alt="Story"
                            fill
                            className="object-contain"
                            priority
                        />

                        {/* Navigation Tap Areas */}
                        <div className="absolute inset-0 flex">
                            <div className="w-1/3 h-full cursor-pointer" onClick={handlePrev} />
                            <div className="w-2/3 h-full cursor-pointer" onClick={handleNext} />
                        </div>
                    </div>

                    {/* Note Overlay */}
                    {currentLog.note && (
                        <div className="absolute bottom-24 left-0 right-0 px-8 text-center z-20">
                            <p className="text-white text-lg font-medium drop-shadow-lg bg-black/20 py-2 px-4 rounded-lg inline-block">
                                {currentLog.note}
                            </p>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LogDetailModal;

