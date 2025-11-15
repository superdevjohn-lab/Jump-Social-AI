import { formatAttendeeList } from "@/lib/meeting-utils";

describe("formatAttendeeList", () => {
  it("returns 'Not listed' when attendees undefined", () => {
    expect(formatAttendeeList(undefined)).toBe("Not listed");
  });

  it("joins attendee display names or emails", () => {
    const attendees = [
      { displayName: "Alice", email: "alice@example.com" },
      { email: "bob@example.com" },
    ];

    expect(formatAttendeeList(attendees)).toBe("Alice, bob@example.com");
  });

  it("filters declined attendees", () => {
    const attendees = [
      { displayName: "Kee", responseStatus: "accepted" },
      { displayName: "Lee", responseStatus: "declined" },
    ];

    expect(formatAttendeeList(attendees)).toBe("Kee");
  });
});

