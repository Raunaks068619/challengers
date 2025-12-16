import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const challengeId = searchParams.get("challengeId");

    if (!userId || !challengeId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const q = adminDb.collection("daily_logs")
            .where("challenge_id", "==", challengeId)
            .where("user_id", "==", userId)
            .orderBy("created_at", "desc");

        const snap = await q.get();
        const logs = snap.docs.map(d => ({ ...d.data(), id: d.id }));

        return NextResponse.json(logs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
