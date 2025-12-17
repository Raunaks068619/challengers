import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldPath } from "firebase-admin/firestore";

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

        // 2. Batch fetch challenges
        const chunks = [];
        for (let i = 0; i < challengeIds.length; i += 10) {
            chunks.push(challengeIds.slice(i, i + 10));
        }

        const activeChallenges: any[] = [];
        const activeChallengeIds: string[] = [];

        for (const chunk of chunks) {
            const cSnap = await adminDb.collection("challenges")
                .where(FieldPath.documentId(), "in", chunk)
                .get();

            cSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.status === 'active') {
                    activeChallenges.push({ ...data, id: doc.id });
                    activeChallengeIds.push(doc.id);
                }
            });
        }

        if (activeChallenges.length === 0) return NextResponse.json([]);

        // 3. Batch fetch participant counts
        const counts: Record<string, number> = {};

        const countChunks = [];
        for (let i = 0; i < activeChallengeIds.length; i += 10) {
            countChunks.push(activeChallengeIds.slice(i, i + 10));
        }

        for (const chunk of countChunks) {
            const cpSnap = await adminDb.collection("challenge_participants")
                .where("challenge_id", "in", chunk)
                .get();

            cpSnap.docs.forEach(doc => {
                const cid = doc.data().challenge_id;
                counts[cid] = (counts[cid] || 0) + 1;
            });
        }

        // 4. Merge data
        const result = activeChallenges.map(c => ({
            ...c,
            participants_count: counts[c.id] || 0,
            participant: pSnap.docs.find(d => d.data().challenge_id === c.id)?.data()
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error fetching active challenges:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
