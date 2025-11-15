import type { Meeting } from "@prisma/client";

const RECALL_BASE_URL = "https://api.recall.ai/v1";

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
    metadata: {
      meetingId: meeting.id,
      userId: meeting.userId,
    },
  };

  const bot = await recallRequest("/bot/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return bot;
}

export async function stopRecallBot(botId: string) {
  await recallRequest(`/bot/${botId}/`, {
    method: "DELETE",
  });
}

export async function requestTranscript(recordingId: string) {
  const response = await recallRequest("/recording/create_transcript/create/", {
    method: "POST",
    body: JSON.stringify({ recording_id: recordingId }),
  });
  return response?.transcript?.id as string | undefined;
}

export async function downloadTranscript(transcriptId: string) {
  const meta = await recallRequest("/transcript/retrieve/", {
    method: "POST",
    body: JSON.stringify({ transcript_id: transcriptId }),
  });

  const downloadUrl: string | undefined = meta?.data?.download_url;
  if (!downloadUrl) {
    throw new Error("Recall transcript response missing download_url");
  }

  const download = await fetch(downloadUrl);
  if (!download.ok) {
    throw new Error("Unable to download transcript payload");
  }

  const text = await download.text();
  return { text };
}

