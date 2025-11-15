import type { Meeting } from "@prisma/client";
import { MeetingPlatform } from "@prisma/client";

const RECALL_BASE_URL =
  process.env.RECALL_BASE_URL || "https://us-west-2.recall.ai/api/v1";

async function recallRequest(
  path: string,
  init: RequestInit = {},
): Promise<any> {
  if (!process.env.RECALL_API_KEY) {
    throw new Error("Missing RECALL_API_KEY");
  }

  const baseUrl = RECALL_BASE_URL.endsWith("/")
    ? RECALL_BASE_URL.slice(0, -1)
    : RECALL_BASE_URL;
  const apiPath = path.startsWith("/") ? path : `/${path}`;

  const response = await fetch(`${baseUrl}${apiPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      Authorization: process.env.RECALL_API_KEY,
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

  // Calculate meeting duration in seconds
  const meetingDurationSeconds = Math.ceil(
    (meeting.endTime.getTime() - meeting.startTime.getTime()) / 1000,
  );

  // Calculate time from join time to end time (including lead time)
  const totalWaitTimeSeconds = Math.ceil(
    (meeting.endTime.getTime() - new Date(joinTime).getTime()) / 1000,
  );

  // Platform-specific waiting room timeout limits (in seconds)
  // These are platform-enforced maximums that override our settings
  let platformLimit: number = Infinity;
  switch (meeting.platform) {
    case MeetingPlatform.GOOGLE_MEET:
      platformLimit = 600; // 10 minutes
      break;
    case MeetingPlatform.MICROSOFT_TEAMS:
      platformLimit = 1800; // 30 minutes
      break;
    case MeetingPlatform.ZOOM:
      platformLimit = Infinity; // No limit
      break;
    default:
      platformLimit = Infinity;
  }

  // Set timeouts to be longer than the meeting duration to ensure bot stays until end
  // Add buffer of 1 hour to account for delays
  const silenceTimeout = Math.max(3600, meetingDurationSeconds + 3600);
  const botDetectionTimeout = Math.max(3600, meetingDurationSeconds + 3600);
  
  // Use platform-specific limit or total wait time, whichever is smaller
  const waitingRoomTimeout = Math.min(
    totalWaitTimeSeconds,
    platformLimit === Infinity ? totalWaitTimeSeconds : platformLimit,
  );
  
  const nooneJoinedTimeout = totalWaitTimeSeconds; // Wait until scheduled end time
  const notRecordingTimeout = Math.max(3600, meetingDurationSeconds + 3600);

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
    automatic_leave: {
      silence_detection: {
        timeout: silenceTimeout,
        activate_after: 1200, // 20 minutes
      },
      bot_detection: {
        using_participant_events: {
          timeout: 600, // 10 minutes
          activate_after: 1200, // 20 minutes
        },
        using_participant_names: {
          matches: ["Jump Notetaker", "notetaker", "bot", "recall"], // Bot name patterns to detect
          timeout: botDetectionTimeout,
          activate_after: 1200, // 20 minutes
        },
      },
      everyone_left: {
        timeout: 2, // Leave immediately if everyone left
        activate_after: 0,
      },
      waiting_room_timeout: waitingRoomTimeout, // Wait until scheduled end time
      noone_joined_timeout: nooneJoinedTimeout, // Wait until scheduled end time
      in_call_not_recording_timeout: notRecordingTimeout,
      recording_permission_denied_timeout: 30, // 30 seconds if permission denied
    },
  };

  console.log("Bot payload", payload);

  const bot = await recallRequest("/bot/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return bot;
}

export async function fetchRecallBot(botId: string) {
  const bot = await recallRequest(`/bot/${botId}/`, {
    method: "GET",
  });
  return bot;
}

export async function stopRecallBot(botId: string) {
  await recallRequest(`/bot/${botId}/`, {
    method: "DELETE",
  });
}

export async function requestTranscript(recordingId: string) {
  const response = await recallRequest(`/recording/${recordingId}/create_transcript/`, {
    method: "POST",
    body: JSON.stringify({
      provider: {
        recallai_async: {
          language_code: "en_us",
        },
      },
    }),
  });
  return response?.transcript?.id as string | undefined;
}

export async function downloadTranscript(transcriptId: string) {
  const meta = await recallRequest(`/transcript/${transcriptId}/`, {
    method: "GET",
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

