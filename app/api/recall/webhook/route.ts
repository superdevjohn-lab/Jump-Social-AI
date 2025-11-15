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

      // Get meeting to check if it has actually started
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { startTime: true },
      });

      if (!meeting) {
        return NextResponse.json({ ok: true });
      }

      const now = new Date();
      const hasMeetingStarted = now >= meeting.startTime;

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
      
      // Only set status to IN_PROGRESS if meeting has actually started
      // "bot.joining_call" and "bot.in_waiting_room" can happen before meeting starts
      if (inProgressEvents.includes(event)) {
        if (hasMeetingStarted || event === "bot.in_call_recording") {
          // Meeting has started OR bot is actually recording (definitely in progress)
          updateData.status = MeetingStatus.IN_PROGRESS;
        }
        // Otherwise, keep status as UPCOMING (bot is waiting to join)
      }
      if (completedEvents.includes(event)) {
        // Check if meeting has a transcript to determine correct status
        const meetingWithTranscript = await prisma.meeting.findUnique({
          where: { id: meetingId },
          include: { transcript: true },
        });

        // Only mark as COMPLETED if there's a transcript
        // Otherwise, keep status as IN_PROGRESS or set based on whether recording exists
        if (meetingWithTranscript?.transcript) {
          updateData.status = MeetingStatus.COMPLETED;
        } else {
          // Meeting ended but no transcript - check if recording exists
          if (meetingWithTranscript?.recallRecordingId) {
            // Recording exists but transcript not ready yet - keep as IN_PROGRESS
            updateData.status = MeetingStatus.IN_PROGRESS;
          } else {
            // No recording at all - meeting ended without recording
            updateData.status = MeetingStatus.COMPLETED;
            // Update recallStatus to indicate no recording
            if (event === "bot.call_ended") {
              updateData.recallStatus = "bot.call_ended_no_recording";
            } else if (event === "bot.done") {
              updateData.recallStatus = "bot.done_no_recording";
            }
          }
        }
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
      const botId = payload.data?.bot?.id;
      const transcriptId = payload.data?.transcript?.id;
      if (!botId || !transcriptId) {
        return NextResponse.json({ ok: true });
      }

      const meeting = await prisma.meeting.findFirst({
        where: { recallBotId: botId },
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
          recallTranscriptId: transcriptId,
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

