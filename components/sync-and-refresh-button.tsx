"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type SyncAndRefreshButtonProps = {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
};

export function SyncAndRefreshButton({
  variant = "outline",
  size = "sm",
}: SyncAndRefreshButtonProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Call the sync API endpoint
      const response = await fetch("/api/sync-calendars", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Sync failed");
      }
      router.refresh();
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="gap-2"
    >
      <RefreshCw
        className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
      />
      Refresh
    </Button>
  );
}

