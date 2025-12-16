import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { conversationId, text, senderId, senderName, senderAvatar } = body;

        if (!conversationId || !text || !senderId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const messageData = {
            text,
            senderId,
            senderName: senderName || "Unknown",
            senderAvatar: senderAvatar || "",
            timestamp: FieldValue.serverTimestamp(),
            readBy: [senderId]
        };

        // 1. Add message to subcollection
        const msgRef = await adminDb.collection("conversations")
            .doc(conversationId)
            .collection("messages")
            .add(messageData);

        // 2. Update parent conversation with lastMessage
        await adminDb.collection("conversations").doc(conversationId).update({
            lastMessage: {
                text,
                senderId,
                timestamp: new Date().toISOString() // Approximate for client immediate update if needed
            },
            updatedAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({ success: true, messageId: msgRef.id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
