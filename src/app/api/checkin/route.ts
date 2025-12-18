import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { challengeId, userId, imgSrc, location, note } = body;

        if (!challengeId || !userId || !imgSrc) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 0. Validate challenge has started
        const challengeRef = adminDb.collection("challenges").doc(challengeId);
        const challengeDoc = await challengeRef.get();

        if (!challengeDoc.exists) {
            return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
        }

        const challengeData = challengeDoc.data();
        const today = new Date().toLocaleDateString('en-CA');

        if (challengeData?.start_date && today < challengeData.start_date) {
            return NextResponse.json({ error: "Challenge hasn't started yet" }, { status: 400 });
        }

        // 1. Upload Image to Supabase Storage
        let proofUrl = imgSrc;

        // If imgSrc is a base64 string, upload it
        if (imgSrc.startsWith('data:image')) {

            const base64Data = imgSrc.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const timestamp = Date.now();
            const fileName = `checkins/${challengeId}/${userId}-${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('challengers')
                .upload(fileName, buffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('challengers')
                .getPublicUrl(fileName);

            proofUrl = publicUrl;
        }

        // 2. Create Log
        const logData = {
            challenge_id: challengeId,
            user_id: userId,
            date: today,
            status: "completed",
            created_at: new Date().toISOString(),
            proof_url: proofUrl,
            lat: location?.lat || null,
            lng: location?.lng || null,
            verified: true,
            note: note || "",
        };

        await adminDb.collection("daily_logs").add(logData);

        // 3. Update Streak & Points
        const participantsRef = adminDb.collection("challenge_participants");
        const q = participantsRef
            .where("challenge_id", "==", challengeId)
            .where("user_id", "==", userId);

        const snap = await q.get();

        if (!snap.empty) {
            const pDoc = snap.docs[0];
            const participant = pDoc.data();

            const newStreak = (participant.streak_current || 0) + 1;
            const newBestStreak = Math.max(newStreak, participant.streak_best || 0);
            let pointsToAdd = 0;

            // Streak Bonus: Every 3 days -> +100 pts
            if (newStreak % 3 === 0) {
                pointsToAdd = 100;
            }

            await pDoc.ref.update({
                streak_current: newStreak,
                streak_best: newBestStreak,
                current_points: (participant.current_points || 0) + pointsToAdd,
                points_history: FieldValue.arrayUnion({
                    date: today,
                    points: (participant.current_points || 0) + pointsToAdd,
                    taskStatus: 'completed'
                })
            });

            // Update Global Profile Points
            if (pointsToAdd > 0) {
                const profileRef = adminDb.collection("profiles").doc(userId);
                const profileSnap = await profileRef.get();

                if (profileSnap.exists) {
                    const profile = profileSnap.data();
                    await profileRef.update({
                        total_earned: (profile?.total_earned || 0) + pointsToAdd,
                        current_points: (profile?.current_points || 0) + pointsToAdd,
                        points_history: FieldValue.arrayUnion({
                            date: today,
                            points: (profile?.current_points || 0) + pointsToAdd,
                            taskStatus: 'completed'
                        })
                    });
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("CheckIn API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
