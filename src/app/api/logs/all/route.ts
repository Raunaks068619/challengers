import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        const q = adminDb.collection("daily_logs")
            .where("user_id", "==", userId)
            .orderBy("date", "desc");

        const snap = await q.get();
        const logs = snap.docs.map(d => ({ ...d.data(), id: d.id }));

        return NextResponse.json(logs);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error fetching all logs:", error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
