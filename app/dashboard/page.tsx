import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MeetingPlatform, Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncGoogleCalendarsForUser } from "@/lib/google";
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

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type UpcomingMeetingRow = {
  id: string;
  title: string;
  startTime: Date;
  timezone: string | null;
  platform: MeetingPlatform;
  notetakerEnabled: boolean;
  sourceAccountEmail: string | null;
};

const upcomingSelect = {
  id: true,
  title: true,
  startTime: true,
  timezone: true,
  platform: true,
  notetakerEnabled: true,
  sourceAccountEmail: true,
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
  const viewParam = plainParams.view === "calendar" ? "calendar" : "list";

  const where: Prisma.MeetingWhereInput = {
    userId: session.user.id,
    startTime: {
      gte: new Date(),
    },
  };

  if (accountParam !== "all") {
    (where as any).sourceAccountEmail =
      accountParam === "__primary" ? null : accountParam;
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

  const accountOptions = Array.from(
    new Set(
      accountRows.map(
        (row) => row.sourceAccountEmail ?? "__primary",
      ),
    ),
  );

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
            size="lg"
            disabled={!googleAccountCount}
            pendingText="Syncing..."
          >
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
                  <option value="__primary">Primary login</option>
                  {accountOptions
                    .filter((value) => value !== "__primary")
                    .map((value) => (
                      <option key={value} value={value}>
                        {value}
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Meeting</TableHead>
          <TableHead>Google account</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>Platform</TableHead>
          <TableHead className="text-right">Notetaker enabled</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {meetings.map((meeting) => (
          <TableRow key={meeting.id}>
            <TableCell>
              <div className="font-medium">{meeting.title}</div>
              <p className="text-xs text-muted-foreground">
                {meeting.timezone ?? "Local timezone"}
              </p>
            </TableCell>
            <TableCell>
              <div className="font-medium">
                {meeting.sourceAccountEmail ?? "Primary login"}
              </div>
            </TableCell>
            <TableCell>
              {formatMeetingTime(meeting.startTime, meeting.timezone)}
            </TableCell>
            <TableCell>
              <Badge className={platformStyles[meeting.platform]}>
                {platformLabels[meeting.platform]}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <NotetakerToggle
                meetingId={meeting.id}
                enabled={meeting.notetakerEnabled}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UpcomingCalendar({ meetings }: { meetings: UpcomingMeetingRow[] }) {
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
                  <p className="text-xs font-medium">{meeting.title}</p>
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

