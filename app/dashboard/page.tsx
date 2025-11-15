import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MeetingPlatform, MeetingStatus, Prisma } from "@prisma/client";
import { Info, RefreshCw } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncGoogleCalendarsForUser } from "@/lib/google";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PendingButton } from "@/components/form/pending-button";
import { NotetakerToggle } from "@/components/notetaker-toggle";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRecallStatus } from "@/lib/meeting-utils";
import { PlatformLogo } from "@/lib/platform-utils";

const SUPPORTED_PLATFORMS = new Set<MeetingPlatform>([
  MeetingPlatform.ZOOM,
  MeetingPlatform.GOOGLE_MEET,
  MeetingPlatform.MICROSOFT_TEAMS,
]);

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type UpcomingMeetingRow = {
  id: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  timezone: string | null;
  platform: MeetingPlatform;
  conferenceUrl: string | null;
  notetakerEnabled: boolean;
  recallStatus: string | null;
  sourceAccountEmail: string | null;
};

const upcomingSelect = {
  id: true,
  title: true,
  description: true,
  startTime: true,
  endTime: true,
  timezone: true,
  platform: true,
  conferenceUrl: true,
  notetakerEnabled: true,
  sourceAccountEmail: true,
  recallStatus: true,
} as const;

async function syncCalendarsAction() {
  "use server";

  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  await syncGoogleCalendarsForUser(session.user.id);
  revalidatePath("/dashboard");
}

const platformLabels: Record<MeetingPlatform, string> = {
  [MeetingPlatform.ZOOM]: "Zoom",
  [MeetingPlatform.GOOGLE_MEET]: "Google Meet",
  [MeetingPlatform.MICROSOFT_TEAMS]: "Teams",
  [MeetingPlatform.OTHER]: "Other",
};

const platformStyles: Record<MeetingPlatform, string> = {
  [MeetingPlatform.ZOOM]: "bg-blue-100 text-blue-900",
  [MeetingPlatform.GOOGLE_MEET]: "bg-emerald-100 text-emerald-900",
  [MeetingPlatform.MICROSOFT_TEAMS]: "bg-purple-100 text-purple-900",
  [MeetingPlatform.OTHER]: "bg-slate-100 text-slate-900",
};

function formatMeetingTime(date: Date, timezone?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(date);
}

