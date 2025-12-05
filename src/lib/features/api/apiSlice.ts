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
    deleteDoc
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
                                participants_count: countSnap.data().count
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
                            created_at: new Date().toISOString()
                        });
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
                            created_at: new Date().toISOString()
                        });
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
                        created_at: new Date().toISOString()
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
                            current_points: (participant.current_points || 0) + pointsToAdd
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
    useGetAllParticipantsQuery
} = apiSlice;
