"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Challenge } from "@/types";
import Webcam from "react-webcam";
import { Camera, MapPin, RefreshCw, CheckCircle, AlertTriangle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

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



import { useGetChallengeQuery, usePerformCheckInMutation } from "@/lib/features/api/apiSlice";

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
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const currentLat = position.coords.latitude;
                const currentLng = position.coords.longitude;
                setLocation({ lat: currentLat, lng: currentLng });

                if (challenge?.requires_location && challenge.location_lat && challenge.location_lng) {
                    const dist = calculateDistance(currentLat, currentLng, challenge.location_lat, challenge.location_lng);
                    setDistance(dist);
                }
            },
            (error) => {
                setLocationError("Unable to retrieve location. Please allow access.");
                console.error(error);
            },
            { enableHighAccuracy: true }
        );
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setImgSrc(imageSrc);
        }
    }, [webcamRef]);

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
                location
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
                <div className="min-h-screen bg-zinc-950 text-white p-4 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">You're all set!</h1>
                    <p className="text-zinc-400 mb-6">You have already checked in for today.</p>
                    <Link href="/" className="px-6 py-3 bg-zinc-800 rounded-xl font-medium hover:bg-zinc-700">
                        Back to Dashboard
                    </Link>
                </div>
            </AuthGuard>
        );
    }

    if (status === "success") {
        return (
            <AuthGuard>
                <div className="min-h-screen bg-zinc-950 text-white p-4 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Great Job!</h1>
                    <p className="text-zinc-400 mb-6">Check-in successful. Keep up the streak!</p>
                    <Link href="/" className="px-6 py-3 bg-indigo-600 rounded-xl font-medium hover:bg-indigo-500">
                        Back to Dashboard
                    </Link>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-zinc-950 text-white p-4 pb-20">
                <header className="flex items-center gap-4 mb-6">
                    <Link href={`/challenges/${id}`} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold">Daily Check-in</h1>
                </header>

                <div className="space-y-6">
                    {/* Location Step */}
                    <div className={`p-4 rounded-xl border ${location ? 'border-green-500/30 bg-green-500/10' : 'border-zinc-800 bg-zinc-900'}`}>
                        <div className="flex items-start gap-3">
                            <div className={`mt-1 p-1.5 rounded-full ${location ? 'bg-green-500' : 'bg-zinc-700'}`}>
                                <MapPin className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium mb-1">1. Verify Location</h3>
                                {challenge.requires_location ? (
                                    <>
                                        {location ? (
                                            <div>
                                                <p className="text-sm text-green-400">Location captured</p>
                                                {distance !== null && (
                                                    <p className={`text-xs mt-1 ${distance <= (challenge.location_radius || 100) ? 'text-green-400' : 'text-red-400'}`}>
                                                        Distance: {Math.round(distance)}m (Max: {challenge.location_radius || 100}m)
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={getLocation}
                                                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
                                            >
                                                Tap to verify location
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-zinc-500">Location not required for this challenge.</p>
                                )}
                                {locationError && <p className="text-xs text-red-400 mt-1">{locationError}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Camera Step */}
                    <div className={`p-4 rounded-xl border ${imgSrc ? 'border-green-500/30 bg-green-500/10' : 'border-zinc-800 bg-zinc-900'}`}>
                        <div className="flex items-start gap-3">
                            <div className={`mt-1 p-1.5 rounded-full ${imgSrc ? 'bg-green-500' : 'bg-zinc-700'}`}>
                                <Camera className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 w-full">
                                <h3 className="font-medium mb-3">2. Take Selfie</h3>

                                {imgSrc ? (
                                    <div className="relative rounded-lg overflow-hidden aspect-[3/4]">
                                        <img src={imgSrc} alt="Selfie" className="w-full h-full object-cover" />
                                        <button
                                            onClick={retake}
                                            className="absolute bottom-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70"
                                        >
                                            <RefreshCw className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="rounded-lg overflow-hidden aspect-[3/4] bg-black relative">
                                        <Webcam
                                            audio={false}
                                            ref={webcamRef}
                                            screenshotFormat="image/jpeg"
                                            videoConstraints={{ facingMode: "user" }}
                                            className="w-full h-full object-cover"
                                            onUserMediaError={() => setCameraError(true)}
                                        />
                                        {cameraError && (
                                            <div className="absolute inset-0 flex items-center justify-center text-center p-4">
                                                <p className="text-red-400 text-sm">Camera access denied or not available.</p>
                                            </div>
                                        )}
                                        <button
                                            onClick={capture}
                                            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-white flex items-center justify-center"
                                        >
                                            <div className="w-14 h-14 bg-white rounded-full active:scale-90 transition-transform" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleCheckIn}
                        disabled={submitting || (challenge.requires_location && (!location || (distance !== null && distance > (challenge.location_radius || 100)))) || !imgSrc}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Verifying..." : "Complete Check-in"}
                    </button>
                </div>
            </div>
        </AuthGuard>
    );
}

// Missing icons import fix
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
