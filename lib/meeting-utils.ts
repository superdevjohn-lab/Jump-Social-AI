type GoogleAttendee = {
  email?: string | null;
  displayName?: string | null;
  responseStatus?: string | null;
};

export function formatAttendeeList(attendees: unknown) {
  const parsed = (attendees as GoogleAttendee[]) ?? [];
  if (!parsed.length) return "Not listed";
  return parsed
    .filter((attendee) => attendee.responseStatus !== "declined")
    .map((attendee) => attendee.displayName || attendee.email || "Guest")
    .join(", ");
}

export function getAttendees(attendees: unknown): GoogleAttendee[] {
  const parsed = (attendees as GoogleAttendee[]) ?? [];
  return parsed.filter((attendee) => attendee.responseStatus !== "declined");
}

export function formatRecallStatus(status: string | null | undefined): string {
  if (!status) return "Not started";
  const statusMap: Record<string, string> = {
    "bot.pending": "Pending creation",
    "bot.created": "Bot created",
    "bot.joining_call": "Joining call",
    "bot.in_waiting_room": "In waiting room",
    "bot.in_call_recording": "Recording",
    "bot.call_ended": "Call ended",
    "bot.call_ended_no_recording": "Ended (no recording)",
    "bot.done": "Completed",
    "bot.done_no_recording": "Ended (no recording)",
    "recording.done": "Recording processed",
    "transcript.requested": "Transcript requested",
    "transcript.done": "Transcript ready",
  };
  return statusMap[status] || status.replace(/_/g, " ").replace(/\./g, " ");
}

type TranscriptWord = {
  text: string;
  start_timestamp: {
    relative: number | null;
    absolute: number | null;
  };
  end_timestamp: {
    relative: number | null;
    absolute: number | null;
  };
};

type TranscriptParticipant = {
  id: number;
  name: string;
  is_host: boolean;
  platform: string;
  email: string | null;
  extra_data?: Record<string, any>;
};

type TranscriptSegment = {
  participant: TranscriptParticipant;
  words: TranscriptWord[];
};

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function parseStructuredTranscript(data: unknown): string | null {
  try {
    const segments = data as TranscriptSegment[];
    if (!Array.isArray(segments) || segments.length === 0) {
      return null;
    }

    // Check if it's the structured format
    if (!segments[0]?.participant || !segments[0]?.words) {
      return null;
    }

    const lines: string[] = [];
    let currentParticipant: TranscriptParticipant | null = null;
    let currentWords: string[] = [];
    let currentStartTime: number | null = null;

    for (const segment of segments) {
      const { participant, words } = segment;

      // If participant changed, flush previous segment
      if (
        currentParticipant &&
        currentParticipant.id !== participant.id &&
        currentWords.length > 0
      ) {
        const timeStr = currentStartTime !== null
          ? formatTimestamp(currentStartTime)
          : "0m 0s";
        lines.push(
          `${currentParticipant.name}\n${timeStr}\n${currentWords.join(" ")}`,
        );
        currentWords = [];
        currentStartTime = null;
      }

      currentParticipant = participant;

      for (const word of words) {
        if (currentStartTime === null && word.start_timestamp.relative !== null) {
          currentStartTime = word.start_timestamp.relative;
        }
        currentWords.push(word.text);
      }
    }

    // Flush last segment
    if (currentParticipant && currentWords.length > 0) {
      const timeStr = currentStartTime !== null
        ? formatTimestamp(currentStartTime)
        : "0m 0s";
      lines.push(
        `${currentParticipant.name}\n${timeStr}\n${currentWords.join(" ")}`,
      );
    }

    return lines.join("\n\n");
  } catch {
    return null;
  }
}

export function formatTranscript(text: string): string {
  // Try to parse as structured JSON first
  try {
    const parsed = JSON.parse(text);
    const structured = parseStructuredTranscript(parsed);
    if (structured) {
      return structured;
    }
  } catch {
    // Not JSON, continue with plain text formatting
  }

  // Fallback to plain text formatting
  return text
    .split(/(?:\n\n+|\. |\? |! )/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .join(". ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getFormattedTranscriptText(text: string): string {
  const formatted = formatTranscript(text);
  // Convert the formatted display format to readable text for copying
  const segments = formatted.split("\n\n");
  const lines: string[] = [];
  
  for (const segment of segments) {
    const segmentLines = segment.split("\n");
    if (segmentLines.length >= 3) {
      const [name, time, ...textLines] = segmentLines;
      lines.push(`${name} (${time})`);
      lines.push(textLines.join(" "));
      lines.push(""); // Empty line between speakers
    } else {
      lines.push(segment);
      lines.push("");
    }
  }
  
  return lines.join("\n").trim();
}

