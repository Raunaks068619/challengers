"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useGetProfileQuery, useGetActiveChallengesQuery } from "@/lib/features/api/apiSlice";
import { supabase } from "@/lib/supabase";

import { checkMissedLogs } from "@/lib/gamification";

export default function Dashboard() {
  const { user } = useAuth();

  // RTK Query Hooks
  const { data: userProfile, isLoading: profileLoading } = useGetProfileQuery(user?.id || '', {
    skip: !user?.id,
  });

  const { data: activeChallenges = [], isLoading: challengesLoading } = useGetActiveChallengesQuery(user?.id || '', {
    skip: !user?.id,
  });

  const loading = profileLoading || challengesLoading;

  useEffect(() => {
    if (user) {
      // Run lazy check for missed logs
      checkMissedLogs(user.id);
    }
  }, [user]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-zinc-950 text-white p-4 pb-20">
        <header className="flex justify-between items-center mb-8 pt-4">
          <div>
            <h1 className="text-2xl font-bold">Hello, {userProfile?.display_name?.split(' ')[0]}</h1>
            <p className="text-zinc-400 text-sm">Ready for a challenge?</p>
          </div>
          <Link href="/profile" className="h-10 w-10 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700 block">
            {userProfile?.photo_url ? (
              <img src={userProfile.photo_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">?</div>
            )}
          </Link>
        </header>

        <main className="space-y-6">
          {/* Gamification Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <p className="text-zinc-400 text-xs mb-1">Current Points</p>
              <p className="text-2xl font-bold text-indigo-400">{userProfile?.current_points || 0}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <p className="text-zinc-400 text-xs mb-1">Total Lost (Treat Pool)</p>
              <p className="text-2xl font-bold text-red-400">{userProfile?.total_lost || 0}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <p className="text-zinc-400 text-xs mb-1">Active Challenges</p>
              <p className="text-2xl font-bold text-white">{activeChallenges.length}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <p className="text-zinc-400 text-xs mb-1">Total Earned</p>
              <p className="text-2xl font-bold text-green-400">{userProfile?.total_earned || 0}</p>
            </div>
          </div>

          {/* Active Challenges */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Active Challenges</h2>
              <Link href="/challenges/create" className="text-indigo-400 text-sm hover:text-indigo-300">
                + New
              </Link>
            </div>

            {loading ? (
              <p className="text-zinc-500 text-sm">Loading challenges...</p>
            ) : activeChallenges.length === 0 ? (
              <div className="bg-zinc-900/50 rounded-2xl p-8 text-center border border-zinc-800 border-dashed">
                <p className="text-zinc-500 mb-4 text-sm">No active challenges found.</p>
                <Link href="/challenges/create" className="inline-block px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
                  Create Challenge
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {activeChallenges.map((ch) => (
                  <Link key={ch.id} href={`/challenges/${ch.id}`} className="block bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-indigo-500 transition-colors">
                    <h3 className="font-medium">{ch.title}</h3>
                    <div className="flex gap-4 mt-2 text-sm text-zinc-400">
                      <span>{ch.challenge_participants?.[0]?.count || 0} Participants</span>
                      <span>{ch.time_window_start} - {ch.time_window_end}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
