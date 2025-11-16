import { SocialPlatform } from "@prisma/client";

import { prisma } from "@/lib/prisma";

async function getLinkedInPersonUrn(accessToken: string): Promise<string> {
  // Fetch the person URN from LinkedIn OpenID Connect userinfo endpoint
  // Reference: https://learn.microsoft.com/es-mx/linkedin/consumer/integrations/self-serve/share-on-linkedin
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch LinkedIn profile: ${error}`);
  }

  const data = await response.json();
  // The OpenID Connect userinfo response contains 'sub' (subject) which is the Person URN
  // Format: urn:li:person:xxxxx or just the numeric ID
  // We can also check 'id' field as fallback
  const personUrn = data.sub || data.id;
  if (!personUrn) {
    throw new Error("LinkedIn Person URN not found in userinfo response");
  }
  
  // Extract numeric ID from URN if it's in URN format, otherwise use as-is
  const personId = personUrn.replace("urn:li:person:", "");
  return personId;
}

async function linkedinShare(accessToken: string, text: string) {
  // First, get the person URN
  const personId = await getLinkedInPersonUrn(accessToken);

  const body = {
    author: `urn:li:person:${personId}`,
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
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
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

  // According to LinkedIn API docs, successful response (201 Created) returns post ID in X-RestLi-Id header
  // Reference: https://learn.microsoft.com/es-mx/linkedin/consumer/integrations/self-serve/share-on-linkedin
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `LinkedIn publish failed (${response.status}): ${errorText}`;
    
    // Try to parse error for better message
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) {
        errorMessage = `LinkedIn publish failed: ${errorJson.message}`;
      }
      if (errorJson.errorDetails) {
        errorMessage += ` - ${JSON.stringify(errorJson.errorDetails)}`;
      }
    } catch {
      // Use the text error if JSON parsing fails
    }
    
    throw new Error(errorMessage);
  }

  // Check for post ID in response header first (preferred method per LinkedIn docs)
  const postId = response.headers.get("X-RestLi-Id");
  if (postId) {
    return postId;
  }

  // Fallback: try to get from response body if header is not available
  try {
    const data = await response.json();
    if (data.id) {
      return data.id as string;
    }
  } catch {
    // If response is not JSON or body is empty, continue
  }

  throw new Error("LinkedIn post ID not found in response header or body");
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

