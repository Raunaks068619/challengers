import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    try {
        // Create Mock Challenge
        const challengeId = "mock_challenge_nov_dec_2025";
        const userId = "mock_user_daily_checkin";
        const startDate = new Date("2025-11-20");
        const endDate = new Date("2025-12-10");
        const mockImageUrl = "https://wxsnybwtpeybrefpbgke.supabase.co/storage/v1/object/public/challengers/checkins/GAATTmhbaUkhsedoZUt3/hLyBplyAL2QN2rAqwTAFKZQciti2-1765241802122.jpg";

        // 1. Create Challenge
        await adminDb.collection("challenges").doc(challengeId).set({
            title: "Mock 21-Day Consistency Challenge",
            description: "A mock challenge for testing the Memory calendar feature",
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            created_at: startDate.toISOString(),
            created_by: userId,
            participants: [userId],
            location_required: false,
            is_active: true
        });

        // 2. Create Mock User Profile (skip if using real user)
        // await adminDb.collection("profiles").doc(userId).set({
        //     user_id: userId,
        //     email: "mockuser@example.com",
        //     display_name: "Mock Daily User",
        //     photo_url: mockImageUrl,
        //     current_points: 0,
        //     total_lost: 0,
        //     points_history: [],
        //     created_at: startDate.toISOString()
        // });

        // 3. Create Challenge Participant
        await adminDb.collection("challenge_participants").add({
            challenge_id: challengeId,
            user_id: userId,
            current_points: 0,
            current_streak: 0,
            max_streak: 0,
            is_active: true,
            joined_at: startDate.toISOString(),
            points_history: []
        });

        // 4. Generate daily logs for every day from Nov 20 to Dec 10
        const dailyLogs = [];
        const currentDate = new Date(startDate);
        let streak = 0;
        let totalPoints = 0;
        const pointsPerDay = 50; // Standard check-in points

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            streak++;
            totalPoints += pointsPerDay;

            // Create daily log
            await adminDb.collection("daily_logs").add({
                challenge_id: challengeId,
                user_id: userId,
                date: dateStr,
                status: "completed",
                proof_url: mockImageUrl,
                points: pointsPerDay,
                streak: streak,
                verified: true,
                created_at: new Date(currentDate.getTime() + 12 * 60 * 60 * 1000).toISOString(), // Noon on that day
                note: `Check-in for day ${streak}`
            });

            dailyLogs.push({
                date: dateStr,
                points: pointsPerDay,
                streak: streak
            });

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // 5. Update participant with final stats
        const participantSnap = await adminDb
            .collection("challenge_participants")
            .where("challenge_id", "==", challengeId)
            .where("user_id", "==", userId)
            .get();

        if (!participantSnap.empty) {
            const participantDoc = participantSnap.docs[0];
            await participantDoc.ref.update({
                current_points: totalPoints,
                current_streak: streak,
                max_streak: streak,
                points_history: dailyLogs.map((log, idx) => ({
                    date: log.date,
                    points: totalPoints - (dailyLogs.length - idx - 1) * pointsPerDay,
                    delta: pointsPerDay,
                    taskStatus: "completed"
                }))
            });
        }

        // 6. Update user profile with final stats (skip if using real user)
        // await adminDb.collection("profiles").doc(userId).update({
        //     current_points: totalPoints,
        //     points_history: dailyLogs.map((log, idx) => ({
        //         date: log.date,
        //         points: totalPoints - (dailyLogs.length - idx - 1) * pointsPerDay,
        //         delta: pointsPerDay,
        //         taskStatus: "completed"
        //     }))
        // });

        return NextResponse.json({
            success: true,
            message: "Mock challenge created successfully!",
            data: {
                challengeId,
                userId,
                totalDays: dailyLogs.length,
                finalPoints: totalPoints,
                finalStreak: streak,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                dailyLogs
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const challengeId = "mock_challenge_nov_dec_2025";
        const userId = "mock_user_daily_checkin";

        const deletedItems = {
            challenge: 0,
            participants: 0,
            dailyLogs: 0
        };

        // 1. Delete Challenge
        const challengeDoc = await adminDb.collection("challenges").doc(challengeId).get();
        if (challengeDoc.exists) {
            await challengeDoc.ref.delete();
            deletedItems.challenge = 1;
        }

        // 2. Delete Challenge Participants
        const participantsSnap = await adminDb
            .collection("challenge_participants")
            .where("challenge_id", "==", challengeId)
            .get();

        for (const doc of participantsSnap.docs) {
            await doc.ref.delete();
            deletedItems.participants++;
        }

        // 3. Delete All Daily Logs for this challenge
        const logsSnap = await adminDb
            .collection("daily_logs")
            .where("challenge_id", "==", challengeId)
            .get();

        for (const doc of logsSnap.docs) {
            await doc.ref.delete();
            deletedItems.dailyLogs++;
        }

        return NextResponse.json({
            success: true,
            message: "Mock challenge data deleted successfully!",
            deleted: deletedItems
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
