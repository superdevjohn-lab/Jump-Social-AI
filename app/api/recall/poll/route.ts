import { NextResponse } from "next/server";

import { pollRecallBots } from "@/lib/recall";

export async function POST(request: Request) {
  const secret = process.env.RECALL_POLL_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await pollRecallBots();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[recall] poll failure", error);
    return NextResponse.json({ error: "Poll failed" }, { status: 500 });
  }
}

