import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        // 1. Get participant entries
        const pRef = adminDb.collection("challenge_participants");
        const pSnap = await pRef.where("user_id", "==", userId).get();

        const challengeIds = pSnap.docs.map(d => d.data().challenge_id);

        if (!challengeIds.length) return NextResponse.json([]);

        // 2. Get challenges
        const challenges: any[] = [];
        for (const cid of challengeIds) {
            const cRef = adminDb.collection("challenges").doc(cid);
            const cSnap = await cRef.get();

            const data = cSnap.data();
            if (cSnap.exists && data?.status === 'active') {
                // Get participant count
                const countSnap = await adminDb.collection("challenge_participants")
                    .where("challenge_id", "==", cid)
                    .count()
                    .get();

                challenges.push({
                    ...data,
                    id: cSnap.id,
                    participants_count: countSnap.data().count,
                    participant: pSnap.docs.find(d => d.data().challenge_id === cid)?.data()
                });
            }
        }

        return NextResponse.json(challenges);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

