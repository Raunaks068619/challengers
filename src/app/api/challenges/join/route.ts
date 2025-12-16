import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, challengeId, code } = body;

        let targetChallengeId = challengeId;

        // Handle Join by Code
        if (code) {
            const q = adminDb.collection("challenges").where("join_code", "==", code);
            const snap = await q.get();

            if (snap.empty) return NextResponse.json({ error: "Invalid code or challenge not found" }, { status: 404 });
            targetChallengeId = snap.docs[0].id;
        }

        if (!targetChallengeId || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check if already joined
        const pq = adminDb.collection("challenge_participants")
            .where("challenge_id", "==", targetChallengeId)
            .where("user_id", "==", userId);

        const psnap = await pq.get();

        if (!psnap.empty) {
            await psnap.docs[0].ref.update({ is_active: true });
        } else {
            await adminDb.collection("challenge_participants").add({
                challenge_id: targetChallengeId,
                user_id: userId,
                current_points: 500,
                is_active: true,
                created_at: new Date().toISOString(),
                points_history: [{ date: new Date().toLocaleDateString('en-CA'), points: 500 }]
            });

            // Update Global Profile Points
            const profileRef = adminDb.collection("profiles").doc(userId);
            const profileSnap = await profileRef.get();

            if (profileSnap.exists) {
                const profile = profileSnap.data();
                await profileRef.update({
                    current_points: (profile?.current_points || 0) + 500,
                    total_earned: (profile?.total_earned || 0) + 500, // Only add to total earned if new join? Logic in original was adding.
                    points_history: FieldValue.arrayUnion({
                        date: new Date().toLocaleDateString('en-CA'),
                        points: (profile?.current_points || 0) + 500,
                        taskStatus: 'joined'
                    })
                });
            }
        }

        // 2. Add to Conversation Participants
        const convRef = adminDb.collection("conversations").doc(targetChallengeId);
        const convSnap = await convRef.get();
        if (convSnap.exists) {
            await convRef.update({
                participants: FieldValue.arrayUnion(userId)
            });
        } else {
            // Create if missing (fallback)
            await convRef.set({
                type: 'challenge',
                participants: [userId],
                challengeId: targetChallengeId,
                updatedAt: FieldValue.serverTimestamp(),
                lastMessage: null
            });
        }

        return NextResponse.json({ success: true, challengeId: targetChallengeId });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
