import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { supabase } from "@/lib/supabase";
import { verifyApiAuth, enforceUserMatch } from "@/lib/auth";

/** Haversine distance between two GPS coordinates, returns metres */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000; // Earth radius in metres
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { challengeId, userId, imgSrc, location, note, route, distance_m, duration_s, avg_pace_s_per_km, activity_type } = body;

        const isActivityCheckIn = !!route && Array.isArray(route) && route.length > 0;

        // Activity check-ins don't require a photo (the route IS the proof)
        if (!challengeId || !userId || (!imgSrc && !isActivityCheckIn)) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const authResult = await verifyApiAuth(req);
        if (authResult instanceof NextResponse) return authResult;
        const matchError = enforceUserMatch(authResult.uid, userId);
        if (matchError) return matchError;

        // 0. Validate challenge has started
        const challengeRef = adminDb.collection("challenges").doc(challengeId);
        const challengeDoc = await challengeRef.get();

        if (!challengeDoc.exists) {
            return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
        }

        const challengeData = challengeDoc.data();
        const today = new Date().toLocaleDateString('en-CA');

        if (challengeData?.start_date && today < challengeData.start_date) {
            return NextResponse.json({ error: "Challenge hasn't started yet" }, { status: 400 });
        }

        // 0b. Geo-fence validation — enforced when the challenge requires a location check-in
        let locationVerified = false;
        let distanceFromFence: number | null = null;
        let matchedFenceName: string | null = null;

        if (challengeData?.requires_location) {
            // Must provide coordinates to check in
            if (!location?.lat || !location?.lng) {
                return NextResponse.json(
                    { error: "This challenge requires your location to check in. Please enable location access." },
                    { status: 400 }
                );
            }

            const { lat: userLat, lng: userLng } = location;

            // Collect all geo-fence zones (new multi-location array + legacy single fields)
            const fences: Array<{ lat: number; lng: number; radius: number; address?: string }> = [];

            if (Array.isArray(challengeData.locations) && challengeData.locations.length > 0) {
                fences.push(...challengeData.locations);
            } else if (challengeData.location_lat != null && challengeData.location_lng != null) {
                fences.push({
                    lat: challengeData.location_lat,
                    lng: challengeData.location_lng,
                    radius: challengeData.location_radius ?? 100
                });
            }

            if (fences.length === 0) {
                // No fences configured — location requirement is effectively disabled
                locationVerified = true;
            } else {
                // Check if user is within ANY of the defined geo-fences
                for (const fence of fences) {
                    const dist = haversineDistance(userLat, userLng, fence.lat, fence.lng);
                    if (dist <= fence.radius) {
                        locationVerified = true;
                        distanceFromFence = Math.round(dist);
                        matchedFenceName = fence.address ?? null;
                        break;
                    }
                    // Track closest approach for error message
                    if (distanceFromFence === null || dist < distanceFromFence) {
                        distanceFromFence = Math.round(dist);
                    }
                }

                if (!locationVerified) {
                    const needed = fences.map(f => f.radius).join(' / ');
                    return NextResponse.json(
                        {
                            error: `You're too far from the check-in location (${distanceFromFence}m away, need to be within ${needed}m). Move closer and try again.`,
                            distanceMetres: distanceFromFence
                        },
                        { status: 400 }
                    );
                }
            }
        }

        // 1. Upload Image to Supabase Storage
        let proofUrl = imgSrc;

        // If imgSrc is a base64 string, upload it
        if (imgSrc.startsWith('data:image')) {

            const base64Data = imgSrc.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const timestamp = Date.now();
            const fileName = `checkins/${challengeId}/${userId}-${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('challengers')
                .upload(fileName, buffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('challengers')
                .getPublicUrl(fileName);

            proofUrl = publicUrl;
        }

        // 2. Create Log
        const logData: Record<string, unknown> = {
            challenge_id: challengeId,
            user_id: userId,
            date: today,
            status: "completed",
            created_at: new Date().toISOString(),
            proof_url: proofUrl,
            lat: location?.lat ?? null,
            lng: location?.lng ?? null,
            verified: !challengeData?.requires_location || locationVerified,
            location_verified: locationVerified,
            ...(distanceFromFence !== null && { distance_from_fence_m: distanceFromFence }),
            ...(matchedFenceName && { matched_fence: matchedFenceName }),
            note: note || "",
            // Activity tracking data (only when route is provided)
            ...(isActivityCheckIn && {
                route,                          // array of {lat, lng, timestamp, accuracy, altitude}
                distance_m: distance_m ?? null,
                duration_s: duration_s ?? null,
                avg_pace_s_per_km: avg_pace_s_per_km ?? null,
                activity_type: activity_type ?? "any",
            }),
        };

        await adminDb.collection("daily_logs").add(logData);

        // 3. Update Streak & Points
        const participantsRef = adminDb.collection("challenge_participants");
        const q = participantsRef
            .where("challenge_id", "==", challengeId)
            .where("user_id", "==", userId);

        const snap = await q.get();

        if (!snap.empty) {
            const pDoc = snap.docs[0];
            const participant = pDoc.data();

            const newStreak = (participant.streak_current || 0) + 1;
            const newBestStreak = Math.max(newStreak, participant.streak_best || 0);
            let pointsToAdd = 0;

            // Streak Bonus: Every 3 days -> +100 pts
            if (newStreak % 3 === 0) {
                pointsToAdd = 100;
            }

            await pDoc.ref.update({
                streak_current: newStreak,
                streak_best: newBestStreak,
                current_points: (participant.current_points || 0) + pointsToAdd,
                points_history: FieldValue.arrayUnion({
                    date: today,
                    points: (participant.current_points || 0) + pointsToAdd,
                    taskStatus: 'completed'
                })
            });

            // Update Global Profile Points
            if (pointsToAdd > 0) {
                const profileRef = adminDb.collection("profiles").doc(userId);
                const profileSnap = await profileRef.get();

                if (profileSnap.exists) {
                    const profile = profileSnap.data();
                    await profileRef.update({
                        total_earned: (profile?.total_earned || 0) + pointsToAdd,
                        current_points: (profile?.current_points || 0) + pointsToAdd,
                        points_history: FieldValue.arrayUnion({
                            date: today,
                            points: (profile?.current_points || 0) + pointsToAdd,
                            taskStatus: 'completed'
                        })
                    });
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("CheckIn API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
