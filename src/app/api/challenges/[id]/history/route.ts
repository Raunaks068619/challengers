import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type"); // 'aggregated' or 'participants'

    if (!id) return NextResponse.json({ error: "Missing challenge ID" }, { status: 400 });

    try {
        if (type === 'participants') {
            // --- Logic for getChallengeParticipantsPointsHistory ---

            // 1. Get challenge metadata
            const challengeRef = adminDb.collection("challenges").doc(id);
            const challengeSnap = await challengeRef.get();
            if (!challengeSnap.exists) return NextResponse.json({ history: [], users: [] });

            const challenge = challengeSnap.data();
            const startDateStr = challenge?.start_date;
            const endDateStr = challenge?.end_date || null;
            const startDate = new Date(startDateStr + 'T00:00:00');
            let endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : new Date();
            if (isNaN(endDate.getTime())) endDate = new Date();

            // 2. Get active participants
            const pSnap = await adminDb.collection("challenge_participants")
                .where("challenge_id", "==", id)
                .where("is_active", "==", true)
                .get();

            const participants = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
            if (participants.length === 0) return NextResponse.json({ history: [], users: [] });

            // 3. Fetch profiles for names
            const userIds = Array.from(new Set(participants.map(p => p.user_id)));
            const userMap: Record<string, string> = {};

            for (const uid of userIds) {
                const uSnap = await adminDb.collection("profiles").doc(uid).get();
                if (uSnap.exists) {
                    const data = uSnap.data();
                    userMap[uid] = data?.display_name || data?.email?.split('@')[0] || "User";
                } else {
                    userMap[uid] = "Unknown";
                }
            }

            // 4. Build history map
            const historyMap: Record<string, Record<string, number>> = {};
            let earliestHistoryDate: string | null = null;

            participants.forEach(p => {
                const history = p.points_history || [];
                history.forEach((entry: any) => {
                    if (!historyMap[entry.date]) historyMap[entry.date] = {};
                    historyMap[entry.date][p.user_id] = entry.points;
                    if (!earliestHistoryDate || entry.date < earliestHistoryDate) earliestHistoryDate = entry.date;
                });
                if (history.length === 0 && p.created_at) {
                    const createdDate = p.created_at.split('T')[0];
                    if (!earliestHistoryDate || createdDate < earliestHistoryDate) earliestHistoryDate = createdDate;
                }
            });

            // 5. Initialize lastKnown
            const lastKnown: Record<string, number | null> = {};
            const startingPoints: Record<string, number> = {};
            userIds.forEach(uid => {
                startingPoints[uid] = 500;
                lastKnown[uid] = null;
            });

            // 6. Continuous timeline
            const finalHistory: any[] = [];
            const today = new Date();
            const finalEnd = endDate > today ? today : endDate;

            let effectiveStartStr = startDateStr;
            if (earliestHistoryDate && earliestHistoryDate < startDateStr) effectiveStartStr = earliestHistoryDate;
            const effectiveStart = new Date(effectiveStartStr + 'T00:00:00');

            const d = new Date(effectiveStart);

            while (d <= finalEnd) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

                const row: any = { date: dateStr, name: dayName };

                if (historyMap[dateStr]) {
                    userIds.forEach(uid => {
                        if (historyMap[dateStr][uid] !== undefined) lastKnown[uid] = historyMap[dateStr][uid];
                    });
                }

                userIds.forEach(uid => {
                    const participant = participants.find(p => p.user_id === uid);
                    const joinedAt = participant?.joined_at || participant?.created_at?.split('T')[0];

                    if (joinedAt && dateStr < joinedAt) {
                        row[uid] = null;
                    } else {
                        if (lastKnown[uid] !== null) {
                            row[uid] = lastKnown[uid];
                        } else {
                            row[uid] = startingPoints[uid];
                            lastKnown[uid] = startingPoints[uid];
                        }
                    }
                });

                finalHistory.push(row);
                d.setDate(d.getDate() + 1);
            }

            if (finalHistory.length === 0) {
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const todayStr = `${year}-${month}-${day}`;
                const dayName = today.toLocaleDateString('en-US', { weekday: 'short' });
                const row: any = { date: todayStr, name: dayName };
                userIds.forEach(uid => {
                    const participant = participants.find(p => p.user_id === uid);
                    row[uid] = participant?.current_points || 500;
                });
                finalHistory.push(row);
            }

            return NextResponse.json({
                history: finalHistory,
                users: userIds.map(uid => ({ id: uid, name: userMap[uid] })),
            });

        } else {
            // --- Logic for getChallengePointsHistory (Aggregated/Legacy) ---

            // 1. Fetch Participants
            const pSnap = await adminDb.collection("challenge_participants")
                .where("challenge_id", "==", id)
                .get();
            const participants = pSnap.docs.map(d => d.data());
            const participantIds = participants.map(p => p.user_id);

            // 2. Fetch User Profiles
            const userMap: Record<string, string> = {};
            for (const uid of participantIds) {
                const uSnap = await adminDb.collection("profiles").doc(uid).get();
                if (uSnap.exists) {
                    const data = uSnap.data();
                    userMap[uid] = data?.display_name || data?.email?.split('@')[0] || "User";
                } else {
                    userMap[uid] = "Unknown";
                }
            }

            // 3. Construct History
            const historyMap: Record<string, any> = {};

            participants.forEach(p => {
                const name = userMap[p.user_id];
                const history = p.points_history || [];

                if (history.length === 0) {
                    const today = new Date().toLocaleDateString('en-CA');
                    if (!historyMap[today]) historyMap[today] = { date: today, name: new Date().toLocaleDateString('en-US', { weekday: 'short' }) };
                    historyMap[today][name] = p.current_points || 500;
                } else {
                    history.forEach((entry: any) => {
                        if (!historyMap[entry.date]) {
                            const d = new Date(entry.date);
                            historyMap[entry.date] = {
                                date: entry.date,
                                name: d.toLocaleDateString('en-US', { weekday: 'short' })
                            };
                        }
                        historyMap[entry.date][name] = entry.points;
                    });
                }
            });

            const sortedDates = Object.keys(historyMap).sort();
            if (sortedDates.length === 0) return NextResponse.json([]);

            const startDate = new Date(sortedDates[0]);
            const endDate = new Date();
            const finalHistory: any[] = [];
            const lastKnownPoints: Record<string, number> = {};
            participantIds.forEach(uid => lastKnownPoints[userMap[uid]] = 500);

            const d = new Date(startDate);
            while (d <= endDate) {
                const dateStr = d.toLocaleDateString('en-CA');
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                const entry: any = { name: dayName, date: dateStr };

                if (historyMap[dateStr]) {
                    participantIds.forEach(uid => {
                        const name = userMap[uid];
                        if (historyMap[dateStr][name] !== undefined) {
                            lastKnownPoints[name] = historyMap[dateStr][name];
                        }
                    });
                }

                participantIds.forEach(uid => {
                    const name = userMap[uid];
                    entry[name] = lastKnownPoints[name];
                });

                finalHistory.push(entry);
                d.setDate(d.getDate() + 1);
            }

            return NextResponse.json(finalHistory);
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