function formatTimeRange(
  start: Date,
  end: Date,
  timezone?: string | null,
): string {
  const startStr = formatMeetingTime(start, timezone);
  const endStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(end);
  return `${startStr} – ${endStr}`;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const plainParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (typeof value === "string") {
      plainParams[key] = value;
    }
  }

  const accountParam = plainParams.account ?? "all";
  const platformParam = plainParams.platform ?? "all";
  const viewParam = plainParams.view === "calendar" ? "calendar" : "list";

  const now = new Date();

  const where: Prisma.MeetingWhereInput = {
    userId: session.user.id,
    status: { not: MeetingStatus.COMPLETED },
    OR: [
      { endTime: { gte: now } },
      { status: MeetingStatus.IN_PROGRESS },
    ],
    AND: [
      {
        OR: [
          { recallStatus: null },
          { recallStatus: { notIn: ["recording.done", "transcript.done"] } },
        ],
      },
    ],
  };

  if (accountParam !== "all") {
    (where as any).sourceAccountEmail =
      accountParam === "__primary" ? null : accountParam;
  }

  if (
    platformParam !== "all" &&
    Object.values(MeetingPlatform).includes(
      platformParam.toUpperCase() as MeetingPlatform,
    )
  ) {
    where.platform = platformParam.toUpperCase() as MeetingPlatform;
  }

  const [meetings, googleAccountCount, accountRows] = await Promise.all([
    prisma.meeting
      .findMany({
        select: upcomingSelect,
        where,
        orderBy: {
          startTime: "asc",
        },
        take: 25,
      })
      .then((rows) => rows as UpcomingMeetingRow[]),
    prisma.account.count({
      where: { userId: session.user.id, provider: "google" },
    }),
    prisma.meeting
      .findMany({
        where: { userId: session.user.id },
        select: { sourceAccountEmail: true },
      })
      .then(
        (rows) =>
          rows as Array<{
            sourceAccountEmail: string | null;
          }>,
      ),
  ]);

  const primaryEmail = session.user.email?.toLowerCase() ?? null;
  const accountOptionMap = new Map<
    string,
    {
      value: string;
      label: string;
    }
  >();
  accountRows.forEach((row) => {
    const original = row.sourceAccountEmail;
    const normalized = original?.toLowerCase() ?? "__primary";
    if (!original || (primaryEmail && normalized === primaryEmail)) {
      if (!accountOptionMap.has("primary")) {
        accountOptionMap.set("primary", {
          value: original ?? "__primary",
          label: "Primary login",
        });
      }
      return;
    }
    if (!accountOptionMap.has(normalized)) {
      accountOptionMap.set(normalized, { value: original, label: original });
    }
  });
  if (!accountOptionMap.size) {
    accountOptionMap.set("primary", {
      value: "__primary",
      label: "Primary login",
    });
  }
  const accountOptions = Array.from(accountOptionMap.values());

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-tight text-primary">
            Upcoming meetings
          </p>
          <h1 className="text-3xl font-semibold">
            Stay ahead of every client conversation
          </h1>
          <p className="text-muted-foreground">
            Sync Google calendars, toggle the Recall notetaker, and get every
            meeting ready for AI content.
          </p>
        </div>
        <form action={syncCalendarsAction}>
          <PendingButton
            size="sm"
            disabled={!googleAccountCount}
            pendingText="Syncing..."
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {googleAccountCount ? "Sync calendars" : "Connect Google first"}
          </PendingButton>
        </form>
      </div>

      {googleAccountCount === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No Google accounts yet</CardTitle>
            <CardDescription>
              Connect at least one Google account on the home page to pull in
              your calendar events.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Next meetings</CardTitle>
              <CardDescription>
                Toggle the notetaker for any meeting to let Recall.ai know where to
                join.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewParam === "list" ? "default" : "outline"}
                asChild
              >
                <Link
                  href={{
                    pathname: "/dashboard",
                    query: { ...plainParams, view: "list" },
                  }}
                >
                  List view
                </Link>
              </Button>
              <Button
                variant={viewParam === "calendar" ? "default" : "outline"}
                asChild
              >
                <Link
                  href={{
                    pathname: "/dashboard",
                    query: { ...plainParams, view: "calendar" },
                  }}
                >
                  Calendar view
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-4 rounded-lg border bg-muted/40 p-4">
            <form className="flex flex-wrap items-end gap-4" method="get">
              <div className="grid gap-2">
                <Label htmlFor="account">Google account</Label>
                <select
                  id="account"
                  name="account"
                  defaultValue={accountParam}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All accounts</option>
                  {accountOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="platform">Platform</Label>
                <select
                  id="platform"
                  name="platform"
                  defaultValue={platformParam}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All platforms</option>
                  {Object.values(MeetingPlatform).map((platform) => (
                    <option key={platform} value={platform}>
                      {platformLabels[platform]}
                    </option>
                  ))}
                </select>
              </div>
              <input type="hidden" name="view" value={viewParam} />
              <Button type="submit">Apply filters</Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {meetings.length ? (
            viewParam === "calendar" ? (
              <UpcomingCalendar meetings={meetings} />
            ) : (
              <UpcomingTable meetings={meetings} />
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming meetings yet. Click “Sync calendars” after you connect
              your Google account to pull events into Jump Social AI.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function UpcomingTable({ meetings }: { meetings: UpcomingMeetingRow[] }) {
  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Meeting</TableHead>
            <TableHead>Google account</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Recall status</TableHead>
            <TableHead className="text-right">Notetaker</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {meetings.map((meeting) => (
            <TableRow key={meeting.id}>
              <TableCell>
                <div className="font-medium">{meeting.title}</div>
                {meeting.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {meeting.description}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <div className="font-medium">
                  {meeting.sourceAccountEmail ?? "Primary login"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {meeting.timezone ?? "Local timezone"}
                </p>
              </TableCell>
              <TableCell>
                {formatTimeRange(
                  meeting.startTime,
                  meeting.endTime,
                  meeting.timezone,
                )}
              </TableCell>
              <TableCell>
                <PlatformLogo platform={meeting.platform} size={32} />
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {formatRecallStatus(meeting.recallStatus)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <NotetakerAction meeting={meeting} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

function UpcomingCalendar({ meetings }: { meetings: UpcomingMeetingRow[] }) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + index);
    return day;
  });

  const startHour = 6;
  const endHour = 20;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) =>
    startHour + index,
  );

  const meetingsByDay = new Map<string, UpcomingMeetingRow[]>();
  meetings.forEach((meeting) => {
    const key = meeting.startTime.toISOString().slice(0, 10);
    const list = meetingsByDay.get(key);
    if (list) {
      list.push(meeting);
    } else {
      meetingsByDay.set(key, [meeting]);
    }
  });

  const totalMinutes = (endHour - startHour) * 60;

  return (
    <TooltipProvider>
      <div className="overflow-auto rounded-lg border">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] text-xs">
            <div />
            {days.map((day) => (
              <div key={day.toISOString()} className="px-2 py-3 text-center font-semibold">
                {day.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            ))}
            <div className="flex flex-col text-muted-foreground">
              {hours.map((hour) => (
                <div key={hour} className="h-16 border-b px-1 text-right">
                  {hour % 12 === 0 ? 12 : hour % 12}
                  {hour < 12 ? "a" : "p"}
                </div>
              ))}
            </div>
            {days.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const dayMeetings = meetingsByDay.get(key) ?? [];
              return (
                <div key={key} className="relative border-l">
                  {hours.map((hour, index) => (
                    <div
                      key={`${key}-grid-${hour}`}
                      className={cn(
                        "h-16 border-b border-border/60",
                        index === hours.length - 1 && "border-0",
                      )}
                    />
                  ))}
                  {dayMeetings.map((meeting) => {
                    const meetingStart = new Date(meeting.startTime);
                    const meetingEnd = new Date(meeting.endTime);
                    const startMinutes =
                      (meetingStart.getHours() * 60 + meetingStart.getMinutes()) -
                      startHour * 60;
                    const endMinutes =
                      (meetingEnd.getHours() * 60 + meetingEnd.getMinutes()) -
                      startHour * 60;
                    if (endMinutes <= 0 || startMinutes >= totalMinutes) {
                      return null;
                    }
                    const clampedStart = Math.max(0, startMinutes);
                    const duration = Math.max(
                      40,
                      Math.min(totalMinutes - clampedStart, endMinutes - startMinutes),
                    );
                    return (
                      <div
                        key={meeting.id}
                        className="absolute left-1 right-1 rounded-md bg-primary/10 p-2 text-xs shadow-sm"
                        style={{
                          top: `${clampedStart}px`,
                          height: `${duration}px`,
                        }}
                      >
                        <p className="font-medium">{meeting.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Intl.DateTimeFormat("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(meeting.startTime)}{" "}
                          · {meeting.sourceAccountEmail ?? "Primary"}
                        </p>
                                <div className="mt-1 flex items-center justify-between">
                                  <PlatformLogo platform={meeting.platform} size={20} />
                                  <NotetakerAction meeting={meeting} compact />
                                </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function NotetakerAction({
  meeting,
  compact = false,
}: {
  meeting: UpcomingMeetingRow;
  compact?: boolean;
}) {
  const supported =
    SUPPORTED_PLATFORMS.has(meeting.platform) && Boolean(meeting.conferenceUrl);
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "cursor-default text-[10px] font-medium",
              supported ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {supported
              ? meeting.notetakerEnabled
                ? "Notetaker on"
                : "Available"
              : "Unavailable"}
          </span>
        </TooltipTrigger>
      <TooltipContent>
        {supported
          ? "Toggle from the list view"
          : meeting.platform === MeetingPlatform.OTHER
            ? "Notetaker is not supported for this meeting platform"
            : "No meeting link available. Notetaker requires a Zoom, Google Meet, or Teams link."}
      </TooltipContent>
      </Tooltip>
    );
  }

  if (supported) {
    return (
      <NotetakerToggle
        meetingId={meeting.id}
        enabled={meeting.notetakerEnabled}
        recallStatus={meeting.recallStatus}
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info
          aria-label="Not available for this meeting"
          className="mx-auto h-4 w-4 text-muted-foreground"
        />
      </TooltipTrigger>
      <TooltipContent>
        {meeting.platform === MeetingPlatform.OTHER
          ? "Notetaker is not supported for this meeting platform"
          : "No meeting link available. Notetaker requires a Zoom, Google Meet, or Teams link."}
      </TooltipContent>
    </Tooltip>
  );
}

