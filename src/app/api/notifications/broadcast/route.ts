import { NextRequest, NextResponse } from "next/server";
import {
    sendNotificationToAllUsers,
    NotificationPayload
} from "@/lib/NotificationSender";

interface BroadcastNotificationRequest {
    title: string;
    body: string;
    icon?: string;
    image?: string;
    url?: string;
    type?: "info" | "success" | "warning" | "error";
    tag?: string;
    requireInteraction?: boolean;
    data?: Record<string, string>;
}

export async function POST(req: NextRequest) {
    try {
        const body: BroadcastNotificationRequest = await req.json();

        if (!body.title || !body.body) {
            return NextResponse.json(
                { error: "title and body are required" },
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

        const result = await sendNotificationToAllUsers(payload);

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error("[API /api/notifications/broadcast] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to send notification" },
            { status: 500 }
        );
    }
}
