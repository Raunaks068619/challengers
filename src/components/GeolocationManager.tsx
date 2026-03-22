"use client";

/**
 * GeolocationManager (headless)
 *
 * Mounts the useGeolocation hook at the app root so user location is
 * silently synced to Firestore whenever the app is open.
 * No UI is rendered — this is purely a side-effect component.
 */

import { useAuth } from "@/context/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";

export default function GeolocationManager() {
    const { user } = useAuth();
    // Hook auto-fetches on mount if permission is already granted,
    // and persists to profiles/{userId}.lastLocation in Firestore.
    useGeolocation(user?.uid ?? null);
    return null;
}
