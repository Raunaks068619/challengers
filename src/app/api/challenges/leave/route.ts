import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, challengeId } = body;

        if (!userId || !challengeId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const q = adminDb.collection("challenge_participants")
            .where("challenge_id", "==", challengeId)
            .where("user_id", "==", userId);

        const snap = await q.get();

        if (!snap.empty) {
            const participantDoc = snap.docs[0];
            const participantData = participantDoc.data();
            const pointsToDeduct = participantData.current_points || 0;

            // 1. Update Global Profile
            const profileRef = adminDb.collection("profiles").doc(userId);
            const profileSnap = await profileRef.get();

            if (profileSnap.exists) {
                const profile = profileSnap.data();
                const currentGlobalPoints = profile?.current_points || 0;
                const newGlobalPoints = Math.max(0, currentGlobalPoints - pointsToDeduct);

                await profileRef.update({
                    current_points: newGlobalPoints,
                    points_history: FieldValue.arrayUnion({
                        date: new Date().toLocaleDateString('en-CA'),
                        points: newGlobalPoints,
                        reason: 'left_challenge'
                    })
                });
            }

            // 2. Delete Participant Doc
            await participantDoc.ref.delete();

            // 3. Remove from Conversation Participants
            const convRef = adminDb.collection("conversations").doc(challengeId);
            const convSnap = await convRef.get();
            if (convSnap.exists) {
                await convRef.update({
                    participants: FieldValue.arrayRemove(userId)
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
