import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendNotificationToUser } from "@/lib/NotificationSender";

/**
 * GET /api/cron/geo-reminder
 *
 * Runs every 10 minutes (via pg_cron).
 *
 * For every active challenge that requires_location:
 *   1. Fetches participants who haven't checked in today
 *   2. Reads each user's lastLocation from their profile (stored by useGeolocation hook)
 *   3. If the user is within the challenge geo-fence → sends a
 *      "You're nearby — check in now!" push notification
 *
 * This is separate from the time-window reminder (send-reminders) which fires
 * 15 minutes before a scheduled window opens. Geo-reminders fire whenever the
 * user is physically present, regardless of the clock.
 *
 * Idempotency: uses geo_reminder_sent_dates on challenge_participants (same
 * pattern as reminder_sent_dates) to avoid spamming the same user twice a day.
 */

/** Haversine distance in metres */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface GeoFence {
    lat: number;
    lng: number;
    radius: number;
    address?: string;
}

function isWithinAnyFence(
    userLat: number,
    userLng: number,
    fences: GeoFence[]
): { matched: boolean; fence: GeoFence | null; distanceM: number } {
    let closestDist = Infinity;
    for (const fence of fences) {
        const dist = haversineDistance(userLat, userLng, fence.lat, fence.lng);
        if (dist <= fence.radius) {
            return { matched: true, fence, distanceM: Math.round(dist) };
        }
        if (dist < closestDist) closestDist = dist;
    }
    return { matched: false, fence: null, distanceM: Math.round(closestDist) };
}

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const now = new Date();
        const todayStr = now.toLocaleDateString("en-CA"); // YYYY-MM-DD

        // Only send geo-reminders between 06:00 and 23:00 local server time
        const hour = now.getHours();
        if (hour < 6 || hour >= 23) {
            return NextResponse.json({ message: "Outside active hours", reminders: 0 });
        }

        // Fetch all active challenges that require a location check-in
        const challengesSnap = await adminDb
            .collection("challenges")
            .where("status", "==", "active")
            .where("requires_location", "==", true)
            .get();

        if (challengesSnap.empty) {
            return NextResponse.json({ message: "No location-based challenges", reminders: 0 });
        }

        let remindersSent = 0;

        await Promise.all(
            challengesSnap.docs.map(async (challengeDoc) => {
                const challenge = challengeDoc.data();
                const challengeId = challengeDoc.id;

                // Challenge date range check
                if (challenge.start_date && todayStr < challenge.start_date) return;
                if (challenge.end_date && todayStr > challenge.end_date) return;

                // Skip rest days
                const dayOfWeek = now.getDay();
                if (challenge.rest_days?.includes(dayOfWeek)) return;

                // Build geo-fence list from challenge data
                const fences: GeoFence[] = [];
                if (Array.isArray(challenge.locations) && challenge.locations.length > 0) {
                    fences.push(...challenge.locations);
                } else if (challenge.location_lat != null && challenge.location_lng != null) {
                    fences.push({
                        lat: challenge.location_lat,
                        lng: challenge.location_lng,
                        radius: challenge.location_radius ?? 100
                    });
                }
                if (fences.length === 0) return; // No fences configured

                // Fetch active participants who haven't already received a geo-reminder today
                const participantsSnap = await adminDb
                    .collection("challenge_participants")
                    .where("challenge_id", "==", challengeId)
                    .where("is_active", "==", true)
                    .get();

                await Promise.all(
                    participantsSnap.docs.map(async (pDoc) => {
                        const p = pDoc.data();
                        const userId = p.user_id;

                        // Idempotency: one geo-reminder per user per challenge per day
                        const alreadyReminded = p.geo_reminder_sent_dates?.includes(todayStr);
                        if (alreadyReminded) return;

                        // Skip if already checked in today
                        const logSnap = await adminDb
                            .collection("daily_logs")
                            .where("challenge_id", "==", challengeId)
                            .where("user_id", "==", userId)
                            .where("date", "==", todayStr)
                            .limit(1)
                            .get();
                        if (!logSnap.empty) return;

                        // Read user's last known location from their profile
                        const profileSnap = await adminDb.collection("profiles").doc(userId).get();
                        if (!profileSnap.exists) return;

                        const profile = profileSnap.data()!;
                        const lastLocation = profile.lastLocation as
                            | { lat: number; lng: number; updatedAt: string }
                            | undefined;

                        if (!lastLocation?.lat || !lastLocation?.lng) return;

                        // Reject stale location data (older than 30 minutes)
                        const locationAge =
                            (Date.now() - new Date(lastLocation.updatedAt).getTime()) / 60_000;
                        if (locationAge > 30) return;

                        // Check geo-fence
                        const { matched, fence, distanceM } = isWithinAnyFence(
                            lastLocation.lat,
                            lastLocation.lng,
                            fences
                        );
                        if (!matched) return;

                        // Mark as reminded before sending (prevents double-send on retry)
                        await pDoc.ref.update({
                            geo_reminder_sent_dates: [
                                ...(p.geo_reminder_sent_dates || []).slice(-29),
                                todayStr
                            ]
                        });

                        // Send proximity notification
                        try {
                            const placeName = fence?.address
                                ? `near ${fence.address}`
                                : `${distanceM}m from your check-in spot`;

                            const streakMsg =
                                p.streak_current > 0
                                    ? ` Keep your ${p.streak_current}-day streak alive!`
                                    : "";

                            await sendNotificationToUser(userId, {
                                title: `📍 You're ${placeName}`,
                                body: `Time to check in for "${challenge.title}".${streakMsg}`,
                                url: `/challenges/${challengeId}`,
                                type: "info",
                                tag: `geo-reminder-${challengeId}-${todayStr}`,
                                requireInteraction: true
                            });

                            remindersSent++;
                            console.log(
                                `[geo-reminder] Notified user ${userId} for challenge ${challengeId} (${distanceM}m from fence)`
                            );
                        } catch (notifError) {
                            // Roll back sent marker so it can retry
                            await pDoc.ref.update({
                                geo_reminder_sent_dates: (
                                    p.geo_reminder_sent_dates || []
                                ).filter((d: string) => d !== todayStr)
                            });
                            console.warn(
                                `[geo-reminder] Failed to notify user ${userId}:`,
                                notifError
                            );
                        }
                    })
                );
            })
        );

        return NextResponse.json({ success: true, reminders: remindersSent });
    } catch (error: any) {
        console.error("[geo-reminder] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
