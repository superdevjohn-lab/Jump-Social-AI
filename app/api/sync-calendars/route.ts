import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { syncGoogleCalendarsForUser } from "@/lib/google";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await syncGoogleCalendarsForUser(session.user.id);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json(
      { error: "Failed to sync calendars" },
      { status: 500 },
    );
  }
}

