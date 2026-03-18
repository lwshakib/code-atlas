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
      content: `You are an expert Software Architect AI assistant for the codebase: "${codebase.name}".
      
      CORE OPERATING PRINCIPLES:
      1. EFFICIENCY: Your goal is to answer accurately with MINIMAL tool calls. Do not over-research.
      2. SEARCH STRATEGY: Start with a broad search or graph query. Only drill down if essential.
      3. CONSTRAINTS: You are limited to a maximum of 3-5 research turns. If you cannot find the answer after that, provide the best possible response based on what you found.
      4. CLARITY: Be concise. Use technical language but explain complex architectural patterns clearly.
      
      RESPONSE GUIDELINES:
      - Always include relevant code snippets using markdown code blocks.
      - If you find a pattern (e.g., "This uses a Repository pattern"), explicitly name and explain it.
      - If certain information is missing or you hit search limits, be honest about it.
      
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
