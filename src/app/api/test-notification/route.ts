import { NextRequest, NextResponse } from "next/server";
import { adminMessaging } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("[API] Test Notification Request Body:", body);
        const { token } = body;

        if (!token) {
            console.error("[API] Missing FCM token");
            return NextResponse.json({ error: "Missing FCM token" }, { status: 400 });
        }

        const message = {
            token: token,
            notification: {
                title: "Test Notification",
                body: "This is a test notification from your Challengers app! 🚀",
            },
            data: {
                url: "/profile",
                click_action: "FLUTTER_NOTIFICATION_CLICK"
            }
        };

        console.log("[API] Sending message to Firebase Admin...");
        const response = await adminMessaging.send(message);
        console.log("[API] Firebase Admin Response:", response);

        return NextResponse.json({ success: true, messageId: response });
    } catch (error: any) {
        console.error("[API] Error sending test notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
