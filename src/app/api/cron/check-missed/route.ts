import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
    // Verify Cron Secret (Optional but recommended)
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new Response('Unauthorized', { status: 401 });
    // }

    try {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA');

        // 1. Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

        // 2. Get all active participants
        const participantsRef = adminDb.collection("challenge_participants");
        const snapshot = await participantsRef.where("is_active", "==", true).get();

        if (snapshot.empty) {
            return NextResponse.json({ message: "No active participants found" });
        }

        let processedCount = 0;

        for (const pDoc of snapshot.docs) {
            const p = pDoc.data();
            const challengeId = p.challenge_id;
            const userId = p.user_id;

            // Fetch Challenge Details
            const challengeRef = adminDb.collection("challenges").doc(challengeId);
            const challengeSnap = await challengeRef.get();

            if (!challengeSnap.exists) continue;
            const challenge = challengeSnap.data();

            // Determine Start Date (Max of Joined Date or Challenge Start Date)
            let startDate = new Date(p.created_at);
            startDate.setHours(0, 0, 0, 0);

            if (challenge?.start_date) {
                const challengeStart = new Date(challenge.start_date);
                // challengeStart is usually UTC 00:00 from YYYY-MM-DD parsing
                // Adjust for local timezone consistency if needed, but usually YYYY-MM-DD is safe
                // Actually, let's just rely on string comparison or normalized dates
                // If we use the existing logic's startDate, it was:
                // let startDate = new Date(p.created_at);
                // ...
            }

            // SIMPLIFIED LOGIC: Only check yesterday
            const datesToCheck: string[] = [];

            // Ensure yesterday is within the valid range for this user
            // 1. Check if yesterday >= User Join Date (normalized)
            const userJoinDate = new Date(p.created_at);
            userJoinDate.setHours(0, 0, 0, 0);

            // 2. Check if yesterday >= Challenge Start Date
            let isAfterStart = true;
            if (challenge?.start_date) {
                const challengeStart = new Date(challenge.start_date);
                // Fix: Parse YYYY-MM-DD explicitly to avoid timezone shifts if needed, 
                // but new Date('YYYY-MM-DD') is UTC. 
                // yesterday is local time derived. 
                // Let's compare strings YYYY-MM-DD to be safe and simple.
                if (yesterdayStr < challenge.start_date) isAfterStart = false;
            }

            // 3. Check if yesterday <= Challenge End Date
            let isBeforeEnd = true;
            if (challenge?.end_date) {
                if (yesterdayStr > challenge.end_date) isBeforeEnd = false;
            }

            // 4. Check if yesterday >= User Join Date (string comparison)
            const userJoinDateStr = userJoinDate.toLocaleDateString('en-CA');
            const isAfterJoin = yesterdayStr >= userJoinDateStr;

            if (isAfterStart && isBeforeEnd && isAfterJoin) {
                datesToCheck.push(yesterdayStr);
            }

            for (const dateStr of datesToCheck) {
                // Check if this date is a REST DAY
                const checkDate = new Date(dateStr);
                const dayOfWeek = checkDate.getDay(); // 0 = Sunday, 6 = Saturday
                if (challenge?.rest_days && challenge.rest_days.includes(dayOfWeek)) {
                    continue; // Skip rest days
                }

                // Check if we already have a history entry for this date (Idempotency Check)
                // This prevents double deduction if daily_logs are missing but points were already deducted
                const alreadyProcessed = p.points_history?.some((h: any) => h.date === dateStr);
                if (alreadyProcessed) {
                    console.log(`Skipping ${dateStr} for user ${userId} - already in history`);
                    continue;
                }

                // Check if a log exists for this date (completed OR missed)
                const logsRef = adminDb.collection("daily_logs");
                const logSnap = await logsRef
                    .where("challenge_id", "==", challengeId)
                    .where("user_id", "==", userId)
                    .where("date", "==", dateStr)
                    .get();

                if (logSnap.empty) {
                    // MISSED!
                    console.log(`User ${userId} missed challenge ${challengeId} on ${dateStr}`);

                    // A. Create 'missed' log
                    await adminDb.collection("daily_logs").add({
                        challenge_id: challengeId,
                        user_id: userId,
                        date: dateStr,
                        status: "missed",
                        verified: false,
                        created_at: new Date().toISOString()
                    });

                    // B. Deduct Points & Reset Streak
                    const penalty = 100;
                    const newPoints = p.current_points - penalty;

                    // Update local participant object to reflect deduction for next iteration if needed
                    // (Though usually we just update DB. But if we process multiple days for same user, we should be careful about race conditions on 'current_points' if we read it once.
                    // Actually, we are reading p.current_points from the initial snapshot.
                    // If we deduct twice in one run, we need to update our local 'p.current_points' tracker.)
                    p.current_points = newPoints;

                    await pDoc.ref.update({
                        current_points: newPoints,
                        streak_current: 0,
                        points_history: FieldValue.arrayUnion({ date: dateStr, points: newPoints, taskStatus: 'missed' })
                    });

                    // C. Update Profile (Total Lost / Treat Pool)
                    const profileRef = adminDb.collection("profiles").doc(userId);
                    const profileSnap = await profileRef.get();

                    if (profileSnap.exists) {
                        const profile = profileSnap.data();
                        await profileRef.update({
                            total_lost: (profile?.total_lost) + penalty,
                            current_points: (profile?.current_points) - penalty,
                            points_history: FieldValue.arrayUnion({
                                date: dateStr,
                                points: (profile?.current_points) - penalty,
                                taskStatus: 'missed'
                            })
                        });
                    }
                    processedCount++;
                }
            }
        }

        return NextResponse.json({ success: true, processed: processedCount });
    } catch (error: any) {
        console.error("Cron Job Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
