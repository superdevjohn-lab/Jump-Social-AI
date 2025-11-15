"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks() {
  const pathname = usePathname();
  
  // Only highlight if on /dashboard, not on home page (/)
  const isDashboard = pathname === "/dashboard";
  const isMeetings = pathname?.startsWith("/meetings");

  return (
    <nav className="hidden items-center gap-6 text-sm md:flex">
      <Link
        href="/dashboard"
        className={cn(
          "transition-colors hover:text-foreground",
          isDashboard
            ? "font-semibold text-foreground"
            : "text-muted-foreground"
        )}
      >
        Upcoming meetings
      </Link>
      <Link
        href="/meetings"
        className={cn(
          "transition-colors hover:text-foreground",
          isMeetings
            ? "font-semibold text-foreground"
            : "text-muted-foreground"
        )}
      >
        Past meetings
      </Link>
    </nav>
  );
}

