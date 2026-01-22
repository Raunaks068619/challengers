import { NextRequest, NextResponse } from "next/server";
import { sendNotificationToToken, NotificationPayload } from "@/lib/NotificationSender";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("[API /api/test-notification] Request:", {
            ...body,
            token: body.token ? `${body.token.substring(0, 20)}...` : undefined
        });

        const { token, title, message } = body;

        if (!token) {
            console.error("[API /api/test-notification] Missing FCM token");
            return NextResponse.json({ error: "Missing FCM token" }, { status: 400 });
        }

        const notificationTitle = title || "Test Notification";
        const notificationBody = message || "This is a test notification from your Challengers app! 🚀";

        const payload: NotificationPayload = {
            title: notificationTitle,
            body: notificationBody,
            icon: "/icon-192x192.png",
            badge: "/icon-192x192.png",
            url: "/test-notifications",
            type: "info",
            tag: `test-${Date.now()}`,
        };

        console.log("[API /api/test-notification] Sending notification...");
        const messageId = await sendNotificationToToken(token, payload);
        console.log("[API /api/test-notification] Notification sent:", messageId);

        return NextResponse.json({ 
            success: true, 
            messageId,
            message: "Push notification sent successfully"
        });
    } catch (error: any) {
        console.error("[API /api/test-notification] Error:", error);
        return NextResponse.json({ 
            error: error.message || "Failed to send notification" 
        }, { status: 500 });
    }
}
