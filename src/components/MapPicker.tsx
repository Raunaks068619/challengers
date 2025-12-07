"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Check } from "lucide-react";
import { toast } from "sonner";

// Fix for default marker icon in Leaflet with Next.js/React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (location: { lat: number; lng: number; radius: number }) => void;
    initialLocation?: { lat: number; lng: number; radius: number };
}

function LocationMarker({ location, setLocation }: { location: { lat: number; lng: number } | null, setLocation: (loc: { lat: number; lng: number }) => void }) {
    useMapEvents({
        click(e) {
            setLocation(e.latlng);
        },
    });

    return location === null ? null : (
        <Marker position={location}></Marker>
    );
}

export default function MapPicker({ isOpen, onClose, onSelect, initialLocation }: MapPickerProps) {
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [radius, setRadius] = useState(100);
    const [defaultCenter, setDefaultCenter] = useState<{ lat: number; lng: number }>({ lat: 51.505, lng: -0.09 }); // Default to London

    useEffect(() => {
        if (isOpen) {
            if (initialLocation) {
                setLocation({ lat: initialLocation.lat, lng: initialLocation.lng });
                setRadius(initialLocation.radius);
                setDefaultCenter({ lat: initialLocation.lat, lng: initialLocation.lng });
            } else {
                // Try to get current location for initial center
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const userLoc = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            };
                            if (!location) {
                                setDefaultCenter(userLoc);
                                // Optional: Auto-select current location? Maybe better to let user choose.
                                // setLocation(userLoc); 
                            }
                        },
                        () => {
                            // Keep default
                        }
                    );
                }
            }
        }
    }, [isOpen, initialLocation]);

    const handleConfirm = () => {
        if (location) {
            onSelect({ ...location, radius });
            onClose();
        } else {
            toast.error("Please select a location on the map");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-lg h-[80vh] rounded-2xl border border-border flex flex-col overflow-hidden relative">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-card z-10">
                    <h3 className="font-bold text-foreground">Select Location</h3>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Map */}
                <div className="flex-1 relative bg-muted z-0">
                    {/* Key forces re-render when center changes, ensuring map flies to new center */}
                    <MapContainer
                        key={`${defaultCenter.lat}-${defaultCenter.lng}`}
                        center={defaultCenter}
                        zoom={13}
                        style={{ height: "100%", width: "100%" }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker location={location} setLocation={setLocation} />
                        {location && (
                            <Circle
                                center={location}
                                radius={radius}
                                pathOptions={{
                                    fillColor: '#22c55e',
                                    fillOpacity: 0.2,
                                    color: '#22c55e',
                                    weight: 2,
                                }}
                            />
                        )}
                    </MapContainer>

                    {/* Radius Slider Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 bg-card/90 backdrop-blur-md p-4 rounded-xl border border-border shadow-lg z-[1000]">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Check-in Radius</label>
                            <span className="text-xs font-mono font-medium text-foreground">{radius}m</span>
                        </div>
                        <input
                            type="range"
                            min="50"
                            max="1000"
                            step="50"
                            value={radius}
                            onChange={(e) => setRadius(Number(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-card z-10">
                    <button
                        onClick={handleConfirm}
                        className="w-full py-3 bg-primary rounded-xl font-bold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                        <Check className="w-5 h-5" />
                        Confirm Location
                    </button>
                </div>
            </div>
        </div>
    );
}
