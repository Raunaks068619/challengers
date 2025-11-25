import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const checkMissedLogs = async (userId: string) => {
    try {
        // 1. Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // 2. Get all active challenges for the user
        const { data: participations, error: pError } = await supabase
            .from("challenge_participants")
            .select("challenge_id, current_points, streak_current, created_at, challenges(start_date)")
            .eq("user_id", userId)
            .eq("is_active", true);

        if (pError || !participations) return;

        for (const p of participations) {
            // Check if user joined AFTER yesterday (e.g. joined today)
            // We compare the date strings to be safe (YYYY-MM-DD)
            const joinedDate = new Date(p.created_at).toISOString().split('T')[0];
            if (joinedDate > yesterdayStr) continue;

            // Check if challenge started AFTER yesterday
            // @ts-ignore - Supabase join types can be tricky
            const challenge = Array.isArray(p.challenges) ? p.challenges[0] : p.challenges;
            if (challenge?.start_date) {
                const startDate = new Date(challenge.start_date).toISOString().split('T')[0];
                if (startDate > yesterdayStr) continue;
            }

            // 3. Check if a log exists for yesterday
            const { data: log } = await supabase
                .from("daily_logs")
                .select("id")
                .eq("challenge_id", p.challenge_id)
                .eq("user_id", userId)
                .eq("date", yesterdayStr)
                .maybeSingle();

            if (!log) {
                // MISSED!
                console.log(`User ${userId} missed challenge ${p.challenge_id} on ${yesterdayStr}`);

                // A. Create 'missed' log
                await supabase.from("daily_logs").insert({
                    challenge_id: p.challenge_id,
                    user_id: userId,
                    date: yesterdayStr,
                    status: "missed",
                    verified: false
                });

                // B. Deduct Points & Reset Streak
                const penalty = 100;
                const newPoints = (p.current_points || 0) - penalty;

                await supabase.from("challenge_participants").update({
                    current_points: newPoints,
                    streak_current: 0
                }).eq("challenge_id", p.challenge_id).eq("user_id", userId);

                // C. Update Profile (Total Lost / Treat Pool)
                const { data: profile } = await supabase.from("profiles").select("total_lost, current_points").eq("id", userId).single();
                if (profile) {
                    await supabase.from("profiles").update({
                        total_lost: (profile.total_lost || 0) + penalty,
                        current_points: (profile.current_points || 0) - penalty
                    }).eq("id", userId);
                }

                toast.error(`Missed task yesterday! -${penalty} pts`);
            }
        }
    } catch (error) {
        console.error("Error checking missed logs:", error);
    }
};
