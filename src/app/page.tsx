"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useGetProfileQuery, useGetActiveChallengesQuery, useJoinChallengeByCodeMutation } from "@/lib/features/api/apiSlice";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { checkMissedLogs } from "@/lib/gamification";

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();

  // RTK Query Hooks
  const { data: userProfile, isLoading: profileLoading } = useGetProfileQuery(user?.id || '', {
    skip: !user?.id,
  });

  const { data: activeChallenges = [], isLoading: challengesLoading } = useGetActiveChallengesQuery(user?.id || '', {
    skip: !user?.id,
  });

  const [joinByCode, { isLoading: joining }] = useJoinChallengeByCodeMutation();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const loading = profileLoading || challengesLoading;

  useEffect(() => {
    if (user) {
      // Run lazy check for missed logs
      checkMissedLogs(user.id);
    }
  }, [user]);

  const handleJoinByCode = async () => {
    if (!joinCode || joinCode.length < 6) {
      toast.error("Please enter a valid 6-character code");
      return;
    }

    try {
      const result = await joinByCode({ code: joinCode.toUpperCase(), userId: user?.id || '' }).unwrap();
      toast.success("Joined challenge successfully!");
      setShowJoinModal(false);
      setJoinCode("");
      router.push(`/challenges/${result}`);
    } catch (error: any) {
      console.error("Join error:", error);
      toast.error(error.data?.error || "Failed to join challenge. Check the code.");
    }
  };

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
              <div className="flex gap-2">
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="text-zinc-400 text-sm hover:text-white transition-colors"
                >
                  Join with Code
                </button>
                <Link href="/challenges/create" className="text-indigo-400 text-sm hover:text-indigo-300">
                  + New
                </Link>
              </div>
            </div>

            {loading ? (
              <p className="text-zinc-500 text-sm">Loading challenges...</p>
            ) : activeChallenges.length === 0 ? (
              <div className="bg-zinc-900/50 rounded-2xl p-8 text-center border border-zinc-800 border-dashed">
                <p className="text-zinc-500 mb-4 text-sm">No active challenges found.</p>
                <div className="flex flex-col gap-3">
                  <Link href="/challenges/create" className="inline-block px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
                    Create Challenge
                  </Link>
                  <button onClick={() => setShowJoinModal(true)} className="text-sm text-zinc-400 hover:text-white">
                    or Join with Code
                  </button>
                </div>
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

        {/* Join Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800">
              <h3 className="text-lg font-bold mb-4">Join Challenge</h3>
              <p className="text-zinc-400 text-sm mb-4">Enter the 6-character code shared by your friend.</p>

              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center text-2xl font-mono tracking-widest mb-6 focus:outline-none focus:border-indigo-500 uppercase"
                maxLength={6}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-3 bg-zinc-800 rounded-xl font-medium hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinByCode}
                  disabled={joining || joinCode.length < 6}
                  className="flex-1 py-3 bg-indigo-600 rounded-xl font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joining ? "Joining..." : "Join"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
