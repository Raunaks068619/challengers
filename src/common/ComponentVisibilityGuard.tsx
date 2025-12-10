"use client";

import { usePathname } from "next/navigation";

interface ComponentVisibilityGuardProps {
    children: React.ReactNode;
    allowedRoutes: string[]; // Exact match for now, can be expanded to regex
}

export default function ComponentVisibilityGuard({ children, allowedRoutes }: ComponentVisibilityGuardProps) {
    const pathname = usePathname();

    // Check if current path is in allowedRoutes
    // We can add more complex logic here if needed (e.g. startsWith)
    const isAllowed = allowedRoutes.includes(pathname);

    if (!isAllowed) return null;

    return <>{children}</>;
}
