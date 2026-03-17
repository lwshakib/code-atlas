import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { streamTextFromGLM } from "@/llm/streamText";
import { aiTools } from "@/lib/ai-tools";

export async function POST(
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
    const { id: codebaseId } = await params;
    const { messages } = await req.json();

    // Verify ownership
    const codebase = await prisma.codebase.findUnique({
      where: { id: codebaseId },
    });

    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json({ error: "Codebase not found or access denied" }, { status: 404 });
    }

    // Prepare system prompt
    const systemPrompt = {
      role: "system",
      content: `You are an expert software architect AI assistant. You have access to the codebase: "${codebase.name}" (ID: ${codebaseId}).
      Use the provided tools to search the code and understand relations.
      When answering:
      1. Always show relevant code snippets if you find them.
      2. Explain the architecture clearly.
      3. If you don't find something, say so.
      
      Current Date: ${new Date().toLocaleDateString()}`
    };

    const stream = await streamTextFromGLM([systemPrompt, ...messages], {
      tools: aiTools,
      codebaseId
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("API POST /api/chat/[id] error:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
