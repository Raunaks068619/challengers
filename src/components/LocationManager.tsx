"use client";

import { useState, useEffect } from "react";
import { MapPin, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface Location {
    lat: number;
    lng: number;
    radius: number;
    address?: string;
}

interface LocationManagerProps {
    requiresLocation: boolean;
    setRequiresLocation: (val: boolean) => void;
    locations: Location[];
    setLocations: (locs: Location[]) => void;
    // Legacy support (optional)
    singleLocation?: { lat: number; lng: number } | null;
    setSingleLocation?: (loc: { lat: number; lng: number } | null) => void;
}

import MapPicker from "./MapPicker";

export default function LocationManager({
    requiresLocation,
    setRequiresLocation,
    locations,
    setLocations,
    singleLocation,
    setSingleLocation
}: LocationManagerProps) {
    const [locating, setLocating] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);

    // Convert legacy single location to locations array if needed
    useEffect(() => {
        if (singleLocation && locations.length === 0 && setSingleLocation) {
            setLocations([{ ...singleLocation, radius: 100, address: "Primary Location" }]);
            setSingleLocation(null); // Clear legacy to avoid duplication
        }
    }, [singleLocation, locations, setLocations, setSingleLocation]);

    const addCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported");
            return;
        }
        setLocating(true);
        const toastId = toast.loading("Getting location...");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newLoc: Location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    radius: 100, // Default radius
                    address: `Location ${locations.length + 1}`
                };
                setLocations([...locations, newLoc]);
                toast.success("Location added!", { id: toastId });
                setLocating(false);
            },
            (error) => {
                console.error(error);
                toast.error("Failed to get location", { id: toastId });
                setLocating(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleMapSelect = (location: { lat: number; lng: number; radius: number }) => {
        const newLoc: Location = {
            lat: location.lat,
            lng: location.lng,
            radius: location.radius,
            address: `Location ${locations.length + 1}`
        };
        setLocations([...locations, newLoc]);
    };

    const removeLocation = (index: number) => {
        const newLocs = [...locations];
        newLocs.splice(index, 1);
        setLocations(newLocs);
    };

    const updateRadius = (index: number, radius: number) => {
        const newLocs = [...locations];
        newLocs[index].radius = radius;
        setLocations(newLocs);
    };

    const updateLabel = (index: number, label: string) => {
        const newLocs = [...locations];
        newLocs[index].address = label;
        setLocations(newLocs);
    };

    return (
        <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-foreground">Require Location Check-in?</label>
                <button
                    onClick={() => setRequiresLocation(!requiresLocation)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${requiresLocation ? 'bg-primary' : 'bg-muted'}`}
                >
                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${requiresLocation ? 'translate-x-5' : ''}`} />
                </button>
            </div>

            {requiresLocation && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-muted/30 rounded-xl p-4 border border-border">
                        <p className="text-xs text-muted-foreground mb-4">
                            Participants must be within the specified radius of ANY of these locations to check in.
                        </p>

                        <div className="space-y-3 mb-4">
                            {locations.map((loc, index) => (
                                <div key={index} className="bg-card p-3 rounded-lg border border-border shadow-sm">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                                                <MapPin className="w-3 h-3" />
                                            </div>
                                            <input
                                                type="text"
                                                value={loc.address}
                                                onChange={(e) => updateLabel(index, e.target.value)}
                                                className="bg-transparent text-sm font-medium focus:outline-none focus:border-b border-primary w-32"
                                                placeholder="Label"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeLocation(index)}
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Removed raw Lat/Lng display as requested */}

                                    <div className="mt-3 flex items-center gap-2">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Radius (m)</label>
                                        <input
                                            type="range"
                                            min="50"
                                            max="1000"
                                            step="50"
                                            value={loc.radius}
                                            onChange={(e) => updateRadius(index, Number(e.target.value))}
                                            className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
                                        />
                                        <span className="w-10 text-right font-mono text-xs">{loc.radius}m</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={addCurrentLocation}
                                disabled={locating}
                                className="py-3 bg-card border border-dashed border-border rounded-xl text-xs font-medium hover:bg-muted flex items-center justify-center gap-2 text-foreground transition-colors"
                            >
                                {locating ? (
                                    "Locating..."
                                ) : (
                                    <>
                                        <Plus className="w-3 h-3" />
                                        Current Location
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowMapPicker(true)}
                                className="py-3 bg-card border border-dashed border-border rounded-xl text-xs font-medium hover:bg-muted flex items-center justify-center gap-2 text-foreground transition-colors"
                            >
                                <MapPin className="w-3 h-3" />
                                Select on Map
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <MapPicker
                isOpen={showMapPicker}
                onClose={() => setShowMapPicker(false)}
                onSelect={handleMapSelect}
            />
        </div>
    );
}
