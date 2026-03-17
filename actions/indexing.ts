"use server";

import { Octokit } from "octokit";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { getNeo4jDriver } from "@/lib/neo4j";
import { getPineconeIndex } from "@/lib/pinecone";
import { generateEmbeddings } from "@/llm/embeddings";
import { generateTextFromGLM } from "@/llm/generateText";

import { inngest } from "@/inngest/client";

/**
 * Server action to fetch codebases for the authenticated user.
 */
export async function getUserCodebasesAction() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const codebases = await prisma.codebase.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: codebases };
  } catch (error: any) {
    console.error("getUserCodebasesAction error:", error);
    return { success: false, error: error.message || "Failed to fetch codebases" };
  }
}

/**
 * Server action to start indexing a codebase.
 */
export async function startIndexingAction(repoFullName: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      providerId: "github",
    },
  });

  if (!account || !account.accessToken) {
    return { success: false, error: "GitHub account not connected" };
  }

  const octokit = new Octokit({ auth: account.accessToken });

  try {
    // 1. Get Repository Info
    const [owner, repo] = repoFullName.split("/");
    const { data: repoInfo } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    // 2. Create Codebase Record in Postgres
    let codebase = await prisma.codebase.findFirst({
      where: {
        userId: session.user.id,
        url: repoInfo.html_url,
      },
    });

    if (codebase) {
      codebase = await prisma.codebase.update({
        where: { id: codebase.id },
        data: {
          name: repoInfo.name,
          description: repoInfo.description,
        },
      });
    } else {
      codebase = await prisma.codebase.create({
        data: {
          name: repoInfo.name,
          url: repoInfo.html_url,
          description: repoInfo.description,
          userId: session.user.id,
        },
      });
    }

    // 3. Trigger Inngest background job
    // This allows us to handle large repos without timing out the server action
    await inngest.send({
      name: "codebase/index.start",
      data: {
        repoFullName,
        codebaseId: codebase.id,
        accessToken: account.accessToken,
        userId: session.user.id,
      },
    });

    return { success: true, codebaseId: codebase.id };
  } catch (error: any) {
    console.error("startIndexingAction error:", error);
    return { success: false, error: error.message || "Failed to start indexing" };
  }
}

