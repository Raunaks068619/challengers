"use server";

import redis from "@/lib/redis";

export interface Notification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    created_at: number;
    read: boolean;
}

const NOTIFICATION_TTL = 60 * 60 * 24 * 7; // 7 days

export async function getNotifications(userId: string): Promise<Notification[]> {
    if (!redis) return [];

    try {
        const key = `notifications:${userId}`;
        const rawNotifications = await redis.lrange(key, 0, -1);

        return rawNotifications.map(n => JSON.parse(n));
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return [];
    }
}

export async function addNotification(userId: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    if (!redis) return;

    try {
        const key = `notifications:${userId}`;
        const notification: Notification = {
            id: Math.random().toString(36).substring(7),
            message,
            type,
            created_at: Date.now(),
            read: false
        };

        await redis.lpush(key, JSON.stringify(notification));

        // Calculate seconds until midnight (23:59:59)
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(23, 59, 59, 999);
        const ttlSeconds = Math.floor((midnight.getTime() - now.getTime()) / 1000);

        // Ensure at least a minimum TTL (e.g. 1 minute) just in case
        const finalTTL = Math.max(60, ttlSeconds);

        await redis.expire(key, finalTTL);

        return notification;
    } catch (error) {
        console.error("Error adding notification:", error);
    }
}

export async function markAllRead(userId: string) {
    // For a simple list implementation, marking specific items as read in a Redis List is tricky (requires read-modify-write).
    // For now, we'll just clear the list or we could implement a separate "read" set.
    // Given the request for ephemeral notifications, we might just leave them as is or clear them.
    // Let's implement a "Clear All" for now as it's safer with Lists.
    if (!redis) return;

    try {
        const key = `notifications:${userId}`;
        await redis.del(key);
    } catch (error) {
        console.error("Error clearing notifications:", error);
    }
}
