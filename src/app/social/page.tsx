"use client";

import { Plus } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import PageHeader from "@/components/PageHeader";

export default function SocialPage() {
    // Mock Stories Data
    const stories = [
        { id: 'new', name: 'New', isAdd: true },
        { id: '1', name: 'Sarah', img: 'https://i.pravatar.cc/150?u=1' },
        { id: '2', name: 'Mike', img: 'https://i.pravatar.cc/150?u=2' },
        { id: '3', name: 'Jessica', img: 'https://i.pravatar.cc/150?u=3' },
        { id: '4', name: 'David', img: 'https://i.pravatar.cc/150?u=4' },
        { id: '5', name: 'Alex', img: 'https://i.pravatar.cc/150?u=5' },
        { id: '6', name: 'Emily', img: 'https://i.pravatar.cc/150?u=6' },
    ];

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground p-6 pb-20">
                <PageHeader title="Social" className="mb-4" />

                <main className="space-y-8">
                    {/* Stories Feed */}
                    <section>
                        {/* <h2 className="text-base font-semibold mb-4 text-foreground">Stories</h2> */}
                        <div className="overflow-x-auto no-scrollbar -mx-4">
                            <div className="flex gap-4 min-w-max px-4">
                                {stories.map((story) => (
                                    <div key={story.id} className="flex flex-col items-center gap-1.5">
                                        <div className={`w-16 h-16 rounded-full p-[2px] ${story.isAdd ? 'border-2 border-dashed border-muted-foreground/30' : 'bg-gradient-to-tr from-yellow-400 to-fuchsia-600'}`}>
                                            <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-muted flex items-center justify-center">
                                                {story.isAdd ? (
                                                    <Plus className="w-6 h-6 text-muted-foreground" />
                                                ) : (
                                                    <img src={story.img} alt={story.name} className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-medium">{story.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Placeholder for Feed */}
                    <section className="space-y-4">
                        {/* <h2 className="text-base font-semibold text-foreground">Feed</h2> */}
                        <div className="bg-card rounded-2xl p-8 text-center border border-border">
                            <p className="text-muted-foreground text-sm">Activity feed coming soon...</p>
                        </div>
                    </section>
                </main>
            </div>
        </AuthGuard>
    );
}
