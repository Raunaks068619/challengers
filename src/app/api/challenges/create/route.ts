import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, challenge } = body;

        if (!userId || !challenge) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        // 1. Create Challenge
        const docRef = await adminDb.collection("challenges").add({
            ...challenge,
            creator_id: userId,
            status: 'active',
            join_code: joinCode,
            created_at: new Date().toISOString()
        });

        // 2. Add Creator as Participant
        await adminDb.collection("challenge_participants").add({
            challenge_id: docRef.id,
            user_id: userId,
            current_points: 500,
            is_active: true,
            created_at: new Date().toISOString(),
            points_history: [{ date: new Date().toLocaleDateString('en-CA'), points: 500, taskStatus: 'completed' }]
        });

        // 3. Update Global Profile Points
        const profileRef = adminDb.collection("profiles").doc(userId);
        const profileSnap = await profileRef.get();

        if (profileSnap.exists) {
            const profile = profileSnap.data();
            await profileRef.update({
                current_points: (profile?.current_points || 0) + 500,
                points_history: FieldValue.arrayUnion({
                    date: new Date().toLocaleDateString('en-CA'),
                    points: (profile?.current_points || 0) + 500,
                    taskStatus: 'created'
                })
            });
        }

        // 4. Create Conversation Document
        await adminDb.collection("conversations").doc(docRef.id).set({
            type: 'challenge',
            participants: [userId],
            challengeId: docRef.id,
            updatedAt: FieldValue.serverTimestamp(),
            lastMessage: null
        });

        return NextResponse.json({ success: true, challengeId: docRef.id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
