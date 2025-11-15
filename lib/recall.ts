import { MeetingStatus, type Meeting } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runMeetingAutomations } from "@/lib/automations";

const RECALL_BASE_URL = "https://api.recall.ai/api/v1";

type RecallBotResponse = {
  id: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  meeting_url?: string;
  transcript?: {
    text: string;
  };
};

async function recallRequest(
  path: string,
  init: RequestInit = {},
): Promise<any> {
  if (!process.env.RECALL_API_KEY) {
    throw new Error("Missing RECALL_API_KEY");
  }

  const response = await fetch(`${RECALL_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${process.env.RECALL_API_KEY}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Recall API error (${response.status} ${response.statusText}): ${text}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function createRecallBot({
  meeting,
  leadTimeMinutes,
}: {
  meeting: Meeting;
  leadTimeMinutes: number;
}) {
  const joinTime = new Date(
    meeting.startTime.getTime() - leadTimeMinutes * 60 * 1000,
  ).toISOString();

  const payload = {
    meeting_url: meeting.conferenceUrl,
    join_time: joinTime,
    leave_time: meeting.endTime.toISOString(),
    bot_name: `Jump Notetaker • ${meeting.title}`,
    language: "en",
    transcription_options: {
      provider: "default",
    },
  };

  const bot = (await recallRequest("/meeting-bots/", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as RecallBotResponse;

  return bot;
}

export async function stopRecallBot(botId: string) {
  await recallRequest(`/meeting-bots/${botId}/`, {
    method: "DELETE",
  });
}

export async function fetchRecallBot(botId: string) {
  const bot = (await recallRequest(`/meeting-bots/${botId}/`, {
    method: "GET",
  })) as RecallBotResponse;
  return bot;
}

export async function fetchRecallTranscript(botId: string) {
  const transcript = (await recallRequest(
    `/meeting-bots/${botId}/transcript/`,
    {
      method: "GET",
    },
  )) as { text: string };

  return transcript;
}

function isBotComplete(bot: RecallBotResponse) {
  const status = bot.status?.toLowerCase();
  return (
    status === "completed" ||
    status === "call_ended" ||
    status === "media_ready" ||
    status === "transcript_ready"
  );
}

export async function pollRecallBots() {
  if (!process.env.RECALL_API_KEY) {
    throw new Error("Missing RECALL_API_KEY");
  }

  const activeMeetings = await prisma.meeting.findMany({
    where: {
      recallBotId: {
        not: null,
      },
      recallStatus: {
        notIn: ["completed", "cancelled"],
      },
    },
    include: {
      transcript: true,
    },
  });

  let processed = 0;

  for (const meeting of activeMeetings) {
    if (!meeting.recallBotId) continue;

    try {
      const bot = await fetchRecallBot(meeting.recallBotId);
      const complete = isBotComplete(bot);

      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          recallStatus: bot.status ?? meeting.recallStatus,
          status: complete ? MeetingStatus.COMPLETED : meeting.status,
        },
      });

      if (complete) {
        const transcript = await fetchRecallTranscript(meeting.recallBotId);

        await prisma.meetingTranscript.upsert({
          where: { meetingId: meeting.id },
          create: {
            meetingId: meeting.id,
            rawText: transcript.text ?? "",
            summary: meeting.transcript?.summary,
          },
          update: {
            rawText: transcript.text ?? "",
          },
        });

        await runMeetingAutomations(meeting.id);
      }

      processed += 1;
    } catch (error) {
      console.error("[recall] poll error", error);
    }
  }

  return { processed };
}

