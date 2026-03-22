"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Waypoint } from "@/types";

export type ActivityStatus = "idle" | "tracking" | "paused" | "finished";

/** Haversine distance between two GPS coordinates, in metres */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GPS_OPTS: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 2_000,
    timeout: 15_000,
};

// Only record a new point if the user moved at least this far (noise filter)
const MIN_MOVE_M = 3;
// Discard GPS readings with accuracy worse than this
const MAX_ACCURACY_M = 30;

export function useActivityTracking() {
    const [status, setStatus] = useState<ActivityStatus>("idle");
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [distanceM, setDistanceM] = useState(0);
    const [durationS, setDurationS] = useState(0);
    const [currentSpeedMs, setCurrentSpeedMs] = useState<number | null>(null);
    const [gpsError, setGpsError] = useState<string | null>(null);

    const watchIdRef = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const pausedMsRef = useRef<number>(0);          // total paused time
    const pauseStartRef = useRef<number | null>(null);
    const lastWpRef = useRef<Waypoint | null>(null);
    const distanceRef = useRef<number>(0);           // mirror of distanceM for callbacks

    // ---------- helpers ----------

    const clearWatch = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    }, []);

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Shared position handler used by both start() and resume()
    const handlePosition = useCallback((pos: GeolocationPosition) => {
        if (pos.coords.accuracy > MAX_ACCURACY_M) return;

        const wp: Waypoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: pos.timestamp,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
        };

        setWaypoints(prev => {
            const last = prev[prev.length - 1];
            if (last) {
                const d = haversine(last.lat, last.lng, wp.lat, wp.lng);
                if (d < MIN_MOVE_M) return prev;          // GPS noise — skip

                distanceRef.current += d;
                setDistanceM(distanceRef.current);

                const dtS = (wp.timestamp - last.timestamp) / 1_000;
                if (dtS > 0) setCurrentSpeedMs(d / dtS);
            }
            lastWpRef.current = wp;
            return [...prev, wp];
        });
    }, []);

    const startTimer = useCallback(() => {
        clearTimer();
        timerRef.current = setInterval(() => {
            if (startTimeRef.current !== null) {
                const elapsed = Date.now() - startTimeRef.current - pausedMsRef.current;
                setDurationS(Math.max(0, Math.floor(elapsed / 1_000)));
            }
        }, 1_000);
    }, [clearTimer]);

    // ---------- public actions ----------

    const start = useCallback(() => {
        if (!("geolocation" in navigator)) {
            setGpsError("Geolocation is not supported by this device.");
            return;
        }

        // Reset everything
        setWaypoints([]);
        setDistanceM(0);
        setDurationS(0);
        setCurrentSpeedMs(null);
        setGpsError(null);
        distanceRef.current = 0;
        pausedMsRef.current = 0;
        pauseStartRef.current = null;
        lastWpRef.current = null;
        startTimeRef.current = Date.now();

        setStatus("tracking");
        startTimer();

        watchIdRef.current = navigator.geolocation.watchPosition(
            handlePosition,
            (err) => setGpsError(`GPS: ${err.message}`),
            GPS_OPTS
        );
    }, [handlePosition, startTimer]);

    const pause = useCallback(() => {
        clearWatch();
        clearTimer();
        pauseStartRef.current = Date.now();
        setCurrentSpeedMs(null);
        setStatus("paused");
    }, [clearWatch, clearTimer]);

    const resume = useCallback(() => {
        if (pauseStartRef.current !== null) {
            pausedMsRef.current += Date.now() - pauseStartRef.current;
            pauseStartRef.current = null;
        }
        setStatus("tracking");
        startTimer();
        watchIdRef.current = navigator.geolocation.watchPosition(
            handlePosition,
            (err) => setGpsError(`GPS: ${err.message}`),
            GPS_OPTS
        );
    }, [handlePosition, startTimer]);

    /** Stop tracking — status moves to "finished". Read waypoints/distanceM/durationS from state. */
    const finish = useCallback(() => {
        clearWatch();
        clearTimer();
        setCurrentSpeedMs(null);
        if (pauseStartRef.current !== null) {
            pausedMsRef.current += Date.now() - pauseStartRef.current;
            pauseStartRef.current = null;
        }
        // Force one last duration update
        if (startTimeRef.current !== null) {
            const elapsed = Date.now() - startTimeRef.current - pausedMsRef.current;
            setDurationS(Math.max(0, Math.floor(elapsed / 1_000)));
        }
        setStatus("finished");
    }, [clearWatch, clearTimer]);

    const reset = useCallback(() => {
        clearWatch();
        clearTimer();
        setStatus("idle");
        setWaypoints([]);
        setDistanceM(0);
        setDurationS(0);
        setCurrentSpeedMs(null);
        setGpsError(null);
        distanceRef.current = 0;
        pausedMsRef.current = 0;
        startTimeRef.current = null;
        lastWpRef.current = null;
    }, [clearWatch, clearTimer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearWatch();
            clearTimer();
        };
    }, [clearWatch, clearTimer]);

    // ---------- derived ----------

    const avgPaceSPerKm =
        distanceM > 0 && durationS > 0 ? durationS / (distanceM / 1_000) : null;

    return {
        status,
        waypoints,
        distanceM,
        durationS,
        avgPaceSPerKm,   // seconds per km
        currentSpeedMs,
        gpsError,
        start,
        pause,
        resume,
        finish,
        reset,
    };
}
