"use client";

import { useEffect, useRef } from "react";

type AutoSyncOnMountProps = {
  enabled?: boolean;
};

export function AutoSyncOnMount({ enabled = true }: AutoSyncOnMountProps) {
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (enabled && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      // Call the sync API endpoint
      fetch("/api/sync-calendars", {
        method: "POST",
      }).catch((error) => {
        console.error("Auto-sync failed:", error);
      });
    }
  }, [enabled]);

  return null;
}

