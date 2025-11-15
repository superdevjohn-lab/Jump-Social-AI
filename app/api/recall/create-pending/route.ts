import { NextResponse } from "next/server";
import { MeetingPlatform, MeetingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createRecallBot } from "@/lib/recall";

/**
 * Cron job endpoint to create bots for meetings that are pending creation.
 * Runs every 1 minute via Vercel Cron.
 * 
 * Logic:
 * 1. Finds meetings with notetakerEnabled=true but no recallBotId (bot not created yet)
 * 2. For each meeting, calculates when the bot should join (startTime - leadTime)
 * 3. Only creates bot if we're within the platform-specific creation window
 * 4. This prevents bots from being created too early and hitting waiting room timeouts
 */
export async function GET(request: Request) {
  // Optional: Add authentication/secret check
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find meetings that need bot creation
  // - notetakerEnabled = true
  // - recallBotId is null (bot not created yet)
  // - recallStatus is "bot.pending" or null
  // - meeting hasn't started yet
  const pendingMeetings = await prisma.meeting.findMany({
    where: {
      notetakerEnabled: true,
      recallBotId: null,
      startTime: { gt: now }, // Meeting hasn't started yet
      OR: [
        { recallStatus: "bot.pending" },
        { recallStatus: null },
      ],
    },
    include: {
      user: {
        include: {
          settings: true,
        },
      },
    },
  });

  const results = [];

  for (const meeting of pendingMeetings) {
    if (!meeting.conferenceUrl) {
      continue;
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

    // Calculate join time
    const joinTime = new Date(
      meeting.startTime.getTime() - leadTime * 60 * 1000,
    );
    const minutesUntilJoin = (joinTime.getTime() - now.getTime()) / (1000 * 60);

    // Platform-specific bot creation windows
    let maxCreationWindowMinutes: number;
    switch (meeting.platform) {
      case MeetingPlatform.GOOGLE_MEET:
        maxCreationWindowMinutes = 15;
        break;
      case MeetingPlatform.MICROSOFT_TEAMS:
        maxCreationWindowMinutes = 35;
        break;
      case MeetingPlatform.ZOOM:
        maxCreationWindowMinutes = 60;
        break;
      default:
        maxCreationWindowMinutes = 30;
    }

    // Only create bot if we're within the creation window
    if (minutesUntilJoin <= maxCreationWindowMinutes && minutesUntilJoin >= -5) {
      try {
        const bot = await createRecallBot({
          meeting,
          leadTimeMinutes: leadTime,
        });

        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            recallBotId: bot.id,
            recallStatus: "bot.created",
            status: MeetingStatus.UPCOMING,
          },
        });

        results.push({
          meetingId: meeting.id,
          status: "created",
          botId: bot.id,
        });
      } catch (error) {
        console.error(`[create-pending] Failed to create bot for meeting ${meeting.id}:`, error);
        results.push({
          meetingId: meeting.id,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}

