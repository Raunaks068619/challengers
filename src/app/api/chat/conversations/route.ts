import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        const q = adminDb.collection("conversations")
            .where("participants", "array-contains", userId);

        const snap = await q.get();
        const conversations = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            // @ts-ignore
            .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));

        return NextResponse.json(conversations);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, participants, challengeId } = body;

        if (!type || !participants || participants.length < 2) {
            return NextResponse.json({ error: "Invalid conversation data" }, { status: 400 });
        }

        let conversationId = "";
        let data: any = {
            type,
            participants,
            updatedAt: FieldValue.serverTimestamp(),
            lastMessage: null
        };

        if (type === 'dm') {
            const sortedIds = [...participants].sort();
            conversationId = `dm_${sortedIds.join('_')}`;
        } else if (type === 'challenge') {
            if (!challengeId) return NextResponse.json({ error: "Missing challengeId" }, { status: 400 });
            conversationId = challengeId;
            data.challengeId = challengeId;
        }

        const docRef = adminDb.collection("conversations").doc(conversationId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            await docRef.set(data);
        } else {
            // Ensure participants are up to date (e.g. for challenge chats)
            await docRef.update({ participants });
        }

        return NextResponse.json({ success: true, conversationId });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
