import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetingStatus, MeetingPlatform } from "@prisma/client";

import { createRecallBot, stopRecallBot } from "@/lib/recall";

const bodySchema = z.object({
  meetingId: z.string(),
  enabled: z.boolean(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetingId, enabled } = bodySchema.parse(await request.json());

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcript: true,
      user: {
        include: {
          settings: true,
        },
      },
    },
  });

  if (!meeting || meeting.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!process.env.RECALL_API_KEY) {
    return NextResponse.json(
      { error: "Recall API key missing in environment" },
      { status: 500 },
    );
  }

  if (enabled) {
    if (!meeting.conferenceUrl) {
      return NextResponse.json(
        { error: "No conference link found on the event" },
        { status: 400 },
      );
    }

    // Get platform-specific lead time
    let leadTime = 5; // Default fallback
    if (meeting.user.settings) {
      switch (meeting.platform) {
        case MeetingPlatform.ZOOM:
          leadTime = meeting.user.settings?.zoomLeadTimeMinutes ?? 10;
          break;
        case MeetingPlatform.GOOGLE_MEET:
          leadTime = meeting.user.settings?.googleMeetLeadTimeMinutes ?? 0;
          break;
        case MeetingPlatform.MICROSOFT_TEAMS:
          leadTime = meeting.user.settings?.teamsLeadTimeMinutes ?? 10;
          break;
        default:
          leadTime = meeting.user.settings.botLeadTimeMinutes ?? 5;
      }
    }

    // Calculate join time (meeting start - lead time)
    const joinTime = new Date(
      meeting.startTime.getTime() - leadTime * 60 * 1000,
    );
    const now = new Date();

    // Decision logic: Only create bot when join time has arrived
    // If join time has already passed (now >= joinTime) → Create immediately
    // Otherwise → Queue for cron job
    const shouldCreateNow = now >= joinTime;

    if (shouldCreateNow) {
      // Create bot immediately - join time has passed
      try {
        const bot = await createRecallBot({
          meeting,
          leadTimeMinutes: leadTime,
        });

        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            notetakerEnabled: true,
            recallBotId: bot.id,
            recallStatus: "bot.created",
            status: MeetingStatus.UPCOMING,
            recallRecordingId: null,
            recallTranscriptId: null,
          },
        });
      } catch (error) {
        // If creation fails, queue it for retry via cron
        console.error(`[recall/start] Failed to create bot immediately, queuing:`, error);
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            notetakerEnabled: true,
            recallStatus: "bot.pending",
            status: MeetingStatus.UPCOMING,
            recallBotId: null,
          },
        });
      }
    } else {
      // Queue for cron job - too early to create
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          notetakerEnabled: true,
          recallStatus: "bot.pending",
          status: MeetingStatus.UPCOMING,
          recallBotId: null,
        },
      });
    }
  } else {
    // Disable notetaker
    if (meeting.recallBotId) {
      // Bot exists - stop it via Recall.ai API
      try {
        await stopRecallBot(meeting.recallBotId);
      } catch (error) {
        // Log error but continue with database update
        console.error(`[recall/start] Failed to stop bot ${meeting.recallBotId}:`, error);
      }
    }

    // Update database to disable notetaker
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        notetakerEnabled: false,
        recallBotId: null, // Clear bot ID
        recallStatus: meeting.recallBotId ? "cancelled" : null, // Only mark as cancelled if bot existed
        // Don't clear recallRecordingId or recallTranscriptId if they exist
        // They might be useful for historical data
        status: MeetingStatus.UPCOMING,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/meetings");

  return NextResponse.json({ success: true });
}

