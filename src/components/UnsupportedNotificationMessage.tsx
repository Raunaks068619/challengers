"use client";

import Image from "next/image";
import React from "react";
import { Smartphone } from "lucide-react";

interface UnsupportedNotificationMessageProps {
    className?: string;
}

export default function UnsupportedNotificationMessage({
    className = ""
}: UnsupportedNotificationMessageProps) {
    return (
        <div className={`p-6 rounded-xl bg-card border border-border ${className}`}>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-amber-500/10">
                    <Smartphone className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                    Enable Push Notifications
                </h3>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
                Push notifications are not supported in this browser. To receive notifications:
            </p>

            <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="text-lg">📱</span>
                    <div>
                        <p className="text-sm font-medium text-foreground">On Mobile (iOS/Android)</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Tap the share button and select "Add to Home Screen" to install the app.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="text-lg">💻</span>
                    <div>
                        <p className="text-sm font-medium text-foreground">On Desktop</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Use Chrome, Firefox, or Edge for full notification support.
                        </p>
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
                iOS requires version 16.4+ and the app must be installed as a PWA.
            </p>
        </div>
    );
}
