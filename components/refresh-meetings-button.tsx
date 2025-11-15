"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type RefreshMeetingsButtonProps = {
  onSync?: () => Promise<void>;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
};

export function RefreshMeetingsButton({
  onSync,
  variant = "outline",
  size = "sm",
}: RefreshMeetingsButtonProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onSync) {
        await onSync();
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

