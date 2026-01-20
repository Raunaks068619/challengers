import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import redis from "@/lib/redis";
import { sendNotificationToUser, NotificationPayload } from "@/lib/NotificationSender";

/**
 * Cron endpoint to send challenge reminders
 * - Time-bound challenges: 15 minutes before start
 * - Non-time-bound challenges: 10 AM daily
 * - Skips rest days
 * - Uses Redis to prevent duplicate notifications
 */
export async function GET(req: NextRequest) {
    // Optional: Verify cron secret
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const dayOfWeek = now.getDay(); // 0 = Sunday

        console.log(`[Cron] Running at ${todayStr} ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);

        // Get all active challenges
        const challengesRef = adminDb.collection("challenges");
        const challengesSnap = await challengesRef.where("status", "==", "active").get();

        if (challengesSnap.empty) {
            return NextResponse.json({ message: "No active challenges", sent: 0 });
        }

        let sentCount = 0;
        let skippedCount = 0;

        for (const challengeDoc of challengesSnap.docs) {
            const challenge = { id: challengeDoc.id, ...challengeDoc.data() } as any;

            // Skip if today is a rest day
            if (challenge.rest_days?.includes(dayOfWeek)) {
                console.log(`[Cron] Skipping ${challenge.title} - rest day`);
                continue;
            }

            // Check if challenge is within date range
            if (challenge.start_date && todayStr < challenge.start_date) continue;
            if (challenge.end_date && todayStr > challenge.end_date) continue;

            // Get participants for this challenge
            const participantsRef = adminDb.collection("challenge_participants");
            const participantsSnap = await participantsRef
                .where("challenge_id", "==", challenge.id)
                .where("is_active", "==", true)
                .get();

            if (participantsSnap.empty) continue;

            // Determine if we should send notification
            let shouldSend = false;
            let notificationType = "";
            let notificationPayload: NotificationPayload | null = null;

            if (challenge.time_window_start) {
                // TIME-BOUND: Send 15 minutes before start
                const [startH, startM] = challenge.time_window_start.split(':').map(Number);
                const reminderH = startM < 15 ? startH - 1 : startH;
                const reminderM = (startM - 15 + 60) % 60;

                // Check if current time is within 5-minute window of reminder time
                const currentTotalMin = currentHour * 60 + currentMinute;
                const reminderTotalMin = reminderH * 60 + reminderM;

                if (currentTotalMin >= reminderTotalMin && currentTotalMin < reminderTotalMin + 5) {
                    shouldSend = true;
                    notificationType = "15min";
                    notificationPayload = {
                        title: `⏰ ${challenge.title}`,
                        body: `Starts in 15 minutes! Get ready for your check-in.`,
                        url: `/challenges/${challenge.id}`,
                        type: "info",
                        tag: `challenge-${challenge.id}-15min`
                    };
                }
            } else {
                // NON-TIME-BOUND: Send at 10 AM
                if (currentHour === 10 && currentMinute < 5) {
                    shouldSend = true;
                    notificationType = "daily";
                    notificationPayload = {
                        title: `🔥 Daily Challenge`,
                        body: `Don't forget: ${challenge.title}`,
                        url: `/challenges/${challenge.id}`,
                        type: "info",
                        tag: `challenge-${challenge.id}-daily`
                    };
                }
            }

            if (!shouldSend || !notificationPayload) continue;

            // Send to each participant
            for (const participantDoc of participantsSnap.docs) {
                const participant = participantDoc.data();
                const userId = participant.user_id;

                // Check Redis to prevent duplicate
                const redisKey = `notif:${userId}:${challenge.id}:${todayStr}:${notificationType}`;

                if (redis) {
                    const alreadySent = await redis.exists(redisKey);
                    if (alreadySent) {
                        skippedCount++;
                        continue;
                    }
                }

                try {
                    const result = await sendNotificationToUser(userId, notificationPayload);

                    if (result.successCount > 0) {
                        sentCount++;
                        console.log(`[Cron] Sent ${notificationType} reminder to ${userId} for ${challenge.title}`);

                        // Mark as sent in Redis (24hr TTL)
                        if (redis) {
                            await redis.setex(redisKey, 86400, "1");
                        }
                    }
                } catch (error) {
                    console.error(`[Cron] Failed to send to ${userId}:`, error);
                }
            }
        }

        console.log(`[Cron] Complete. Sent: ${sentCount}, Skipped (already sent): ${skippedCount}`);

        return NextResponse.json({
            success: true,
            sent: sentCount,
            skipped: skippedCount,
            timestamp: now.toISOString()
        });
    } catch (error: any) {
        console.error("[Cron] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
