import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  meetingId: z.string(),
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const { meetingId, enabled } = bodySchema.parse(json);

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { userId: true },
  });

  if (!meeting || meeting.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      notetakerEnabled: enabled,
    },
  });

  revalidatePath("/dashboard");

  return NextResponse.json({ success: true });
}

