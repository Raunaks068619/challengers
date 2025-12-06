"use client";

import { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { toast } from 'sonner';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);

    useEffect(() => {
        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // Check if already in standalone mode (installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

        if (isStandalone) {
            setIsInstallable(false);
            return;
        }

        // If iOS and not standalone, we can show the button (to trigger instructions)
        if (isIosDevice && !isStandalone) {
            setIsInstallable(true);
        }

        // Android/Desktop: Listen for beforeinstallprompt
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isIOS) {
            setShowIOSInstructions(true);
            return;
        }

        if (!deferredPrompt) return;

        deferredPrompt.prompt();

        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        setDeferredPrompt(null);
        setIsInstallable(false);
    };

    if (!isInstallable) return null;

    return (
        <>
            <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
                <Download className="w-5 h-5" />
                Install App
            </button>

            {/* iOS Instructions Modal */}
            {showIOSInstructions && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-foreground">Install for iOS</h3>
                            <button
                                onClick={() => setShowIOSInstructions(false)}
                                className="p-1 hover:bg-muted rounded-full text-muted-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4 text-sm text-muted-foreground">
                            <p>To install this app on your iPhone/iPad:</p>

                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                                <Share className="w-6 h-6 text-blue-500" />
                                <span>1. Tap the <strong>Share</strong> button in your browser bar.</span>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                                <PlusSquare className="w-6 h-6 text-foreground" />
                                <span>2. Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowIOSInstructions(false)}
                            className="w-full mt-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
