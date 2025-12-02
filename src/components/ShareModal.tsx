"use client";

import { Copy, Share2, X } from "lucide-react";
import { toast } from "sonner";

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    challengeTitle: string;
    joinCode?: string;
    url: string;
}

export default function ShareModal({ isOpen, onClose, challengeTitle, joinCode, url }: ShareModalProps) {
    if (!isOpen) return null;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
    };

    const handleShareNative = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: challengeTitle,
                    text: `Join me in the "${challengeTitle}" challenge!`,
                    url: url,
                });
            } catch (err) {
                console.error("Error sharing:", err);
            }
        } else {
            toast.error("Sharing not supported on this device.");
        }
    };

    const handleCopyCode = () => {
        if (joinCode) {
            navigator.clipboard.writeText(joinCode);
            toast.success("Join code copied!");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div
                className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm border border-zinc-800 animate-in slide-in-from-bottom-10 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Share Challenge</h3>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Option 1: Copy Link */}
                    <button
                        onClick={handleCopyLink}
                        className="w-full flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500/20">
                                <Copy className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="font-medium text-white">Copy Link</p>
                                <p className="text-xs text-zinc-500">Copy invite link to clipboard</p>
                            </div>
                        </div>
                    </button>

                    {/* Option 2: Native Share */}
                    <button
                        onClick={handleShareNative}
                        className="w-full flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg text-green-400 group-hover:bg-green-500/20">
                                <Share2 className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="font-medium text-white">Share via...</p>
                                <p className="text-xs text-zinc-500">Send to other apps</p>
                            </div>
                        </div>
                    </button>

                    {/* Option 3: Join Code */}
                    {joinCode && (
                        <div className="pt-4 border-t border-zinc-800">
                            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">JOIN CODE</p>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center p-3">
                                    <span className="font-mono text-xl font-bold tracking-widest text-white">{joinCode}</span>
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className="px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300 font-medium transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
