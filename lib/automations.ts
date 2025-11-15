import { SocialPostStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatAttendeeList } from "@/lib/meeting-utils";
import { generateFollowUpEmail, generateSocialPost } from "@/lib/ai";
import { publishSocialPost } from "@/lib/social";

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

  const automations = await prisma.automation.findMany({
    where: {
      userId: meeting.userId,
      enabled: true,
    },
  });

  for (const automation of automations) {
    const existing = meeting.socialPosts.find(
      (post) => post.automationId === automation.id,
    );
    if (existing) continue;

    const content = await generateSocialPost({
      meetingTitle: meeting.title,
      attendees,
      transcriptText: meeting.transcript.rawText,
      platform: automation.platform,
      customPrompt: automation.prompt,
    });

    const newPost = await prisma.socialPost.create({
      data: {
        userId: meeting.userId,
        meetingId: meeting.id,
        automationId: automation.id,
        platform: automation.platform,
        content,
        status: SocialPostStatus.DRAFT,
      },
    });

    if (automation.autoPost) {
      try {
        await publishSocialPost(newPost.id);
      } catch (error) {
        await prisma.socialPost.update({
          where: { id: newPost.id },
          data: { status: SocialPostStatus.FAILED },
        });
        console.error("[automation] autopost failed", error);
      }
    }
  }
}

