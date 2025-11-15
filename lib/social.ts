import { SocialPlatform } from "@prisma/client";

import { prisma } from "@/lib/prisma";

async function linkedinShare(accessToken: string, authorId: string, text: string) {
  const body = {
    author: `urn:li:person:${authorId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text,
        },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "CONNECTIONS",
    },
  };

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn publish failed: ${error}`);
  }

  const data = await response.json();
  return data.id as string;
}

async function facebookShare(accessToken: string, message: string) {
  const response = await fetch(
    "https://graph.facebook.com/v19.0/me/feed",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        message,
        access_token: accessToken,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Facebook publish failed: ${error}`);
  }

  const data = await response.json();
  return data.id as string;
}

export async function publishSocialPost(socialPostId: string) {
  const socialPost = await prisma.socialPost.findUnique({
    where: { id: socialPostId },
  });

  if (!socialPost) {
    throw new Error("Social post not found");
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: socialPost.userId,
      provider:
        socialPost.platform === SocialPlatform.LINKEDIN
          ? "linkedin"
          : "facebook",
    },
  });

  if (!account?.access_token) {
    throw new Error(
      `No connected ${
        socialPost.platform === SocialPlatform.LINKEDIN ? "LinkedIn" : "Facebook"
      } account`,
    );
  }

  let externalId: string | null = null;

  if (socialPost.platform === SocialPlatform.LINKEDIN) {
    externalId = await linkedinShare(
      account.access_token,
      account.providerAccountId,
      socialPost.content,
    );
  } else {
    externalId = await facebookShare(account.access_token, socialPost.content);
  }

  await prisma.socialPost.update({
    where: { id: socialPost.id },
    data: {
      status: "POSTED",
      externalPostId: externalId,
      postedAt: new Date(),
    },
  });

  return { externalId };
}

