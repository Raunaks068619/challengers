"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useEffect, useState } from "react";
import TaskProgressCard from "@/components/TaskProgressCard";
import ParticipantsCard from "@/components/ParticipantsCard";
import { useGetProfileQuery, useGetActiveChallengesQuery, useGetUserWeeklyLogsQuery, useGetAllParticipantsQuery, useGetChallengePointsHistoryQuery, useJoinChallengeByCodeMutation } from "@/lib/features/api/apiSlice";
import { checkMissedLogs } from "@/lib/gamification";

import { Plus, ArrowRight, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ProgressChart from "@/components/ProgressChart";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { user } = useAuth();


  // RTK Query Hooks
  const { data: userProfile, isLoading: profileLoading } = useGetProfileQuery(user?.uid || '', {
    skip: !user?.uid,
  });

  const { data: activeChallenges = [], isLoading: challengesLoading } = useGetActiveChallengesQuery(user?.uid || '', {
    skip: !user?.uid,
  });

  const { data: weeklyLogs = [] } = useGetUserWeeklyLogsQuery(user?.uid || '', {
    skip: !user?.uid,
  });

  const { data: participants = [] } = useGetAllParticipantsQuery(user?.uid || '', {
    skip: !user?.uid,
  });



  // Get the first active challenge ID for the chart
  const firstChallengeId = activeChallenges.length > 0 ? activeChallenges[0].id : null;

  const { data: historyData = [] } = useGetChallengePointsHistoryQuery(firstChallengeId || '', {
    skip: !firstChallengeId
  });

  // Calculate Task Progress (Daily)
  // Denominator: Active Challenges that are active today (not a rest day)
  // Numerator: Actual logs created today
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0-6
  const todayDateString = today.toISOString().split('T')[0];

  const totalDailyTasks = activeChallenges.reduce((acc: number, challenge: any) => {
    const restDays = challenge.rest_days || [];
    // If today is a rest day, don't count it
    if (restDays.includes(dayOfWeek)) {
      return acc;
    }
    return acc + 1;
  }, 0);

  const completedDailyTasks = weeklyLogs.filter((log: any) => log.date === todayDateString).length;



  const [joinByCode, { isLoading: joining }] = useJoinChallengeByCodeMutation();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

  const handleJoinByCode = async () => {
    if (!joinCode || joinCode.length < 6) {
      toast.error("Please enter a valid 6-character code");
      return;
    }

    try {
      const result = await joinByCode({ code: joinCode.toUpperCase(), userId: user?.uid || '' }).unwrap();
      toast.success("Joined challenge successfully!");
      setShowJoinModal(false);
      setJoinCode("");
      router.push(`/challenges/${result}`);
    } catch (error: any) {
      console.error("Join error:", error);
      toast.error(error.data?.error || "Failed to join challenge. Check the code.");
    }
  };

  useEffect(() => {
    if (user) {
      // Run lazy check for missed logs
      checkMissedLogs(user.uid);
    }
  }, [user]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background text-foreground p-6 pb-20">
        {/* Header */}
        <PageHeader
          title="Challengers"
          showNotificationComponent={true}
          className="mb-4"
        />

        <main className="space-y-8">
          {challengesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : activeChallenges.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center space-y-6 py-12">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Welcome to Challengers!</h2>
                <p className="text-muted-foreground">Join a challenge or create one to get started.</p>
              </div>

              <div className="grid grid-cols-1 w-full gap-4">
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="py-6 bg-card border border-border rounded-2xl text-lg font-bold hover:bg-muted transition-colors text-foreground flex flex-col items-center justify-center gap-3 shadow-sm"
                >
                  <Users className="w-8 h-8 text-primary" />
                  Join with Code
                </button>
                <Link
                  href="/challenges/create"
                  className="py-6 bg-primary rounded-2xl text-lg font-bold text-center text-primary-foreground hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 flex flex-col items-center justify-center gap-3"
                >
                  <Plus className="w-8 h-8" />
                  New Challenge
                </Link>
              </div>
            </div>
          ) : (
            /* Gamification Metrics */
            <section>
              <h2 className="text-base font-semibold mb-4 text-foreground">Your Progress</h2>
              <div className="space-y-4">
                {/* Task Progress Card - Full Width */}
                <TaskProgressCard
                  completed={completedDailyTasks}
                  total={totalDailyTasks}
                  className="w-full"
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Current Points</p>
                    <p className="text-3xl font-medium text-foreground">{userProfile?.current_points || 0}</p>
                  </div>
                  <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Lost</p>
                    <p className="text-3xl font-medium text-foreground">{userProfile?.total_lost || 0}</p>
                  </div>

                  {/* Active Challenges Card - Clickable */}
                  <Link href="/challenges" className="bg-card rounded-2xl p-4 border border-border shadow-sm hover:bg-muted/50 transition-colors flex flex-col justify-between">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Active Challenges</p>
                      <p className="text-3xl font-medium text-foreground">{activeChallenges.length}</p>
                    </div>
                    <div className="mt-2 flex items-center text-xs text-primary font-medium">
                      View All <ArrowRight className="w-3 h-3 ml-1" />
                    </div>
                  </Link>

                  {/* Participants Card */}
                  <ParticipantsCard
                    participants={participants}
                    className="col-span-1 h-full"
                  />
                </div>

                {/* Progress Chart */}
                <ProgressChart data={historyData} />
              </div>
            </section>
          )}
        </main>

        {/* Join Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border shadow-xl">
              <h3 className="text-lg font-bold mb-4 text-foreground">Join Challenge</h3>
              <p className="text-muted-foreground text-sm mb-4">Enter the 6-character code shared by your friend.</p>

              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="E.G. A1B2C3"
                className="w-full bg-background border border-border rounded-xl p-3 text-center text-2xl font-mono tracking-widest mb-6 focus:outline-none focus:ring-2 focus:ring-primary uppercase placeholder:text-muted-foreground/50 text-foreground"
                maxLength={6}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-3 bg-muted rounded-xl font-medium hover:bg-muted/80 text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinByCode}
                  disabled={joining || joinCode.length < 6}
                  className="flex-1 py-3 bg-primary rounded-xl font-medium hover:opacity-90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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
