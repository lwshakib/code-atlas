/**
 * CODEBASES COLLECTION ROUTE HANDLER
 *
 * This file manages the collection of all codebases for the authenticated user.
 * It supports listing all codebases (GET) and initiating the indexing of a new one (POST).
 */

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import { inngest } from "@/inngest/client";
import { decrypt } from "@/lib/crypto";

/**
 * GET /api/codebases
 * Returns a list of all codebases belonging to the logged-in user.
 */
export async function GET() {
  // 1. Authenticate the session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Fetch all codebase records from Postgres for this user
    const codebases = await prisma.codebase.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc", // Latest first
      },
    });

    return NextResponse.json({ success: true, data: codebases });
  } catch (error: unknown) {
    console.error("API GET /api/codebases error:", error);
    return NextResponse.json(
      { error: "Failed to fetch codebases" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/codebases
 * Initiates the indexing process for a new GitHub repository.
 */
export async function POST(req: Request) {
  // 1. Authenticate the session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Extract repository full name (e.g., 'facebook/react') from request
    const { repoFullName } = await req.json();

    // 3. Fetch the user's GitHub OAuth token from the database
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "github",
      },
    });

    if (!account || !account.accessToken) {
      return NextResponse.json(
        { error: "GitHub account not connected" },
        { status: 400 },
      );
    }
    const decryptedToken = decrypt(account.accessToken);

    // Initialize Octokit (GitHub API client) with the user's token
    const octokit = new Octokit({ auth: decryptedToken });

    // 4. Validate Repository existence and access via GitHub API
    const [owner, repo] = repoFullName.split("/");
    let repoInfo;
    try {
      const response = await octokit.rest.repos.get({
        owner,
        repo,
      });
      repoInfo = response.data;
    } catch (err: unknown) {
      // Handle the case where the repo is private or doesn't exist
      if (err instanceof Error && (err as { status?: number }).status === 404) {
        return NextResponse.json(
          {
            error:
              "Repository not found or private. Please check the URL and ensure your GitHub account has the necessary permissions.",
          },
          { status: 404 },
        );
      }
      throw err;
    }

    // 5. Postgres Record Creation/Update
    // We check if this user has already indexed this specific repo.
    let codebase = await prisma.codebase.findFirst({
      where: {
        userId: session.user.id,
        url: repoInfo.html_url,
      },
    });

    if (codebase) {
      // If it exists, we update the metadata (name, description)
      codebase = await prisma.codebase.update({
        where: { id: codebase.id },
        data: {
          name: repoInfo.name,
          description: repoInfo.description,
        },
      });
    } else {
      // If new, we create a record with 'PENDING' status (default in schema)
      codebase = await prisma.codebase.create({
        data: {
          name: repoInfo.name,
          url: repoInfo.html_url,
          description: repoInfo.description,
          userId: session.user.id,
        },
      });
    }

    // 6. Trigger Background Indexing Job via Inngest
    // We send an event that the Inngest 'index-codebase' function is listening for.
    await inngest.send({
      name: "codebase/index.start",
      data: {
        repoFullName,
        codebaseId: codebase.id,
        accessToken: decryptedToken,
        userId: session.user.id,
      },
    });

    // Return the newly created/updated ID to the frontend
    return NextResponse.json({ success: true, codebaseId: codebase.id });
  } catch (error: unknown) {
    console.error("API POST /api/codebases error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to start indexing" },
      { status: 500 },
    );
  }
}
