import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, increment, limit, startAfter, getDocs, QueryDocumentSnapshot, where } from "firebase/firestore";
import { Send, Camera, Mic, Image as ImageIcon, Smile } from "lucide-react";
import MessageBubble from "./MessageBubble";

interface ChatWindowProps {
    conversationId: string;
    currentUserId: string;
    participants?: string[];
}

const MESSAGES_PER_PAGE = 50;

export default function ChatWindow({ conversationId, currentUserId, participants = [] }: ChatWindowProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [lastLoadedDoc, setLastLoadedDoc] = useState<QueryDocumentSnapshot<any> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isFirstLoad = useRef(true);

    // Real-time unread count reset
    useEffect(() => {
        if (!conversationId || !currentUserId) return;

        const unsub = onSnapshot(doc(db, "conversations", conversationId), (snapshot) => {
            const data = snapshot.data();
            if (data?.unreadCounts?.[currentUserId] > 0) {
                updateDoc(doc(db, "conversations", conversationId), {
                    [`unreadCounts.${currentUserId}`]: 0
                }).catch(console.error);
            }
        });

        return () => unsub();
    }, [conversationId, currentUserId]);

    // Initial Load + Realtime Listener
    useEffect(() => {
        if (!conversationId) return;

        setMessages([]);
        setLastLoadedDoc(null);
        setHasMore(true);
        isFirstLoad.current = true;

        const setupChat = async () => {
            // 1. Fetch latest messages for initial view
            const initialQuery = query(
                collection(db, `conversations/${conversationId}/messages`),
                orderBy("timestamp", "desc"),
                limit(MESSAGES_PER_PAGE)
            );

            const snapshot = await getDocs(initialQuery);
            const initialMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();

            setMessages(initialMessages);

            if (snapshot.docs.length > 0) {
                setLastLoadedDoc(snapshot.docs[snapshot.docs.length - 1]);
            }

            if (snapshot.docs.length < MESSAGES_PER_PAGE) {
                setHasMore(false);
            }

            // 2. Listen for NEW messages
            // If we have messages, listen after the latest one. If empty, listen from now.
            const latestDoc = snapshot.docs[0]; // First in desc is latest
            const latestTimestamp = latestDoc?.data().timestamp || serverTimestamp();

            const realtimeQuery = query(
                collection(db, `conversations/${conversationId}/messages`),
                orderBy("timestamp", "asc"),
                startAfter(latestTimestamp)
            );

            const unsubscribe = onSnapshot(realtimeQuery, (snapshot) => {
                const newMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (newMsgs.length > 0) {
                    setMessages(prev => {
                        // Deduplicate just in case
                        const existingIds = new Set(prev.map(m => m.id));
                        const uniqueNewMsgs = newMsgs.filter(m => !existingIds.has(m.id));
                        return [...prev, ...uniqueNewMsgs];
                    });
                }
            });

            return unsubscribe;
        };

        let unsub: (() => void) | undefined;
        setupChat().then(u => unsub = u);

        return () => {
            if (unsub) unsub();
        };
    }, [conversationId]);

    // Load More Messages (Pagination)
    const loadMoreMessages = async () => {
        if (!conversationId || !lastLoadedDoc || !hasMore || isLoadingMore) return;

        setIsLoadingMore(true);
        // Save scroll position
        const container = containerRef.current;
        const oldScrollHeight = container?.scrollHeight || 0;

        try {
            const nextQuery = query(
                collection(db, `conversations/${conversationId}/messages`),
                orderBy("timestamp", "desc"),
                startAfter(lastLoadedDoc),
                limit(MESSAGES_PER_PAGE)
            );

            const snapshot = await getDocs(nextQuery);
            const olderMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();

            if (snapshot.docs.length > 0) {
                setLastLoadedDoc(snapshot.docs[snapshot.docs.length - 1]);
                setMessages(prev => [...olderMessages, ...prev]);

                // Restore scroll position
                requestAnimationFrame(() => {
                    if (container) {
                        const newScrollHeight = container.scrollHeight;
                        container.scrollTop = newScrollHeight - oldScrollHeight;
                    }
                });
            }

            if (snapshot.docs.length < MESSAGES_PER_PAGE) {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Error loading more messages:", error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Intersection Observer for Top Sentinel
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    loadMoreMessages();
                }
            },
            { threshold: 0.5 }
        );

        if (topSentinelRef.current) {
            observer.observe(topSentinelRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, lastLoadedDoc]); // Dependencies crucial for closure

    // Memoized message list to prevent unnecessary re-renders
    const messageList = useMemo(() => {
        return messages.map((msg) => (
            <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.senderId === currentUserId}
            />
        ));
    }, [messages, currentUserId]);

    // Auto-scroll to bottom for new messages
    useEffect(() => {
        if (messages.length === 0) return;

        if (isFirstLoad.current) {
            // Instant jump to bottom on first load
            if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
            isFirstLoad.current = false;
        } else if (!isLoadingMore && messagesEndRef.current) {
            // Smooth scroll for new messages (only if not loading history)
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isLoadingMore]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const text = newMessage;
        setNewMessage(""); // Optimistic clear

        try {
            const response = await fetch("/api/chat/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text,
                    conversationId,
                    senderId: currentUserId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Failed to send message:", errorData);
            }
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
            >
                {/* Top Sentinel for loading more */}
                <div ref={topSentinelRef} className="h-4 w-full flex items-center justify-center">
                    {isLoadingMore && <span className="text-xs text-muted-foreground">Loading history...</span>}
                </div>

                {messageList}
                <div ref={messagesEndRef} />
            </div>

            <div className="px-4 pb-5 bg-transparent">
                <div className="flex items-center gap-3">
                    <form onSubmit={handleSendMessage} className="flex-1 flex items-center bg-muted rounded-full px-4 py-2 gap-2 min-w-0">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Message..."
                            className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                        />
                        {newMessage && (
                            <button type="submit" className="text-primary font-semibold text-sm">
                                Send
                            </button>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
