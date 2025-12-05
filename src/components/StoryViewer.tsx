"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StoryViewerProps {
    isOpen: boolean;
    onClose: () => void;
    logs: any[];
    initialIndex?: number;
}

export default function StoryViewer({ isOpen, onClose, logs, initialIndex = 0 }: StoryViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
        }
    }, [isOpen, initialIndex]);

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex < logs.length - 1) {
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

    if (!isOpen) return null;

    const currentLog = logs[currentIndex];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black flex flex-col"
                >
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 right-0 z-20 p-2 flex gap-1">
                        {logs.map((_, idx) => (
                            <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-white transition-all duration-300 ${idx < currentIndex ? "w-full" : idx === currentIndex ? "w-full" : "w-0"}`}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Header */}
                    <div className="absolute top-4 left-0 right-0 z-20 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
                                {/* Placeholder for user avatar if available in log, otherwise generic */}
                                <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
                                    ME
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">My Check-in</p>
                                <p className="text-xs text-white/70">
                                    {new Date(currentLog.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(currentLog.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-white/80 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 relative flex items-center justify-center bg-zinc-900" onClick={handleNext}>
                        {/* Navigation Areas */}
                        <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={handlePrev} />
                        <div className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={handleNext} />

                        <img
                            src={currentLog.proof_url}
                            alt="Check-in"
                            className="w-full h-full object-contain"
                        />

                        {/* Note / Caption Overlay */}
                        {currentLog.note && (
                            <div className="absolute bottom-24 left-4 right-4 z-20">
                                <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl text-white border border-white/10">
                                    <p className="text-sm font-medium">{currentLog.note}</p>
                                </div>
                            </div>
                        )}

                        {/* AI Caption Placeholder (Simulated) */}
                        {!currentLog.note && (
                            <div className="absolute bottom-24 left-4 right-4 z-20">
                                <div className="bg-indigo-600/80 backdrop-blur-md p-3 rounded-xl text-white border border-white/10 flex items-start gap-2">
                                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded text-white/90 font-bold">AI</span>
                                    <p className="text-sm italic">"Crushing goals one day at a time! 🔥"</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-8 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button className="p-2 text-white hover:text-red-500 transition-colors">
                                <Heart className="w-6 h-6" />
                            </button>
                            <input
                                type="text"
                                placeholder="Send a message..."
                                className="bg-transparent border border-white/30 rounded-full px-4 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:border-white w-48"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
