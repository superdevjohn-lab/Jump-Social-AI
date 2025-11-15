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

