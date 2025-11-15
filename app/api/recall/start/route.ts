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
    const minutesUntilJoin = (joinTime.getTime() - now.getTime()) / (1000 * 60);

    // Platform-specific bot creation windows
    // We should create the bot close to join time to avoid waiting room timeouts
    let maxCreationWindowMinutes: number;
    switch (meeting.platform) {
      case MeetingPlatform.GOOGLE_MEET:
        // Google Meet: 10 min waiting room limit, create bot max 15 min before join
        maxCreationWindowMinutes = 15;
        break;
      case MeetingPlatform.MICROSOFT_TEAMS:
        // Teams: 30 min waiting room limit, create bot max 35 min before join
        maxCreationWindowMinutes = 35;
        break;
      case MeetingPlatform.ZOOM:
        // Zoom: No limit, but still reasonable to create within 1 hour
        maxCreationWindowMinutes = 60;
        break;
      default:
        maxCreationWindowMinutes = 30;
    }

    // If join time is too far in the future, mark as enabled but don't create bot yet
    // A cron job will create it when it's time
    if (minutesUntilJoin > maxCreationWindowMinutes) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          notetakerEnabled: true,
          recallStatus: "bot.pending", // Mark as pending creation
          status: MeetingStatus.UPCOMING,
        },
      });
      return NextResponse.json({
        success: true,
        message: "Notetaker will be created closer to the meeting time",
      });
    }

    // Create bot now if we're within the creation window
    const bot = await createRecallBot({
      meeting,
      leadTimeMinutes: leadTime,
    });

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        notetakerEnabled: true,
        recallBotId: bot.id,
        status: MeetingStatus.UPCOMING,
        recallRecordingId: null,
        recallTranscriptId: null,
        recallStatus: "bot.created",
      },
    });
  } else if (!enabled && meeting.recallBotId) {
    await stopRecallBot(meeting.recallBotId);
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        notetakerEnabled: false,
        recallBotId: null,
        status: MeetingStatus.UPCOMING,
        recallRecordingId: null,
        recallTranscriptId: null,
        recallStatus: "cancelled",
      },
    });
  } else {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        notetakerEnabled: false,
        status: MeetingStatus.UPCOMING,
        recallRecordingId: null,
        recallTranscriptId: null,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/meetings");

  return NextResponse.json({ success: true });
}

