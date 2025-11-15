import { generateFollowUpEmail, generateSocialPost } from "@/lib/ai";

const transcript = "We reviewed retirement goals and risk tolerance.";

describe("AI helpers", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    delete (process.env as Record<string, string | undefined>).OPENAI_API_KEY;
  });

  it("falls back to template follow-up email without OPENAI_API_KEY", async () => {
    const email = await generateFollowUpEmail({
      meetingTitle: "Client Review",
      transcriptText: transcript,
      attendees: "Jordan",
    });

    expect(email).toContain("Client Review");
    expect(email.length).toBeGreaterThan(50);
  });

  it("uses OpenAI when API key is present", async () => {
    process.env.OPENAI_API_KEY = "test";
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Post content",
            },
          },
        ],
      }),
    } as Response);

    const post = await generateSocialPost({
      meetingTitle: "Mid-year review",
      transcriptText: transcript,
      attendees: "Jordan",
      platform: "LINKEDIN",
    });

    expect(post).toBe("Post content");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

