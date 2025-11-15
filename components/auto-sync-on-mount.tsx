"use client";

import { useEffect, useRef } from "react";

type AutoSyncOnMountProps = {
  enabled?: boolean;
  syncAction: () => Promise<void>;
};

export function AutoSyncOnMount({
  enabled = true,
  syncAction,
}: AutoSyncOnMountProps) {
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (enabled && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      syncAction().catch((error) => {
        console.error("Auto-sync failed:", error);
      });
    }
  }, [enabled, syncAction]);

  return null;
}

