"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
    src?: string | null;
    alt?: string;
    fallback: string;
    className?: string;
}

export default function Avatar({ src, alt, fallback, className }: AvatarProps) {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [src]);

    return (
        <div className={cn("relative overflow-hidden rounded-full bg-muted flex items-center justify-center", className)}>
            {src && !hasError ? (
                <img
                    src={src}
                    alt={alt || "Avatar"}
                    className="w-full h-full object-cover"
                    onError={() => setHasError(true)}
                />
            ) : (
                <span className="font-bold text-muted-foreground uppercase">
                    {fallback}
                </span>
            )}
        </div>
    );
}
