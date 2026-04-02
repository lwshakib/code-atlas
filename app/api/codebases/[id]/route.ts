/**
 * CODEBASE SPECIFIC ROUTE HANDLER
 *
 * This file manages operations on a single codebase instance, identified by its unique ID.
 * It supports updating names (PATCH), deleting all associated data (DELETE),
 * clearing chat history (PUT), and fetching fully aggregated codebase data (GET).
 */

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";
import { PineconeService } from "@/services/pinecone.services";

/**
 * PATCH /api/codebases/[id]
 * Renames a codebase.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Authentication check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json(); // New name from request body
    const { id } = await params; // ID from URL params

    // Verify ownership before updating
    const codebase = await prisma.codebase.findUnique({
      where: { id },
    });

    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Codebase not found or access denied" },
        { status: 404 },
      );
    }

    // Perform the update in Postgres (Prisma)
    const updatedCodebase = await prisma.codebase.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json({ success: true, data: updatedCodebase });
  } catch (error: unknown) {
    console.error("API PATCH /api/codebases/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to rename codebase" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/codebases/[id]
 * Permanently removes a codebase and all its associated data across 3 separate databases.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Authentication check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Verify ownership before deletion
    const codebase = await prisma.codebase.findUnique({
      where: { id },
    });

    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Codebase not found or access denied" },
        { status: 404 },
      );
    }

    /**
     * MULTI-SYSTEM CLEANUP
     * Codebase data lives in Postgres, Pinecone (Vectors), and Neo4j (Graph).
     * We attempt to delete from all 3 to maintain consistency.
     */

    // 1. Delete vector embeddings from Pinecone (Vector DB)
    try {
      const pineconeIndex = PineconeService.getInstance().getIndex();
      await pineconeIndex.deleteMany({
        filter: { codebaseId: { $eq: id } }, // Filter by the specific codebase ID
      });
    } catch (pcError) {
      console.error("Failed to delete from Pinecone:", pcError);
      // We log but continue, as a failure here shouldn't block the primary DB deletion
    }

    // 2. Delete architectural nodes and relationships from Neo4j (Graph DB)
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
          { id },
        ),
      );
      await neoSession.close();
    } catch (neoError) {
      console.error("Failed to delete from Neo4j:", neoError);
    }

    // 3. Finally, delete the record from our primary Postgres database (Prisma)
    // Cascade settings in the schema handle the deletion of DocPages and Messages.
    await prisma.codebase.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("API DELETE /api/codebases/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete codebase" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/codebases/[id]
 * Acts as a 'Clear Chat' endpoint for a specific codebase.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Authentication check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: codebaseId } = await params;

    // Verify ownership
    const codebase = await prisma.codebase.findUnique({
      where: { id: codebaseId },
    });

    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Codebase not found or access denied" },
        { status: 404 },
      );
    }

    // Delete all messages associated with this specific codebase
    await prisma.message.deleteMany({
      where: { codebaseId },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("API PUT /api/codebases/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to clear chat history" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/codebases/[id]
 * Aggregates all data for the 'Codebase Details' view: Wiki pages, Recommendations, and Chat history.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Authentication check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Fetch the codebase with complicated joins for fully hydrated UI
    const codebase = await prisma.codebase.findUnique({
      where: { id },
      include: {
        docPages: {
          // Retrieve generated wiki pages
          orderBy: { order: "asc" },
          include: {
            children: {
              // Include nested sub-sections
              orderBy: { order: "asc" },
            },
          },
        },
        recommendations: true, // Retrieve AI-suggested starting questions
        messages: {
          // Retrieve previous chat messages
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Validations
    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Codebase not found or access denied" },
        { status: 404 },
      );
    }

    // PERSISTENCE FORMATTING:
    // Postgres stores message parts as raw JSON. We map them back to the specific
    // structured format expected by our frontend components (with tool citations).
    const formattedMessages = codebase.messages.map((m) => {
      const parts = m.parts as {
        type: string;
        text?: string;
        id?: string;
        tool?: string;
        result?: unknown;
      }[];
      return {
        id: m.id,
        role: m.role,
        // Extract the main text part
        content: Array.isArray(parts)
          ? parts.find((p) => p.type === "text")?.text || ""
          : "",
        // Extract and format tool invocations for visualization in the chat UI
        toolInvocations: Array.isArray(parts)
          ? parts
              .filter((p) => p.type === "tool")
              .map((p) => ({
                id: p.id,
                tool: p.tool,
                status: "success", // Historically loaded tool calls are marked as success
                result: p.result,
              }))
          : [],
      };
    });

    // UI Optimization: Filter to only return top-level wiki pages initially.
    // Nested children are already attached to these objects.
    const topLevelPages = codebase.docPages.filter((p) => !p.parentId);

    return NextResponse.json({
      success: true,
      data: {
        ...codebase,
        docPages: topLevelPages,
        messages: formattedMessages,
      },
    });
  } catch (error: unknown) {
    console.error("API GET /api/codebases/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch codebase" },
      { status: 500 },
    );
  }
}
