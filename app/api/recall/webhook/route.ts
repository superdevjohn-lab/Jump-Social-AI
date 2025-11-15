import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { MeetingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requestTranscript, downloadTranscript } from "@/lib/recall";
import { runMeetingAutomations } from "@/lib/automations";

type RecallWebhookPayload = {
  event?: string;
  data?: {
    bot?: {
      id?: string;
      metadata?: Record<string, any>;
    } | null;
    recording?: {
      id?: string;
    } | null;
    transcript?: {
      id?: string;
    } | null;
  };
};

function extractMeetingId(payload: RecallWebhookPayload) {
  const metadataMeetingId = payload.data?.bot?.metadata?.meetingId;
  if (metadataMeetingId && typeof metadataMeetingId === "string") {
    return metadataMeetingId;
  }
  return undefined;
}

async function resolveMeetingId(payload: RecallWebhookPayload, botId?: string) {
  const idFromMetadata = extractMeetingId(payload);
  if (idFromMetadata) return idFromMetadata;
  if (!botId) return undefined;
  const match = await prisma.meeting.findFirst({
    where: { recallBotId: botId },
    select: { id: true },
  });
  return match?.id;
}

function revalidateMeetings() {
  revalidatePath("/dashboard");
  revalidatePath("/meetings");
}

export async function POST(request: Request) {
  if (process.env.RECALL_WEBHOOK_SECRET) {
    const headerSecret = request.headers.get("x-recall-secret");
    const querySecret = new URL(request.url).searchParams.get("secret");
    const provided = headerSecret ?? querySecret;
    if (provided !== process.env.RECALL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = (await request.json()) as RecallWebhookPayload;
  const event = payload.event;

  try {
    if (event?.startsWith("bot.")) {
      const botId = payload.data?.bot?.id ?? undefined;
      const meetingId = await resolveMeetingId(payload, botId);
      if (!meetingId) {
        return NextResponse.json({ ok: true });
      }

      const inProgressEvents = [
        "bot.joining_call",
        "bot.in_waiting_room",
        "bot.in_call_recording",
      ];
      const completedEvents = ["bot.call_ended", "bot.done"];

      const updateData: Record<string, unknown> = {
        recallStatus: event,
        ...(botId ? { recallBotId: botId } : {}),
      };
      if (inProgressEvents.includes(event)) {
        updateData.status = MeetingStatus.IN_PROGRESS;
      }
      if (completedEvents.includes(event)) {
        updateData.status = MeetingStatus.COMPLETED;
      }

      await prisma.meeting.update({
        where: { id: meetingId },
        data: updateData,
      });
      revalidateMeetings();

      return NextResponse.json({ ok: true });
    }

    if (event === "recording.done") {
      const botId = payload.data?.bot?.id ?? undefined;
      const recordingId = payload.data?.recording?.id;
      if (!recordingId) {
        return NextResponse.json({ ok: true });
      }

      const meetingId = await resolveMeetingId(payload, botId);
      if (!meetingId) {
        return NextResponse.json({ ok: true });
      }

      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          recallRecordingId: recordingId,
          recallStatus: "recording.done",
          status: MeetingStatus.IN_PROGRESS,
        },
      });

      const transcriptId = await requestTranscript(recordingId);
      if (transcriptId) {
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            recallTranscriptId: transcriptId,
            recallStatus: "transcript.requested",
          },
        });
      }
      revalidateMeetings();

      return NextResponse.json({ ok: true });
    }

    if (event === "transcript.done") {
      const transcriptId = payload.data?.transcript?.id;
      if (!transcriptId) {
        return NextResponse.json({ ok: true });
      }

      const meeting = await prisma.meeting.findFirst({
        where: { recallTranscriptId: transcriptId },
        include: { transcript: true },
      });

      if (!meeting) {
        return NextResponse.json({ ok: true });
      }

      const transcript = await downloadTranscript(transcriptId);

      await prisma.meetingTranscript.upsert({
        where: { meetingId: meeting.id },
        create: {
          meetingId: meeting.id,
          rawText: transcript.text ?? "",
        },
        update: {
          rawText: transcript.text ?? "",
        },
      });

      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: MeetingStatus.COMPLETED,
          recallStatus: "transcript.done",
        },
      });

      await runMeetingAutomations(meeting.id);
      revalidateMeetings();

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[recall-webhook] handler error", error);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}

