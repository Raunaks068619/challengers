import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendNotificationToUser } from "@/lib/NotificationSender";

/**
 * GET /api/cron/send-reminders
 *
 * Runs every minute (via Vercel cron or pg_cron → pg_net).
 * Finds challenges whose time_window_start falls within the next 15 minutes
 * and sends a reminder push notification to every active participant who
 * hasn't yet checked in today.
 *
 * Idempotency: uses a `reminder_sent_dates` array on each challenge_participant
 * document so we never send more than one reminder per user per challenge per day.
 */
export async function GET(req: NextRequest) {
    // Verify Cron Secret to prevent unauthorized invocations
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD

        // Window: challenges starting between now and now+15 minutes
        // We store time_window_start as "HH:MM" (24-hour, e.g. "07:30")
        const windowMinutes = 15;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const targetMinutes = nowMinutes + windowMinutes;

        // Format as "HH:MM" for comparison
        const targetHH = String(Math.floor(targetMinutes / 60) % 24).padStart(2, '0');
        const targetMM = String(targetMinutes % 60).padStart(2, '0');
        const targetTime = `${targetHH}:${targetMM}`;

        // Also allow a ±1 minute band so we don't miss challenges if the cron fires slightly late
        const bandStart = Math.max(0, targetMinutes - 1);
        const bandEnd = targetMinutes + 1;

        function minutesToTime(m: number): string {
            return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        }

        const timeRangeStart = minutesToTime(bandStart);
        const timeRangeEnd = minutesToTime(bandEnd);

        // Fetch all active challenges that are currently in range (start_date <= today <= end_date)
        // Firestore doesn't support range queries on two different fields easily, so we fetch
        // active challenges and filter by time window in-memory.
        const challengesSnap = await adminDb
            .collection("challenges")
            .where("status", "==", "active")
            .get();

        if (challengesSnap.empty) {
            return NextResponse.json({ message: "No active challenges", reminders: 0 });
        }

        let remindersSent = 0;

        await Promise.all(challengesSnap.docs.map(async (challengeDoc) => {
            const challenge = challengeDoc.data();
            const challengeId = challengeDoc.id;

            // Filter: challenge must be within its date range
            if (challenge.start_date && todayStr < challenge.start_date) return;
            if (challenge.end_date && todayStr > challenge.end_date) return;

            // Filter: challenge time_window_start must fall in our 15-min target band
            const windowStart: string | undefined = challenge.time_window_start;
            if (!windowStart) return;

            // Normalize to "HH:MM" — handle both "HH:MM" and "HH:MM:SS"
            const normalizedStart = windowStart.substring(0, 5);
            if (normalizedStart < timeRangeStart || normalizedStart > timeRangeEnd) return;

            // Skip rest days
            const dayOfWeek = now.getDay();
            if (challenge.rest_days?.includes(dayOfWeek)) return;

            // Get all active participants for this challenge
            const participantsSnap = await adminDb
                .collection("challenge_participants")
                .where("challenge_id", "==", challengeId)
                .where("is_active", "==", true)
                .get();

            await Promise.all(participantsSnap.docs.map(async (pDoc) => {
                const p = pDoc.data();
                const userId = p.user_id;

                // Idempotency: only send one reminder per user per challenge per day
                const alreadyReminded = p.reminder_sent_dates?.includes(todayStr);
                if (alreadyReminded) return;

                // Check if user already checked in today — no need to remind
                const logSnap = await adminDb.collection("daily_logs")
                    .where("challenge_id", "==", challengeId)
                    .where("user_id", "==", userId)
                    .where("date", "==", todayStr)
                    .limit(1)
                    .get();

                if (!logSnap.empty) return; // Already checked in today

                // Mark reminder as sent (before sending to avoid double-send on retry)
                await pDoc.ref.update({
                    reminder_sent_dates: [...(p.reminder_sent_dates || []).slice(-29), todayStr]
                });

                // Send the push notification
                try {
                    const windowEnd: string | undefined = challenge.time_window_end;
                    const timeInfo = windowEnd
                        ? `Opens at ${windowStart} – closes at ${windowEnd}`
                        : `Opens at ${windowStart}`;

                    await sendNotificationToUser(userId, {
                        title: `⏰ Time to check in — "${challenge.title}"`,
                        body: `Your challenge window opens in ~15 minutes. ${timeInfo}. Don't break your streak!`,
                        url: `/challenges/${challengeId}`,
                        type: "info",
                        tag: `reminder-${challengeId}-${todayStr}`,
                        requireInteraction: true
                    });

                    remindersSent++;
                    console.log(`[send-reminders] Reminded user ${userId} for challenge ${challengeId}`);
                } catch (notifError) {
                    // Roll back the sent marker so it can retry
                    await pDoc.ref.update({
                        reminder_sent_dates: (p.reminder_sent_dates || []).filter((d: string) => d !== todayStr)
                    });
                    console.warn(`[send-reminders] Failed to notify user ${userId}:`, notifError);
                }
            }));
        }));

        return NextResponse.json({ success: true, reminders: remindersSent });
    } catch (error: any) {
        console.error("[send-reminders] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
