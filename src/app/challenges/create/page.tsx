"use client";

import { useState } from "react";
import { generateChallengeFromAI } from "@/app/actions";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { ChevronLeft, Loader2, Sparkles, MapPin } from "lucide-react";
import { toast } from "sonner";

import { useCreateChallengeMutation } from "@/lib/features/api/apiSlice";

export default function CreateChallengePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [createChallenge, { isLoading: creating }] = useCreateChallengeMutation();

    // Location State
    const [requiresLocation, setRequiresLocation] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);


    const [locationStatus, setLocationStatus] = useState<string>("");

    // Date & Time State
    const [startOption, setStartOption] = useState<"tomorrow" | "today" | "custom">("tomorrow");
    const [customStartDate, setCustomStartDate] = useState("");
    const [requiresTimeWindow, setRequiresTimeWindow] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        try {
            const result = await generateChallengeFromAI(prompt);
            setPreview(result);
        } catch (error) {
            toast.error("Failed to generate challenge");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const captureLocation = () => {
        setLocationStatus("Locating...");
        if (!navigator.geolocation) {
            setLocationStatus("Geolocation not supported");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setLocationStatus("Location captured!");
            },
            (error) => {
                setLocationStatus("Error capturing location");
                console.error(error);
            }
        );
    };

    const handleCreate = async () => {
        if (!preview || !user) return;

        if (requiresLocation && !location) {
            toast.error("Please capture your location first");
            return;
        }

        try {
            // Calculate end date based on duration
            // Calculate dates based on selection
            const startDate = new Date();
            if (startOption === 'tomorrow') {
                startDate.setDate(startDate.getDate() + 1);
            } else if (startOption === 'custom' && customStartDate) {
                const custom = new Date(customStartDate);
                startDate.setFullYear(custom.getFullYear(), custom.getMonth(), custom.getDate());
            }
            // If 'today', startDate is already now

            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + (preview.durationDays || 30));

            const challengeData = {
                title: preview.title,
                description: preview.description,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                time_window_start: requiresTimeWindow ? preview.timeWindowStart : null,
                time_window_end: requiresTimeWindow ? preview.timeWindowEnd : null,
                requires_location: requiresLocation,
                location_lat: location?.lat || null,
                location_lng: location?.lng || null,
                location_radius: 100, // Default 100m
            };

            await createChallenge({ challenge: challengeData, userId: user.id }).unwrap();

            toast.success("Challenge created!");
            router.push("/");
        } catch (error: any) {
            toast.error("Error creating challenge: " + error.message);
            console.error(error);
        }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-zinc-950 text-white p-4 pb-20">
                <header className="flex items-center gap-4 mb-6">
                    <Link href="/" className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl font-bold">Create Challenge</h1>
                </header>

                {!preview ? (
                    <div className="space-y-6">
                        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                            <label className="block text-sm font-medium text-zinc-400 mb-2">
                                Describe your challenge
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g. Run 5km every morning at 5 AM for a month."
                                className="w-full h-32 bg-black border border-zinc-800 rounded-xl p-4 text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                            />
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-bold text-lg disabled:opacity-50 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Generate with AI
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-lg font-semibold mb-4">Challenge Preview</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-500 uppercase font-semibold">Title</label>
                                <input
                                    type="text"
                                    value={preview.title}
                                    onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                                    className="w-full bg-transparent border-b border-zinc-700 py-2 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-zinc-500 uppercase font-semibold">Description</label>
                                <textarea
                                    value={preview.description}
                                    onChange={(e) => setPreview({ ...preview, description: e.target.value })}
                                    className="w-full bg-transparent border-b border-zinc-700 py-2 focus:outline-none focus:border-indigo-500 resize-none h-20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-zinc-500 uppercase font-semibold">Duration (Days)</label>
                                    <input
                                        type="number"
                                        value={preview.durationDays}
                                        onChange={(e) => setPreview({ ...preview, durationDays: Number(e.target.value) })}
                                        className="w-full bg-transparent border-b border-zinc-700 py-2 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Start Date Toggle */}
                            <div className="space-y-3 pt-2">
                                <label className="text-xs text-zinc-500 uppercase font-semibold">Start From</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setStartOption('tomorrow')}
                                        className={`py-2 rounded-lg text-sm font-medium transition-colors ${startOption === 'tomorrow' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                    >
                                        Tomorrow
                                    </button>
                                    <button
                                        onClick={() => setStartOption('today')}
                                        className={`py-2 rounded-lg text-sm font-medium transition-colors ${startOption === 'today' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={() => setStartOption('custom')}
                                        className={`py-2 rounded-lg text-sm font-medium transition-colors ${startOption === 'custom' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                    >
                                        Custom
                                    </button>
                                </div>
                                {startOption === 'custom' && (
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="w-full bg-transparent border-b border-zinc-700 py-2 focus:outline-none focus:border-indigo-500 text-white"
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                )}
                            </div>

                            <div className="pt-4 border-t border-zinc-800">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-sm font-medium text-white">Require Time Window?</label>
                                    <button
                                        onClick={() => setRequiresTimeWindow(!requiresTimeWindow)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${requiresTimeWindow ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${requiresTimeWindow ? 'translate-x-6' : ''}`} />
                                    </button>
                                </div>

                                {requiresTimeWindow && (
                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <label className="text-xs text-zinc-500 uppercase font-semibold">Start Time</label>
                                            <input
                                                type="time"
                                                value={preview.timeWindowStart}
                                                onChange={(e) => setPreview({ ...preview, timeWindowStart: e.target.value })}
                                                className="w-full bg-transparent border-b border-zinc-700 py-2 focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-500 uppercase font-semibold">End Time</label>
                                            <input
                                                type="time"
                                                value={preview.timeWindowEnd}
                                                onChange={(e) => setPreview({ ...preview, timeWindowEnd: e.target.value })}
                                                className="w-full bg-transparent border-b border-zinc-700 py-2 focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Location Toggle */}
                            <div className="pt-4 border-t border-zinc-800">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-sm font-medium text-white">Require Location Check-in?</label>
                                    <button
                                        onClick={() => setRequiresLocation(!requiresLocation)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${requiresLocation ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${requiresLocation ? 'translate-x-6' : ''}`} />
                                    </button>
                                </div>

                                {requiresLocation && (
                                    <div className="bg-black/50 rounded-xl p-4 border border-zinc-800">
                                        <p className="text-xs text-zinc-400 mb-3">
                                            Participants must be within 100m of this location to check in.
                                        </p>
                                        <button
                                            onClick={captureLocation}
                                            className="w-full py-2 bg-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-700 flex items-center justify-center gap-2"
                                        >
                                            <MapPin className="w-4 h-4" />
                                            {location ? "Update Location" : "Capture Current Location"}
                                        </button>
                                        {locationStatus && (
                                            <p className="text-center text-xs text-indigo-400 mt-2">{locationStatus}</p>
                                        )}
                                        {location && (
                                            <p className="text-center text-xs text-zinc-500 mt-1">
                                                Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="w-full py-4 bg-green-600 rounded-xl font-bold text-lg hover:bg-green-500 transition-all shadow-lg shadow-green-500/20"
                        >
                            {creating ? "Creating..." : "Confirm & Create"}
                        </button>

                        <button
                            onClick={() => setPreview(null)}
                            className="w-full py-3 text-zinc-400 text-sm hover:text-white transition-colors"
                        >
                            Cancel & Edit Prompt
                        </button>
                    </div>
                )}
            </div>
        </AuthGuard >
    );
}
