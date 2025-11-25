import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import { Challenge, UserProfile, ChallengeParticipant } from '@/types';

export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery: fakeBaseQuery(),
    tagTypes: ['Profile', 'Challenge', 'Participant'],
    endpoints: (builder) => ({
        getProfile: builder.query<UserProfile, string>({
            queryFn: async (userId) => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (error) return { error: error.message };
                return { data };
            },
            providesTags: ['Profile'],
        }),
        getActiveChallenges: builder.query<any[], string>({
            queryFn: async (userId) => {
                // 1. Get participant entries
                const { data: participantEntries, error: pError } = await supabase
                    .from('challenge_participants')
                    .select('challenge_id')
                    .eq('user_id', userId);

                if (pError) return { error: pError.message };

                const challengeIds = (participantEntries || []).map((p) => p.challenge_id);
                if (!challengeIds.length) return { data: [] };

                // 2. Get challenges
                const { data: challenges, error: cError } = await supabase
                    .from('challenges')
                    .select('*, challenge_participants(count)')
                    .in('id', challengeIds)
                    .eq('status', 'active');

                if (cError) return { error: cError.message };
                return { data: challenges || [] };
            },
            providesTags: ['Challenge'],
        }),
        getChallenge: builder.query<Challenge & { participants_count: number }, string>({
            queryFn: async (challengeId) => {
                const { data: challenge, error } = await supabase
                    .from('challenges')
                    .select('*')
                    .eq('id', challengeId)
                    .single();

                if (error) return { error: error.message };

                const { count } = await supabase
                    .from('challenge_participants')
                    .select('*', { count: 'exact', head: true })
                    .eq('challenge_id', challengeId);

                return { data: { ...challenge, participants_count: count || 0 } };
            },
            providesTags: (result, error, id) => [{ type: 'Challenge', id }],
        }),
        getParticipantData: builder.query<ChallengeParticipant | null, { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                const { data, error } = await supabase
                    .from('challenge_participants')
                    .select('*')
                    .eq('challenge_id', challengeId)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') return { error: error.message };
                return { data: data || null };
            },
            providesTags: ['Participant'],
        }),
        joinChallenge: builder.mutation<void, { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                const { error } = await supabase
                    .from('challenge_participants')
                    .upsert({
                        challenge_id: challengeId,
                        user_id: userId,
                        current_points: 500,
                        is_active: true
                    });

                if (error) return { error: error.message };
                return { data: undefined };
            },
            invalidatesTags: ['Challenge', 'Participant'],
        }),
        createChallenge: builder.mutation<string, { challenge: Partial<Challenge>; userId: string }>({
            queryFn: async ({ challenge, userId }) => {
                // 1. Create Challenge
                const { data: newChallenge, error: cError } = await supabase
                    .from('challenges')
                    .insert({
                        ...challenge,
                        creator_id: userId,
                        status: 'active'
                    })
                    .select()
                    .single();

                if (cError) return { error: cError.message };

                // 2. Add Creator as Participant
                const { error: pError } = await supabase
                    .from('challenge_participants')
                    .insert({
                        challenge_id: newChallenge.id,
                        user_id: userId,
                        current_points: 500,
                        is_active: true
                    });

                if (pError) return { error: pError.message };

                return { data: newChallenge.id };
            },
            invalidatesTags: ['Challenge'],
        }),
        performCheckIn: builder.mutation<void, {
            challengeId: string;
            userId: string;
            imgSrc: string;
            location?: { lat: number; lng: number } | null
        }>({
            queryFn: async ({ challengeId, userId, imgSrc, location }) => {
                try {
                    // 1. Upload Image
                    const blob = await (await fetch(imgSrc)).blob();
                    const fileExt = "jpg";
                    const fileName = `${Date.now()}_checkin.${fileExt}`;
                    const filePath = `checkins/${challengeId}/${userId}/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from("challengers")
                        .upload(filePath, blob, { contentType: 'image/jpeg' });

                    if (uploadError) return { error: uploadError.message || "Upload failed" };

                    const { data: publicData } = supabase.storage.from("challengers").getPublicUrl(filePath);
                    const downloadURL = publicData.publicUrl;

                    // 2. Create Log
                    const today = new Date().toISOString().split('T')[0];
                    const { error: logError } = await supabase.from("daily_logs").insert({
                        challenge_id: challengeId,
                        user_id: userId,
                        date: today,
                        status: "completed",
                        created_at: new Date().toISOString(),
                        proof_url: downloadURL,
                        lat: location?.lat || null,
                        lng: location?.lng || null,
                        verified: true,
                    });

                    if (logError) return { error: logError.message || "Log creation failed" };

                    // 3. Update Streak & Points
                    const { data: participant } = await supabase
                        .from("challenge_participants")
                        .select("*")
                        .eq("challenge_id", challengeId)
                        .eq("user_id", userId)
                        .single();

                    if (participant) {
                        const newStreak = (participant.streak_current || 0) + 1;
                        const newBestStreak = Math.max(newStreak, participant.streak_best || 0);
                        let pointsToAdd = 0;

                        // Streak Bonus: Every 3 days -> +100 pts
                        if (newStreak % 3 === 0) {
                            pointsToAdd = 100;
                        }

                        await supabase.from("challenge_participants").update({
                            streak_current: newStreak,
                            streak_best: newBestStreak,
                            current_points: (participant.current_points || 0) + pointsToAdd
                        }).eq("challenge_id", challengeId).eq("user_id", userId);

                        // Update Global Profile Points
                        if (pointsToAdd > 0) {
                            const { data: profile } = await supabase.from("profiles").select("total_earned, current_points").eq("id", userId).single();
                            if (profile) {
                                await supabase.from("profiles").update({
                                    total_earned: (profile.total_earned || 0) + pointsToAdd,
                                    current_points: (profile.current_points || 0) + pointsToAdd
                                }).eq("id", userId);
                            }
                        }
                    }

                    return { data: undefined };
                } catch (error: any) {
                    return { error: error.message || "An unexpected error occurred" };
                }
            },
            invalidatesTags: ['Participant', 'Profile', 'Challenge'],
        }),
        getUserChallengeLogs: builder.query<any[], { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                const { data, error } = await supabase
                    .from('daily_logs')
                    .select('*')
                    .eq('challenge_id', challengeId)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) return { error: error.message };
                return { data: data || [] };
            },
            providesTags: (result, error, arg) => [{ type: 'Challenge', id: arg.challengeId }],
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
    useGetUserChallengeLogsQuery
} = apiSlice;
