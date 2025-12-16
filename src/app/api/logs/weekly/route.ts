import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        const dateString = lastWeek.toLocaleDateString('en-CA');

        const q = adminDb.collection("daily_logs")
            .where("user_id", "==", userId)
            .where("date", ">=", dateString);

        const snap = await q.get();
        const logs = snap.docs.map(d => ({ ...d.data(), id: d.id }));

        return NextResponse.json(logs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
