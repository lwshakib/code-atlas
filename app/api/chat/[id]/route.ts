import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { CHAT_ASSISTANT_SYSTEM_PROMPT } from "@/llm/prompts";
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

    // Prepare system prompt using "Goldilocks" precision principles
    const systemPrompt = {
      role: "system",
      content: CHAT_ASSISTANT_SYSTEM_PROMPT(codebase.name)
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
