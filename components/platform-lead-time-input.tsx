"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlatformLogo } from "@/lib/platform-utils";
import { MeetingPlatform } from "@prisma/client";

type PlatformLeadTimeInputProps = {
  platform: "googleMeet" | "teams" | "zoom";
  label: string;
  maxValue: number;
  defaultValue: number;
  platformTimeout: number; // The platform-enforced waiting room timeout
  name: string;
  id: string;
};

export function PlatformLeadTimeInput({
  platform,
  label,
  maxValue,
  defaultValue,
  platformTimeout,
  name,
  id,
}: PlatformLeadTimeInputProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const remaining =
    platformTimeout === Infinity ? Infinity : platformTimeout - value;

  const platformEnum =
    platform === "googleMeet"
      ? MeetingPlatform.GOOGLE_MEET
      : platform === "teams"
        ? MeetingPlatform.MICROSOFT_TEAMS
        : MeetingPlatform.ZOOM;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <PlatformLogo platform={platformEnum} size={20} />
        <Label htmlFor={id}>{label}</Label>
        <Badge variant="outline" className="text-xs">
          Max: {maxValue} minutes
        </Badge>
      </div>
      <Input
        type="number"
        name={name}
        id={id}
        min={0}
        max={maxValue}
        value={value}
        onChange={(e) => {
          const newValue = Number(e.target.value);
          if (newValue >= 0 && newValue <= maxValue) {
            setValue(newValue);
          }
        }}
        className="w-40"
      />
      <p className="text-xs text-muted-foreground">
        {platform === "zoom" || platformTimeout === Infinity ? (
          "Zoom allows indefinite waiting room timeouts."
        ) : (
          <>
            {label} enforces a {platformTimeout}-minute waiting room timeout. The
            notetaker will automatically leave if not approved within{" "}
            <span className="font-semibold text-foreground">
              {remaining} minute{remaining !== 1 ? "s" : ""}
            </span>
            .
          </>
        )}
      </p>
    </div>
  );
}

