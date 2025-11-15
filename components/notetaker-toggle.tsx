"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2 } from "lucide-react";
import { MeetingStatus } from "@prisma/client";

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
  endTime?: Date;
  status?: MeetingStatus;
};

// Statuses where the bot is active and cannot be cancelled
const ACTIVE_BOT_STATUSES = new Set([
  "bot.joining_call",
  "bot.in_waiting_room",
  "bot.in_call_recording",
]);

// Statuses that indicate the meeting is completed
const COMPLETED_RECALL_STATUSES = new Set([
  "recording.done",
  "transcript.done",
  "bot.call_ended",
  "bot.done",
  "bot.call_ended_no_recording",
  "bot.done_no_recording",
]);

export function NotetakerToggle({
  meetingId,
  enabled,
  recallStatus,
  endTime,
  status,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(
    enabled,
    (_, next: boolean) => next,
  );

  const now = new Date();
  const isMeetingEnded = endTime ? new Date(endTime) < now : false;
  const isMeetingCompleted =
    status === MeetingStatus.COMPLETED ||
    (recallStatus && COMPLETED_RECALL_STATUSES.has(recallStatus));
  const isBotActive = recallStatus && ACTIVE_BOT_STATUSES.has(recallStatus);
  const isDisabled =
    isPending || isBotActive || isMeetingEnded || isMeetingCompleted;

  const getTooltipMessage = () => {
    if (isMeetingCompleted || isMeetingEnded) {
      return "This meeting has ended and the notetaker cannot be modified.";
    }
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
        {(isBotActive || isMeetingCompleted || isMeetingEnded) &&
          !isPending && (
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

