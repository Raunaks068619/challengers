import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    try {
        const results: any[] = [];

        // 1. Fix Challenge Participants
        const participantsSnap = await adminDb.collection("challenge_participants").get();

        for (const doc of participantsSnap.docs) {
            const p = doc.data();
            const history = p.points_history || [];

            if (!Array.isArray(history) || history.length === 0) continue;

            const seenMissed = new Set();
            let hasDuplicates = false;

            // Filter duplicates
            // Strategy: Iterate through the array in order.
            // Since new duplicates are appended to the end (recent), 
            // keeping the FIRST occurrence and dropping subsequent ones effectively deletes the recent duplicates.
            const newHistory = history.filter((h: any) => {
                if (h.taskStatus === 'missed') {
                    if (seenMissed.has(h.date)) {
                        hasDuplicates = true;
                        // This is a subsequent (recent) duplicate for this date -> DELETE IT
                        return false;
                    }
                    seenMissed.add(h.date);
                }
                return true;
            });

            if (hasDuplicates) {
                // Recalculate current points from the last entry of the fixed history
                // Sort by date to be safe, though usually appended
                newHistory.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                const lastEntry = newHistory[newHistory.length - 1];
                const newCurrentPoints = lastEntry.points;

                await doc.ref.update({
                    points_history: newHistory,
                    current_points: newCurrentPoints
                });

                results.push({
                    type: 'participant',
                    id: doc.id,
                    userId: p.user_id,
                    oldPoints: p.current_points,
                    newPoints: newCurrentPoints,
                    removedCount: history.length - newHistory.length
                });
            }
        }

        // 2. Fix User Profiles
        const profilesSnap = await adminDb.collection("profiles").get();

        for (const doc of profilesSnap.docs) {
            const p = doc.data();
            const history = p.points_history || [];

            if (!Array.isArray(history) || history.length === 0) continue;

            const seenMissed = new Set();
            let hasDuplicates = false;

            const newHistory = history.filter((h: any) => {
                if (h.taskStatus === 'missed') {
                    if (seenMissed.has(h.date)) {
                        hasDuplicates = true;
                        return false;
                    }
                    seenMissed.add(h.date);
                }
                return true;
            });

            if (hasDuplicates) {
                newHistory.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                const lastEntry = newHistory[newHistory.length - 1];
                const newCurrentPoints = lastEntry.points;
                const removedCount = history.length - newHistory.length;
                const pointsRestored = removedCount * 100; // Assuming 100 pts per missed deduction

                await doc.ref.update({
                    points_history: newHistory,
                    current_points: newCurrentPoints,
                    total_lost: (p.total_lost || 0) - pointsRestored
                });

                results.push({
                    type: 'profile',
                    id: doc.id,
                    oldPoints: p.current_points,
                    newPoints: newCurrentPoints,
                    oldTotalLost: p.total_lost,
                    newTotalLost: (p.total_lost || 0) - pointsRestored,
                    removedCount: removedCount
                });
            }
        }

        return NextResponse.json({ success: true, fixed: results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
