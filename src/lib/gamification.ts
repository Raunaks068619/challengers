import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, addDoc, arrayUnion } from "firebase/firestore";
import { toast } from "sonner";

export const checkMissedLogs = async (userId: string) => {
    try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // 1. Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // 2. Get all active challenges for the user
        const participantsRef = collection(db, "challenge_participants");
        const q = query(
            participantsRef,
            where("user_id", "==", userId),
            where("is_active", "==", true)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) return;

        for (const pDoc of querySnapshot.docs) {
            const p = pDoc.data();
            const challengeId = p.challenge_id;

            // Fetch Challenge Details
            const challengeRef = doc(db, "challenges", challengeId);
            const challengeSnap = await getDoc(challengeRef);

            if (!challengeSnap.exists()) continue;
            const challenge = challengeSnap.data();

            // Dates to check: Yesterday AND Today (if time window passed)
            const datesToCheck = [yesterdayStr];

            // Check if we should check TODAY based on time window
            if (challenge.time_window_end) {
                const [endHour, endMinute] = challenge.time_window_end.split(':').map(Number);
                const windowEnd = new Date();
                windowEnd.setHours(endHour, endMinute, 0, 0);

                if (now > windowEnd) {
                    datesToCheck.push(todayStr);
                }
            }

            for (const dateStr of datesToCheck) {
                // Skip if user joined AFTER this date
                const joinedDate = new Date(p.created_at).toISOString().split('T')[0];
                if (joinedDate > dateStr) continue;

                // Skip if challenge started AFTER this date
                if (challenge.start_date) {
                    const startDate = new Date(challenge.start_date).toISOString().split('T')[0];
                    if (startDate > dateStr) continue;
                }

                // Check if a log exists for this date
                const logsRef = collection(db, "daily_logs");
                const logQuery = query(
                    logsRef,
                    where("challenge_id", "==", challengeId),
                    where("user_id", "==", userId),
                    where("date", "==", dateStr)
                );
                const logSnap = await getDocs(logQuery);

                if (logSnap.empty) {
                    // MISSED!
                    console.log(`User ${userId} missed challenge ${challengeId} on ${dateStr}`);

                    // A. Create 'missed' log
                    await addDoc(collection(db, "daily_logs"), {
                        challenge_id: challengeId,
                        user_id: userId,
                        date: dateStr,
                        status: "missed",
                        verified: false,
                        created_at: new Date().toISOString()
                    });

                    // B. Deduct Points & Reset Streak
                    const penalty = 100;
                    const newPoints = (p.current_points || 0) - penalty;

                    await updateDoc(pDoc.ref, {
                        current_points: newPoints,
                        streak_current: 0,
                        points_history: arrayUnion({ date: dateStr, points: newPoints, taskStatus: 'missed' })
                    });

                    // C. Update Profile (Total Lost / Treat Pool)
                    const profileRef = doc(db, "profiles", userId);
                    const profileSnap = await getDoc(profileRef);

                    if (profileSnap.exists()) {
                        const profile = profileSnap.data();
                        await updateDoc(profileRef, {
                            total_lost: (profile.total_lost || 0) + penalty,
                            current_points: (profile.current_points || 0) - penalty
                        });
                    }

                    toast.error(`Missed task on ${dateStr === todayStr ? 'today' : 'yesterday'}! -${penalty} pts`);
                }
            }
        }
    } catch (error) {
        console.error("Error checking missed logs:", error);
    }
};
