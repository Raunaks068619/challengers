"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useParams } from "next/navigation";
import Link from "next/link";
import Webcam from "react-webcam";
import { MapPin, RefreshCw, CheckCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useGetChallengeQuery, usePerformCheckInMutation } from "@/lib/features/api/apiSlice";
import Loader from "@/components/Loader";
import dynamic from "next/dynamic";
import type { Waypoint } from "@/types";
import RouteMap from "@/components/RouteMap";

const ActivityTracker = dynamic(() => import("@/components/ActivityTracker"), { ssr: false });

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

interface ActivityResult {
    waypoints: Waypoint[];
    distanceM: number;
    durationS: number;
    avgPaceSPerKm: number | null;
}

export default function CheckInPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const { data: challengeData, isLoading: challengeLoading } = useGetChallengeQuery(id as string, { skip: !id });
    const challenge = challengeData;
    const [performCheckIn, { isLoading: submitting }] = usePerformCheckInMutation();

    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [locationError, setLocationError] = useState("");
    const [distance, setDistance] = useState<number | null>(null);

    const webcamRef = useRef<Webcam>(null);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState(false);

    const [status, setStatus] = useState<"idle" | "success" | "already_checked_in">("idle");
    const [checkingLog, setCheckingLog] = useState(true);
    const [note, setNote] = useState("");

    const [showTracker, setShowTracker] = useState(false);
    const [activityResult, setActivityResult] = useState<ActivityResult | null>(null);

    const getLocation = useCallback(() => {
        setLocationError("");
        if (!navigator.geolocation) { setLocationError("Geolocation is not supported"); return; }
        const toastId = toast.loading("Getting location...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const currentLat = position.coords.latitude;
                const currentLng = position.coords.longitude;
                setLocation({ lat: currentLat, lng: currentLng });
                if (challenge?.requires_location) {
                    let minDist = Infinity;
                    if (challenge.location_lat && challenge.location_lng) {
                        const dist = calculateDistance(currentLat, currentLng, challenge.location_lat, challenge.location_lng);
                        if (dist < minDist) minDist = dist;
                    }
                    if (challenge.locations?.length) {
                        challenge.locations.forEach(loc => {
                            const dist = calculateDistance(currentLat, currentLng, loc.lat, loc.lng);
                            if (dist < minDist) minDist = dist;
                        });
                    }
                    if (minDist !== Infinity) setDistance(minDist);
                }
                toast.success("Location verified!", { id: toastId });
            },
            (error) => {
                setLocationError("Unable to retrieve location. Please allow access.");
                toast.error("Location failed", { id: toastId });
                console.error(error);
            },
            { enableHighAccuracy: true }
        );
    }, [challenge]);

    useEffect(() => {
        const checkLog = async () => {
            if (!id || !user) return;
            const today = new Date().toISOString().split('T')[0];
            const q = query(collection(db, "daily_logs"), where("challenge_id", "==", id), where("user_id", "==", user.uid), where("date", "==", today));
            const snap = await getDocs(q);
            if (!snap.empty) setStatus("already_checked_in");
            setCheckingLog(false);
        };
        checkLog();
    }, [id, user]);

    useEffect(() => {
        if (challenge?.requires_location && !location && !locationError) {
            navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((result) => {
                if (result.state === 'granted') getLocation();
            });
        }
    }, [challenge, location, locationError, getLocation]);

    const loading = challengeLoading || checkingLog;
    const today = new Date().toLocaleDateString('en-CA');
    const hasStarted = challenge ? today >= challenge.start_date.split('T')[0] : true;
    const [countdown, setCountdown] = useState<number | null>(null);

    const capture = useCallback(async (): Promise<string | null> => {
        try {
            const stream = webcamRef.current?.video?.srcObject as MediaStream;
            const track = stream?.getVideoTracks()[0];
            // @ts-ignore
            if (track && window.ImageCapture) {
                // @ts-ignore
                const imageCapture = new window.ImageCapture(track);
                const blob = await imageCapture.takePhoto();
                const bitmap = await createImageBitmap(blob);
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width; canvas.height = bitmap.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
                    ctx.drawImage(bitmap, 0, 0);
                    return canvas.toDataURL('image/jpeg', 0.52);
                }
            }
        } catch (e) { console.warn("ImageCapture failed, falling back", e); }
        const video = webcamRef.current?.video;
        if (video) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.filter = 'contrast(1.2) saturate(1.1)';
                ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                return canvas.toDataURL('image/jpeg', 0.92);
            }
        }
        return null;
    }, [webcamRef]);

    const startCapture = async () => {
        setCountdown(3);
        await new Promise(r => setTimeout(r, 100));
        const capturePromise = capture();
        await new Promise(r => setTimeout(r, 1000)); setCountdown(2);
        await new Promise(r => setTimeout(r, 1000)); setCountdown(1);
        await new Promise(r => setTimeout(r, 1000));
        const imageUrl = await capturePromise;
        setCountdown(null);
        if (imageUrl) { setImgSrc(imageUrl); } else { toast.error("Failed to capture image."); }
    };

    const handleCheckIn = async () => {
        if (!user || !challenge) return;
        const isActivity = !!challenge.activity_tracking;
        if (!isActivity && !imgSrc) return;
        if (isActivity && !activityResult) return;

        if (challenge.requires_location) {
            if (!location || distance === null) { toast.error("Please verify your location first."); return; }
            let applicableRadius = challenge.location_radius || 100;
            if (challenge.locations?.length) {
                let minDist = Infinity;
                challenge.locations.forEach(loc => {
                    const dist = calculateDistance(location.lat, location.lng, loc.lat, loc.lng);
                    if (dist < minDist) { minDist = dist; applicableRadius = loc.radius || 100; }
                });
            }
            if (distance > applicableRadius) {
                toast.error(`Too far! (${Math.round(distance)}m, need within ${applicableRadius}m)`);
                return;
            }
        }

        if (challenge.time_window_start && challenge.time_window_end) {
            const now = new Date();
            const cur = now.getHours() * 60 + now.getMinutes();
            const [sh, sm] = challenge.time_window_start.split(':').map(Number);
            const [eh, em] = challenge.time_window_end.split(':').map(Number);
            if (cur < sh * 60 + sm || cur > eh * 60 + em) {
                toast.error(`Check-in only allowed between ${challenge.time_window_start} and ${challenge.time_window_end}`);
                return;
            }
        }

        if (!challenge.id || !user.uid) return;

        try {
            await performCheckIn({
                challengeId: challenge.id,
                userId: user.uid,
                imgSrc: imgSrc ?? "",
                location,
                note,
                ...(activityResult && {
                    route: activityResult.waypoints,
                    distance_m: activityResult.distanceM,
                    duration_s: activityResult.durationS,
                    avg_pace_s_per_km: activityResult.avgPaceSPerKm,
                    activity_type: challenge.activity_type ?? "any",
                }),
            }).unwrap();
            setStatus("success");
            toast.success("Check-in complete! 🎉");
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to check in: " + error.message);
        }
    };

    const handleActivityFinish = (result: ActivityResult) => {
        setShowTracker(false);
        setActivityResult(result);
        if (result.waypoints.length > 0) {
            const last = result.waypoints[result.waypoints.length - 1];
            setLocation({ lat: last.lat, lng: last.lng });
        }
    };

    if (loading) return <Loader fullscreen={true} />;
    if (!challenge) return <div className="p-4 text-white">Challenge not found</div>;

    if (status === "already_checked_in") {
        return (
            <AuthGuard>
                <div className="h-[100dvh] overflow-hidden bg-background text-foreground p-4 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h1 className="text-xl font-bold mb-2">You're all set!</h1>
                    <p className="text-muted-foreground mb-6 text-sm">You have already checked in for today.</p>
                    <Link href="/" className="px-6 py-3 bg-muted rounded-xl font-medium hover:bg-muted/80 text-foreground transition-colors">Back to Dashboard</Link>
                </div>
            </AuthGuard>
        );
    }

    if (!hasStarted) {
        return (
            <AuthGuard>
                <div className="h-[100dvh] overflow-hidden bg-background text-foreground p-4 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h1 className="text-xl font-bold mb-2">Challenge Hasn't Started</h1>
                    <p className="text-muted-foreground mb-2 text-sm">Starts on:</p>
                    <p className="text-primary font-bold text-lg mb-6">{new Date(challenge.start_date.includes('T') ? challenge.start_date : challenge.start_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    <Link href={`/challenges/${id}`} className="px-6 py-3 bg-muted rounded-xl font-medium hover:bg-muted/80 text-foreground transition-colors">Back to Challenge</Link>
                </div>
            </AuthGuard>
        );
    }

    if (status === "success") {
        return (
            <AuthGuard>
                <div className="h-[100dvh] overflow-hidden bg-background text-foreground p-4 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold mb-2">Great Job!</h1>
                    <p className="text-muted-foreground mb-4 text-sm">Check-in successful. Keep up the streak!</p>
                    {activityResult && activityResult.waypoints.length > 0 && (
                        <div className="w-full max-w-sm mb-6">
                            <RouteMap waypoints={activityResult.waypoints} distanceM={activityResult.distanceM} durationS={activityResult.durationS} avgPaceSPerKm={activityResult.avgPaceSPerKm} heightClass="h-40" />
                        </div>
                    )}
                    <Link href="/" className="px-6 py-3 bg-primary rounded-xl font-medium text-primary-foreground hover:opacity-90 transition-opacity">Back to Dashboard</Link>
                </div>
            </AuthGuard>
        );
    }

    // ── Activity tracking flow ────────────────────────────────────────────────
    if (challenge.activity_tracking) {
        if (showTracker) {
            return (
                <ActivityTracker
                    challenge={challenge}
                    onFinish={handleActivityFinish}
                    onCancel={() => setShowTracker(false)}
                />
            );
        }

        return (
            <AuthGuard>
                <div className="min-h-screen bg-background text-foreground pb-24">
                    <header className="p-4 flex items-center gap-4">
                        <Link href={`/challenges/${id}`} className="p-2 bg-card rounded-full hover:bg-muted border border-border transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-base font-bold">Activity Check-in</h1>
                            <p className="text-xs text-muted-foreground">{challenge.title}</p>
                        </div>
                    </header>

                    <div className="p-4 space-y-5">
                        {activityResult ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-green-500 flex items-center gap-1.5">
                                        <CheckCircle className="w-4 h-4" /> Activity Complete
                                    </p>
                                    <button onClick={() => setActivityResult(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Redo</button>
                                </div>
                                <RouteMap waypoints={activityResult.waypoints} distanceM={activityResult.distanceM} durationS={activityResult.durationS} avgPaceSPerKm={activityResult.avgPaceSPerKm} heightClass="h-56" />
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowTracker(true)}
                                className="w-full h-56 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-3 hover:bg-primary/10 active:scale-95 transition-all"
                            >
                                <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-foreground capitalize">Start {challenge.activity_type ?? "Activity"}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {challenge.min_distance_m
                                            ? `Goal: ${(challenge.min_distance_m / 1000).toFixed(1)} km`
                                            : "Track your route on the map"}
                                    </p>
                                </div>
                            </button>
                        )}

                        <div>
                            <label className="block text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">Notes (optional)</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full bg-card border border-border rounded-xl p-4 text-base focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] placeholder:text-muted-foreground/50 text-foreground"
                                placeholder="How did it go?"
                            />
                        </div>

                        <button
                            onClick={handleCheckIn}
                            disabled={submitting || !activityResult}
                            className="w-full py-4 bg-primary rounded-xl font-bold text-base text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? (<><Loader size={18} className="text-primary-foreground p-0" /><span>Submitting…</span></>) : "Submit Check-in"}
                        </button>
                    </div>
                </div>
            </AuthGuard>
        );
    }

    // ── Standard photo check-in (unchanged) ───────────────────────────────────
    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground pb-24">
                <header className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent">
                    <Link href={`/challenges/${id}`} className="p-2 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 text-white transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-base font-bold drop-shadow-md text-white">Daily Check-in</h1>
                </header>

                <div className="relative w-full aspect-[3/4] bg-muted">
                    {imgSrc ? (
                        <>
                            <img src={imgSrc} alt="Selfie" className="w-full h-full object-cover" />
                            <button onClick={() => setImgSrc(null)} className="absolute bottom-4 right-4 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 z-20 transition-colors"><RefreshCw className="w-6 h-6" /></button>
                        </>
                    ) : (
                        <>
                            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user", width: { ideal: 4096 }, height: { ideal: 2160 } }} className="w-full h-full object-cover scale-x-[-1]" onUserMediaError={() => setCameraError(true)} />
                            {cameraError && (<div className="absolute inset-0 flex items-center justify-center text-center p-4 bg-muted"><p className="text-destructive text-sm">Camera access denied or not available.</p></div>)}
                            {countdown !== null && (<div className="absolute inset-0 flex items-center justify-center z-30 bg-black/10"><span className="text-3xl font-bold text-white drop-shadow-lg animate-pulse">{countdown}</span></div>)}
                            {!countdown && (<button onClick={startCapture} className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-4 border-white flex items-center justify-center z-20 hover:scale-105 transition-transform"><div className="w-16 h-16 bg-white rounded-full active:scale-90 transition-transform" /></button>)}
                        </>
                    )}
                </div>

                <div className="p-4 space-y-6 -mt-4 relative z-10 bg-background rounded-t-3xl border-t border-border">
                    <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-2" />

                    {challenge.requires_location && (
                        <div className={`p-4 rounded-xl border ${location ? 'border-green-500/30 bg-green-500/10' : 'border-border bg-card'}`}>
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 p-1.5 rounded-full ${location ? 'bg-green-500' : 'bg-muted'}`}>
                                    <MapPin className={`w-4 h-4 ${location ? 'text-white' : 'text-muted-foreground'}`} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium mb-1 text-sm">Location Verification</h3>
                                    {location ? (
                                        <div>
                                            <p className="text-xs text-green-500">Location captured</p>
                                            {distance !== null && (<p className={`text-[10px] mt-1 ${distance <= (challenge.location_radius || 100) ? 'text-green-500' : 'text-destructive'}`}>Distance: {Math.round(distance)}m</p>)}
                                        </div>
                                    ) : (
                                        <button onClick={getLocation} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">Tap to verify location</button>
                                    )}
                                    {locationError && <p className="text-xs text-destructive mt-1">{locationError}</p>}
                                    <p className="text-[10px] text-muted-foreground mt-2 leading-tight">Tip: Set permission to "Always Allow" in browser settings.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">Tell us about today</label>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-card border border-border rounded-xl p-4 text-base focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] placeholder:text-muted-foreground/50 text-foreground transition-all" placeholder="I crushed it today because..." />
                    </div>

                    <button
                        onClick={handleCheckIn}
                        disabled={submitting || !hasStarted || (challenge.requires_location && (!location || (distance !== null && distance > 5000))) || !imgSrc}
                        className="w-full py-4 bg-primary rounded-xl font-bold text-base text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    >
                        {submitting ? (<><Loader size={18} className="text-primary-foreground p-0" /><span>Verifying...</span></>) : !hasStarted ? "Challenge Not Started" : "Complete Check-in"}
                    </button>
                </div>
            </div>
        </AuthGuard>
    );
}

function Sparkles({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
    );
}
