import { X, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getNotifications, markAllRead, Notification } from "@/app/actions/notifications";
import { useAuth } from "@/context/AuthContext";

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        if (isOpen && user) {
            setLoading(true);
            getNotifications(user.uid)
                .then(setNotifications)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [isOpen, user]);

    const handleClear = async () => {
        if (!user) return;
        await markAllRead(user.uid);
        setNotifications([]);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-80 bg-background border-l border-border z-50 shadow-2xl"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
                            <div className="flex items-center gap-2">
                                {notifications.length > 0 && (
                                    <button onClick={handleClear} className="p-2 hover:bg-muted rounded-full transition-colors text-destructive" title="Clear All">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 space-y-3 overflow-y-auto h-[calc(100vh-64px)]">
                            {loading ? (
                                <div className="text-center text-muted-foreground py-8">Loading...</div>
                            ) : notifications.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">No new notifications</div>
                            ) : (
                                notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={`p-3 rounded-xl border ${notif.read ? 'bg-card/50 border-border' : 'bg-card border-primary/20'} transition-colors`}
                                    >
                                        <p className="text-sm text-foreground">{notif.message}</p>
                                        <span className="text-xs text-muted-foreground mt-2 block">
                                            {new Date(notif.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
