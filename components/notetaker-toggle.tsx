"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  meetingId: string;
  enabled: boolean;
  recallStatus?: string | null;
};

// Statuses where the bot is active and cannot be cancelled
const ACTIVE_BOT_STATUSES = new Set([
  "bot.joining_call",
  "bot.in_waiting_room",
  "bot.in_call_recording",
]);

export function NotetakerToggle({ meetingId, enabled, recallStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(
    enabled,
    (_, next: boolean) => next,
  );

  const isBotActive = recallStatus && ACTIVE_BOT_STATUSES.has(recallStatus);
  const isDisabled = isPending || isBotActive;

  const getTooltipMessage = () => {
    if (isBotActive) {
      switch (recallStatus) {
        case "bot.joining_call":
          return "The notetaker is currently joining the call and cannot be disabled.";
        case "bot.in_waiting_room":
          return "The notetaker is waiting in the meeting room and cannot be disabled.";
        case "bot.in_call_recording":
          return "The notetaker is actively recording the meeting and cannot be disabled.";
        default:
          return "The notetaker is currently active and cannot be disabled.";
      }
    }
    return "";
  };

  const handleChange = (nextValue: boolean) => {
    if (isDisabled) return;
    
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
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Switch
          checked={optimisticEnabled}
          onCheckedChange={handleChange}
          disabled={isDisabled}
          aria-label="Toggle notetaker"
        />
        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {isBotActive && !isPending && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{getTooltipMessage()}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

