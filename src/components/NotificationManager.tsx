"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGetActiveChallengesQuery } from "@/lib/features/api/apiSlice";
import { toast } from "sonner";

import useFcmToken from "@/hooks/useFcmToken";

export default function NotificationManager() {
    const { user } = useAuth();
    const { token, notificationPermission } = useFcmToken();
    const { data: challenges = [] } = useGetActiveChallengesQuery(user?.uid || '', {
        skip: !user?.uid,
        pollingInterval: 60000, // Poll every minute to keep data fresh
    });

    const lastCheckRef = useRef<number>(Date.now());
    const sentNotificationsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!user || !("Notification" in window)) return;

        const checkNotifications = () => {
            if (Notification.permission !== "granted") return;

            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

            // Reset sent notifications at midnight
            if (currentHour === 0 && currentMinute === 0) {
                sentNotificationsRef.current.clear();
            }

            challenges.forEach(challenge => {
                const notificationKey = `${challenge.id}-${now.toDateString()}`;

                // 1. Time-bound Challenges: 15 mins before start
                if (challenge.time_window_start) {
                    const [startHour, startMinute] = challenge.time_window_start.split(':').map(Number);
                    const startTimeInMinutes = startHour * 60 + startMinute;
                    const currentTimeInMinutes = currentHour * 60 + currentMinute;

                    const diff = startTimeInMinutes - currentTimeInMinutes;

                    if (diff === 15 && !sentNotificationsRef.current.has(notificationKey + '-start')) {
                        new Notification(`Upcoming Challenge: ${challenge.title}`, {
                            body: `Your challenge starts in 15 minutes! Get ready.`,
                            icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔥</text></svg>'
                        });
                        sentNotificationsRef.current.add(notificationKey + '-start');
                        toast.info(`Reminder: ${challenge.title} starts in 15 mins!`);
                    }
                }
                // 2. Non-time-bound Challenges: 11 AM reminder
                else {
                    if (currentHour === 11 && currentMinute === 0 && !sentNotificationsRef.current.has(notificationKey + '-daily')) {
                        new Notification(`Daily Challenge Reminder`, {
                            body: `Don't forget to complete your challenge: ${challenge.title}`,
                            icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔥</text></svg>'
                        });
                        sentNotificationsRef.current.add(notificationKey + '-daily');
                        toast.info(`Reminder: Complete ${challenge.title} today!`);
                    }
                }
            });
        };

        // Check immediately and then every minute
        checkNotifications();
        const interval = setInterval(checkNotifications, 60000);

        return () => clearInterval(interval);
    }, [user, challenges]);

    return null; // Headless component
}
