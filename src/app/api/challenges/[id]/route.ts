import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const docRef = adminDb.collection("challenges").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

        const countSnap = await adminDb.collection("challenge_participants")
            .where("challenge_id", "==", id)
            .count()
            .get();

        return NextResponse.json({
            ...docSnap.data(),
            id: docSnap.id,
            participants_count: countSnap.data().count
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const body = await req.json();
        const { updates } = body;

        const docRef = adminDb.collection("challenges").doc(id);
        await docRef.update(updates);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
