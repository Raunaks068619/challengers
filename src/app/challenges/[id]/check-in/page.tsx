"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useParams } from "next/navigation";
import Link from "next/link";
import Webcam from "react-webcam";
import { MapPin, RefreshCw, CheckCircle, ChevronLeft, Camera } from "lucide-react";
import { toast } from "sonner";
import { useGetChallengeQuery, usePerformCheckInMutation } from "@/lib/features/api/apiSlice";

// Haversine Formula for distance in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

export default function CheckInPage() {
    const { id } = useParams();
    const { user } = useAuth();

    // RTK Query
    const { data: challengeData, isLoading: challengeLoading } = useGetChallengeQuery(id as string, {
        skip: !id,
    });
    const challenge = challengeData;

    const [performCheckIn, { isLoading: submitting }] = usePerformCheckInMutation();

    // Location State
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [locationError, setLocationError] = useState("");
    const [distance, setDistance] = useState<number | null>(null);

    // Camera State
    const webcamRef = useRef<Webcam>(null);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState(false);

    const [status, setStatus] = useState<"idle" | "success" | "already_checked_in">("idle");
    const [checkingLog, setCheckingLog] = useState(true);
    const [note, setNote] = useState("");

    useEffect(() => {
        const checkLog = async () => {
            if (!id || !user) return;
            // Check if already checked in today
            const today = new Date().toISOString().split('T')[0];

            const q = query(
                collection(db, "daily_logs"),
                where("challenge_id", "==", id),
                where("user_id", "==", user.uid),
                where("date", "==", today)
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                setStatus("already_checked_in");
            }
            setCheckingLog(false);
        };
        checkLog();
    }, [id, user]);

    const loading = challengeLoading || checkingLog;

    const getLocation = () => {
        setLocationError("");
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported");
            return;
        }
        const toastId = toast.loading("Getting location...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const currentLat = position.coords.latitude;
                const currentLng = position.coords.longitude;
                setLocation({ lat: currentLat, lng: currentLng });

                if (challenge?.requires_location && challenge.location_lat && challenge.location_lng) {
                    const dist = calculateDistance(currentLat, currentLng, challenge.location_lat, challenge.location_lng);
                    setDistance(dist);
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
    };

    const [countdown, setCountdown] = useState<number | null>(null);

    const capture = useCallback(async (): Promise<string | null> => {
        // 1. Try ImageCapture API (Modern Android/Desktop) - Solution A
        try {
            const stream = webcamRef.current?.video?.srcObject as MediaStream;
            const track = stream?.getVideoTracks()[0];

            // @ts-ignore - ImageCapture is experimental
            if (track && window.ImageCapture) {
                // @ts-ignore
                const imageCapture = new window.ImageCapture(track);

                // This takes a high-res photo using camera hardware
                const blob = await imageCapture.takePhoto();

                // Post-process to flip the image (selfies are usually mirrored)
                const bitmap = await createImageBitmap(blob);
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(bitmap, 0, 0);
                    const imageUrl = canvas.toDataURL('image/jpeg', 0.92);
                    console.log("Captured using ImageCapture API (High Res)");
                    return imageUrl;
                }
            }
        } catch (e) {
            console.warn("ImageCapture failed, falling back to canvas", e);
        }

        // 2. Fallback: Canvas with High-Res Stream - Solution B
        const video = webcamRef.current?.video;
        if (video) {
            const canvas = document.createElement('canvas');
            // Use full video resolution (which should be 4K if supported)
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Apply filters as requested
                ctx.filter = 'contrast(1.2) saturate(1.1)';

                // Flip the image to match the mirrored preview
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageSrc = canvas.toDataURL('image/jpeg', 0.92);
                console.log("Captured using Canvas Fallback (4K Constraints)");
                return imageSrc;
            }
        }
        return null;
    }, [webcamRef]);

    const startCapture = async () => {
        setCountdown(3);

        // Give UI a moment to render the "3"
        await new Promise(r => setTimeout(r, 100));

        // Start capture in background (this might take time)
        const capturePromise = capture();

        // Run countdown
        await new Promise(r => setTimeout(r, 1000));
        setCountdown(2);
        await new Promise(r => setTimeout(r, 1000));
        setCountdown(1);
        await new Promise(r => setTimeout(r, 1000));

        // Wait for capture to finish if it hasn't already
        const imageUrl = await capturePromise;

        setCountdown(null);
        if (imageUrl) {
            setImgSrc(imageUrl);
        } else {
            toast.error("Failed to capture image. Please try again.");
        }
    };

    const retake = () => {
        setImgSrc(null);
    };

    const handleCheckIn = async () => {
        if (!user || !challenge || !imgSrc) return;

        // Location Validation
        if (challenge.requires_location) {
            if (!location || distance === null) {
                toast.error("Please verify your location first.");
                return;
            }
            if (distance > (challenge.location_radius || 100)) {
                toast.error(`You are too far! (${Math.round(distance)}m away). Must be within ${challenge.location_radius}m.`);
                return;
            }
        }

        // Time Window Validation
        if (challenge.time_window_start && challenge.time_window_end) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const [startH, startM] = challenge.time_window_start.split(':').map(Number);
            const [endH, endM] = challenge.time_window_end.split(':').map(Number);
            const startTime = startH * 60 + startM;
            const endTime = endH * 60 + endM;

            if (currentTime < startTime || currentTime > endTime) {
                toast.error(`Check-in only allowed between ${challenge.time_window_start} and ${challenge.time_window_end}`);
                return;
            }
        }

        if (!challenge.id || !user.uid) return;

        try {
            await performCheckIn({
                challengeId: challenge.id,
                userId: user.uid,
                imgSrc,
                location,
                note
            }).unwrap();

            setStatus("success");
            toast.success("Check-in verified!");
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to check in: " + error.message);
        }
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;
    if (!challenge) return <div className="p-4 text-white">Challenge not found</div>;

    if (status === "already_checked_in") {
        return (
            <AuthGuard>
                <div className="min-h-screen bg-background text-foreground p-4 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h1 className="text-xl font-bold mb-2">You're all set!</h1>
                    <p className="text-muted-foreground mb-6 text-sm">You have already checked in for today.</p>
                    <Link href="/" className="px-6 py-3 bg-muted rounded-xl font-medium hover:bg-muted/80 text-foreground transition-colors">
                        Back to Dashboard
                    </Link>
                </div>
            </AuthGuard>
        );
    }

    if (status === "success") {
        return (
            <AuthGuard>
                <div className="min-h-screen bg-background text-foreground p-4 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold mb-2">Great Job!</h1>
                    <p className="text-muted-foreground mb-6 text-sm">Check-in successful. Keep up the streak!</p>
                    <Link href="/" className="px-6 py-3 bg-primary rounded-xl font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                        Back to Dashboard
                    </Link>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground pb-24">
                {/* Header Overlay */}
                <header className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent">
                    <Link href={`/challenges/${id}`} className="p-2 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 text-white transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-base font-bold drop-shadow-md text-white">Daily Check-in</h1>
                </header>

                {/* 1. Image Capture (Full Width, No Gutter) */}
                <div className="relative w-full aspect-[3/4] bg-muted">
                    {imgSrc ? (
                        <>
                            <img src={imgSrc} alt="Selfie" className="w-full h-full object-cover" />
                            <button
                                onClick={retake}
                                className="absolute bottom-4 right-4 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 z-20 transition-colors"
                            >
                                <RefreshCw className="w-6 h-6" />
                            </button>
                        </>
                    ) : (
                        <>
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{
                                    facingMode: "user",
                                    width: { ideal: 4096 },
                                    height: { ideal: 2160 }
                                }}
                                className="w-full h-full object-cover scale-x-[-1]"
                                onUserMediaError={() => setCameraError(true)}
                            />
                            {cameraError && (
                                <div className="absolute inset-0 flex items-center justify-center text-center p-4 bg-muted">
                                    <p className="text-destructive text-sm">Camera access denied or not available.</p>
                                </div>
                            )}

                            {/* Countdown Overlay */}
                            {countdown !== null && (
                                <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/10">
                                    <span className="text-3xl font-bold text-white drop-shadow-lg animate-pulse">
                                        {countdown}
                                    </span>
                                </div>
                            )}

                            {!countdown && (
                                <button
                                    onClick={startCapture}
                                    className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-4 border-white flex items-center justify-center z-20 hover:scale-105 transition-transform"
                                >
                                    <div className="w-16 h-16 bg-white rounded-full active:scale-90 transition-transform" />
                                </button>
                            )}
                        </>
                    )}
                </div>

                <div className="p-4 space-y-6 -mt-4 relative z-10 bg-background rounded-t-3xl border-t border-border">
                    <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-2" />

                    {/* 2. Location (Conditional) */}
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
                                            {distance !== null && (
                                                <p className={`text-[10px] mt-1 ${distance <= (challenge.location_radius || 100) ? 'text-green-500' : 'text-destructive'}`}>
                                                    Distance: {Math.round(distance)}m (Max: {challenge.location_radius || 100}m)
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={getLocation}
                                            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                                        >
                                            Tap to verify location
                                        </button>
                                    )}
                                    {locationError && <p className="text-xs text-destructive mt-1">{locationError}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Note */}
                    <div>
                        <label className="block text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">Tell us about today / set your goals</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full bg-card border border-border rounded-xl p-4 text-base focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] placeholder:text-muted-foreground/50 text-foreground transition-all"
                            placeholder="I crushed it today because..."
                        />
                    </div>

                    <button
                        onClick={handleCheckIn}
                        disabled={submitting || (challenge.requires_location && (!location || (distance !== null && distance > (challenge.location_radius || 100)))) || !imgSrc}
                        className="w-full py-4 bg-primary rounded-xl font-bold text-base text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                    >
                        {submitting ? "Verifying..." : "Complete Check-in"}
                    </button>
                </div>
            </div >
        </AuthGuard >
    );
}

function Sparkles({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
    )
}

function Loader2({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
    )
}
