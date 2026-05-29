"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { inngest } from "@/inngest/client";
import { getNeo4jDriver } from "@/lib/neo4j";
import { getPineconeIndex } from "@/lib/pinecone";
import { getSubscriptionToken } from "@inngest/realtime";
import { decrypt } from "@/lib/crypto";

export async function cancelAndCleanupIndexingAction(codebaseId: string) {
  // Get the current user session using Better Auth
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If no session exists, the user is not logged in
  if (!session) {
    throw new Error("Unauthorized");
  }

  try {
    // Find the specific codebase record in the Postgres database
    const codebase = await prisma.codebase.findUnique({
      where: { id: codebaseId },
    });

    // Verify the codebase exists and belongs to the authenticated user
    if (!codebase || codebase.userId !== session.user.id) {
      throw new Error("Codebase not found or access denied");
    }

    // 1. Send cancellation event to Inngest background worker
    // This will stop any ongoing indexing processes for this codebase
    await inngest.send({
      name: "codebase/index.cancel",
      data: { codebaseId },
    });

    // 2. Cleanup data from external systems (Pinecone, Neo4j, Postgres)

    // Delete vector embeddings from Pinecone
    try {
      const pineconeIndex = getPineconeIndex();
      await pineconeIndex.deleteMany({
        filter: { codebaseId: { $eq: codebaseId } },
      });
    } catch (pcError) {
      console.error(
        "Failed to delete from Pinecone during cancellation:",
        pcError,
      );
    }

    // Delete architectural nodes and relationships from Neo4j
    try {
      const driver = getNeo4jDriver();
      const neoSession = driver.session();
      await neoSession.executeWrite((tx) =>
        tx.run(
          `
          MATCH (c:Codebase {id: $id})
          OPTIONAL MATCH (f:File {codebaseId: $id})
          DETACH DELETE c, f
          `,
          { id: codebaseId },
        ),
      );
      await neoSession.close();
    } catch (neoError) {
      console.error(
        "Failed to delete from Neo4j during cancellation:",
        neoError,
      );
    }

    // Finally, remove the codebase record from our primary Postgres database
    await prisma.codebase.delete({
      where: { id: codebaseId },
    });

    return { success: true };
  } catch (error) {
    const err = error as Error;
    console.error("cancelAndCleanupIndexingAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to cancel indexing",
    };
  }
}

export async function retryIndexingAction(codebaseId: string) {
  // Verify user session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  try {
    // Fetch the codebase record
    const codebase = await prisma.codebase.findUnique({
      where: { id: codebaseId },
    });

    // Ensure the user owns this codebase
    if (!codebase || codebase.userId !== session.user.id) {
      throw new Error("Codebase not found or access denied");
    }

    // Fetch the GitHub account connected to the user to get a fresh access token
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "github",
      },
    });

    if (!account || !account.accessToken) {
      throw new Error("GitHub account not connected");
    }

    const decryptedToken = decrypt(account.accessToken);

    // Parse the GitHub URL to extract repository details (owner/repo)
    const urlParts = codebase.url.split("/");
    const owner = urlParts[3];
    const repo = urlParts[4];
    const repoFullName = `${owner}/${repo}`;

    // Reset the codebase status to PENDING so the UI knows it's starting over
    await prisma.codebase.update({
      where: { id: codebaseId },
      data: { status: "PENDING" },
    });

    // Trigger the Inngest 'index.start' event to begin the background indexing process
    await inngest.send({
      name: "codebase/index.start",
      data: {
        repoFullName,
        codebaseId: codebase.id,
        accessToken: decryptedToken,
        userId: session.user.id,
      },
    });

    return { success: true };
  } catch (error) {
    const err = error as Error;
    console.error("retryIndexingAction error:", err);
    return { success: false, error: err.message || "Failed to retry indexing" };
  }
}

/**
 * Fetches a short-lived realtime subscription token for the Inngest/Realtime stream.
 * This allows the client to listen for status updates (e.g. 'indexing', 'completed')
 * without revealing secret keys.
 */
export async function fetchRealtimeSubscriptionToken(codebaseId: string) {
  // Authentication check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Request a token from Inngest Realtime specifically for this codebase's channel
  const token = await getSubscriptionToken(inngest, {
    channel: `codebase:${codebaseId}`,
    topics: ["status"],
  });

  return token;
}
