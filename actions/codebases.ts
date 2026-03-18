"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { inngest } from "@/inngest/client";
import { getNeo4jDriver } from "@/lib/neo4j";
import { getPineconeIndex } from "@/lib/pinecone";
import { getSubscriptionToken } from "@inngest/realtime";

export async function cancelAndCleanupIndexingAction(codebaseId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  try {
    const codebase = await prisma.codebase.findUnique({
      where: { id: codebaseId },
    });

    if (!codebase || codebase.userId !== session.user.id) {
      throw new Error("Codebase not found or access denied");
    }

    // 1. Send cancellation event to Inngest
    await inngest.send({
      name: "codebase/index.cancel",
      data: { codebaseId },
    });

    // 2. Cleanup data (Pinecone, Neo4j, Postgres)
    // Delete from Pinecone
    try {
      const pineconeIndex = getPineconeIndex();
      await pineconeIndex.deleteMany({
        filter: { codebaseId: { $eq: codebaseId } }
      });
    } catch (pcError) {
      console.error("Failed to delete from Pinecone during cancellation:", pcError);
    }

    // Delete from Neo4j
    try {
      const driver = getNeo4jDriver();
      const neoSession = driver.session();
      await neoSession.executeWrite(tx => 
        tx.run(
          `
          MATCH (c:Codebase {id: $id})
          OPTIONAL MATCH (f:File {codebaseId: $id})
          DETACH DELETE c, f
          `,
          { id: codebaseId }
        )
      );
      await neoSession.close();
    } catch (neoError) {
      console.error("Failed to delete from Neo4j during cancellation:", neoError);
    }

    // Delete from Postgres
    await prisma.codebase.delete({
      where: { id: codebaseId },
    });

    return { success: true };
  } catch (error) {
    const err = error as Error;
    console.error("cancelAndCleanupIndexingAction error:", err);
    return { success: false, error: err.message || "Failed to cancel indexing" };
  }
}

export async function retryIndexingAction(codebaseId: string) {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
  
    if (!session) {
      throw new Error("Unauthorized");
    }
  
    try {
      const codebase = await prisma.codebase.findUnique({
        where: { id: codebaseId },
      });
  
      if (!codebase || codebase.userId !== session.user.id) {
        throw new Error("Codebase not found or access denied");
      }

      const account = await prisma.account.findFirst({
        where: {
          userId: session.user.id,
          providerId: "github",
        },
      });

      if (!account || !account.accessToken) {
         throw new Error("GitHub account not connected");
      }

      // Extract owner and repo from URL
      const urlParts = codebase.url.split("/");
      const owner = urlParts[3];
      const repo = urlParts[4];
      const repoFullName = `${owner}/${repo}`;
  
      // Update status back to PENDING
      await prisma.codebase.update({
        where: { id: codebaseId },
        data: { status: "PENDING" },
      });
  
      // Trigger Inngest background job
      await inngest.send({
        name: "codebase/index.start",
        data: {
          repoFullName,
          codebaseId: codebase.id,
          accessToken: account.accessToken,
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

export async function fetchRealtimeSubscriptionToken(codebaseId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const token = await getSubscriptionToken(inngest, {
    channel: `codebase:${codebaseId}`,
    topics: ["status"],
  });

  return token;
}
