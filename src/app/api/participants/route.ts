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
        // 1. Get all challenges the user is part of
        const pRef = adminDb.collection("challenge_participants");
        const pSnap = await pRef.where("user_id", "==", userId).get();

        const challengeIds = pSnap.docs.map(d => d.data().challenge_id);

        if (!challengeIds.length) return NextResponse.json([]);

        // 2. Get all participants for these challenges (Batch)
        const participantUserIds = new Set<string>();

        // Chunk challenge IDs to avoid 'in' limit (10)
        const chunks = [];
        for (let i = 0; i < challengeIds.length; i += 10) {
            chunks.push(challengeIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
            const cpSnap = await adminDb.collection("challenge_participants")
                .where("challenge_id", "in", chunk)
                .get();

            cpSnap.docs.forEach(doc => {
                const pid = doc.data().user_id;
                if (pid !== userId) { // Exclude self
                    participantUserIds.add(pid);
                }
            });
        }

        if (participantUserIds.size === 0) return NextResponse.json([]);

        // 3. Fetch user profiles (Batch)
        const profiles: any[] = [];
        const userIds = Array.from(participantUserIds);

        const userChunks = [];
        for (let i = 0; i < userIds.length; i += 10) {
            userChunks.push(userIds.slice(i, i + 10));
        }

        for (const chunk of userChunks) {
            const userSnap = await adminDb.collection("profiles")
                .where(FieldPath.documentId(), "in", chunk)
                .get();

            userSnap.docs.forEach(doc => {
                profiles.push({ ...doc.data(), id: doc.id });
            });
        }

        return NextResponse.json(profiles);
    } catch (error: any) {
        console.error("Error fetching participants:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
