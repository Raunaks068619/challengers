"use client";

import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

import { generateAvatarAction, generateVisualDescriptionAction } from "@/app/actions/generateAvatar";
import { cacheProfile } from "@/app/actions/profile";

import { requestNotificationPermission } from "@/lib/notifications";
import { arrayUnion } from "firebase/firestore";
import InstallPrompt from "@/components/InstallPrompt";

export default function ProfilePage() {
    const { user, userProfile, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        contact_email: "",
        contact_phone: "",
        bio: "",
        photo_url: ""
    });

    // AI Avatar State
    const [showAiModal, setShowAiModal] = useState(false);
    const [avatarPrompt, setAvatarPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);

    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

    useEffect(() => {
        if (userProfile) {
            setFormData({
                first_name: userProfile.first_name || "",
                last_name: userProfile.last_name || "",
                contact_email: userProfile.contact_email || user?.email || "",
                contact_phone: userProfile.contact_phone || "",
                bio: userProfile.bio || "",
                photo_url: userProfile.photo_url || user?.photoURL || ""
            });
        }
    }, [userProfile, user]);

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const userRef = doc(db, "profiles", user.uid);
            const updatedData = {
                ...formData,
                display_name: `${formData.first_name} ${formData.last_name}`.trim() || userProfile?.display_name || user?.displayName
            };

            await updateDoc(userRef, updatedData);

            // Update Cache
            await cacheProfile(user.uid, { ...userProfile, ...updatedData });

            toast.success("Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const toastId = toast.loading("Uploading image...");

        try {
            if (!user) throw new Error("User not authenticated");

            const fileExt = file.name.split('.').pop();
            const fileName = `avatars/${user.uid}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('challengers')
                .upload(fileName, file, {
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('challengers')
                .getPublicUrl(fileName);

            setFormData(prev => ({ ...prev, photo_url: publicUrl }));
            toast.success("Image uploaded!", { id: toastId });
        } catch (error: any) {
            console.error("Upload error:", error);
            toast.error("Failed to upload image: " + error.message, { id: toastId });
        }
    };

    const handleGenerateAvatar = async () => {
        if (!avatarPrompt) {
            toast.error("Please describe your avatar");
            return;
        }
        setIsGenerating(true);
        setGeneratedAvatar(null);
        try {
            const base64Image = await generateAvatarAction(`A high-quality 3D CGI render in the distinct style of an Apple Memoji. The image is a head and shoulders portrait of a custom avatar designed based on the specific following details: ${avatarPrompt}. The lighting is clean, soft studio lighting. The textures are smooth, polished, and cartoonish. The background is a clean, solid, neutral color.`);
            setGeneratedAvatar(base64Image);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveGeneratedAvatar = async () => {
        if (!generatedAvatar || !user) return;
        const toastId = toast.loading("Saving avatar...");
        try {
            // Convert base64 to Blob
            const res = await fetch(generatedAvatar);
            const blob = await res.blob();

            // Create a File from Blob
            const file = new File([blob], "avatar.png", { type: "image/png" });

            const fileName = `avatars/${user.uid}-${Math.random().toString(36).substring(7)}.png`;

            const { error: uploadError } = await supabase.storage
                .from('challengers')
                .upload(fileName, file, {
                    upsert: true,
                    contentType: 'image/png'
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('challengers')
                .getPublicUrl(fileName);

            // Update Form Data
            setFormData(prev => ({ ...prev, photo_url: publicUrl }));

            // Immediate save to Firestore
            const userRef = doc(db, "profiles", user.uid);
            await updateDoc(userRef, {
                photo_url: publicUrl
            });

            // Update Cache
            await cacheProfile(user.uid, { ...userProfile, photo_url: publicUrl });

            setShowAiModal(false);
            setGeneratedAvatar(null);
            setAvatarPrompt("");
            toast.success("Avatar saved and profile updated!", { id: toastId });
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error("Failed to save avatar", { id: toastId });
        }
    };

    const handleAiMakeIt = async () => {
        setIsThinking(true);
        try {
            if (!formData.bio && !formData.first_name) {
                // Fallback to random if no info
                const features = [
                    ["short messy", "long wavy", "curly", "buzz cut", "braided"],
                    ["brown", "black", "blonde", "red", "silver"],
                    ["glasses", "a beanie", "headphones", "earrings", "a cap"],
                    ["hoodie", "t-shirt", "jacket", "sweater"],
                    ["smiling", "confident", "cool", "happy"]
                ];
                const random = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
                const prompt = `A high-quality 3D CGI render in the distinct style of an Apple Memoji. The image is a head and shoulders portrait of a custom avatar designed based on the specific following details: ${features[3]}. The lighting is clean, soft studio lighting. The textures are smooth, polished, and cartoonish. The background is a clean, solid, neutral color.`;
                setAvatarPrompt(prompt);
                toast.info("Generated random prompt (add a Bio for personalized results!)");
            } else {
                const prompt = await generateVisualDescriptionAction(formData.bio, `${formData.first_name} ${formData.last_name}`);
                setAvatarPrompt(prompt);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate prompt");
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground px-6 pb-24">
                <PageHeader
                    title="Edit Profile"
                    className="mb-8"
                    showOptionButton={[
                        {
                            title: "Sign Out",
                            runFunction: logout,
                            icon: <LogOut className="w-4 h-4" />
                        }
                    ]}
                />

                <div className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center gap-4">
                        <motion.div
                            layoutId="profile-image"
                            className="h-28 w-28 rounded-full bg-muted overflow-hidden border-2 border-border relative group cursor-pointer"
                            onClick={() => formData.photo_url && setIsPhotoModalOpen(true)}
                        >
                            {formData.photo_url ? (
                                <motion.img src={formData.photo_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-3xl">?</div>
                            )}
                            <label
                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                <span className="text-xs font-medium text-white">Change</span>
                            </label>
                        </motion.div>
                        <div className="flex gap-2">
                            <label className="px-4 py-2 bg-card border border-border rounded-lg text-xs font-medium hover:bg-muted cursor-pointer transition-colors text-foreground">
                                Upload Photo
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                            <button
                                onClick={() => setShowAiModal(true)}
                                className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
                            >
                                Generate AI Avatar
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 items-center mt-2">
                            <button
                                onClick={async () => {
                                    const token = await requestNotificationPermission();
                                    if (token && user) {
                                        try {
                                            await updateDoc(doc(db, "profiles", user.uid), {
                                                fcm_tokens: arrayUnion(token)
                                            });
                                            toast.success("Notifications enabled!");
                                        } catch (error) {
                                            console.error("Error saving token:", error);
                                            toast.error("Failed to enable notifications");
                                        }
                                    }
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                            >
                                Enable Notifications
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={async () => {
                                        const toastId = toast.loading("Sending test notification...");
                                        try {
                                            console.log("[Profile] Requesting notification permission...");
                                            const token = await requestNotificationPermission();
                                            console.log("[Profile] Token retrieved:", token);

                                            if (!token) {
                                                console.error("[Profile] Notification permission denied or token null");
                                                toast.error("Notification permission denied", { id: toastId });
                                                return;
                                            }

                                            console.log("[Profile] Sending request to /api/test-notification");
                                            const res = await fetch("/api/test-notification", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ token })
                                            });

                                            const data = await res.json();
                                            console.log("[Profile] API Response:", data);

                                            if (!res.ok) throw new Error(data.error || "Failed to send");

                                            toast.success("Notification sent! Check your status bar.", { id: toastId });
                                        } catch (error) {
                                            console.error("[Profile] Error:", error);
                                            toast.error("Failed to send test notification", { id: toastId });
                                        }
                                    }}
                                    className="text-[10px] flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
                                >
                                    <Bell className="w-3 h-3" />
                                    Test Notification
                                </button>
                                <Link
                                    href="/test-notifications"
                                    className="text-[10px] flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-full text-primary hover:text-primary transition-colors border border-primary/20"
                                >
                                    <Bell className="w-3 h-3" />
                                    Test Page
                                </Link>
                            </div>
                        </div>

                        <div className="w-full max-w-xs mt-4">
                            <InstallPrompt />
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">First Name</label>
                                <input
                                    type="text"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    className="w-full bg-card border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground/50 transition-all"
                                    placeholder="John"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Last Name</label>
                                <input
                                    type="text"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    className="w-full bg-card border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground/50 transition-all"
                                    placeholder="Doe"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Email</label>
                            <input
                                type="email"
                                value={formData.contact_email}
                                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                className="w-full bg-card border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground/50 transition-all"
                                placeholder="john@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Phone (Optional)</label>
                            <input
                                type="tel"
                                value={formData.contact_phone}
                                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                                className="w-full bg-card border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground/50 transition-all"
                                placeholder="+1 234 567 8900"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Bio</label>
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                className="w-full bg-card border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none text-foreground placeholder:text-muted-foreground/50 transition-all"
                                placeholder="Tell us about yourself..."
                            />
                        </div>
                    </div>

                    {/* Appearance Section */}
                    <div className="space-y-2">
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Appearance</label>
                        <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded-full">
                                    {theme === 'dark' ? <Moon className="w-4 h-4 text-foreground" /> : <Sun className="w-4 h-4 text-foreground" />}
                                </div>
                                <span className="text-sm font-medium text-foreground">Dark Mode</span>
                            </div>
                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className={cn("w-11 h-6 rounded-full p-1 transition-colors relative", theme === 'dark' ? "bg-primary" : "bg-muted")}
                            >
                                <div className={cn("w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200", theme === 'dark' ? "translate-x-5" : "translate-x-0")} />
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-3 bg-primary rounded-xl font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg shadow-primary/20"
                    >
                        {loading ? "Saving..." : "Save Profile"}
                    </button>
                </div>

                {/* AI Avatar Modal */}
                {showAiModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border shadow-2xl">
                            <h3 className="text-lg font-bold mb-4 text-foreground">Generate AI Avatar</h3>
                            <p className="text-muted-foreground text-sm mb-4">Describe your avatar features (e.g. "short brown hair, glasses, blue hoodie"). We'll create a 3D Memoji style avatar for you.</p>

                            <div className="relative">
                                <textarea
                                    value={avatarPrompt}
                                    onChange={(e) => setAvatarPrompt(e.target.value)}
                                    placeholder="Describe your avatar..."
                                    className="w-full bg-muted border border-border rounded-xl p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none text-foreground placeholder:text-muted-foreground/50"
                                />
                                <button
                                    onClick={handleAiMakeIt}
                                    disabled={isThinking}
                                    className="absolute bottom-6 right-3 text-[10px] bg-card hover:bg-muted text-muted-foreground px-2 py-1 rounded-lg border border-border transition-colors disabled:opacity-50"
                                >
                                    {isThinking ? "Thinking..." : "Let AI make it ✨"}
                                </button>
                            </div>

                            {generatedAvatar && (
                                <div className="mb-4 flex justify-center">
                                    <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-primary shadow-lg shadow-primary/20">
                                        <img src={generatedAvatar} alt="Generated Avatar" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                {!generatedAvatar ? (
                                    <button
                                        onClick={handleGenerateAvatar}
                                        disabled={isGenerating || !avatarPrompt}
                                        className="w-full py-3 bg-primary rounded-xl font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                        {isGenerating ? "Generating..." : "Generate"}
                                    </button>
                                ) : (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setGeneratedAvatar(null)}
                                            className="flex-1 py-3 bg-muted rounded-xl font-medium text-foreground hover:bg-muted/80 transition-colors"
                                        >
                                            Try Again
                                        </button>
                                        <button
                                            onClick={handleSaveGeneratedAvatar}
                                            className="flex-1 py-3 bg-green-600 rounded-xl font-medium text-white hover:bg-green-500 transition-colors shadow-lg shadow-green-500/20"
                                        >
                                            Use Avatar
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowAiModal(false)}
                                    className="w-full py-3 text-muted-foreground text-sm hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Photo View Modal */}
                {/* Profile Photo View Modal */}
                <AnimatePresence>
                    {isPhotoModalOpen && formData.photo_url && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-background/90 flex items-center justify-center p-4 z-[60] backdrop-blur-md"
                            onClick={() => setIsPhotoModalOpen(false)}
                        >
                            <motion.div
                                layoutId="profile-image"
                                className="relative max-w-md w-full aspect-square rounded-lg overflow-hidden shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <motion.img
                                    src={formData.photo_url}
                                    alt="Profile Full View"
                                    className="w-full h-full object-contain"
                                />
                                <button
                                    onClick={() => setIsPhotoModalOpen(false)}
                                    className="absolute top-4 right-4 text-foreground/70 hover:text-foreground bg-background/20 hover:bg-background/40 rounded-full p-2 transition-all backdrop-blur-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AuthGuard >
    );
}
