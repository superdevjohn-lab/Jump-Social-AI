"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RefreshButtonProps = {
  explanation: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
};

export function RefreshButton({
  explanation,
  size = "sm",
  variant = "outline",
}: RefreshButtonProps) {
  const router = useRouter();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={() => router.refresh()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{explanation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

