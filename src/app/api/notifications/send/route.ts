import { NextRequest, NextResponse } from "next/server";
import {
    sendNotificationToToken,
    sendNotificationToUser,
    sendNotificationToUsers,
    NotificationPayload
} from "@/lib/NotificationSender";

interface SendNotificationRequest {
    // Target - one of these must be provided
    token?: string;
    userId?: string;
    userIds?: string[];

    // Notification content
    title: string;
    body: string;

    // Optional fields
    icon?: string;
    image?: string;
    url?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    tag?: string;
    requireInteraction?: boolean;
    data?: Record<string, string>;
}

export async function POST(req: NextRequest) {
    try {
        const body: SendNotificationRequest = await req.json();
        console.log("[API /api/notifications/send] Request:", {
            ...body,
            token: body.token ? `${body.token.substring(0, 20)}...` : undefined
        });

        // Validate required fields
        if (!body.title || !body.body) {
            return NextResponse.json(
                { error: "title and body are required" },
                { status: 400 }
            );
        }

        // Validate target
        if (!body.token && !body.userId && !body.userIds) {
            return NextResponse.json(
                { error: "One of token, userId, or userIds must be provided" },
                { status: 400 }
            );
        }

        const payload: NotificationPayload = {
            title: body.title,
            body: body.body,
            icon: body.icon,
            image: body.image,
            url: body.url,
            type: body.type,
            tag: body.tag,
            requireInteraction: body.requireInteraction,
            data: body.data
        };

        let result: { successCount: number; failureCount: number; messageId?: string };

        if (body.token) {
            // Send to single token
            const messageId = await sendNotificationToToken(body.token, payload);
            result = { successCount: 1, failureCount: 0, messageId };
        } else if (body.userId) {
            // Send to single user
            result = await sendNotificationToUser(body.userId, payload);
        } else if (body.userIds) {
            // Send to multiple users
            result = await sendNotificationToUsers(body.userIds, payload);
        } else {
            return NextResponse.json(
                { error: "Invalid request" },
                { status: 400 }
            );
        }

        console.log("[API /api/notifications/send] Result:", result);

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error("[API /api/notifications/send] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to send notification" },
            { status: 500 }
        );
    }
}
