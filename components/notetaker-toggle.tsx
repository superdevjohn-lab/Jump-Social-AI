"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";

type Props = {
  meetingId: string;
  enabled: boolean;
};

export function NotetakerToggle({ meetingId, enabled }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(
    enabled,
    (_, next: boolean) => next,
  );

  const handleChange = (nextValue: boolean) => {
    startTransition(async () => {
      setOptimisticEnabled(nextValue);
      const response = await fetch("/api/recall/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meetingId,
          enabled: nextValue,
        }),
      });

      if (!response.ok) {
        setOptimisticEnabled(enabled);
        console.error("Failed to update notetaker setting");
      } else {
        // Refresh the page data to reflect changes
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={optimisticEnabled}
        onCheckedChange={handleChange}
        disabled={isPending}
        aria-label="Toggle notetaker"
      />
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

