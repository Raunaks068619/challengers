"use client";

import React, { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import type { Waypoint } from "@/types";
import "leaflet/dist/leaflet.css";

// Colour-code the route by pace: fast = green, medium = yellow, slow = orange
function paceColor(segMs: number): string {
    const secPerKm = 1000 / segMs; // speed in m/s → s/km = 1000/v
    if (secPerKm < 240) return "#22c55e";   // <4:00/km fast
    if (secPerKm < 360) return "#eab308";   // 4-6:00/km medium
    if (secPerKm < 480) return "#f97316";   // 6-8:00/km slower
    return "#ef4444";                         // >8:00/km walking
}

export default function RouteMapInner({ waypoints }: { waypoints: Waypoint[] }) {
    const positions = useMemo(
        () => waypoints.map(w => [w.lat, w.lng] as [number, number]),
        [waypoints]
    );

    // Build colour-coded segments
    const segments = useMemo(() => {
        if (waypoints.length < 2) return [];
        return waypoints.slice(1).map((wp, i) => {
            const prev = waypoints[i];
            const dtMs = wp.timestamp - prev.timestamp;
            const R = 6_371_000;
            const toRad = (d: number) => (d * Math.PI) / 180;
            const dLat = toRad(wp.lat - prev.lat);
            const dLng = toRad(wp.lng - prev.lng);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(prev.lat)) * Math.cos(toRad(wp.lat)) * Math.sin(dLng / 2) ** 2;
            const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const speedMs = dtMs > 0 ? distM / (dtMs / 1000) : 0;
            return {
                positions: [[prev.lat, prev.lng], [wp.lat, wp.lng]] as [number, number][],
                color: speedMs > 0 ? paceColor(speedMs) : "#6366f1",
            };
        });
    }, [waypoints]);

    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    const centre: [number, number] = first ? [first.lat, first.lng] : [20, 0];

    // Calculate bounds to fit the whole route
    const bounds: [[number, number], [number, number]] | undefined = positions.length >= 2
        ? [
            [Math.min(...positions.map(p => p[0])), Math.min(...positions.map(p => p[1]))],
            [Math.max(...positions.map(p => p[0])), Math.max(...positions.map(p => p[1]))],
        ]
        : undefined;

    return (
        <MapContainer
            bounds={bounds}
            center={!bounds ? centre : undefined}
            zoom={!bounds ? 15 : undefined}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
            attributionControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
        >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {/* Colour-coded route segments */}
            {segments.map((seg, i) => (
                <Polyline key={i} positions={seg.positions} color={seg.color} weight={4} opacity={0.9} />
            ))}

            {/* Start marker — green */}
            {first && (
                <CircleMarker
                    center={[first.lat, first.lng]}
                    radius={6}
                    pathOptions={{ color: "#fff", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }}
                />
            )}

            {/* End marker — red */}
            {last && last !== first && (
                <CircleMarker
                    center={[last.lat, last.lng]}
                    radius={6}
                    pathOptions={{ color: "#fff", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }}
                />
            )}
        </MapContainer>
    );
}
