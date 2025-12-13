"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Maximize2, Minimize2 } from "lucide-react";

interface ChartUser {
    id: string;
    name: string;
}

interface ProgressChartProps {
    data: {
        mode: 'global' | 'challenge';
        data: any[];
        users: ChartUser[];
    };
}

const CustomTooltip = ({ active, payload, label, userMap, isFull }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className={`${isFull ? 'rotate-90' : ''} bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-xl min-w-[150px] ${isFull ? 'w-full' : ''}`}>
                <p className="text-white font-medium mb-2">{label}</p>
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => {
                        // Map user_id to display name if available
                        const displayName = userMap?.[entry.dataKey] || entry.name;
                        return (
                            <div key={index} className="flex items-center gap-2 text-sm">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-zinc-400 capitalize">{displayName}:</span>
                                <span className="text-white font-medium">{entry.value ?? 'N/A'}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

export default function ProgressChart({ data }: ProgressChartProps) {
    const { mode, data: chartData, users } = data;
    const [range, setRange] = useState<'week' | 'month' | 'all'>('week');
    const [isFullscreen, setIsFullscreen] = useState(false);

    if (!chartData || chartData.length === 0) return null;

    // Create a map from user_id to display_name
    const userMap = useMemo(() => {
        const map: Record<string, string> = {};
        users.forEach(u => { map[u.id] = u.name; });
        return map;
    }, [users]);

    // Extract data keys (user_ids or display_names depending on mode)
    const keys = useMemo(() => {
        if (mode === 'global') {
            return Object.keys(chartData[0]).filter(k => k !== 'name' && k !== 'date');
        } else {
            return users.map(u => u.id);
        }
    }, [chartData, mode, users]);

    // Filter data based on range
    const filteredData = useMemo(() => {
        const end = chartData.length;
        if (range === 'week') return chartData.slice(Math.max(0, end - 7));
        if (range === 'month') return chartData.slice(Math.max(0, end - 30));
        return chartData;
    }, [chartData, range]);

    // Generate colors
    const colors = ['#818cf8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    const subtitle = mode === 'global'
        ? 'Your points history'
        : `Comparing ${users.length} participants`;

    const handleRangeChange = (r: 'week' | 'month' | 'all') => {
        setRange(r);
        if (r !== 'week') {
            setIsFullscreen(true);
        }
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const ChartContent = ({ isFull = false }) => {
        const isVertical = isFull;

        return (
            <div className={`w-full h-full flex flex-col ${isFull ? 'p-4' : ''}`}>
                <div className={`${isFull ? 'mb-2' : 'mb-4'} flex justify-between items-start`}>
                    <div>
                        <h3 className={`${isFull ? 'text-xl' : 'text-lg'} font-bold text-foreground`}>Activity Overview</h3>
                        <p className={`${isFull ? 'text-sm' : 'text-sm'} text-muted-foreground`}>{subtitle}</p>
                    </div>
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2 hover:bg-muted rounded-full transition-colors text-foreground"
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                </div>

                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            layout={isVertical ? 'vertical' : 'horizontal'}
                            data={filteredData}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                            <defs>
                                {keys.map((key, index) => (
                                    <linearGradient key={key} id={`color-${index}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />

                            {isVertical ? (
                                <>
                                    <XAxis
                                        type="number"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={({ x, y, payload }) => (
                                            <g transform={`translate(${x},${y})`}>
                                                <text
                                                    x={0}
                                                    y={0}
                                                    dx={12}
                                                    textAnchor="middle"
                                                    fill="#71717a"
                                                    fontSize={12}
                                                    transform="rotate(90)"
                                                >
                                                    {payload.value}
                                                </text>
                                            </g>
                                        )}
                                        dy={10}
                                        interval={'preserveStartEnd'}
                                    />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        width={40}
                                        tick={({ x, y, payload }) => (
                                            <g transform={`translate(${x},${y})`}>
                                                <text
                                                    x={0}
                                                    y={0}
                                                    dy={4}
                                                    textAnchor="middle"
                                                    fill="#71717a"
                                                    fontSize={12}
                                                    transform="rotate(90)"
                                                >
                                                    {payload.value}
                                                </text>
                                            </g>
                                        )}
                                    />
                                </>
                            ) : (
                                <>
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#71717a', fontSize: 12 }}
                                        dy={10}
                                        interval={'preserveStartEnd'}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#71717a', fontSize: 12 }}
                                    />
                                </>
                            )}

                            <Tooltip
                                content={<CustomTooltip userMap={userMap} isFull={isFull} />}
                                cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                position={{ y: -100 }}
                            />

                            {keys.map((key, index) => (
                                <Area
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    name={userMap[key] || key}
                                    stroke={colors[index % colors.length]}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill={`url(#color-${index})`}
                                    connectNulls={false}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Tabs */}
                <div className={`${isFull ? 'mt-2' : 'mt-4'} flex justify-center`}>
                    <div className={`bg-muted/50 ${isFull ? 'py-5 px-1':' p-2'} rounded-xl flex gap-1`}>
                        {(['week', 'month', 'all'] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => handleRangeChange(r)}
                                className={` ${isFull ? 'rotate-90 px-2 py-1' : 'py-2 px-4'} rounded-lg text-xs font-medium transition-all ${range === r
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Inline Chart */}
            <div className="w-full h-[400px] bg-card rounded-2xl p-6 border border-border shadow-sm">
                <ChartContent />
            </div>

            {/* Fullscreen Overlay */}
            {mounted && isFullscreen && createPortal(
                <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full bg-background">
                        <ChartContent isFull={true} />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
