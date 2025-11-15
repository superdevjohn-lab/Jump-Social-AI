import Link from "next/link";
import { redirect } from "next/navigation";
import { MeetingPlatform, MeetingStatus, Prisma } from "@prisma/client";
import { formatRecallStatus } from "@/lib/meeting-utils";
import { PlatformLogo } from "@/lib/platform-utils";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AutoRefreshMeetings } from "@/components/auto-refresh-meetings";
import { RefreshMeetingsButton } from "@/components/refresh-meetings-button";

type MeetingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

function formatDate(date: Date, timezone?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
  const startStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(start);
  const endStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(end);
  return `${startStr} – ${endStr}`;
}

type MeetingRow = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  timezone: string | null;
  platform: MeetingPlatform;
  recallStatus: string | null;
  conferenceUrl: string | null;
  sourceAccountEmail: string | null;
  sourceCalendarTitle: string | null;
};

const meetingSelect = {
  id: true,
  title: true,
  startTime: true,
  endTime: true,
  timezone: true,
  platform: true,
  recallStatus: true,
  conferenceUrl: true,
  sourceAccountEmail: true,
  sourceCalendarTitle: true,
} as const;

export default async function MeetingsPage({
  searchParams,
}: MeetingsPageProps) {
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
    OR: [
      { endTime: { lt: now } },
      { status: MeetingStatus.COMPLETED },
      { status: MeetingStatus.CANCELLED },
      {
        recallStatus: {
          in: ["recording.done", "transcript.done"],
        },
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

  const [meetings, accountRowsRaw] = await Promise.all([
    prisma.meeting.findMany({
      select: meetingSelect as any,
      where,
      orderBy: {
        startTime: "desc",
      },
      take: 50,
    }) as Promise<MeetingRow[]>,
    prisma.meeting.findMany({
      where: { userId: session.user.id },
      select: { sourceAccountEmail: true } as any,
    }),
  ]);

  const primaryEmail = session.user.email?.toLowerCase() ?? null;
  const accountOptionMap = new Map<
    string,
    {
      value: string;
      label: string;
    }
  >();
  accountRowsRaw.forEach((row) => {
    const original = (row as { sourceAccountEmail?: string | null }).sourceAccountEmail;
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
      <AutoRefreshMeetings
        autoSyncOnMount={false}
        refreshInterval={30000}
      />

      <div>
        <p className="text-sm uppercase tracking-tight text-primary">
          Past meetings
        </p>
        <h1 className="text-3xl font-semibold">
          Transcripts, recaps, and social drafts
        </h1>
        <p className="text-muted-foreground">
          Select any completed meeting to view transcripts, compose follow-ups,
          and generate social content.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Completed calls</CardTitle>
              <CardDescription>
                Meetings move here automatically after Recall completes the
                transcript.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <RefreshMeetingsButton />
              <div className="flex gap-2">
              <Button
                variant={viewParam === "list" ? "default" : "outline"}
                asChild
              >
                <Link
                  href={{
                    pathname: "/meetings",
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
                    pathname: "/meetings",
                    query: { ...plainParams, view: "calendar" },
                  }}
                >
                  Calendar view
                </Link>
              </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
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
              <div className="flex gap-2">
                <input type="hidden" name="view" value={viewParam} />
                <Button type="submit">Apply filters</Button>
                <Button variant="ghost" asChild>
                  <Link href="/meetings">Reset</Link>
                </Button>
              </div>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {meetings.length ? (
            viewParam === "calendar" ? (
              <MeetingsCalendar meetings={meetings} />
            ) : (
              <MeetingsTable meetings={meetings} />
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              No completed meetings yet. Once Recall finishes a transcript,
              meetings will appear here.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function MeetingsTable({ meetings }: { meetings: MeetingRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Google account</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Platform</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {meetings.map((meeting) => (
          <TableRow key={meeting.id}>
            <TableCell>
              <div className="font-medium">{meeting.title}</div>
              <p className="text-xs text-muted-foreground">
                {meeting.conferenceUrl ?? "No link"}
              </p>
            </TableCell>
            <TableCell>
              <div className="font-medium">
                {meeting.sourceAccountEmail ?? "Primary login"}
              </div>
              <p className="text-xs text-muted-foreground">
                {meeting.sourceCalendarTitle ?? "Google calendar"}
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
              <Button size="sm" asChild>
                <Link href={`/meetings/${meeting.id}`}>View</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MeetingsCalendar({ meetings }: { meetings: MeetingRow[] }) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDay = startOfMonth.getDay();
  const gridStart = new Date(startOfMonth);
  gridStart.setDate(startOfMonth.getDate() - startDay);

  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    days.push(day);
  }

  const meetingsByDay = new Map<string, MeetingRow[]>();
  meetings.forEach((meeting) => {
    const key = meeting.startTime.toISOString().slice(0, 10);
    const list = meetingsByDay.get(key);
    if (list) {
      list.push(meeting);
    } else {
      meetingsByDay.set(key, [meeting]);
    }
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div
          key={day}
          className="text-center text-sm font-semibold text-muted-foreground"
        >
          {day}
        </div>
      ))}
      {days.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const dayMeetings = meetingsByDay.get(key) ?? [];
        const isCurrentMonth = day.getMonth() === now.getMonth();
        return (
          <div
            key={key}
            className={`min-h-[120px] rounded-lg border p-2 ${
              isCurrentMonth ? "bg-background" : "bg-muted/40 text-muted-foreground"
            }`}
          >
            <p className="text-right text-xs font-semibold">{day.getDate()}</p>
            <div className="mt-2 space-y-1">
              {dayMeetings.map((meeting) => (
                <div key={meeting.id} className="rounded-md bg-primary/10 p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <PlatformLogo platform={meeting.platform} size={20} />
                    <p className="text-xs font-medium">{meeting.title}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {new Intl.DateTimeFormat("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(meeting.startTime)}{" "}
                    · {meeting.sourceAccountEmail ?? "Primary"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

