import { NextRequest, NextResponse } from "next/server";
import { unsubscribeFromPush } from "@/notifications/NotificationPush";

/**
 * Reset push notification subscription
 * This endpoint helps clear stale subscriptions after PWA reinstallations
 */
export async function POST(req: NextRequest) {
    try {
        console.log("[API /api/notifications/reset] Resetting subscription...");

        // Note: This is a client-side operation, but we provide the endpoint
        // for consistency. The actual reset happens in the client.
        // This endpoint can be used to log reset events or perform server-side cleanup.

        return NextResponse.json({
            success: true,
            message: "Subscription reset initiated. Please refresh the page and subscribe again."
        });
    } catch (error: any) {
        console.error("[API /api/notifications/reset] Error:", error);
        return NextResponse.json({
            error: error.message || "Failed to reset subscription"
        }, { status: 500 });
    }
}
