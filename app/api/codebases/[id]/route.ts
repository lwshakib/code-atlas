import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";
import { getPineconeIndex } from "@/lib/pinecone";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json();
    const { id } = await params;


    const codebase = await prisma.codebase.findUnique({
      where: { id },
    });

    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json({ error: "Codebase not found or access denied" }, { status: 404 });
    }

    const updatedCodebase = await prisma.codebase.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json({ success: true, data: updatedCodebase });
  } catch (error: any) {
    console.error("API PATCH /api/codebases/[id] error:", error);
    return NextResponse.json({ error: "Failed to rename codebase" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;


    const codebase = await prisma.codebase.findUnique({
      where: { id },
    });

    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json({ error: "Codebase not found or access denied" }, { status: 404 });
    }

    // 1. Delete from Pinecone (Vector DB)
    try {
      const pineconeIndex = getPineconeIndex();
      await pineconeIndex.deleteMany({
        filter: { codebaseId: { $eq: id } }
      });
    } catch (pcError) {
      console.error("Failed to delete from Pinecone:", pcError);
      // Continue to ensure other deletions are attempted
    }

    // 2. Delete from Neo4j (Graph DB)
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
          { id }
        )
      );
      await neoSession.close();
    } catch (neoError) {
      console.error("Failed to delete from Neo4j:", neoError);
    }

    // 3. Delete from Postgres (Primary DB)
    await prisma.codebase.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API DELETE /api/codebases/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete codebase" }, { status: 500 });
  }
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const codebase = await prisma.codebase.findUnique({
      where: { id },
      include: {
        docPages: {
          orderBy: { order: "asc" },
          include: {
            children: {
              orderBy: { order: "asc" }
            }
          }
        },
        recommendations: true
      }
    });

    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json({ error: "Codebase not found or access denied" }, { status: 404 });
    }

    // Filter to only return top-level pages
    const topLevelPages = codebase.docPages.filter(p => !p.parentId);

    return NextResponse.json({ 
      success: true, 
      data: {
        ...codebase,
        docPages: topLevelPages
      } 
    });
  } catch (error: any) {
    console.error("API GET /api/codebases/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch codebase" }, { status: 500 });
  }
}
