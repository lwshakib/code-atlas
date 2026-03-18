/**
 * REALTIME SUBSCRIPTION TOKEN GENERATOR
 *
 * This endpoint provides a short-lived, scoped JWT for the frontend to connect to
 * Inngest Realtime. This allows the client to listen for events (like indexing status)
 * without exposing sensitive master keys.
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSubscriptionToken } from "@inngest/realtime"; // Inngest utility for generating scoped tokens
import { inngest } from "@/inngest/client";

/**
 * POST /api/codebases/realtime/token
 * Returns a JWT scoped to a specific codebase channel.
 */
export async function POST(req: Request) {
  // 1. Authenticate the request
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Extract codebaseId from the request body
    const { codebaseId } = await req.json();

    if (!codebaseId) {
      return NextResponse.json(
        { error: "Codebase ID is required" },
        { status: 400 },
      );
    }

    /**
     * 3. Generate a scoped token.
     * The token is restricted to:
     * - A specific channel: `codebase:${codebaseId}`
     * - Specific topics: only "status" updates
     * This prevents users from eavesdropping on other codebases or events.
     */
    const token = await getSubscriptionToken(inngest, {
      channel: `codebase:${codebaseId}`,
      topics: ["status"],
    });

    // Return the token payload (JWT + metadata)
    return NextResponse.json(token);
  } catch (error: unknown) {
    console.error("API POST /api/codebases/realtime/token error:", error);
    return NextResponse.json(
      { error: "Failed to generate subscription token" },
      { status: 500 },
    );
  }
}
