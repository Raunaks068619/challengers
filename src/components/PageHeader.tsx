"use client";

import { ChevronLeft, Bell, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import NotificationPanel from "./NotificationPanel";

interface OptionItem {
    title: string;
    navigateTo?: string;
    runFunction?: () => void;
    icon?: React.ReactNode;
}

interface PageHeaderProps {
    title: string;
    backbutton?: boolean;
    backbuttonAction?: string; // Route to navigate to, or empty for router.back()
    showNotificationComponent?: boolean;
    showOptionButton?: OptionItem[];
    className?: string;
}

export default function PageHeader({
    title,
    backbutton = false,
    backbuttonAction = "",
    showNotificationComponent = false,
    showOptionButton = [],
    className
}: PageHeaderProps) {
    const router = useRouter();
    const [showOptions, setShowOptions] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const optionsRef = useRef<HTMLDivElement>(null);

    // Handle click outside for options menu
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                setShowOptions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleBack = () => {
        if (backbuttonAction) {
            router.push(backbuttonAction);
        } else {
            router.back();
        }
    };

    return (
        <>
            <header className={cn("flex items-center justify-between mb-4", className)}>
                <div className="flex items-center gap-4">
                    {backbutton && (
                        <button
                            onClick={handleBack}
                            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors text-foreground"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    <h1 className="text-xl font-bold text-foreground">{title}</h1>
                </div>

                <div className="flex items-center gap-2">
                    {showNotificationComponent && (
                        <button
                            onClick={() => setShowNotifications(true)}
                            className="p-2 rounded-full hover:bg-muted transition-colors relative text-foreground"
                        >
                            <Bell className="w-6 h-6" />
                            {/* Optional: Add a red dot if there are unread notifications */}
                            {/* <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background"></span> */}
                        </button>
                    )}

                    {showOptionButton && showOptionButton.length > 0 && (
                        <div className="relative" ref={optionsRef}>
                            <button
                                onClick={() => setShowOptions(!showOptions)}
                                className="p-2 rounded-full hover:bg-muted transition-colors text-foreground"
                            >
                                <MoreHorizontal className="w-6 h-6" />
                            </button>

                            {/* Dropdown Menu */}
                            {showOptions && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                                    {showOptionButton.map((option, index) => (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                if (option.navigateTo) {
                                                    router.push(option.navigateTo);
                                                } else if (option.runFunction) {
                                                    option.runFunction();
                                                }
                                                setShowOptions(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted transition-colors text-foreground border-b border-border last:border-0 flex items-center gap-3"
                                        >
                                            {option.icon && <span className="text-muted-foreground">{option.icon}</span>}
                                            <span>{option.title}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Notification Panel */}
            {showNotificationComponent && (
                <NotificationPanel
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                />
            )}
        </>
    );
}
