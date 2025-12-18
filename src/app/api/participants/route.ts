import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        // 1. Get all challenges the user is part of
        const pRef = adminDb.collection("challenge_participants");
        const pSnap = await pRef.where("user_id", "==", userId).get();

        const challengeIds = pSnap.docs.map(d => d.data().challenge_id);

        if (!challengeIds.length) return NextResponse.json([]);

        // 2. Get all participants for these challenges
        const participantUserIds = new Set<string>();

        for (const cid of challengeIds) {
            const cpSnap = await adminDb.collection("challenge_participants")
                .where("challenge_id", "==", cid)
                .get();

            cpSnap.docs.forEach(doc => {
                const pid = doc.data().user_id;
                if (pid !== userId) { // Exclude self
                    participantUserIds.add(pid);
                }
            });
        }

        if (participantUserIds.size === 0) return NextResponse.json([]);

        // 3. Fetch user profiles
        const profiles: any[] = [];
        for (const pid of Array.from(participantUserIds)) {
            const userDoc = await adminDb.collection("profiles").doc(pid).get();
            if (userDoc.exists) {
                profiles.push({ ...userDoc.data(), id: userDoc.id });
            }
        }

        return NextResponse.json(profiles);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

