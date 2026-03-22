"use client";

import dynamic from "next/dynamic";
import type { Waypoint } from "@/types";
import { MapPin } from "lucide-react";

const RouteMapInner = dynamic(() => import("./activity/RouteMapInner"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900 rounded-xl">
            <div className="text-zinc-400 text-xs animate-pulse flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Loading map…
            </div>
        </div>
    ),
});

interface RouteMapProps {
    waypoints: Waypoint[];
    className?: string;
    /** Height of the map container. Defaults to "h-48" */
    heightClass?: string;
    distanceM?: number;
    durationS?: number;
    avgPaceSPerKm?: number | null;
}

/** Displays a saved GPS route as a polyline with start/end markers and stats overlay */
export default function RouteMap({
    waypoints,
    className = "",
    heightClass = "h-48",
    distanceM,
    durationS,
    avgPaceSPerKm,
}: RouteMapProps) {
    if (!waypoints || waypoints.length === 0) return null;

    return (
        <div className={`relative rounded-xl overflow-hidden ${heightClass} ${className}`}>
            <RouteMapInner waypoints={waypoints} />

            {/* Stats overlay at bottom */}
            {(distanceM !== undefined || durationS !== undefined) && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 flex gap-4">
                    {distanceM !== undefined && (
                        <StatChip
                            label="Distance"
                            value={distanceM >= 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${Math.round(distanceM)} m`}
                        />
                    )}
                    {durationS !== undefined && (
                        <StatChip label="Time" value={formatDuration(durationS)} />
                    )}
                    {avgPaceSPerKm != null && isFinite(avgPaceSPerKm) && (
                        <StatChip label="Pace" value={formatPace(avgPaceSPerKm)} />
                    )}
                </div>
            )}
        </div>
    );
}

function StatChip({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-white/50 text-[9px] uppercase tracking-wider leading-none mb-0.5">{label}</p>
            <p className="text-white text-xs font-bold tabular-nums">{value}</p>
        </div>
    );
}

function formatDuration(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

function formatPace(secPerKm: number): string {
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, "0")} /km`;
}
