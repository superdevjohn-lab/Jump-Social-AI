import NextAuth from "next-auth";
import type { Session, User } from "next-auth";
import type { Provider } from "next-auth/providers";
import type { LinkedInProfile } from "next-auth/providers/linkedin";
import type { FacebookProfile } from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import Facebook from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

const providers: Provider[] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly",
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  providers.push(
    LinkedIn({
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "r_liteprofile r_emailaddress w_member_social",
        },
      },
      profile(profile: LinkedInProfile) {
        const rawProfile = profile as LinkedInProfile & Record<string, any>;
        const firstName =
          profile.localizedFirstName ??
          rawProfile.firstName?.localized?.[
            `${rawProfile.firstName?.preferredLocale?.language || "en"}_${rawProfile.firstName?.preferredLocale?.country || "US"}`
          ] ??
          "";
        const lastName =
          profile.localizedLastName ??
          rawProfile.lastName?.localized?.[
            `${rawProfile.lastName?.preferredLocale?.language || "en"}_${rawProfile.lastName?.preferredLocale?.country || "US"}`
          ] ??
          "";
        const email =
          (rawProfile.emailAddress ||
            rawProfile.elements?.[0]?.["handle~"]?.emailAddress) ||
          null;
        const picture =
          rawProfile.profilePicture?.["displayImage~"]?.elements?.[0]?.identifiers?.[0]
            ?.identifier ||
          null;

        return {
          id: profile.id,
          name:
            [firstName, lastName].filter(Boolean).join(" ") ||
            profile.localizedHeadline ||
            "LinkedIn Member",
          email,
          image: picture,
        };
      },
    }),
  );
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata",
        },
      },
      profile(profile: FacebookProfile) {
        const email = (profile as FacebookProfile & Record<string, unknown>)
          .email as string | undefined;
        const name =
          profile.name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          "Facebook User";

        return {
          id: profile.id,
          name,
          email: email ?? null,
          image: `https://graph.facebook.com/${profile.id}/picture?type=large`,
        };
      },
    }),
  );
}

if (providers.length === 0) {
  throw new Error(
    "At least one OAuth provider must be configured. Check your environment variables.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  providers,
  trustHost: true,
  callbacks: {
    session: async ({ session, user }: { session: Session; user: User }) => {
      if (session.user && user.id) {
        session.user.id = user.id;
        session.user.name = session.user.name ?? user.name;
        session.user.email = session.user.email ?? user.email;
        session.user.image = session.user.image ?? user.image;
      }
      return session;
    },
  },
  events: {
    createUser: async ({ user }: { user: User }) => {
      if (!user.id) return;

      await prisma.setting.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
        },
        update: {},
      });
    },
  },
});

