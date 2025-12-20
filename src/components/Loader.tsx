"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoaderProps {
    fullscreen?: boolean;
    className?: string;
    size?: number;
}

export default function Loader({ fullscreen = false, className, size = 24 }: LoaderProps) {
    const loader = (
        <Loader2
            className={cn("animate-spin text-primary", className)}
            size={size}
        />
    );

    if (fullscreen) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                {loader}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-4">
            {loader}
        </div>
    );
}
