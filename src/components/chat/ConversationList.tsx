import { useState, useEffect } from "react";
import { Users, Search, Camera } from "lucide-react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Loader from "@/components/Loader";
import Skeleton from "@/components/Skeleton";

const ConversationSkeleton = () => (
    <div className="w-full px-0 pt-4 flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
            <div className="flex justify-between items-baseline">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-3 w-8 rounded" />
            </div>
            <Skeleton className="h-3 w-2/3 rounded" />
        </div>
    </div>
);

interface Conversation {
    id: string;
    type: 'challenge' | 'dm';
    participants: string[];
    lastMessage?: {
        text: string;
        timestamp: string;
    };
    updatedAt?: any;
    challengeId?: string;
}

interface ConversationListProps {
    userId: string;
    onSelect: (conversationId: string, type: 'challenge' | 'dm') => void;
    selectedId?: string;
}

export default function ConversationList({ userId, onSelect, selectedId }: ConversationListProps) {
    const router = useRouter();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [participants, setParticipants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Conversations
                const convRes = await fetch(`/api/chat/conversations?userId=${userId}`);
                const convData = await convRes.json();

                // 2. Fetch All Participants
                const partRes = await fetch(`/api/participants?userId=${userId}`);
                const partData = await partRes.json();

                setConversations(convData);
                setParticipants(partData);
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        };

        if (userId) fetchData();
    }, [userId]);

    const handleItemClick = async (item: any) => {
        if (item.type === 'conversation') {
            onSelect(item.data.id, item.data.type);
        } else if (item.type === 'user') {
            // Check if conversation already exists
            const existingConv = conversations.find(c =>
                c.type === 'dm' && c.participants.includes(item.data.id)
            );

            if (existingConv) {
                onSelect(existingConv.id, 'dm');
            } else {
                // Create new conversation
                if (creating) return;
                setCreating(true);
                try {
                    const res = await fetch("/api/chat/conversations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: 'dm',
                            participants: [userId, item.data.id]
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        // Optimistically add to conversations list or just navigate
                        onSelect(data.conversationId, 'dm');
                    } else {
                        toast.error("Failed to start chat");
                    }
                } catch (error) {
                    toast.error("An error occurred");
                } finally {
                    setCreating(false);
                }
            }
        }
    };

    // Merge Logic
    const getMergedList = () => {
        const list: any[] = [];
        const participantMap: Record<string, any> = {};
        participants.forEach(p => participantMap[p.id] = p);

        // 1. Add all existing conversations
        conversations.forEach(c => {
            list.push({
                type: 'conversation',
                id: c.id,
                data: c,
                sortTime: c.lastMessage?.timestamp ? new Date(c.lastMessage.timestamp).getTime() : (c.updatedAt?.seconds * 1000 || 0)
            });
        });

        // 2. Add users who DON'T have a DM conversation yet
        participants.forEach(p => {
            if (p.id === userId) return; // Skip self

            const hasConv = conversations.some(c =>
                c.type === 'dm' && c.participants.includes(p.id)
            );

            if (!hasConv) {
                list.push({
                    type: 'user',
                    id: p.id,
                    data: p,
                    sortTime: 0 // Bottom of list
                });
            }
        });

        // Filter by search
        const filtered = list.filter(item => {
            if (searchQuery.trim() === "") return true;
            const query = searchQuery.toLowerCase();

            if (item.type === 'conversation') {
                const c = item.data as Conversation;
                if (c.type === 'challenge') return "Challenge Chat".toLowerCase().includes(query);
                const otherId = c.participants.find(pid => pid !== userId);
                const name = otherId ? (participantMap[otherId]?.display_name || "Unknown") : "Unknown";
                return name.toLowerCase().includes(query);
            } else {
                return item.data.display_name?.toLowerCase().includes(query);
            }
        });

        // Sort: Active conversations first (by time), then users (alphabetical?)
        // Actually, let's just sort by sortTime desc. Users with 0 will be at bottom.
        return filtered.sort((a, b) => b.sortTime - a.sortTime);
    };

    const mergedList = getMergedList();

    const getShortTime = (timestamp: string) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return "now";

        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h`;

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d`;

        return `${Math.floor(diffInDays / 7)}w`;
    };

    const getDisplayInfo = (item: any) => {
        if (item.type === 'conversation') {
            const c = item.data as Conversation;
            if (c.type === 'challenge') {
                return {
                    name: "Challenge Chat",
                    avatar: null,
                    subtext: c.lastMessage?.text || "No messages yet",
                    time: getShortTime(c.lastMessage?.timestamp || ""),
                    isChallenge: true
                };
            } else {
                const otherId = c.participants.find(p => p !== userId);
                const user = participants.find(p => p.id === otherId);
                return {
                    name: user?.display_name || "Unknown User",
                    avatar: user?.photo_url,
                    subtext: c.lastMessage?.text || "No messages yet",
                    time: getShortTime(c.lastMessage?.timestamp || ""),
                    isChallenge: false
                };
            }
        } else {
            // User item
            const user = item.data;
            return {
                name: user.display_name || "Unknown User",
                avatar: user.photo_url,
                subtext: "Start chatting",
                time: "",
                isChallenge: false
            };
        }
    };

    return (
        <div className="flex flex-col h-full bg-card">
            {/* Search Bar */}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-muted/50 pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                />
            </div>


            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="space-y-1">
                        <ConversationSkeleton />
                        <ConversationSkeleton />
                        <ConversationSkeleton />
                        <ConversationSkeleton />
                        <ConversationSkeleton />
                        <ConversationSkeleton />
                        <ConversationSkeleton />
                    </div>
                ) : mergedList.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No results found.
                    </div>
                ) : (
                    mergedList.map(item => {
                        const info = getDisplayInfo(item);
                        const isSelected = selectedId === (item.type === 'conversation' ? item.data.id : undefined);

                        return (
                            <button
                                key={`${item.type}-${item.id}`}
                                onClick={() => handleItemClick(item)}
                                disabled={creating && item.type === 'user'}
                                className={`w-full px-0 pt-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left ${isSelected ? "bg-muted" : ""}`}
                            >
                                <div className="flex-shrink-0 relative">
                                    {info.avatar ? (
                                        <img src={info.avatar} alt={info.name} className="w-12 h-12 rounded-full object-cover border border-border/50" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-border/50">
                                            {info.isChallenge ? <Users className="w-6 h-6" /> : <span className="font-bold text-lg">{info.name.charAt(0)}</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <span className="font-medium text-sm truncate">{info.name}</span>
                                        {info.time && <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{info.time}</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <p className={`text-xs truncate ${item.type === 'user' ? 'text-primary' : 'text-muted-foreground'}`}>
                                            {info.subtext}
                                        </p>
                                        {item.type === 'conversation' && !info.isChallenge && (
                                            <Camera className="w-4 h-4 text-muted-foreground ml-auto" />
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
