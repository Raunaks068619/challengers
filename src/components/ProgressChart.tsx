"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ProgressChartProps {
    data: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-xl min-w-[150px]">
                <p className="text-white font-medium mb-2">{label}</p>
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-zinc-400 capitalize">{entry.name} :</span>
                            <span className="text-white font-medium">{entry.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export default function ProgressChart({ data }: ProgressChartProps) {
    if (!data || data.length === 0) return null;

    // Extract participant names from the first data point
    const keys = Object.keys(data[0]).filter(k => k !== 'name' && k !== 'date');
    console.log({keys});
    

    // Generate colors (simple rotation)
    const colors = ['#818cf8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    return (
        <div className="w-full h-[350px] bg-card rounded-2xl p-6 border border-border shadow-sm">
            <div className="mb-4">
                <h3 className="text-lg font-bold text-foreground">Activity Overview</h3>
                <p className="text-sm text-muted-foreground">Points history vs participants</p>
            </div>

            <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        {keys.map((key, index) => (
                            <linearGradient key={key} id={`color-${index}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />

                    {keys.map((key, index) => (
                        <Area
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={colors[index % colors.length]}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill={`url(#color-${index})`}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
