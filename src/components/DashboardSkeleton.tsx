import Skeleton from "./Skeleton";

export default function DashboardSkeleton() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <section>
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="space-y-4">
                    {/* Task Progress Card Skeleton */}
                    <Skeleton className="h-32 w-full rounded-2xl" />

                    <div className="grid grid-cols-2 gap-4">
                        {/* Current Points Skeleton */}
                        <Skeleton className="h-24 rounded-2xl" />
                        {/* Lost Points Skeleton */}
                        <Skeleton className="h-24 rounded-2xl" />
                        {/* Active Challenges Skeleton */}
                        <Skeleton className="h-32 rounded-2xl" />
                        {/* Participants Card Skeleton */}
                        <Skeleton className="h-32 rounded-2xl" />
                    </div>

                    {/* Progress Chart Skeleton */}
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
            </section>
        </div>
    );
}
