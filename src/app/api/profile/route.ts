import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyApiAuth, enforceUserMatch } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const authResult = await verifyApiAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const matchError = enforceUserMatch(authResult.uid, userId);
    if (matchError) return matchError;

    try {
        const docRef = adminDb.collection("profiles").doc(userId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            return NextResponse.json({ ...docSnap.data(), id: docSnap.id });
        }
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, updates } = body;

        if (!userId || !updates) {
            return NextResponse.json({ error: "Missing userId or updates" }, { status: 400 });
        }

        const authResult = await verifyApiAuth(req);
        if (authResult instanceof NextResponse) return authResult;
        const matchError = enforceUserMatch(authResult.uid, userId);
        if (matchError) return matchError;

        const docRef = adminDb.collection("profiles").doc(userId);
        await docRef.update(updates);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
