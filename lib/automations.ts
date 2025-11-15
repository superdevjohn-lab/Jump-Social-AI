import { SocialPostStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatAttendeeList } from "@/lib/meeting-utils";
import { generateFollowUpEmail, generateSocialPost } from "@/lib/ai";

export async function runMeetingAutomations(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcript: true,
      socialPosts: true,
    },
  });

  if (!meeting || !meeting.transcript?.rawText) {
    return;
  }

  const attendees = formatAttendeeList(meeting.attendees);

  // Generate follow-up email if missing
  if (!meeting.transcript.followUpEmail) {
    const followUp = await generateFollowUpEmail({
      meetingTitle: meeting.title,
      attendees,
      transcriptText: meeting.transcript.rawText,
    });

    await prisma.meetingTranscript.update({
      where: { meetingId: meeting.id },
      data: { followUpEmail: followUp },
    });
  }

  // Generate base prompt posts for LinkedIn and Facebook (if not already exist)
  // These are created automatically when transcript is ready
  // Automation-based posts are NOT generated automatically - user must click "Generate new post"
  const platforms = ["LINKEDIN", "FACEBOOK"] as const;
  for (const platform of platforms) {
    const existingBasePost = meeting.socialPosts.find(
      (post) => post.platform === platform && !post.automationId,
    );
    if (existingBasePost) continue;

    const content = await generateSocialPost({
      meetingTitle: meeting.title,
      attendees,
      transcriptText: meeting.transcript.rawText,
      platform,
      // No customPrompt - use base prompt
    });

    await prisma.socialPost.create({
      data: {
        userId: meeting.userId,
        meetingId: meeting.id,
        automationId: null, // Base prompt post, not from automation
        platform,
        content,
        status: SocialPostStatus.DRAFT,
      },
    });
  }

  // Note: Automation-based posts are NOT generated automatically
  // Users must manually click "Generate new post" button in the UI
  // which calls generateSocialPostAction in app/meetings/[id]/page.tsx
}

