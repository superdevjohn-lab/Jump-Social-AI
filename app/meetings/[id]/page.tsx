import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateFollowUpEmail, generateSocialPost } from "@/lib/ai";
import { publishSocialPost } from "@/lib/social";
import { CopyButton } from "@/components/copy-button";
import { PendingButton } from "@/components/form/pending-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  MeetingPlatform,
  SocialPlatform,
  SocialPostStatus,
} from "@prisma/client";
import { formatAttendeeList } from "@/lib/meeting-utils";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const platformLabels: Record<MeetingPlatform, string> = {
  [MeetingPlatform.ZOOM]: "Zoom",
  [MeetingPlatform.GOOGLE_MEET]: "Google Meet",
  [MeetingPlatform.MICROSOFT_TEAMS]: "Teams",
  [MeetingPlatform.OTHER]: "Other",
};

const socialStatusStyles: Record<SocialPostStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-900",
  READY: "bg-amber-100 text-amber-900",
  POSTED: "bg-emerald-100 text-emerald-900",
  FAILED: "bg-rose-100 text-rose-900",
};

function formatDateTime(date: Date, timezone?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(date);
}

async function generateFollowUpAction(formData: FormData) {
  "use server";
  const meetingId = formData.get("meetingId") as string;

  const session = await auth();
  if (!session?.user) redirect("/");

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId, userId: session.user.id },
    include: { transcript: true },
  });

  if (!meeting?.transcript?.rawText) {
    throw new Error("Transcript not available yet.");
  }

  const attendees = formatAttendeeList(meeting.attendees);

  const email = await generateFollowUpEmail({
    meetingTitle: meeting.title,
    attendees,
    transcriptText: meeting.transcript.rawText,
  });

  await prisma.meetingTranscript.update({
    where: { meetingId },
    data: {
      followUpEmail: email,
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
}

async function generateSocialPostAction(formData: FormData) {
  "use server";
  const meetingId = formData.get("meetingId") as string;
  const automationId = formData.get("automationId") as string;

  const session = await auth();
  if (!session?.user) redirect("/");

  const [meeting, automation] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: meetingId, userId: session.user.id },
      include: { transcript: true },
    }),
    prisma.automation.findUnique({
      where: { id: automationId, userId: session.user.id },
    }),
  ]);

  if (!meeting || !automation) {
    throw new Error("Automation or meeting not found.");
  }
  if (!meeting.transcript?.rawText) {
    throw new Error("Transcript not ready.");
  }

  const content = await generateSocialPost({
    meetingTitle: meeting.title,
    attendees: formatAttendeeList(meeting.attendees),
    platform: automation.platform,
    transcriptText: meeting.transcript.rawText,
    customPrompt: automation.prompt,
  });

  await prisma.socialPost.create({
    data: {
      userId: session.user.id,
      meetingId: meeting.id,
      automationId: automation.id,
      platform: automation.platform,
      content,
      status: "DRAFT",
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
}

async function publishSocialPostAction(formData: FormData) {
  "use server";
  const postId = formData.get("postId") as string;
  const meetingId = formData.get("meetingId") as string;

  const session = await auth();
  if (!session?.user) redirect("/");

  try {
    await publishSocialPost(postId);
  } catch (error) {
    console.error("[social] manual post failed", error);
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: SocialPostStatus.FAILED },
    });
  }
  revalidatePath(`/meetings/${meetingId}`);
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id, userId: session.user.id },
    include: {
      transcript: true,
      socialPosts: {
        orderBy: { createdAt: "desc" },
        include: { automation: true },
      },
    },
  });

  const automations = await prisma.automation.findMany({
    where: { userId: session.user.id },
  });

  if (!meeting) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      <div>
        <p className="text-sm uppercase tracking-tight text-primary">
          Meeting detail
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{meeting.title}</h1>
            <p className="text-muted-foreground">
              {formatDateTime(meeting.startTime, meeting.timezone)} ·{" "}
              {platformLabels[meeting.platform]}
            </p>
          </div>
          {meeting.conferenceUrl && (
            <Button variant="outline" asChild>
              <a href={meeting.conferenceUrl} target="_blank" rel="noreferrer">
                Open meeting link
              </a>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meeting overview</CardTitle>
          <CardDescription>
            Attendees, Recall status, and notetaker controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Attendees
            </p>
            <p>{formatAttendeeList(meeting.attendees)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Recall status
            </p>
            <Badge variant="outline">{meeting.recallStatus ?? "—"}</Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Notetaker
            </p>
            <p>{meeting.notetakerEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Duration
            </p>
            <p>
              {formatDateTime(meeting.startTime, meeting.timezone)} –{" "}
              {formatDateTime(meeting.endTime, meeting.timezone)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="transcript">
        <TabsList className="mb-4">
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="followup">Follow-up email</TabsTrigger>
          <TabsTrigger value="social">Social posts</TabsTrigger>
        </TabsList>

        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle>Full transcript</CardTitle>
              <CardDescription>
                This text comes directly from Recall.ai after processing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {meeting.transcript?.rawText ? (
                <>
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                    <pre className="whitespace-pre-wrap">
                      {meeting.transcript.rawText}
                    </pre>
                  </div>
                  <CopyButton text={meeting.transcript.rawText}>
                    Copy transcript
                  </CopyButton>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Transcript not available yet. Check back after the meeting
                  ends and the Recall bot finishes uploading media.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followup">
          <Card>
            <CardHeader>
              <CardTitle>AI follow-up email</CardTitle>
              <CardDescription>
                Generate a recap email that summarizes key points and next
                steps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {meeting.transcript?.followUpEmail ? (
                <>
                  <Textarea
                    readOnly
                    rows={10}
                    value={meeting.transcript.followUpEmail}
                  />
                  <div className="flex gap-2">
                    <CopyButton text={meeting.transcript.followUpEmail}>
                      Copy email
                    </CopyButton>
                    <form action={generateFollowUpAction}>
                      <input type="hidden" name="meetingId" value={meeting.id} />
                      <PendingButton variant="ghost" size="sm">
                        Regenerate
                      </PendingButton>
                    </form>
                  </div>
                </>
              ) : (
                <form action={generateFollowUpAction} className="space-y-3">
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <p className="text-sm text-muted-foreground">
                    No follow-up email yet. Generate the first draft below.
                  </p>
                  <PendingButton disabled={!meeting.transcript?.rawText}>
                    Generate follow-up email
                  </PendingButton>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle>Social drafts</CardTitle>
              <CardDescription>
                Generate platform-specific drafts from your automations, then
                post them with one click.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium">Generate new post</p>
                {automations.length ? (
                  <div className="flex flex-wrap gap-3">
                    {automations.map((automation: any) => (
                      <form
                        key={automation.id}
                        action={generateSocialPostAction}
                      >
                        <input
                          type="hidden"
                          name="meetingId"
                          value={meeting.id}
                        />
                        <input
                          type="hidden"
                          name="automationId"
                          value={automation.id}
                        />
                        <PendingButton
                          variant="outline"
                          size="sm"
                          disabled={!meeting.transcript?.rawText}
                        >
                          {automation.platform === SocialPlatform.LINKEDIN
                            ? "LinkedIn"
                            : "Facebook"}{" "}
                          • {automation.name}
                        </PendingButton>
                      </form>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Create an automation in settings to unlock one-click
                    generation.
                  </p>
                )}
              </div>

              {meeting.socialPosts.length ? (
                <div className="space-y-4">
                  {meeting.socialPosts.map((post: any) => (
                    <div
                      key={post.id}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize">
                              {post.platform.toLowerCase()}
                            </Badge>
                            <Badge className={socialStatusStyles[post.status]}>
                              {post.status.toLowerCase()}
                            </Badge>
                          </div>
                          {post.automation?.name && (
                            <p className="text-xs text-muted-foreground">
                              Automation: {post.automation.name}
                            </p>
                          )}
                          {post.postedAt && (
                            <p className="text-xs text-muted-foreground">
                              Posted {formatDateTime(post.postedAt, meeting.timezone)}
                              {post.externalPostId && (
                                <>
                                  {" "}
                                  ·{" "}
                                  <a
                                    href={
                                      post.platform === SocialPlatform.LINKEDIN
                                        ? `https://www.linkedin.com/feed/update/${post.externalPostId}`
                                        : `https://www.facebook.com/${post.externalPostId}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                  >
                                    View live
                                  </a>
                                </>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <CopyButton text={post.content} />
                          {post.status !== "POSTED" && (
                            <form action={publishSocialPostAction}>
                              <input
                                type="hidden"
                                name="postId"
                                value={post.id}
                              />
                              <input
                                type="hidden"
                                name="meetingId"
                                value={meeting.id}
                              />
                              <PendingButton size="sm">
                                {post.status === "FAILED" ? "Retry" : "Post"}
                              </PendingButton>
                            </form>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm">
                        {post.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No social drafts yet. Generate one using an automation above.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

