import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createRecallBot,
  stopRecallBot,
} from "@/lib/recall";

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

    const leadTime =
      meeting.user.settings?.botLeadTimeMinutes !== undefined
        ? meeting.user.settings.botLeadTimeMinutes
        : 5;

    const bot = await createRecallBot({
      meeting,
      leadTimeMinutes: leadTime,
    });

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        notetakerEnabled: true,
        recallBotId: bot.id,
        recallStatus: bot.status ?? "scheduled",
      },
    });
  } else if (!enabled && meeting.recallBotId) {
    await stopRecallBot(meeting.recallBotId);
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        notetakerEnabled: false,
        recallBotId: null,
        recallStatus: "cancelled",
      },
    });
  } else {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        notetakerEnabled: false,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/meetings");

  return NextResponse.json({ success: true });
}

