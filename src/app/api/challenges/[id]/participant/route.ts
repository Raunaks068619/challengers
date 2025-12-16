import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        const q = adminDb.collection("challenge_participants")
            .where("challenge_id", "==", id)
            .where("user_id", "==", userId);

        const snap = await q.get();

        if (!snap.empty) {
            return NextResponse.json(snap.docs[0].data());
        }
        return NextResponse.json(null);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
