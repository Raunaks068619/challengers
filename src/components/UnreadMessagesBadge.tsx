"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

export default function UnreadMessagesBadge() {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const pathname = usePathname();
    const prevCountRef = useRef(0);
    const isFirstLoadRef = useRef(true);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "conversations"),
            where("participants", "array-contains", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let totalUnread = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Check if user has unread messages
                // We assume unreadCounts is a map { [userId]: number }
                const count = data.unreadCounts?.[user.uid] || 0;

                // Don't count unread messages if we are currently on that chat page
                const isOnChatPage = pathname === `/messages/${doc.id}`;
                if (!isOnChatPage) {
                    totalUnread += count;
                }
            });

            setUnreadCount(totalUnread);

            // Toast notification logic
            if (!isFirstLoadRef.current && totalUnread > prevCountRef.current) {
                // Determine which conversation caused the increase could be complex, 
                // for now just a generic toast or check if we can identify the change.
                // Simple approach: "You have new messages"
                toast.info("You have new messages!", {
                    action: {
                        label: "View",
                        onClick: () => window.location.href = "/messages"
                    }
                });
            }

            prevCountRef.current = totalUnread;
            isFirstLoadRef.current = false;
        });

        return () => unsubscribe();
    }, [user, pathname]);

    return (
        <Link
            href="/messages"
            className="p-2 -mr-2 rounded-full hover:bg-muted transition-colors text-foreground relative"
        >
            <MessageCircle className="w-6 h-5" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-background">
                    {unreadCount > 99 ? "99+" : unreadCount}
                </span>
            )}
        </Link>
    );
}
