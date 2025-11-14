import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MeetingPlatform } from "@prisma/client";

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

type GoogleAttendee = {
  email?: string | null;
  displayName?: string | null;
  responseStatus?: string | null;
};

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

function formatAttendees(attendees: unknown) {
  const parsed = (attendees as GoogleAttendee[]) ?? [];
  if (!parsed.length) return "—";

  const names = parsed
    .filter((attendee) => attendee.responseStatus !== "declined")
    .map((attendee) => attendee.displayName || attendee.email || "Guest");

  if (!names.length) {
    return "—";
  }

  if (names.length <= 2) {
    return names.join(", ");
  }

  const [first, second] = names;
  return `${first}, ${second} +${names.length - 2}`;
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const [meetings, googleAccountCount] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        userId: session.user.id,
        startTime: {
          gte: new Date(),
        },
      },
      orderBy: {
        startTime: "asc",
      },
      take: 25,
    }),
    prisma.account.count({
      where: { userId: session.user.id, provider: "google" },
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-tight text-primary">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold">
            Upcoming client conversations
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
          <CardTitle>Next meetings</CardTitle>
          <CardDescription>
            Toggle the notetaker for any meeting to let Recall.ai know where to
            join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meetings.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Attendees</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">
                    Notetaker enabled
                  </TableHead>
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
                      {formatMeetingTime(meeting.startTime, meeting.timezone)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {formatAttendees(meeting.attendees)}
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

