type GenerateArgs = {
  meetingTitle: string;
  transcriptText: string;
  attendees?: string;
};

async function callOpenAI(prompt: string) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.45,
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that writes polished financial advisor communications. Keep tone warm, professional, and compliant.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[openai] request failed", error);
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return content as string | null;
}

export async function generateFollowUpEmail({
  meetingTitle,
  transcriptText,
  attendees = "the client",
}: GenerateArgs) {
  const prompt = `Draft a concise follow-up email (200 words max) from a financial advisor to ${attendees}. Summarize the key themes from this meeting titled "${meetingTitle}" and include a clear list of next steps. Transcript:\n${transcriptText}\nEmail:`;

  const completion = await callOpenAI(prompt);

  if (completion) {
    return completion.trim();
  }

  return `Hi there,\n\nThank you for the thoughtful conversation during "${meetingTitle}". Here’s a quick recap of what we covered:\n\n• Reviewed portfolio positioning and risk tolerance\n• Confirmed the action items and follow-ups for next quarter\n• Scheduled our next touchpoint to revisit goals\n\nNext steps:\n1. We'll finalize the allocation changes discussed and share the updated plan.\n2. Please send over any new life updates that might affect the strategy.\n\nLet me know if any questions pop up. Looking forward to our next meeting.\n\nBest,\nYour Advisory Team`;
}

export async function generateSocialPost({
  meetingTitle,
  transcriptText,
  attendees = "a client",
  platform,
  customPrompt,
}: GenerateArgs & {
  platform: "LINKEDIN" | "FACEBOOK";
  customPrompt?: string;
}) {
  const tone =
    platform === "LINKEDIN"
      ? "professional yet conversational, first-person, 120-160 words, end with up to three hashtags"
      : "friendly, community-focused, 80-120 words, include a gentle call-to-action";

  const basePrompt = customPrompt
    ? `${customPrompt}\n\nUse this transcript for context:\n${transcriptText}`
    : `Write a ${tone} social media post describing highlights from the meeting "${meetingTitle}" with ${attendees}. Focus on market insights and value to clients. Avoid confidential details. Transcript:\n${transcriptText}\nPost:`;

  const completion = await callOpenAI(basePrompt);
  if (completion) return completion.trim();

  return `Talking with ${attendees} about staying calm in choppy markets is always energizing. "${meetingTitle}" was all about aligning goals with the right mix of growth and stability. We revisited risk tolerance, penciled in our next check-in, and left with a plan that feels resilient no matter what the headlines say.\n\nSmall adjustments now build confidence later. Let’s keep the dialogue going.`;
}

