"use client";

import { useState } from "react";
import { generateChallengeFromAI } from "@/app/actions";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { ChevronLeft, Loader2, Sparkles, MapPin } from "lucide-react";
import { toast } from "sonner";
import LocationManager from "@/components/LocationManager";

import { useCreateChallengeMutation } from "@/lib/features/api/apiSlice";
import Loader from "@/components/Loader";
import { supabase } from "@/lib/supabase";

export default function CreateChallengePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [createChallenge, { isLoading: creating }] = useCreateChallengeMutation();

    // Location State
    const [requiresLocation, setRequiresLocation] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null); // Legacy single location support
    const [locations, setLocations] = useState<{ lat: number; lng: number; radius: number; address?: string }[]>([]);

    const [locationStatus, setLocationStatus] = useState<string>("");

    // Date & Time State
    const [startOption, setStartOption] = useState<"tomorrow" | "today" | "custom">("tomorrow");
    const [customStartDate, setCustomStartDate] = useState("");
    const [requiresTimeWindow, setRequiresTimeWindow] = useState(false);

    // Rest Days State
    const [restDays, setRestDays] = useState<number[]>([]);

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

    const [bannerUrl, setBannerUrl] = useState<string | null>(null);

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `banners/${user?.uid}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const toastId = toast.loading("Uploading banner...");

        try {
            const { error: uploadError } = await supabase.storage
                .from('challengers')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('challengers')
                .getPublicUrl(fileName);

            setBannerUrl(publicUrl);
            toast.success("Banner uploaded!", { id: toastId });
        } catch (error: any) {
            console.error("Upload error:", error);
            toast.error("Failed to upload banner", { id: toastId });
        }
    };

    const handleCreate = async () => {
        if (!preview || !user) return;

        if (requiresLocation && locations.length === 0 && !location) {
            toast.error("Please add at least one location");
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
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                time_window_start: requiresTimeWindow ? preview.timeWindowStart : null,
                time_window_end: requiresTimeWindow ? preview.timeWindowEnd : null,
                requires_location: requiresLocation,
                locations: requiresLocation ? locations : [],
                location_lat: requiresLocation && locations.length > 0 ? locations[0].lat : (location?.lat || null),
                location_lng: requiresLocation && locations.length > 0 ? locations[0].lng : (location?.lng || null),
                location_radius: requiresLocation && locations.length > 0 ? locations[0].radius : 100,
                banner_url: bannerUrl,
                rest_days: restDays,
            };

            await createChallenge({ challenge: challengeData, userId: user.uid }).unwrap();

            toast.success("Challenge created!");
            router.push("/");
        } catch (error: any) {
            toast.error("Error creating challenge: " + error.message);
            console.error(error);
        }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground p-4 pb-20">
                <header className="flex items-center gap-4 mb-6">
                    <Link href="/" className="p-2 bg-card rounded-full hover:bg-muted border border-border transition-colors">
                        <ChevronLeft className="w-5 h-5 text-foreground" />
                    </Link>
                    <h1 className="text-xl font-bold text-foreground">Create Challenge</h1>
                </header>

                {!preview ? (
                    <div className="space-y-6">
                        <div className="bg-card rounded-2xl p-4 border border-border">
                            <label className="block text-sm font-medium text-muted-foreground mb-2">
                                Describe your challenge
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g. Run 5km every morning at 5 AM for a month."
                                className="w-full h-32 bg-muted border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary focus:outline-none resize-none transition-all"
                            />
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                            className="w-full py-4 bg-primary rounded-xl font-bold text-base text-primary-foreground disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                        >
                            {loading ? (
                                <>
                                    <Loader size={18} className="text-primary-foreground p-0" />
                                    <span>Generating...</span>
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
                    <div className="bg-card rounded-2xl p-4 border border-border space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-base font-semibold mb-4 text-foreground">Challenge Preview</h2>

                        {/* Banner Image */}
                        <div className="relative h-40 rounded-xl overflow-hidden bg-muted mb-4 group border border-border">
                            {bannerUrl ? (
                                <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground flex-col gap-2">
                                    <Sparkles className="w-6 h-6 opacity-50" />
                                    <span className="text-xs">No Banner Selected</span>
                                </div>
                            )}
                            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <span className="text-white font-medium text-xs bg-black/50 px-3 py-1 rounded-full backdrop-blur-md border border-white/20">Upload Banner</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                            </label>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Title</label>
                                <input
                                    type="text"
                                    value={preview.title}
                                    onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                                    className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus:border-primary text-foreground text-sm transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Description</label>
                                <textarea
                                    value={preview.description}
                                    onChange={(e) => setPreview({ ...preview, description: e.target.value })}
                                    className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus:border-primary resize-none h-20 text-foreground text-sm transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Duration (Days)</label>
                                    <input
                                        type="number"
                                        value={preview.durationDays}
                                        onChange={(e) => setPreview({ ...preview, durationDays: Number(e.target.value) })}
                                        className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus:border-primary text-foreground text-sm transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Challenge Days Selector */}
                            <div className="space-y-3 pt-2">
                                <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Challenge Days</label>
                                <div className="flex justify-between gap-2">
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                                        // If it's NOT in restDays, it is ACTIVE (Selected)
                                        const isActive = !restDays.includes(index);
                                        return (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    if (isActive) {
                                                        // Was active, now making it rest day (add to restDays)
                                                        setRestDays([...restDays, index]);
                                                    } else {
                                                        // Was rest day, now making it active (remove from restDays)
                                                        setRestDays(restDays.filter(d => d !== index));
                                                    }
                                                }}
                                                className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${isActive
                                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105'
                                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Tap to deselect days (rest days).
                                </p>
                            </div>

                            {/* Start Date Toggle */}
                            <div className="space-y-3 pt-2">
                                <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Start From</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setStartOption('tomorrow')}
                                        className={`py-2 rounded-lg text-xs font-medium transition-colors ${startOption === 'tomorrow' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                    >
                                        Tomorrow
                                    </button>
                                    <button
                                        onClick={() => setStartOption('today')}
                                        className={`py-2 rounded-lg text-xs font-medium transition-colors ${startOption === 'today' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={() => setStartOption('custom')}
                                        className={`py-2 rounded-lg text-xs font-medium transition-colors ${startOption === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                    >
                                        Custom
                                    </button>
                                </div>
                                {startOption === 'custom' && (
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus:border-primary text-foreground text-sm transition-colors"
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                )}
                            </div>

                            <div className="pt-4 border-t border-border">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-sm font-medium text-foreground">Require Time Window?</label>
                                    <button
                                        onClick={() => setRequiresTimeWindow(!requiresTimeWindow)}
                                        className={`w-10 h-5 rounded-full transition-colors relative ${requiresTimeWindow ? 'bg-primary' : 'bg-muted'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${requiresTimeWindow ? 'translate-x-5' : ''}`} />
                                    </button>
                                </div>

                                {requiresTimeWindow && (
                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Start Time</label>
                                            <input
                                                type="time"
                                                value={preview.timeWindowStart}
                                                onChange={(e) => setPreview({ ...preview, timeWindowStart: e.target.value })}
                                                className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus:border-primary text-foreground text-sm transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">End Time</label>
                                            <input
                                                type="time"
                                                value={preview.timeWindowEnd}
                                                onChange={(e) => setPreview({ ...preview, timeWindowEnd: e.target.value })}
                                                className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus:border-primary text-foreground text-sm transition-colors"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Location Manager */}
                            <LocationManager
                                requiresLocation={requiresLocation}
                                setRequiresLocation={setRequiresLocation}
                                locations={locations}
                                setLocations={setLocations}
                                singleLocation={location}
                                setSingleLocation={setLocation}
                            />
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="w-full py-4 bg-green-600 rounded-xl font-bold text-base text-white hover:bg-green-500 transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                        >
                            {creating ? (
                                <>
                                    <Loader size={18} className="text-white p-0" />
                                    <span>Creating...</span>
                                </>
                            ) : "Confirm & Create"}
                        </button>

                        <button
                            onClick={() => setPreview(null)}
                            className="w-full py-3 text-muted-foreground text-sm hover:text-foreground transition-colors"
                        >
                            Cancel & Edit Prompt
                        </button>
                    </div>
                )}
            </div>
        </AuthGuard >
    );
}
