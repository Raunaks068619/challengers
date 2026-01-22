"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Share2, Link as LinkIcon, FileText, Copy, Check, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";

interface SharedItem {
    id: string;
    title: string | null;
    text: string | null;
    url: string | null;
    timestamp: number;
}

const STORAGE_KEY = "challengers_shared_items";

export default function SharedPage() {
    const searchParams = useSearchParams();
    const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [currentShare, setCurrentShare] = useState<{
        title: string | null;
        text: string | null;
        url: string | null;
    } | null>(null);

    // Load shared items from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setSharedItems(JSON.parse(stored));
            } catch (e) {
                console.error("Error parsing shared items:", e);
            }
        }
    }, []);

    // Handle incoming share data from URL params
    useEffect(() => {
        const title = searchParams.get("title");
        const text = searchParams.get("text");
        const url = searchParams.get("url");

        if (title || text || url) {
            setCurrentShare({ title, text, url });

            // Save to localStorage
            const newItem: SharedItem = {
                id: Date.now().toString(),
                title,
                text,
                url,
                timestamp: Date.now()
            };

            setSharedItems(prev => {
                const updated = [newItem, ...prev].slice(0, 50); // Keep last 50
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                return updated;
            });

            toast.success("Content received!", {
                description: title || url || "Shared content saved"
            });

            // Clear URL params after processing
            window.history.replaceState({}, "", "/shared");
        }
    }, [searchParams]);

    const handleCopy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            toast.success("Copied to clipboard!");
            setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {
            toast.error("Failed to copy");
        }
    };

    const handleDelete = (id: string) => {
        setSharedItems(prev => {
            const updated = prev.filter(item => item.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
        toast.success("Removed");
    };

    const handleClearAll = () => {
        setSharedItems([]);
        localStorage.removeItem(STORAGE_KEY);
        toast.success("All items cleared");
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="min-h-screen bg-background text-foreground pb-24">
            <PageHeader title="Shared Content" />

            <div className="p-4 space-y-4">
                {/* Current Share Banner */}
                {currentShare && (
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Share2 className="w-5 h-5 text-primary" />
                            <span className="font-medium text-primary">Just Received</span>
                        </div>
                        {currentShare.title && (
                            <p className="font-semibold text-foreground">{currentShare.title}</p>
                        )}
                        {currentShare.text && (
                            <p className="text-sm text-muted-foreground mt-1">{currentShare.text}</p>
                        )}
                        {currentShare.url && (
                            <a
                                href={currentShare.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary underline break-all mt-2 block"
                            >
                                {currentShare.url}
                            </a>
                        )}
                    </div>
                )}

                {/* Instructions */}
                {sharedItems.length === 0 && !currentShare && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                            <Share2 className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h2 className="text-lg font-semibold mb-2">No Shared Content Yet</h2>
                        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                            Share links, text, or content from other apps to Challengers and they'll appear here.
                        </p>
                        <div className="mt-6 p-4 rounded-xl bg-muted/50 text-left max-w-sm mx-auto">
                            <p className="text-xs text-muted-foreground font-medium mb-2">How to share:</p>
                            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                                <li>Open any app with content to share</li>
                                <li>Tap the share button</li>
                                <li>Select "Challengers" from the list</li>
                            </ol>
                        </div>
                    </div>
                )}

                {/* Shared Items List */}
                {sharedItems.length > 0 && (
                    <>
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-medium text-muted-foreground">
                                Recent ({sharedItems.length})
                            </h2>
                            <button
                                onClick={handleClearAll}
                                className="text-xs text-destructive hover:underline"
                            >
                                Clear All
                            </button>
                        </div>

                        <div className="space-y-3">
                            {sharedItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-4 rounded-xl bg-card border border-border"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            {item.title && (
                                                <p className="font-medium text-foreground truncate">
                                                    {item.title}
                                                </p>
                                            )}
                                            {item.text && (
                                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                    {item.text}
                                                </p>
                                            )}
                                            {item.url && (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <LinkIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary underline truncate"
                                                    >
                                                        {item.url}
                                                    </a>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-2">
                                                {formatTime(item.timestamp)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            {item.url && (
                                                <>
                                                    <button
                                                        onClick={() => handleCopy(item.url!, item.id)}
                                                        className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                                                        title="Copy URL"
                                                    >
                                                        {copiedId === item.id ? (
                                                            <Check className="w-4 h-4 text-primary" />
                                                        ) : (
                                                            <Copy className="w-4 h-4 text-muted-foreground" />
                                                        )}
                                                    </button>
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                                                        title="Open Link"
                                                    >
                                                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                                    </a>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 rounded-lg bg-muted hover:bg-destructive/10 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
