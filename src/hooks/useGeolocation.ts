"use client";

/**
 * useGeolocation
 *
 * Gets the user's current GPS location and silently syncs it to Firestore
 * (profiles/{userId}.lastLocation). The stored location is used by the
 * geo-reminder cron to send "You're near [place], check in now!" notifications.
 *
 * Usage: call this hook once high up in the tree (e.g. in a layout or AuthContext).
 * It requests permission lazily — only when `request()` is called or when the
 * user already granted permission from a previous session.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface GeoLocation {
    lat: number;
    lng: number;
    accuracy: number; // metres
    updatedAt: string; // ISO string
}

interface UseGeolocationReturn {
    location: GeoLocation | null;
    permission: PermissionState | "unsupported" | "unknown";
    isLoading: boolean;
    error: string | null;
    /** Explicitly request the user's location (triggers the browser permission prompt if needed) */
    request: () => void;
}

const GEO_OPTIONS: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 60_000 // reuse a cached fix up to 1 minute old
};

/** Minimum distance (metres) before we bother re-writing to Firestore */
const MIN_UPDATE_DISTANCE_M = 50;

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

export function useGeolocation(userId?: string | null): UseGeolocationReturn {
    const [location, setLocation] = useState<GeoLocation | null>(null);
    const [permission, setPermission] = useState<PermissionState | "unsupported" | "unknown">("unknown");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track last persisted location to avoid redundant Firestore writes
    const lastPersistedRef = useRef<GeoLocation | null>(null);

    const persistToFirestore = useCallback(
        async (geo: GeoLocation) => {
            if (!userId) return;

            // Skip write if user hasn't moved more than MIN_UPDATE_DISTANCE_M
            const prev = lastPersistedRef.current;
            if (prev) {
                const dist = haversine(prev.lat, prev.lng, geo.lat, geo.lng);
                if (dist < MIN_UPDATE_DISTANCE_M) return;
            }

            try {
                await setDoc(
                    doc(db, "profiles", userId),
                    { lastLocation: geo },
                    { merge: true }
                );
                lastPersistedRef.current = geo;
                console.info("[useGeolocation] Location persisted to Firestore");
            } catch (err) {
                console.warn("[useGeolocation] Failed to persist location:", err);
            }
        },
        [userId]
    );

    const handlePosition = useCallback(
        (pos: GeolocationPosition) => {
            const geo: GeoLocation = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: Math.round(pos.coords.accuracy),
                updatedAt: new Date().toISOString()
            };
            setLocation(geo);
            setIsLoading(false);
            setError(null);
            persistToFirestore(geo);
        },
        [persistToFirestore]
    );

    const handleError = useCallback((err: GeolocationPositionError) => {
        setIsLoading(false);
        switch (err.code) {
            case err.PERMISSION_DENIED:
                setPermission("denied");
                setError("Location permission denied");
                break;
            case err.POSITION_UNAVAILABLE:
                setError("Location unavailable — check GPS signal");
                break;
            case err.TIMEOUT:
                setError("Location request timed out");
                break;
            default:
                setError("Unknown location error");
        }
    }, []);

    const request = useCallback(() => {
        if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
            setPermission("unsupported");
            return;
        }
        setIsLoading(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(handlePosition, handleError, GEO_OPTIONS);
    }, [handlePosition, handleError]);

    // On mount: check existing permission and auto-fetch if already granted
    useEffect(() => {
        if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
            setPermission("unsupported");
            return;
        }

        if (!("permissions" in navigator)) {
            // Can't query permission state — just try silently
            request();
            return;
        }

        navigator.permissions.query({ name: "geolocation" }).then((status) => {
            setPermission(status.state);

            // Auto-fetch if already granted — no prompt shown
            if (status.state === "granted") {
                request();
            }

            // React to future permission changes (e.g. user revokes from settings)
            status.onchange = () => {
                setPermission(status.state);
                if (status.state === "granted") request();
            };
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // only on mount

    // Re-persist whenever userId becomes available (late login)
    useEffect(() => {
        if (userId && location) {
            persistToFirestore(location);
        }
    }, [userId, location, persistToFirestore]);

    return { location, permission, isLoading, error, request };
}
