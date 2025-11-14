import { google, type calendar_v3 } from "googleapis";
import {
  MeetingPlatform,
  MeetingStatus,
  type Account,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SYNC_WINDOW_DAYS = 14;

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

const urlRegex = /(https?:\/\/[^\s]+)/i;

function pickPlatform(source: string | undefined): MeetingPlatform {
  if (!source) return MeetingPlatform.OTHER;
  const normalized = source.toLowerCase();

  if (normalized.includes("zoom.us") || normalized.includes("zoom.com")) {
    return MeetingPlatform.ZOOM;
  }
  if (normalized.includes("meet.google.com")) {
    return MeetingPlatform.GOOGLE_MEET;
  }
  if (
    normalized.includes("teams.microsoft.com") ||
    normalized.includes("microsoft.com/l/meetup-join")
  ) {
    return MeetingPlatform.MICROSOFT_TEAMS;
  }

  return MeetingPlatform.OTHER;
}

function extractFirstUrl(text?: string | null) {
  if (!text) return undefined;
  const match = text.match(urlRegex);
  return match?.[0];
}

function extractConferenceUrl(event: calendar_v3.Schema$Event) {
  if (event.hangoutLink) return event.hangoutLink;
  const entryPoint = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri,
  );
  if (entryPoint?.uri) {
    return entryPoint.uri;
  }

  return (
    extractFirstUrl(event.location) ||
    extractFirstUrl(event.description) ||
    undefined
  );
}

async function refreshGoogleAccessToken(account: Account) {
  if (!account.refresh_token) {
    throw new Error("Missing Google refresh token");
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth environment variables are not configured.");
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Google token: ${error}`);
  }

  const tokens = (await response.json()) as GoogleTokenResponse;
  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: tokens.access_token,
      expires_at: expiresAt,
      id_token: tokens.id_token ?? account.id_token,
    },
  });

  return tokens.access_token;
}

async function getValidAccessToken(account: Account) {
  const now = Math.floor(Date.now() / 1000);
  if (
    account.access_token &&
    account.expires_at &&
    account.expires_at - 120 > now
  ) {
    return account.access_token;
  }

  if (account.access_token && !account.expires_at) {
    return account.access_token;
  }

  return refreshGoogleAccessToken(account);
}

async function buildGoogleClient(account: Account) {
  const accessToken = await getValidAccessToken(account);
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({
    access_token: accessToken,
  });
  return client;
}

export async function syncGoogleCalendarsForUser(userId: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth environment variables are not configured.");
  }

  const googleAccounts = await prisma.account.findMany({
    where: {
      userId,
      provider: "google",
    },
  });

  if (!googleAccounts.length) {
    return {
      syncedEvents: 0,
      accountsProcessed: 0,
    };
  }

  const windowStart = new Date();
  const windowEnd = new Date(
    windowStart.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  let syncedEvents = 0;

  for (const account of googleAccounts) {
    try {
      const authClient = await buildGoogleClient(account);
      const calendar = google.calendar({ version: "v3", auth: authClient });

      const calendarList = await calendar.calendarList.list({
        minAccessRole: "reader",
      });

      for (const cal of calendarList.data.items ?? []) {
        if (!cal.id || cal.deleted) continue;
        if (cal.accessRole === "freeBusyReader") continue;

        const eventsResponse = await calendar.events.list({
          calendarId: cal.id,
          timeMin: windowStart.toISOString(),
          timeMax: windowEnd.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });

        for (const event of eventsResponse.data.items ?? []) {
          if (!event.id || event.status === "cancelled") continue;

          const startIso = event.start?.dateTime ?? event.start?.date;
          const endIso =
            event.end?.dateTime ??
            event.end?.date ??
            event.start?.dateTime ??
            event.start?.date;

          if (!startIso || !endIso) continue;

          const startTime = new Date(startIso);
          const endTime = new Date(endIso);
          const conferenceUrl = extractConferenceUrl(event);
          const platform = pickPlatform(
            conferenceUrl ||
              event.location ||
              event.description ||
              event.summary ||
              undefined,
          );
          const externalEventId = `${cal.id}:${event.id}`;

          await prisma.meeting.upsert({
            where: {
              userId_externalEventId: {
                userId,
                externalEventId,
              },
            },
            create: {
              userId,
              externalEventId,
              title: event.summary ?? "Untitled meeting",
              description: event.description,
              platform,
              conferenceUrl,
              startTime,
              endTime,
              timezone:
                event.start?.timeZone ??
                cal.timeZone ??
                Intl.DateTimeFormat().resolvedOptions().timeZone,
              attendees: event.attendees ?? [],
              notetakerEnabled: false,
              status:
                startTime.getTime() > Date.now()
                  ? MeetingStatus.UPCOMING
                  : MeetingStatus.COMPLETED,
            },
            update: {
              title: event.summary ?? "Untitled meeting",
              description: event.description,
              platform,
              conferenceUrl,
              startTime,
              endTime,
              timezone:
                event.start?.timeZone ??
                cal.timeZone ??
                Intl.DateTimeFormat().resolvedOptions().timeZone,
              attendees: event.attendees ?? [],
              status:
                startTime.getTime() > Date.now()
                  ? MeetingStatus.UPCOMING
                  : MeetingStatus.COMPLETED,
            },
          });

          syncedEvents += 1;
        }
      }
    } catch (error) {
      console.error(
        `[calendar-sync] Failed to sync account ${account.id}`,
        error,
      );
    }
  }

  return {
    syncedEvents,
    accountsProcessed: googleAccounts.length,
  };
}

