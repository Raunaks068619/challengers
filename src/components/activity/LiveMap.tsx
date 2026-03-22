"use client";

// This file is ONLY ever imported via dynamic() — never server-rendered.
import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Polyline, useMap, CircleMarker } from "react-leaflet";
import type { Waypoint } from "@/types";
import "leaflet/dist/leaflet.css";

interface LiveMapProps {
    waypoints: Waypoint[];
    /** If true, the map re-centres on the latest waypoint automatically */
    follow?: boolean;
}

/** Keeps the map centred on the latest GPS point when `follow` is true */
function FollowUser({ waypoints }: { waypoints: Waypoint[] }) {
    const map = useMap();
    const last = waypoints[waypoints.length - 1];

    useEffect(() => {
        if (last) {
            map.setView([last.lat, last.lng], map.getZoom() < 17 ? 17 : map.getZoom(), {
                animate: true,
                duration: 0.8,
            });
        }
    }, [last, map]);

    return null;
}

export default function LiveMap({ waypoints, follow = false }: LiveMapProps) {
    const positions = useMemo(
        () => waypoints.map(w => [w.lat, w.lng] as [number, number]),
        [waypoints]
    );

    const last = waypoints[waypoints.length - 1];
    const first = waypoints[0];

    // Default centre: last known point, or a sensible world centre
    const centre: [number, number] = last
        ? [last.lat, last.lng]
        : first
            ? [first.lat, first.lng]
            : [20, 0];

    return (
        <MapContainer
            center={centre}
            zoom={17}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
            attributionControl={false}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
            />

            {/* Route polyline */}
            {positions.length >= 2 && (
                <Polyline
                    positions={positions}
                    color="#6366f1"   // indigo/primary-ish
                    weight={4}
                    opacity={0.9}
                />
            )}

            {/* Start marker */}
            {first && (
                <CircleMarker
                    center={[first.lat, first.lng]}
                    radius={6}
                    pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }}
                />
            )}

            {/* Current position marker (blue pulsing dot) */}
            {last && (
                <CircleMarker
                    center={[last.lat, last.lng]}
                    radius={8}
                    pathOptions={{ color: "#fff", fillColor: "#3b82f6", fillOpacity: 1, weight: 2 }}
                />
            )}

            {follow && <FollowUser waypoints={waypoints} />}
        </MapContainer>
    );
}
