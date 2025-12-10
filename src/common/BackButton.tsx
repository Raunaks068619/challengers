import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BackButtonProps {
    href?: string;
    className?: string;
}

export default function BackButton({ href = "/", className }: BackButtonProps) {
    return (
        <Link
            href={href}
            className={cn(
                "p-2 bg-card rounded-full hover:bg-muted border border-border transition-colors flex items-center justify-center",
                className
            )}
        >
            <ChevronLeft className="w-5 h-5 text-foreground" />
        </Link>
    );
}
