import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, increment } from "firebase/firestore";
import { Send, Camera, Mic, Image as ImageIcon, Smile } from "lucide-react";
import MessageBubble from "./MessageBubble";

interface ChatWindowProps {
    conversationId: string;
    currentUserId: string;
    participants?: string[];
}

export default function ChatWindow({ conversationId, currentUserId, participants = [] }: ChatWindowProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        if (!conversationId) return;

        const q = query(
            collection(db, `conversations/${conversationId}/messages`),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
            scrollToBottom();
        });

        return () => unsubscribe();
    }, [conversationId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

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
                console.error("Failed to send message");
                // Ideally handle error UI here, maybe restore message text
            }
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOwn={msg.senderId === currentUserId}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-background">
                <div className="flex items-center gap-3">
                    <button className="p-2 bg-blue-500 rounded-full text-white flex-shrink-0">
                        <Camera className="w-5 h-5" />
                    </button>

                    <form onSubmit={handleSendMessage} className="flex-1 flex items-center bg-muted rounded-full px-4 py-2 gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Message..."
                            className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                        />
                        {!newMessage && (
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <button type="button"><Mic className="w-5 h-5" /></button>
                                <button type="button"><ImageIcon className="w-5 h-5" /></button>
                                <button type="button"><Smile className="w-5 h-5" /></button>
                            </div>
                        )}
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
