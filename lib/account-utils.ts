import { Buffer } from "buffer";
import type { Account } from "@prisma/client";

export function getAccountEmail(account: Account) {
  if (account.provider !== "google" || !account.id_token) {
    return null;
  }

  try {
    const [, payload] = account.id_token.split(".");
    if (!payload) return null;
    const decoded = JSON.parse(
      Buffer.from(payload, "base64").toString("utf8"),
    );
    return (decoded.email as string | undefined) ?? null;
  } catch (error) {
    console.error("[account-email] Failed to decode id_token", error);
    return null;
  }
}

