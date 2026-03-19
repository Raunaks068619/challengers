import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotificationToUser } from "@/lib/NotificationSender";

export async function GET(req: NextRequest) {
    // Verify Cron Secret to prevent unauthorized invocations
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const now = new Date();

        // Yesterday in YYYY-MM-DD (local time via en-CA locale)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

        // Get all active participants
        const snapshot = await adminDb
            .collection("challenge_participants")
            .where("is_active", "==", true)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ message: "No active participants found" });
        }

        let processedCount = 0;

        // Use Promise.all for parallel processing per participant
        await Promise.all(snapshot.docs.map(async (pDoc) => {
            const p = pDoc.data();
            const { challenge_id: challengeId, user_id: userId } = p;

            // Fetch challenge details
            const challengeSnap = await adminDb.collection("challenges").doc(challengeId).get();
            if (!challengeSnap.exists) return;
            const challenge = challengeSnap.data()!;

            // Validate date range for yesterday
            const challengeStartDate = challenge.start_date as string | undefined;
            const challengeEndDate = challenge.end_date as string | undefined;

            if (challengeStartDate && yesterdayStr < challengeStartDate) return;
            if (challengeEndDate && yesterdayStr > challengeEndDate) return;

            const userJoinDate = new Date(p.created_at);
            userJoinDate.setHours(0, 0, 0, 0);
            const userJoinDateStr = userJoinDate.toLocaleDateString('en-CA');
            if (yesterdayStr < userJoinDateStr) return;

            // Skip rest days
            const checkDate = new Date(yesterdayStr);
            const dayOfWeek = checkDate.getDay();
            if (challenge.rest_days?.includes(dayOfWeek)) return;

            // Idempotency: skip if yesterday already has a points_history entry
            const alreadyProcessed = p.points_history?.some((h: any) => h.date === yesterdayStr);
            if (alreadyProcessed) {
                console.log(`Skipping ${yesterdayStr} for user ${userId} in ${challengeId} — already processed`);
                return;
            }

            // Check if a completed log exists for yesterday
            const logSnap = await adminDb.collection("daily_logs")
                .where("challenge_id", "==", challengeId)
                .where("user_id", "==", userId)
                .where("date", "==", yesterdayStr)
                .get();

            if (!logSnap.empty) return; // User checked in — nothing to do

            // === MISSED DAY ===
            console.log(`User ${userId} missed challenge ${challengeId} on ${yesterdayStr}`);

            const penalty = 100;
            const newPoints = (p.current_points ?? 0) - penalty;

            // A. Create 'missed' daily_log so the calendar/memory view shows it
            await adminDb.collection("daily_logs").add({
                challenge_id: challengeId,
                user_id: userId,
                date: yesterdayStr,
                status: "missed",
                verified: false,
                created_at: now.toISOString()
            });

            // B. Deduct points & reset streak on participant
            await pDoc.ref.update({
                current_points: newPoints,
                streak_current: 0,
                points_history: FieldValue.arrayUnion({
                    date: yesterdayStr,
                    points: newPoints,
                    taskStatus: 'missed'
                })
            });

            // C. Update global profile points
            const profileRef = adminDb.collection("profiles").doc(userId);
            const profileSnap = await profileRef.get();
            if (profileSnap.exists) {
                const profile = profileSnap.data()!;
                const profilePoints = (profile.current_points ?? 0) - penalty;
                await profileRef.update({
                    total_lost: FieldValue.increment(penalty),
                    current_points: profilePoints,
                    points_history: FieldValue.arrayUnion({
                        date: yesterdayStr,
                        points: profilePoints,
                        taskStatus: 'missed'
                    })
                });
            }

            // D. Push notification to the user
            try {
                const challengeTitle = challenge.title || "your challenge";
                await sendNotificationToUser(userId, {
                    title: "You missed yesterday's check-in 😔",
                    body: `You missed "${challengeTitle}" on ${yesterdayStr}. -${penalty} points. Keep going — streaks can be rebuilt!`,
                    url: `/challenges/${challengeId}`,
                    type: "warning",
                    tag: `missed-${challengeId}-${yesterdayStr}`,
                    requireInteraction: false
                });
            } catch (notifError) {
                // Notification failure must not block the points update
                console.warn(`[check-missed] Failed to notify user ${userId}:`, notifError);
            }

            processedCount++;
        }));

        return NextResponse.json({ success: true, processed: processedCount });
    } catch (error: any) {
        console.error("[check-missed] Cron job error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
