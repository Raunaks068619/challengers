"use client";

import { RefreshCw } from "lucide-react";

export default function RefreshButton() {
    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <button
            onClick={handleRefresh}
            className="fixed bottom-6 right-6 z-50 p-3 bg-indigo-600 rounded-full shadow-lg shadow-indigo-500/30 text-white hover:bg-indigo-500 transition-all active:scale-95"
            aria-label="Refresh Page"
        >
            <RefreshCw className="w-6 h-6" />
        </button>
    );
}
