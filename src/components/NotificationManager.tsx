"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGetActiveChallengesQuery } from "@/lib/features/api/apiSlice";
import { toast } from "sonner";
import { useNotification } from "@/notifications/useNotification";

export default function NotificationManager() {
    const { user } = useAuth();
    const { isSubscribed, isGranted } = useNotification();
    const { data: challenges = [] } = useGetActiveChallengesQuery(user?.uid || '', {
        skip: !user?.uid,
        pollingInterval: 60000, // Poll every minute to keep data fresh
    });

    const sentNotificationsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Only check notifications if user is logged in and has granted permission
        if (!user || !isGranted) return;

        const checkNotifications = () => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

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
                        // Show local notification
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification(`Upcoming Challenge: ${challenge.title}`, {
                                body: `Your challenge starts in 15 minutes! Get ready.`,
                                icon: '/icon-192x192.png',
                                badge: '/icon-192x192.png',
                                tag: `challenge-${challenge.id}-start`
                            });
                        }
                        sentNotificationsRef.current.add(notificationKey + '-start');
                        toast.info(`Reminder: ${challenge.title} starts in 15 mins!`);
                    }
                }
                // 2. Non-time-bound Challenges: 11 AM reminder
                else {
                    if (currentHour === 11 && currentMinute === 0 && !sentNotificationsRef.current.has(notificationKey + '-daily')) {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification(`Daily Challenge Reminder`, {
                                body: `Don't forget to complete your challenge: ${challenge.title}`,
                                icon: '/icon-192x192.png',
                                badge: '/icon-192x192.png',
                                tag: `challenge-${challenge.id}-daily`
                            });
                        }
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
    }, [user, challenges, isGranted]);

    return null; // Headless component
}
