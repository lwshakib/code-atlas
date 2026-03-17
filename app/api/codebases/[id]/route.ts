import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json();
    const { id } = params;

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
  { params }: { params: { id: string } }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = params;

    const codebase = await prisma.codebase.findUnique({
      where: { id },
    });

    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json({ error: "Codebase not found or access denied" }, { status: 404 });
    }

    await prisma.codebase.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API DELETE /api/codebases/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete codebase" }, { status: 500 });
  }
}
