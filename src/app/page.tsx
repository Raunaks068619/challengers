"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useEffect } from "react";
import TaskProgressCard from "@/components/TaskProgressCard";
import ParticipantsCard from "@/components/ParticipantsCard";
import { useGetProfileQuery, useGetActiveChallengesQuery, useGetUserWeeklyLogsQuery, useGetAllParticipantsQuery } from "@/lib/features/api/apiSlice";
import { checkMissedLogs } from "@/lib/gamification";

import { Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";

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
          {/* Gamification Metrics */}
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
                <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Active Challenges</p>
                  <p className="text-3xl font-medium text-foreground">{activeChallenges.length}</p>
                </div>
                <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Total Earned</p>
                  <p className="text-3xl font-medium text-foreground">{userProfile?.total_earned || 0}</p>
                </div>

                {/* Participants Card */}
                <ParticipantsCard
                  participants={participants}
                  className="col-span-1"
                />
              </div>
            </div>
          </section>
        </main>

      </div>
    </AuthGuard>
  );
}
