"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore";

export default function BackfillPage() {
    const [status, setStatus] = useState("Idle");

    const runBackfill = async () => {
        setStatus("Running...");
        try {
            const userIds = [
                "hLyBplyAL2QN2rAqwTAFKZQciti2", // Raunak
                "aUeAVWa0OZV981jsQn6y67DvygB3"  // Vedarth
            ];

            const history = [
                { date: "2025-12-04", points: 500, taskStatus: 'completed' },
                { date: "2025-12-05", points: 400, taskStatus: 'missed' },
                { date: "2025-12-06", points: 300, taskStatus: 'missed' }
            ];

            for (const uid of userIds) {
                // Find participant doc
                const q = query(collection(db, "challenge_participants"), where("user_id", "==", uid));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    // Update all challenges for this user
                    for (const d of snap.docs) {
                        await updateDoc(d.ref, {
                            current_points: 300,
                            points_history: history,
                            streak_current: 0 // Reset streak as they missed days
                        });
                        console.log(`Updated user ${uid} doc ${d.id}`);
                    }
                } else {
                    console.warn(`No participant doc found for ${uid}`);
                }
            }

            setStatus("Done! Check console for details.");
        } catch (e: any) {
            console.error(e);
            setStatus("Error: " + e.message);
        }
    };

    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold mb-4">Backfill Data (With TaskStatus)</h1>
            <button
                onClick={runBackfill}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Run Backfill
            </button>
            <pre className="mt-4 p-4 bg-gray-100 rounded">{status}</pre>
        </div>
    );
}
