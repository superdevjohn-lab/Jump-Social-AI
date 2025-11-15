"use client";

import { useOptimistic, useTransition } from "react";

import { Switch } from "@/components/ui/switch";

type Props = {
  meetingId: string;
  enabled: boolean;
};

export function NotetakerToggle({ meetingId, enabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(
    enabled,
    (_, next: boolean) => next,
  );

  const handleChange = (nextValue: boolean) => {
    setOptimisticEnabled(nextValue);
    startTransition(async () => {
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
      }
    });
  };

  return (
    <Switch
      checked={optimisticEnabled}
      onCheckedChange={handleChange}
      disabled={isPending}
      aria-label="Toggle notetaker"
    />
  );
}

