import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
    let text, conversationId, senderId;
    try {
        const body = await request.json();
        text = body.text;
        conversationId = body.conversationId;
        senderId = body.senderId;

        if (!text || !conversationId || !senderId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Verify sender (optional but recommended)
        // const token = request.headers.get("Authorization")?.split("Bearer ")[1];
        // const decodedToken = await adminAuth.verifyIdToken(token || "");
        // if (decodedToken.uid !== senderId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. Add message to Firestore
        const messageRef = await adminDb
            .collection("conversations")
            .doc(conversationId)
            .collection("messages")
            .add({
                text,
                senderId,
                timestamp: FieldValue.serverTimestamp(),
            });

        // 2. Update conversation lastMessage and unread counts
        const conversationRef = adminDb.collection("conversations").doc(conversationId);
        const conversationDoc = await conversationRef.get();

        if (!conversationDoc.exists) {
            console.error(`[Chat API] Conversation not found: ${conversationId}`);
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const conversationData = conversationDoc.data();
        const participants = conversationData?.participants || [];

        const unreadUpdates: any = {};
        const fcmTokensToSend: string[] = [];

        // Calculate unread updates and gather FCM tokens
        for (const pId of participants) {
            if (pId !== senderId) {
                unreadUpdates[`unreadCounts.${pId}`] = FieldValue.increment(1);

                // Get user's FCM tokens (saved in 'users' collection by useFcmToken hook)
                const userDoc = await adminDb.collection("users").doc(pId).get();
                const userData = userDoc.data();
                if (userData?.fcmTokens && Array.isArray(userData.fcmTokens)) {
                    fcmTokensToSend.push(...userData.fcmTokens);
                }
            }
        }

        await conversationRef.update({
            lastMessage: {
                text,
                senderId,
                timestamp: new Date().toISOString()
            },
            updatedAt: FieldValue.serverTimestamp(),
            ...unreadUpdates
        });

        // Fetch sender details for notification from 'profiles' collection
        const senderDoc = await adminDb.collection("profiles").doc(senderId).get();
        const senderData = senderDoc.data();
        const senderName = senderData?.display_name || "New Message";
        const senderImage = senderData?.photo_url || "/icons/icon-192x192.png";

        // 3. Send FCM Notifications
        if (fcmTokensToSend.length > 0) {
            // Remove duplicates
            const uniqueTokens = [...new Set(fcmTokensToSend)];

            // Send multicast message
            try {
                await adminMessaging.sendEachForMulticast({
                    tokens: uniqueTokens,
                    data: {
                        title: senderName,
                        body: text,
                        icon: senderImage,
                        conversationId,
                        url: `/messages/${conversationId}`
                    },
                    webpush: {
                        fcmOptions: {
                            link: `/messages/${conversationId}`
                        }
                    }
                });
            } catch (fcmError) {
                console.error("[Chat API] Error sending FCM:", fcmError);
                // Continue execution, don't fail the request just because notification failed
            }
        }

        return NextResponse.json({ success: true, messageId: messageRef.id });

    } catch (error: any) {
        console.error("[Chat API] Error in /api/chat/send:", {
            error: error.message,
            stack: error.stack,
            body: { text: text?.substring(0, 20), conversationId, senderId }
        });
        return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
    }
}
