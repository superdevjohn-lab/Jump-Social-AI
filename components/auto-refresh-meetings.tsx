"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type AutoRefreshMeetingsProps = {
  autoSyncOnMount?: boolean;
  refreshInterval?: number; // in milliseconds
  syncAction?: () => Promise<void>;
};

export function AutoRefreshMeetings({
  autoSyncOnMount = false,
  refreshInterval = 30000, // 30 seconds default
  syncAction,
}: AutoRefreshMeetingsProps) {
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    // Auto-sync on mount if enabled (only once)
    if (autoSyncOnMount && syncAction && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      syncAction().catch((error) => {
        console.error("Auto-sync failed:", error);
      });
    }

    // Set up interval for silent refresh
    intervalRef.current = setInterval(() => {
      router.refresh();
    }, refreshInterval);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoSyncOnMount, refreshInterval, router, syncAction]);

  return null; // This component doesn't render anything
}

