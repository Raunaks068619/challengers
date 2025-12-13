import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/firebase';
import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    addDoc,
    updateDoc,
    setDoc,
    orderBy,
    limit,
    getCountFromServer,
    documentId,
    deleteDoc,
    arrayUnion
} from 'firebase/firestore';
import { Challenge, UserProfile, ChallengeParticipant } from '@/types';


export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery: fakeBaseQuery(),
    tagTypes: ['Profile', 'Challenge', 'Participant', 'Log'],
    refetchOnMountOrArgChange: true, // Auto-refetch when component mounts
    endpoints: (builder) => ({
        getProfile: builder.query<UserProfile, string>({
            queryFn: async (userId) => {
                try {
                    const docRef = doc(db, "profiles", userId);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        return { data: { ...docSnap.data(), id: docSnap.id } as UserProfile };
                    }
                    return { error: "Profile not found" };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Profile'],
        }),
        updateProfile: builder.mutation<null, { userId: string; updates: Partial<UserProfile> }>({
            queryFn: async ({ userId, updates }) => {
                try {
                    const docRef = doc(db, "profiles", userId);
                    await updateDoc(docRef, updates);
                    return { data: null };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: ['Profile'],
        }),
        getActiveChallenges: builder.query<any[], string>({
            queryFn: async (userId) => {
                try {
                    // 1. Get participant entries
                    const pRef = collection(db, "challenge_participants");
                    const pQuery = query(pRef, where("user_id", "==", userId));
                    const pSnap = await getDocs(pQuery);

                    const challengeIds = pSnap.docs.map(d => d.data().challenge_id);

                    if (!challengeIds.length) return { data: [] };

                    // 2. Get challenges
                    // Firestore 'in' query limit is 10. If > 10, we need to batch or loop.
                    // For simplicity, assuming < 10 for now or just fetching all and filtering (not ideal but works for small app)
                    // Better approach: fetch individual docs

                    const challenges: any[] = [];
                    for (const cid of challengeIds) {
                        const cRef = doc(db, "challenges", cid);
                        const cSnap = await getDoc(cRef);
                        if (cSnap.exists() && cSnap.data().status === 'active') {
                            // Get participant count
                            const countQuery = query(collection(db, "challenge_participants"), where("challenge_id", "==", cid));
                            const countSnap = await getCountFromServer(countQuery);

                            challenges.push({
                                ...cSnap.data(),
                                id: cSnap.id,
                                participants_count: countSnap.data().count,
                                participant: pSnap.docs.find(d => d.data().challenge_id === cid)?.data() // Attach current user's participant data
                            });
                        }
                    }

                    return { data: challenges };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Challenge'],
        }),
        getChallenge: builder.query<Challenge & { participants_count: number }, string>({
            queryFn: async (challengeId) => {
                try {
                    const docRef = doc(db, "challenges", challengeId);
                    const docSnap = await getDoc(docRef);

                    if (!docSnap.exists()) return { error: "Challenge not found" };

                    const countQuery = query(collection(db, "challenge_participants"), where("challenge_id", "==", challengeId));
                    const countSnap = await getCountFromServer(countQuery);

                    return {
                        data: {
                            ...(docSnap.data() as Challenge),
                            id: docSnap.id,
                            participants_count: countSnap.data().count
                        }
                    };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: (result, error, id) => [{ type: 'Challenge', id }],
        }),
        getParticipantData: builder.query<ChallengeParticipant | null, { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                try {
                    const q = query(
                        collection(db, "challenge_participants"),
                        where("challenge_id", "==", challengeId),
                        where("user_id", "==", userId)
                    );
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        const data = snap.docs[0].data();
                        // Add ID if needed, though usually just data is enough
                        return { data: data as ChallengeParticipant };
                    }
                    return { data: null };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Participant'],
        }),
        joinChallenge: builder.mutation<null, { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                try {
                    // Check if already joined
                    const q = query(
                        collection(db, "challenge_participants"),
                        where("challenge_id", "==", challengeId),
                        where("user_id", "==", userId)
                    );
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        // Update existing
                        await updateDoc(snap.docs[0].ref, {
                            is_active: true
                        });
                    } else {
                        // Create new
                        await addDoc(collection(db, "challenge_participants"), {
                            challenge_id: challengeId,
                            user_id: userId,
                            current_points: 500,
                            is_active: true,
                            created_at: new Date().toISOString(),
                            points_history: [{ date: new Date().toLocaleDateString('en-CA'), points: 500 }]
                        });

                        // Update Global Profile Points
                        const profileRef = doc(db, "profiles", userId);
                        const profileSnap = await getDoc(profileRef);
                        if (profileSnap.exists()) {
                            const profile = profileSnap.data();
                            await updateDoc(profileRef, {
                                current_points: (profile.current_points || 0) + 500,
                                total_earned: (profile.total_earned || 0) + 500,
                                points_history: arrayUnion({
                                    date: new Date().toLocaleDateString('en-CA'),
                                    points: (profile.current_points || 0) + 500,
                                    taskStatus: 'joined'
                                })
                            });
                        }
                    }
                    return { data: null };
                } catch (e: any) {
                    console.error("Join Challenge Error:", e);
                    return { error: e?.message || "An unexpected error occurred" };
                }
            },
            invalidatesTags: ['Challenge', 'Participant', 'Profile'],
        }),
        joinChallengeByCode: builder.mutation<string, { code: string; userId: string }>({
            queryFn: async ({ code, userId }) => {
                try {
                    // 1. Find Challenge
                    const q = query(collection(db, "challenges"), where("join_code", "==", code));
                    const snap = await getDocs(q);

                    if (snap.empty) return { error: "Invalid code or challenge not found" };

                    const challengeDoc = snap.docs[0];
                    const challengeId = challengeDoc.id;

                    // 2. Join Challenge
                    // Check if already joined
                    const pq = query(
                        collection(db, "challenge_participants"),
                        where("challenge_id", "==", challengeId),
                        where("user_id", "==", userId)
                    );
                    const psnap = await getDocs(pq);

                    if (!psnap.empty) {
                        await updateDoc(psnap.docs[0].ref, { is_active: true });
                    } else {
                        await addDoc(collection(db, "challenge_participants"), {
                            challenge_id: challengeId,
                            user_id: userId,
                            current_points: 500,
                            is_active: true,
                            created_at: new Date().toISOString(),
                            points_history: [{ date: new Date().toLocaleDateString('en-CA'), points: 500 }]
                        });

                        // Update Global Profile Points
                        const profileRef = doc(db, "profiles", userId);
                        const profileSnap = await getDoc(profileRef);
                        if (profileSnap.exists()) {
                            const profile = profileSnap.data();
                            await updateDoc(profileRef, {
                                current_points: (profile.current_points || 0) + 500,
                                points_history: arrayUnion({
                                    date: new Date().toLocaleDateString('en-CA'),
                                    points: (profile.current_points || 0) + 500,
                                    taskStatus: 'joined'
                                })
                            });
                        }
                    }

                    return { data: challengeId };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: ['Challenge', 'Participant', 'Profile'],
        }),
        leaveChallenge: builder.mutation<null, { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                try {
                    const q = query(
                        collection(db, "challenge_participants"),
                        where("challenge_id", "==", challengeId),
                        where("user_id", "==", userId)
                    );
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        const participantDoc = snap.docs[0];
                        const participantData = participantDoc.data();
                        const pointsToDeduct = participantData.current_points || 0;

                        // 1. Update Global Profile
                        const profileRef = doc(db, "profiles", userId);
                        const profileSnap = await getDoc(profileRef);

                        if (profileSnap.exists()) {
                            const profile = profileSnap.data();
                            const currentGlobalPoints = profile.current_points || 0;
                            const newGlobalPoints = Math.max(0, currentGlobalPoints - pointsToDeduct);

                            await updateDoc(profileRef, {
                                current_points: newGlobalPoints,
                                points_history: arrayUnion({
                                    date: new Date().toLocaleDateString('en-CA'),
                                    points: newGlobalPoints,
                                    reason: 'left_challenge'
                                })
                            });
                        }

                        // 2. Delete Participant Doc
                        await deleteDoc(participantDoc.ref);
                    }
                    return { data: null };
                } catch (e: any) {
                    console.error("Leave Challenge Error:", e);
                    return { error: e?.message || "An unexpected error occurred" };
                }
            },
            invalidatesTags: ['Challenge', 'Participant', 'Profile'],
        }),
        createChallenge: builder.mutation<string, { challenge: Partial<Challenge>; userId: string }>({
            queryFn: async ({ challenge, userId }) => {
                try {
                    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                    // 1. Create Challenge
                    const docRef = await addDoc(collection(db, "challenges"), {
                        ...challenge,
                        creator_id: userId,
                        status: 'active',
                        join_code: joinCode,
                        created_at: new Date().toISOString()
                    });

                    // 2. Add Creator as Participant
                    await addDoc(collection(db, "challenge_participants"), {
                        challenge_id: docRef.id,
                        user_id: userId,
                        current_points: 500,
                        is_active: true,
                        created_at: new Date().toISOString(),
                        points_history: [{ date: new Date().toLocaleDateString('en-CA'), points: 500, taskStatus: 'completed' }]
                    });

                    // 3. Update Global Profile Points
                    const profileRef = doc(db, "profiles", userId);
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        const profile = profileSnap.data();
                        await updateDoc(profileRef, {
                            current_points: (profile.current_points || 0) + 500,
                            points_history: arrayUnion({
                                date: new Date().toLocaleDateString('en-CA'),
                                points: (profile.current_points || 0) + 500,
                                taskStatus: 'created'
                            })
                        });
                    }

                    return { data: docRef.id };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: ['Challenge'],
        }),
        updateChallenge: builder.mutation<null, { challengeId: string; updates: Partial<Challenge> }>({
            queryFn: async ({ challengeId, updates }) => {
                try {
                    const docRef = doc(db, "challenges", challengeId);
                    await updateDoc(docRef, updates);
                    return { data: null };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: (result, error, arg) => [{ type: 'Challenge', id: arg.challengeId }],
        }),
        performCheckIn: builder.mutation<null, {
            challengeId: string;
            userId: string;
            imgSrc: string;
            location?: { lat: number; lng: number } | null;
            note?: string;
        }>({
            queryFn: async ({ challengeId, userId, imgSrc, location, note }) => {
                try {
                    // 0. Validate challenge has started
                    const challengeDoc = await getDoc(doc(db, "challenges", challengeId));
                    if (!challengeDoc.exists()) throw new Error("Challenge not found");
                    const challengeData = challengeDoc.data();
                    const today = new Date().toLocaleDateString('en-CA');
                    if (today < challengeData.start_date) {
                        throw new Error("Challenge hasn't started yet");
                    }

                    // 1. Upload Image (USE SERVER ACTION)
                    const blob = await (await fetch(imgSrc)).blob();
                    const file = new File([blob], "checkin.jpg", { type: "image/jpeg" });

                    const fileName = `checkins/${challengeId}/${userId}-${Date.now()}.jpg`;
                    const { error: uploadError } = await supabase.storage
                        .from('challengers')
                        .upload(fileName, file, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('challengers')
                        .getPublicUrl(fileName);

                    const downloadURL = publicUrl;

                    // 2. Create Log (FIREBASE)
                    await addDoc(collection(db, "daily_logs"), {
                        challenge_id: challengeId,
                        user_id: userId,
                        date: today,
                        status: "completed",
                        created_at: new Date().toISOString(),
                        proof_url: downloadURL,
                        lat: location?.lat || null,
                        lng: location?.lng || null,
                        verified: true,
                        note: note || "",
                    });


                    // 3. Update Streak & Points
                    const q = query(
                        collection(db, "challenge_participants"),
                        where("challenge_id", "==", challengeId),
                        where("user_id", "==", userId)
                    );
                    const snap = await getDocs(q);

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
                        await updateDoc(pDoc.ref, {
                            streak_current: newStreak,
                            streak_best: newBestStreak,
                            current_points: (participant.current_points || 0) + pointsToAdd,
                            points_history: arrayUnion({
                                date: new Date().toLocaleDateString('en-CA'),
                                points: (participant.current_points || 0) + pointsToAdd,
                                taskStatus: 'completed'
                            })
                        });

                        // Update Global Profile Points
                        if (pointsToAdd > 0) {
                            const profileRef = doc(db, "profiles", userId);
                            const profileSnap = await getDoc(profileRef);
                            if (profileSnap.exists()) {
                                const profile = profileSnap.data();
                                await updateDoc(profileRef, {
                                    total_earned: (profile.total_earned || 0) + pointsToAdd,
                                    current_points: (profile.current_points || 0) + pointsToAdd,
                                    points_history: arrayUnion({
                                        date: new Date().toLocaleDateString('en-CA'),
                                        points: (profile.current_points || 0) + pointsToAdd,
                                        taskStatus: 'completed'
                                    })
                                });
                            }
                        }
                    }

                    return { data: null };
                } catch (error: any) {
                    console.error("CheckIn Error:", error);
                    return { error: error?.message || "An unexpected error occurred" };
                }
            },
            invalidatesTags: ['Participant', 'Profile', 'Challenge', 'Log'],
        }),
        getUserChallengeLogs: builder.query<any[], { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                try {
                    const q = query(
                        collection(db, "daily_logs"),
                        where("challenge_id", "==", challengeId),
                        where("user_id", "==", userId),
                        orderBy("created_at", "desc")
                    );
                    const snap = await getDocs(q);
                    const logs = snap.docs.map(d => ({ ...d.data(), id: d.id }));

                    return { data: logs };
                } catch (e: any) {
                    console.error("Error fetching user logs:", e);
                    return { error: e.message };
                }
            },
            providesTags: (result, error, arg) => [{ type: 'Challenge', id: arg.challengeId }],
        }),
        getUserWeeklyLogs: builder.query<any[], string>({
            queryFn: async (userId) => {
                try {
                    const today = new Date();
                    const lastWeek = new Date(today);
                    lastWeek.setDate(today.getDate() - 7);
                    const dateString = lastWeek.toLocaleDateString('en-CA');

                    const q = query(
                        collection(db, "daily_logs"),
                        where("user_id", "==", userId),
                        where("date", ">=", dateString)
                    );
                    const snap = await getDocs(q);
                    const logs = snap.docs.map(d => ({ ...d.data(), id: d.id }));

                    return { data: logs };
                } catch (e: any) {
                    console.error("Error fetching weekly logs:", e);
                    return { error: e.message };
                }
            },
            providesTags: ['Log', 'Participant'],
        }),
        getAllParticipants: builder.query<UserProfile[], string>({
            queryFn: async (userId) => {
                try {
                    // 1. Get all challenges the user is part of
                    const pRef = collection(db, "challenge_participants");
                    const pQuery = query(pRef, where("user_id", "==", userId));
                    const pSnap = await getDocs(pQuery);

                    const challengeIds = pSnap.docs.map(d => d.data().challenge_id);

                    if (!challengeIds.length) return { data: [] };

                    // 2. Get all participants for these challenges
                    // Note: Firestore 'in' query is limited to 10. For scalability, we should batch or do multiple queries.
                    // For now, assuming < 10 active challenges or just fetching all participants for each challenge.

                    const participantUserIds = new Set<string>();

                    for (const cid of challengeIds) {
                        const cpQuery = query(collection(db, "challenge_participants"), where("challenge_id", "==", cid));
                        const cpSnap = await getDocs(cpQuery);
                        cpSnap.docs.forEach(doc => {
                            const pid = doc.data().user_id;
                            if (pid !== userId) { // Exclude self
                                participantUserIds.add(pid);
                            }
                        });
                    }

                    if (participantUserIds.size === 0) return { data: [] };

                    // 3. Fetch user profiles
                    const profiles: UserProfile[] = [];
                    for (const pid of Array.from(participantUserIds)) {
                        const userDoc = await getDoc(doc(db, "profiles", pid));
                        if (userDoc.exists()) {
                            profiles.push({ ...userDoc.data(), id: userDoc.id } as UserProfile);
                        }
                    }

                    return { data: profiles };
                } catch (e: any) {
                    console.error("Error fetching participants:", e);
                    return { error: e.message };
                }
            },
            providesTags: ['Participant'],
        }),
        getChallengePointsHistory: builder.query<any[], string>({
            queryFn: async (challengeId) => {
                try {
                    if (!challengeId) return { data: [] };

                    // 1. Fetch Participants
                    const pQuery = query(collection(db, "challenge_participants"), where("challenge_id", "==", challengeId));
                    const pSnap = await getDocs(pQuery);
                    const participants = pSnap.docs.map(d => d.data());
                    const participantIds = participants.map(p => p.user_id);

                    // 2. Fetch User Profiles (for names)
                    const userMap: Record<string, string> = {};
                    for (const uid of participantIds) {
                        const uSnap = await getDoc(doc(db, "profiles", uid));
                        if (uSnap.exists()) {
                            const data = uSnap.data();
                            userMap[uid] = data.display_name || data.email?.split('@')[0] || "User";
                        } else {
                            userMap[uid] = "Unknown";
                        }
                    }

                    // 3. Construct History from `points_history` field
                    // We need to merge all histories into a single timeline
                    const historyMap: Record<string, any> = {}; // date -> { date, User1: 500, User2: 400 }

                    participants.forEach(p => {
                        const name = userMap[p.user_id];
                        const history = p.points_history || [];

                        // If no history (legacy data), assume current points for today? 
                        // Or maybe just skip? For now, let's try to use what we have.
                        if (history.length === 0) {
                            // Fallback for legacy: just show current points for today
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

                    // Fill in gaps?
                    // The chart needs continuous data. If User A has data for Mon and Wed, but not Tue, we should carry forward Mon's value.
                    // 1. Get all unique dates and sort them
                    const sortedDates = Object.keys(historyMap).sort();

                    if (sortedDates.length === 0) return { data: [] };

                    // 2. Create continuous timeline
                    const startDate = new Date(sortedDates[0]);
                    const endDate = new Date(); // Today
                    const finalHistory: any[] = [];

                    const lastKnownPoints: Record<string, number> = {};
                    participantIds.forEach(uid => lastKnownPoints[userMap[uid]] = 500); // Default start

                    const d = new Date(startDate);
                    while (d <= endDate) {
                        const dateStr = d.toLocaleDateString('en-CA');
                        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

                        const entry: any = { name: dayName, date: dateStr };

                        // Update last known points if we have data for this date
                        if (historyMap[dateStr]) {
                            participantIds.forEach(uid => {
                                const name = userMap[uid];
                                if (historyMap[dateStr][name] !== undefined) {
                                    lastKnownPoints[name] = historyMap[dateStr][name];
                                }
                            });
                        }

                        // Assign points to entry
                        participantIds.forEach(uid => {
                            const name = userMap[uid];
                            entry[name] = lastKnownPoints[name];
                        });

                        finalHistory.push(entry);
                        d.setDate(d.getDate() + 1);
                    }

                    return { data: finalHistory };
                } catch (e: any) {
                    console.error("Error fetching history:", e);
                    return { error: e.message };
                }
            },
            providesTags: ['Challenge', 'Participant'],
        }),
        // Challenge-specific participant points comparison
        getChallengeParticipantsPointsHistory: builder.query<{ history: any[]; users: { id: string; name: string }[] }, string>({
            queryFn: async (challengeId) => {
                try {
                    if (!challengeId) return { data: { history: [], users: [] } };

                    // 1. Get challenge metadata (for date bounds)
                    const challengeRef = doc(db, "challenges", challengeId);
                    const challengeSnap = await getDoc(challengeRef);
                    if (!challengeSnap.exists()) return { data: { history: [], users: [] } };

                    const challenge = challengeSnap.data();
                    const startDateStr = challenge.start_date; // 'YYYY-MM-DD'
                    const endDateStr = challenge.end_date || null;
                    const startDate = new Date(startDateStr + 'T00:00:00');
                    let endDate = endDateStr
                        ? new Date(endDateStr + 'T23:59:59')
                        : new Date();

                    // Fallback if endDate is invalid
                    if (isNaN(endDate.getTime())) {
                        endDate = new Date();
                    }

                    // 2. Get all active participants for this challenge
                    const pQuery = query(
                        collection(db, "challenge_participants"),
                        where("challenge_id", "==", challengeId),
                        where("is_active", "==", true)
                    );
                    const pSnap = await getDocs(pQuery);
                    const participants = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

                    if (participants.length === 0) return { data: { history: [], users: [] } };

                    // 3. Fetch profiles for names
                    const userIds = Array.from(new Set(participants.map(p => p.user_id)));
                    const userMap: Record<string, string> = {};

                    for (const uid of userIds) {
                        const uSnap = await getDoc(doc(db, "profiles", uid));
                        if (uSnap.exists()) {
                            const data = uSnap.data();
                            userMap[uid] = data.display_name || data.email?.split('@')[0] || "User";
                        } else {
                            userMap[uid] = "Unknown";
                        }
                    }

                    // 4. Build history map keyed by date, values keyed by userId
                    // Also track the earliest date in participant history
                    const historyMap: Record<string, Record<string, number>> = {};
                    let earliestHistoryDate: string | null = null;

                    participants.forEach(p => {
                        const history = p.points_history || [];

                        history.forEach((entry: any) => {
                            if (!historyMap[entry.date]) {

                                historyMap[entry.date] = {};
                            }
                            historyMap[entry.date][p.user_id] = entry.points;

                            // Track earliest date
                            if (!earliestHistoryDate || entry.date < earliestHistoryDate) {
                                earliestHistoryDate = entry.date;
                            }
                        });

                        // Also consider created_at if no history
                        if (history.length === 0 && p.created_at) {
                            const createdDate = p.created_at.split('T')[0];
                            if (!earliestHistoryDate || createdDate < earliestHistoryDate) {
                                earliestHistoryDate = createdDate;
                            }
                        }
                    });




                    // 5. Initialize lastKnown with starting points (use current_points as baseline)
                    const lastKnown: Record<string, number | null> = {};
                    const startingPoints: Record<string, number> = {};
                    userIds.forEach(uid => {
                        // Use 500 as default starting points (all participants start with 500)
                        startingPoints[uid] = 500;
                        lastKnown[uid] = null;
                    });

                    // 6. Continuous timeline - use earliest of: challenge.start_date, earliest history date, or participant created_at
                    const finalHistory: any[] = [];
                    const today = new Date();
                    const finalEnd = endDate > today ? today : endDate;

                    // Determine effective start: use earliest participant data or challenge start, whichever is earlier
                    let effectiveStartStr = startDateStr;
                    if (earliestHistoryDate && earliestHistoryDate < startDateStr) {
                        effectiveStartStr = earliestHistoryDate;
                    }
                    const effectiveStart = new Date(effectiveStartStr + 'T00:00:00');

                    const d = new Date(effectiveStart);

                    while (d <= finalEnd) {
                        // Use local date string (YYYY-MM-DD) to match historyMap keys
                        // Manual formatting to ensure consistency across locales
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const dateStr = `${year}-${month}-${day}`;

                        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

                        const row: any = { date: dateStr, name: dayName };

                        // Update lastKnown from historyMap


                        if (historyMap[dateStr]) {
                            userIds.forEach(uid => {
                                if (historyMap[dateStr][uid] !== undefined) {
                                    lastKnown[uid] = historyMap[dateStr][uid];
                                }
                            });
                        }

                        // Fill each user (use user_id as key)
                        userIds.forEach(uid => {
                            const participant = participants.find(p => p.user_id === uid);
                            const joinedAt = participant?.joined_at || participant?.created_at?.split('T')[0];

                            if (joinedAt && dateStr < joinedAt) {
                                row[uid] = null; // no line before join
                            } else {
                                // If we have history data, use it; otherwise use starting points
                                if (lastKnown[uid] !== null) {
                                    row[uid] = lastKnown[uid];
                                } else {
                                    // First data point after join - use starting points
                                    row[uid] = startingPoints[uid];
                                    lastKnown[uid] = startingPoints[uid];
                                }
                            }
                        });

                        finalHistory.push(row);
                        d.setDate(d.getDate() + 1);
                    }

                    // 7. If still empty (edge case), add at least today's point
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

                    // 8. Return both history and users mapping (limit to last 7 days)
                    return {
                        data: {
                            history: finalHistory,
                            users: userIds.map(uid => ({ id: uid, name: userMap[uid] })),
                        }
                    };
                } catch (e: any) {
                    console.error("Error fetching challenge participants history:", e);
                    return { error: e.message };
                }
            },
            providesTags: ['Participant', 'Challenge'],
        }),
    }),
});

export const {
    useGetProfileQuery,
    useGetActiveChallengesQuery,
    useGetChallengeQuery,
    useGetParticipantDataQuery,
    useJoinChallengeMutation,
    useCreateChallengeMutation,
    usePerformCheckInMutation,
    useGetUserChallengeLogsQuery,
    useJoinChallengeByCodeMutation,
    useLeaveChallengeMutation,
    useGetUserWeeklyLogsQuery,
    useGetAllParticipantsQuery,
    useGetChallengePointsHistoryQuery,
    useGetChallengeParticipantsPointsHistoryQuery,
    useUpdateChallengeMutation,
    useUpdateProfileMutation
} = apiSlice;
