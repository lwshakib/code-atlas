import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSubscriptionToken } from "@inngest/realtime";
import { inngest } from "@/inngest/client";

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { codebaseId } = await req.json();

    if (!codebaseId) {
      return NextResponse.json({ error: "Codebase ID is required" }, { status: 400 });
    }

    // Scoped token for the specific codebase channel
    const token = await getSubscriptionToken(inngest, {
      channel: `codebase:${codebaseId}`,
      topics: ["status"],
    });

    return NextResponse.json(token);
  } catch (error: unknown) {
    console.error("API POST /api/codebases/realtime/token error:", error);
    return NextResponse.json({ error: "Failed to generate subscription token" }, { status: 500 });
  }
}
