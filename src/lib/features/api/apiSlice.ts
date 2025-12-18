import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { Challenge, UserProfile, ChallengeParticipant } from '@/types';

export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery: fakeBaseQuery(),
    tagTypes: ['Profile', 'Challenge', 'Participant', 'Log'],
    refetchOnMountOrArgChange: true,
    endpoints: (builder) => ({
        getProfile: builder.query<UserProfile, string>({
            queryFn: async (userId) => {
                try {
                    const res = await fetch(`/api/profile?userId=${userId}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data: data as UserProfile };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Profile'],
            keepUnusedDataFor: 300, // 5 minutes
        }),
        updateProfile: builder.mutation<null, { userId: string; updates: Partial<UserProfile> }>({
            queryFn: async ({ userId, updates }) => {
                try {
                    const res = await fetch('/api/profile', {
                        method: 'POST',
                        body: JSON.stringify({ userId, updates }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
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
                    const res = await fetch(`/api/challenges/active?userId=${userId}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Challenge'],
            keepUnusedDataFor: 300,
        }),
        getChallenge: builder.query<Challenge & { participants_count: number }, string>({
            queryFn: async (challengeId) => {
                try {
                    const res = await fetch(`/api/challenges/${challengeId}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: (result, error, id) => [{ type: 'Challenge', id }],
        }),
        getParticipantData: builder.query<ChallengeParticipant | null, { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                try {
                    const res = await fetch(`/api/challenges/${challengeId}/participant?userId=${userId}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data: data as ChallengeParticipant };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Participant'],
        }),
        joinChallenge: builder.mutation<null, { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                try {
                    const res = await fetch('/api/challenges/join', {
                        method: 'POST',
                        body: JSON.stringify({ challengeId, userId }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data: null };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: ['Challenge', 'Participant', 'Profile'],
        }),
        joinChallengeByCode: builder.mutation<string, { code: string; userId: string }>({
            queryFn: async ({ code, userId }) => {
                try {
                    const res = await fetch('/api/challenges/join', {
                        method: 'POST',
                        body: JSON.stringify({ code, userId }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data: data.challengeId };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: ['Challenge', 'Participant', 'Profile'],
        }),
        leaveChallenge: builder.mutation<null, { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                try {
                    const res = await fetch('/api/challenges/leave', {
                        method: 'POST',
                        body: JSON.stringify({ challengeId, userId }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data: null };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: ['Challenge', 'Participant', 'Profile'],
        }),
        createChallenge: builder.mutation<string, { challenge: Partial<Challenge>; userId: string }>({
            queryFn: async ({ challenge, userId }) => {
                try {
                    const res = await fetch('/api/challenges/create', {
                        method: 'POST',
                        body: JSON.stringify({ challenge, userId }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data: data.challengeId };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            invalidatesTags: ['Challenge'],
        }),
        updateChallenge: builder.mutation<null, { challengeId: string; updates: Partial<Challenge> }>({
            queryFn: async ({ challengeId, updates }) => {
                try {
                    const res = await fetch(`/api/challenges/${challengeId}`, {
                        method: 'POST',
                        body: JSON.stringify({ updates }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
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
                    const response = await fetch('/api/checkin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ challengeId, userId, imgSrc, location, note }),
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || "Check-in failed");
                    return { data: null };
                } catch (error: any) {
                    return { error: error?.message || "An unexpected error occurred" };
                }
            },
            invalidatesTags: ['Participant', 'Profile', 'Challenge', 'Log'],
        }),
        getUserChallengeLogs: builder.query<any[], { challengeId: string; userId: string }>({
            queryFn: async ({ challengeId, userId }) => {
                try {
                    const res = await fetch(`/api/logs/challenge?challengeId=${challengeId}&userId=${userId}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: (result, error, arg) => [{ type: 'Challenge', id: arg.challengeId }],
        }),
        getUserWeeklyLogs: builder.query<any[], string>({
            queryFn: async (userId) => {
                try {
                    const res = await fetch(`/api/logs/weekly?userId=${userId}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Log', 'Participant'],
        }),
        getAllParticipants: builder.query<UserProfile[], string>({
            queryFn: async (userId) => {
                try {
                    const res = await fetch(`/api/participants?userId=${userId}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Participant'],
        }),
        getChallengePointsHistory: builder.query<any[], string>({
            queryFn: async (challengeId) => {
                try {
                    const res = await fetch(`/api/challenges/${challengeId}/history`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
            providesTags: ['Challenge', 'Participant'],
        }),
        getChallengeParticipantsPointsHistory: builder.query<{ history: any[]; users: { id: string; name: string }[] }, string>({
            queryFn: async (challengeId) => {
                try {
                    const res = await fetch(`/api/challenges/${challengeId}/history?type=participants`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return { data };
                } catch (e: any) {
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
