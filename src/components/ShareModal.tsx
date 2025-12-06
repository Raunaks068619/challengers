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
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div
                className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border animate-in zoom-in-95 duration-300 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-foreground">Share Challenge</h3>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Option 1: Copy Link */}
                    <button
                        onClick={handleCopyLink}
                        className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-xl transition-colors group border border-transparent hover:border-border"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500 group-hover:bg-indigo-500/20">
                                <Copy className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="font-medium text-foreground">Copy Link</p>
                                <p className="text-xs text-muted-foreground">Copy invite link to clipboard</p>
                            </div>
                        </div>
                    </button>

                    {/* Option 2: Native Share */}
                    <button
                        onClick={handleShareNative}
                        className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-xl transition-colors group border border-transparent hover:border-border"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg text-green-500 group-hover:bg-green-500/20">
                                <Share2 className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="font-medium text-foreground">Share via...</p>
                                <p className="text-xs text-muted-foreground">Send to other apps</p>
                            </div>
                        </div>
                    </button>

                    {/* Option 3: Join Code */}
                    {joinCode && (
                        <div className="pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">JOIN CODE</p>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-background border border-border rounded-xl flex items-center justify-center p-3">
                                    <span className="font-mono text-xl font-bold tracking-widest text-foreground">{joinCode}</span>
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className="px-4 bg-muted hover:bg-muted/80 rounded-xl text-foreground font-medium transition-colors"
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
