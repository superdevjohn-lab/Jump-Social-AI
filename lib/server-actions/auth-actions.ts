"use server";

import { signIn, signOut } from "@/lib/auth";

export async function startSignIn(
  provider: "google" | "linkedin" | "facebook",
  redirectTo: string,
) {
  await signIn(provider, { redirectTo });
}

export async function startSignOut(redirectTo = "/") {
  await signOut({ redirectTo });
}

