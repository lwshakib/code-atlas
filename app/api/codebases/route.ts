import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import { inngest } from "@/inngest/client";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({ success: true, data: codebases });
  } catch (error: any) {
    console.error("API GET /api/codebases error:", error);
    return NextResponse.json({ error: "Failed to fetch codebases" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { repoFullName } = await req.json();

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "github",
      },
    });

    if (!account || !account.accessToken) {
      return NextResponse.json({ error: "GitHub account not connected" }, { status: 400 });
    }

    const octokit = new Octokit({ auth: account.accessToken });

    // 1. Get Repository Info
    const [owner, repo] = repoFullName.split("/");
    let repoInfo;
    try {
      const response = await octokit.rest.repos.get({
        owner,
        repo,
      });
      repoInfo = response.data;
    } catch (err: any) {
      if (err.status === 404) {
        return NextResponse.json({ 
          error: "Repository not found or private. Please check the URL and ensure your GitHub account has the necessary permissions." 
        }, { status: 404 });
      }
      throw err;
    }

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
    await inngest.send({
      name: "codebase/index.start",
      data: {
        repoFullName,
        codebaseId: codebase.id,
        accessToken: account.accessToken,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true, codebaseId: codebase.id });
  } catch (error: any) {
    console.error("API POST /api/codebases error:", error);
    return NextResponse.json({ error: error.message || "Failed to start indexing" }, { status: 500 });
  }
}
