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

    // Save user message to database
    const userMessage = messages[messages.length - 1];
    await prisma.message.create({
      data: {
        role: "user",
        parts: [{ type: "text", text: userMessage.content }],
        codebaseId,
      },
    });

    // Prepare system prompt 
    const systemPrompt = {
      role: "system",
      content: CHAT_ASSISTANT_SYSTEM_PROMPT(codebase.name)
    };

    const stream = await streamTextFromGLM([systemPrompt, ...messages], {
      tools: aiTools,
      codebaseId
    });

    // We split the stream so we can collect the final message to save it
    const [streamToReturn, streamToCollect] = stream.tee();

    // Async collection to avoid blocking the user response
    (async () => {
      const reader = streamToCollect.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let toolCaptures: any[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.type === "text") {
                fullContent += data.content;
              } else if (data.type === "tool" && data.status === "success") {
                toolCaptures.push({
                  type: "tool",
                  id: data.id,
                  tool: data.tool,
                  result: data.result
                });
              }
            } catch (e) {
              // Not JSON chunk
            }
          }
        }

        // Save assistant message when done
        if (fullContent || toolCaptures.length > 0) {
          await prisma.message.create({
            data: {
              role: "assistant",
              parts: [
                { type: "text", text: fullContent },
                ...toolCaptures
              ],
              codebaseId,
            },
          });
        }
      } catch (err) {
        console.error("[COLLECT_STREAM_ERROR]", err);
      }
    })();

    return new Response(streamToReturn, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("API POST /api/chat/[id] error:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
