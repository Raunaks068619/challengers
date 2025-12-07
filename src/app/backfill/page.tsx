"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";

export default function BackfillPage() {
    const [status, setStatus] = useState("Idle");

    const runBackfill = async () => {
        setStatus("Running Reset & Backfill...");
        try {
            const userIds = [
                "hLyBplyAL2QN2rAqwTAFKZQciti2", // Raunak
                "aUeAVWa0OZV981jsQn6y67DvygB3"  // Vedarth
            ];

            // Target History:
            // Rule: No points for completion unless 3-day streak.
            // Start: 500
            // Thu Dec 04: Completed (No change) -> 500
            // Fri Dec 05: Missed (-100)         -> 400
            // Sat Dec 06: Missed (-100)         -> 300
            // Sun Dec 07: Completed (No change) -> 300
            const history = [
                { date: "2025-12-04", points: 500, taskStatus: 'completed' },
                { date: "2025-12-05", points: 400, taskStatus: 'missed' },
                { date: "2025-12-06", points: 300, taskStatus: 'missed' },
                { date: "2025-12-07", points: 300, taskStatus: 'completed' }
            ];

            const batch = writeBatch(db);

            for (const uid of userIds) {
                console.log(`Processing user ${uid}...`);

                // 1. Update Challenge Participants
                const partQuery = query(collection(db, "challenge_participants"), where("user_id", "==", uid));
                const partSnap = await getDocs(partQuery);

                let challengeIds: string[] = [];

                partSnap.forEach((d) => {
                    challengeIds.push(d.data().challenge_id);
                    batch.update(d.ref, {
                        current_points: 300,
                        points_history: history,
                        streak_current: 1 // Completed today (Sun)
                    });
                });

                // 2. Update Profile
                const profileRef = doc(db, "profiles", uid);
                batch.update(profileRef, {
                    current_points: 300,
                    total_lost: 200 // Missed Fri & Sat (100 each)
                });

                // 3. Recreate Daily Logs
                // First, find existing logs for these dates to delete (to avoid duplicates)
                const dates = history.map(h => h.date);
                const logsQuery = query(
                    collection(db, "daily_logs"),
                    where("user_id", "==", uid),
                    where("date", "in", dates)
                );
                const logsSnap = await getDocs(logsQuery);
                logsSnap.forEach((d) => {
                    batch.delete(d.ref);
                });

                // Create new logs
                for (const h of history) {
                    // Create a log for EACH active challenge the user is in
                    for (const cid of challengeIds) {
                        const newLogRef = doc(collection(db, "daily_logs"));
                        batch.set(newLogRef, {
                            challenge_id: cid,
                            user_id: uid,
                            date: h.date,
                            status: h.taskStatus,
                            verified: h.taskStatus === 'completed',
                            created_at: new Date().toISOString(),
                            // Add image/caption for completed tasks if needed, but keeping it simple
                            caption: h.taskStatus === 'completed' ? "Backfilled Check-in" : null
                        });
                    }
                }
            }

            await batch.commit();
            setStatus("Success! Reset points and backfilled history.");
        } catch (e: unknown) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            setStatus("Error: " + errorMessage);
        }
    };

    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold mb-4">Reset & Backfill Data</h1>
            <p className="mb-4 text-gray-600">
                Resets points to 0. Sets history: Thu(Comp), Fri(Miss), Sat(Miss), Sun(Comp).
            </p>
            <button
                onClick={runBackfill}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
                Run Reset & Backfill
            </button>
            <pre className="mt-4 p-4 bg-gray-100 rounded">{status}</pre>
        </div>
    );
}
