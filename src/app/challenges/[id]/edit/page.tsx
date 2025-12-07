"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { ChevronLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useGetChallengeQuery, useUpdateChallengeMutation } from "@/lib/features/api/apiSlice";
import LocationManager from "@/components/LocationManager";
import { Challenge } from "@/types";

export default function EditChallengePage() {
    const { id } = useParams();
    const { user } = useAuth();
    const router = useRouter();

    const { data: challenge, isLoading: loadingChallenge } = useGetChallengeQuery(id as string, {
        skip: !id,
    });

    const [updateChallenge, { isLoading: updating }] = useUpdateChallengeMutation();

    // Form State
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);

    // Location State
    const [requiresLocation, setRequiresLocation] = useState(false);
    const [locations, setLocations] = useState<{ lat: number; lng: number; radius: number; address?: string }[]>([]);

    // Initialize state from challenge data
    useEffect(() => {
        if (challenge) {
            setTitle(challenge.title);
            setDescription(challenge.description);
            setBannerUrl(challenge.banner_url || null);
            setRequiresLocation(challenge.requires_location || false);

            if (challenge.locations && challenge.locations.length > 0) {
                setLocations(challenge.locations);
            } else if (challenge.location_lat && challenge.location_lng) {
                // Legacy support
                setLocations([{
                    lat: challenge.location_lat,
                    lng: challenge.location_lng,
                    radius: challenge.location_radius || 100,
                    address: "Primary Location"
                }]);
            }
        }
    }, [challenge]);

    // Check permissions
    if (challenge && user && challenge.creator_id !== user.uid) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                You do not have permission to edit this challenge.
            </div>
        );
    }

    const handleSave = async () => {
        if (!user || !id) return;

        if (requiresLocation && locations.length === 0) {
            toast.error("Please add at least one location");
            return;
        }

        try {
            const updates: Partial<Challenge> = {
                title,
                description,
                requires_location: requiresLocation,
                locations: requiresLocation ? locations : [],
                // Clear legacy fields if using new system, or keep them synced with first location?
                // Let's keep them synced with the first location for backward compatibility if needed, 
                // but primarily rely on `locations`.
                location_lat: requiresLocation && locations.length > 0 ? locations[0].lat : null,
                location_lng: requiresLocation && locations.length > 0 ? locations[0].lng : null,
                location_radius: requiresLocation && locations.length > 0 ? locations[0].radius : 100,
            };

            await updateChallenge({ challengeId: id as string, updates }).unwrap();
            toast.success("Challenge updated!");
            router.push(`/challenges/${id}`);
        } catch (error: any) {
            toast.error("Failed to update challenge");
            console.error(error);
        }
    };

    if (loadingChallenge) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground p-4 pb-20">
                <header className="flex items-center gap-4 mb-6">
                    <Link href={`/challenges/${id}`} className="p-2 bg-card rounded-full hover:bg-muted border border-border transition-colors">
                        <ChevronLeft className="w-5 h-5 text-foreground" />
                    </Link>
                    <h1 className="text-xl font-bold text-foreground">Edit Challenge</h1>
                </header>

                <div className="space-y-6">
                    <div className="bg-card rounded-2xl p-4 border border-border space-y-4">
                        <div>
                            <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus:border-primary text-foreground text-sm transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus:border-primary resize-none h-32 text-foreground text-sm transition-colors"
                            />
                        </div>

                        <LocationManager
                            requiresLocation={requiresLocation}
                            setRequiresLocation={setRequiresLocation}
                            locations={locations}
                            setLocations={setLocations}
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={updating}
                        className="w-full py-4 bg-primary rounded-xl font-bold text-base text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 transition-opacity flex items-center justify-center gap-2"
                    >
                        {updating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </AuthGuard>
    );
}
