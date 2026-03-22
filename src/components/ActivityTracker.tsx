"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
    Play,
    Pause,
    Square,
    ChevronLeft,
    Navigation,
    AlertTriangle,
    CheckCircle,
    Clock,
    Zap,
    MapPin,
} from "lucide-react";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import type { Waypoint, Challenge } from "@/types";

// ─── Dynamic Leaflet import (SSR-safe) ─────────────────────────────────────
const LiveMap = dynamic(() => import("./activity/LiveMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
            <div className="text-zinc-400 text-sm animate-pulse flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Loading map…
            </div>
        </div>
    ),
});

// ─── Formatting helpers ──────────────────────────────────────────────────────
function fmtDuration(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function fmtDistance(m: number): string {
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(2)} km`;
}

function fmtPace(secPerKm: number | null): string {
    if (secPerKm === null || !isFinite(secPerKm)) return "--:--";
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, "0")} /km`;
}

function fmtSpeed(ms: number | null): string {
    if (ms === null) return "0.0";
    return (ms * 3.6).toFixed(1);
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface ActivityTrackerProps {
    challenge: Challenge;
    onFinish: (data: { waypoints: Waypoint[]; distanceM: number; durationS: number; avgPaceSPerKm: number | null }) => void;
    onCancel: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ActivityTracker({ challenge, onFinish, onCancel }: ActivityTrackerProps) {
    const {
        status,
        waypoints,
        distanceM,
        durationS,
        avgPaceSPerKm,
        currentSpeedMs,
        gpsError,
        start,
        pause,
        resume,
        finish,
        reset,
    } = useActivityTracking();

    // Keep screen awake via WakeLock API while tracking
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    useEffect(() => {
        if (status === "tracking") {
            navigator.wakeLock?.request("screen").then((wl) => {
                wakeLockRef.current = wl;
            }).catch(() => { /* not critical */ });
        } else {
            wakeLockRef.current?.release().catch(() => { });
            wakeLockRef.current = null;
        }
    }, [status]);

    // Re-acquire wake lock if user switches tabs and comes back
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "visible" && status === "tracking") {
                navigator.wakeLock?.request("screen").then((wl) => {
                    wakeLockRef.current = wl;
                }).catch(() => { });
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [status]);

    const minDist = challenge.min_distance_m ?? 0;
    const minDur = challenge.min_duration_s ?? 0;
    const distOk = distanceM >= minDist;
    const durOk = durationS >= minDur;
    const canFinish = (status === "tracking" || status === "paused") && distOk && durOk;

    const handleFinish = () => {
        finish();
        // status will become "finished" — the useEffect below handles submitting
    };

    // When status becomes "finished", pass data up
    const finishCalledRef = useRef(false);
    useEffect(() => {
        if (status === "finished" && !finishCalledRef.current) {
            finishCalledRef.current = true;
            onFinish({ waypoints, distanceM, durationS, avgPaceSPerKm });
        }
    }, [status, waypoints, distanceM, durationS, avgPaceSPerKm, onFinish]);

    const handleCancel = () => {
        reset();
        onCancel();
    };

    // ── Activity type icon / label ──
    const activityLabel = {
        run: "Run",
        walk: "Walk",
        cycle: "Cycle",
        any: "Activity",
    }[challenge.activity_type ?? "any"] ?? "Activity";

    // ─── Idle screen ─────────────────────────────────────────────────────────
    if (status === "idle") {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 p-4 pt-safe">
                    <button onClick={handleCancel} className="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-white font-bold text-base leading-tight">{challenge.title}</h1>
                        <p className="text-zinc-400 text-xs">{activityLabel} Challenge</p>
                    </div>
                </div>

                {/* Map preview (no route yet) */}
                <div className="flex-1 relative">
                    <LiveMap waypoints={[]} />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-4">
                        <div className="text-center">
                            <p className="text-white/60 text-sm mb-1">Ready to track your {activityLabel.toLowerCase()}</p>
                            {minDist > 0 && (
                                <p className="text-zinc-400 text-xs">Min: {fmtDistance(minDist)}{minDur > 0 ? ` · ${fmtDuration(minDur)}` : ""}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Start button */}
                <div className="p-6 pb-safe">
                    {gpsError && (
                        <div className="flex items-center gap-2 text-yellow-400 text-sm mb-4 bg-yellow-400/10 rounded-xl p-3">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {gpsError}
                        </div>
                    )}
                    <button
                        onClick={start}
                        className="w-full py-5 bg-primary rounded-2xl font-bold text-lg text-primary-foreground shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 hover:opacity-90 active:scale-95 transition-all"
                    >
                        <Play className="w-6 h-6 fill-current" />
                        Start {activityLabel}
                    </button>
                </div>
            </div>
        );
    }

    // ─── Tracking / Paused screen ─────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Live Map — fills most of the screen */}
            <div className="flex-1 relative">
                <LiveMap waypoints={waypoints} follow />

                {/* Floating GPS error banner */}
                {gpsError && (
                    <div className="absolute top-4 left-4 right-4 z-10 bg-yellow-500/90 backdrop-blur-md text-black text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {gpsError}
                    </div>
                )}

                {/* Floating status badge */}
                <div className="absolute top-4 right-4 z-10">
                    {status === "paused" ? (
                        <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">PAUSED</span>
                    ) : (
                        <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            LIVE
                        </span>
                    )}
                </div>
            </div>

            {/* Stats panel */}
            <div className="bg-zinc-950 text-white rounded-t-3xl border-t border-zinc-800 px-6 pt-4 pb-2">
                {/* Primary stat — distance */}
                <div className="text-center mb-3">
                    <p className="text-5xl font-black tabular-nums tracking-tight">
                        {distanceM >= 1000
                            ? (distanceM / 1000).toFixed(2)
                            : Math.round(distanceM).toString()}
                    </p>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">
                        {distanceM >= 1000 ? "kilometres" : "metres"}
                    </p>
                </div>

                {/* Secondary stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <StatBox
                        icon={<Clock className="w-3.5 h-3.5" />}
                        label="Time"
                        value={fmtDuration(durationS)}
                    />
                    <StatBox
                        icon={<Zap className="w-3.5 h-3.5" />}
                        label="Pace"
                        value={fmtPace(avgPaceSPerKm)}
                    />
                    <StatBox
                        icon={<Navigation className="w-3.5 h-3.5" />}
                        label="km/h"
                        value={fmtSpeed(currentSpeedMs)}
                    />
                </div>

                {/* Goal progress */}
                {(minDist > 0 || minDur > 0) && (
                    <div className="flex gap-2 mb-4">
                        {minDist > 0 && (
                            <GoalPill
                                done={distOk}
                                label={`${fmtDistance(distanceM)} / ${fmtDistance(minDist)}`}
                                progress={Math.min(distanceM / minDist, 1)}
                            />
                        )}
                        {minDur > 0 && (
                            <GoalPill
                                done={durOk}
                                label={`${fmtDuration(durationS)} / ${fmtDuration(minDur)}`}
                                progress={Math.min(durationS / minDur, 1)}
                            />
                        )}
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-3 pb-safe">
                    {status === "tracking" ? (
                        <>
                            <button
                                onClick={pause}
                                className="flex-1 py-4 bg-zinc-800 rounded-2xl font-bold text-white flex items-center justify-center gap-2 hover:bg-zinc-700 active:scale-95 transition-all"
                            >
                                <Pause className="w-5 h-5 fill-current" />
                                Pause
                            </button>
                            <button
                                onClick={handleFinish}
                                disabled={!canFinish}
                                className="flex-1 py-4 bg-red-600 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-500 active:scale-95 transition-all"
                            >
                                <Square className="w-5 h-5 fill-current" />
                                Finish
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={resume}
                                className="flex-1 py-4 bg-primary rounded-2xl font-bold text-primary-foreground flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                            >
                                <Play className="w-5 h-5 fill-current" />
                                Resume
                            </button>
                            <button
                                onClick={handleFinish}
                                disabled={!canFinish}
                                className="flex-1 py-4 bg-red-600 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-500 active:scale-95 transition-all"
                            >
                                <CheckCircle className="w-5 h-5" />
                                Finish
                            </button>
                        </>
                    )}
                </div>

                {/* Not enough progress warning */}
                {!canFinish && (status === "tracking" || status === "paused") && (
                    <p className="text-center text-zinc-500 text-xs mt-2 pb-2">
                        {!distOk ? `${fmtDistance(minDist - distanceM)} more to go` : `${fmtDuration(minDur - durationS)} remaining`}
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── Small sub-components ────────────────────────────────────────────────────
function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-zinc-500 mb-0.5">
                {icon}
                <span className="text-[10px] uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-white font-bold text-sm tabular-nums">{value}</p>
        </div>
    );
}

function GoalPill({ done, label, progress }: { done: boolean; label: string; progress: number }) {
    return (
        <div className={`flex-1 rounded-xl p-2.5 ${done ? "bg-green-500/15 border border-green-500/30" : "bg-zinc-900"}`}>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Goal</span>
                {done && <CheckCircle className="w-3 h-3 text-green-400" />}
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1 mb-1.5">
                <div
                    className={`h-1 rounded-full transition-all ${done ? "bg-green-400" : "bg-primary"}`}
                    style={{ width: `${(progress * 100).toFixed(1)}%` }}
                />
            </div>
            <p className={`text-xs font-medium tabular-nums ${done ? "text-green-400" : "text-white"}`}>{label}</p>
        </div>
    );
}
