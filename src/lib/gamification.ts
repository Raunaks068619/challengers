import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, addDoc } from "firebase/firestore";
import { toast } from "sonner";

export const checkMissedLogs = async (userId: string) => {
    try {
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

            // Check if user joined AFTER yesterday
            const joinedDate = new Date(p.created_at).toISOString().split('T')[0];
            if (joinedDate > yesterdayStr) continue;

            // Check if challenge started AFTER yesterday
            const challengeRef = doc(db, "challenges", challengeId);
            const challengeSnap = await getDoc(challengeRef);

            if (challengeSnap.exists()) {
                const challenge = challengeSnap.data();
                if (challenge.start_date) {
                    const startDate = new Date(challenge.start_date).toISOString().split('T')[0];
                    if (startDate > yesterdayStr) continue;
                }
            }

            // 3. Check if a log exists for yesterday
            const logsRef = collection(db, "daily_logs");
            const logQuery = query(
                logsRef,
                where("challenge_id", "==", challengeId),
                where("user_id", "==", userId),
                where("date", "==", yesterdayStr)
            );
            const logSnap = await getDocs(logQuery);

            if (logSnap.empty) {
                // MISSED!
                console.log(`User ${userId} missed challenge ${challengeId} on ${yesterdayStr}`);

                // A. Create 'missed' log
                await addDoc(collection(db, "daily_logs"), {
                    challenge_id: challengeId,
                    user_id: userId,
                    date: yesterdayStr,
                    status: "missed",
                    verified: false
                });

                // B. Deduct Points & Reset Streak
                const penalty = 100;
                const newPoints = (p.current_points || 0) - penalty;

                await updateDoc(pDoc.ref, {
                    current_points: newPoints,
                    streak_current: 0
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

                toast.error(`Missed task yesterday! -${penalty} pts`);
            }
        }
    } catch (error) {
        console.error("Error checking missed logs:", error);
    }
};
