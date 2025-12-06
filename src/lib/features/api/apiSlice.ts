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
import { uploadImageAction } from '@/app/actions/upload';

export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery: fakeBaseQuery(),
    tagTypes: ['Profile', 'Challenge', 'Participant'],
    endpoints: (builder) => ({
        getProfile: builder.query<UserProfile, string>({
            queryFn: async (userId) => {
                try {
                    const docRef = doc(db, "profiles", userId);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        return { data: docSnap.data() as UserProfile };
                    }
                    return { error: "Profile not found" };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Profile'],
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
                            points_history: [{ date: new Date().toISOString().split('T')[0], points: 500 }]
                        });

                        // Update Global Profile Points
                        const profileRef = doc(db, "profiles", userId);
                        const profileSnap = await getDoc(profileRef);
                        if (profileSnap.exists()) {
                            const profile = profileSnap.data();
                            await updateDoc(profileRef, {
                                current_points: (profile.current_points || 0) + 500,
                                total_earned: (profile.total_earned || 0) + 500 // Assuming initial points count as earned? Or just current? User said "stacked in your total current points". I'll update current. User said "Remove Total earned points stats... its o no use", so maybe I don't need to update total_earned, but for consistency I might. Let's just update current_points as requested.
                            });
                        }
                    }
                    return { data: null };
                } catch (e: any) {
                    console.error("Join Challenge Error:", e);
                    return { error: e?.message || "An unexpected error occurred" };
                }
            },
            invalidatesTags: ['Challenge', 'Participant'],
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
                            points_history: [{ date: new Date().toISOString().split('T')[0], points: 500 }]
                        });

                        // Update Global Profile Points
                        const profileRef = doc(db, "profiles", userId);
                        const profileSnap = await getDoc(profileRef);
                        if (profileSnap.exists()) {
                            const profile = profileSnap.data();
                            await updateDoc(profileRef, {
                                current_points: (profile.current_points || 0) + 500
                            });
                        }
                    }

                    return { data: challengeId };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: ['Challenge', 'Participant'],
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
                        await deleteDoc(snap.docs[0].ref);
                    }
                    return { data: null };
                } catch (e: any) {
                    console.error("Leave Challenge Error:", e);
                    return { error: e?.message || "An unexpected error occurred" };
                }
            },
            invalidatesTags: ['Challenge', 'Participant'],
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
                        points_history: [{ date: new Date().toISOString().split('T')[0], points: 500, taskStatus: 'completed' }]
                    });

                    return { data: docRef.id };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: ['Challenge'],
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
                    // 1. Upload Image (USE SERVER ACTION)
                    const blob = await (await fetch(imgSrc)).blob();
                    const file = new File([blob], "checkin.jpg", { type: "image/jpeg" });

                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('userId', userId);
                    formData.append('bucket', 'challengers');
                    formData.append('path', `checkins/${challengeId}/${userId}`);

                    // We need to dynamically import the action or use it if available in scope.
                    // Since this is a client-side file (apiSlice runs in client), we can import the server action.
                    // However, apiSlice is a .ts file, not a component.
                    // Server actions can be imported in client modules.

                    // NOTE: We need to make sure uploadImageAction is imported at the top of the file.
                    // For now, I will assume it is imported. I will add the import in a separate step or include it here if possible.
                    // But replace_file_content works on chunks. I'll use the imported action.

                    const downloadURL = await uploadImageAction(formData);

                    // 2. Create Log (FIREBASE)
                    const today = new Date().toISOString().split('T')[0];
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
                                date: new Date().toISOString().split('T')[0],
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
                                    current_points: (profile.current_points || 0) + pointsToAdd
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
            invalidatesTags: ['Participant', 'Profile', 'Challenge'],
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
                    const dateString = lastWeek.toISOString().split('T')[0];

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
            providesTags: ['Participant'],
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
                            profiles.push(userDoc.data() as UserProfile);
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
                            const today = new Date().toISOString().split('T')[0];
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
                        const dateStr = d.toISOString().split('T')[0];
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
    useGetChallengePointsHistoryQuery
} = apiSlice;
