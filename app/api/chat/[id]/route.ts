/**
 * AI CHAT ROUTE HANDLER
 * 
 * This endpoint handles complex multi-turn AI chat interactions for a specific codebase.
 * It integrates with PG (Prisma) for history, Pinecone for semantic search, and Neo4j for graphs.
 */

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { CHAT_ASSISTANT_SYSTEM_PROMPT } from "@/llm/prompts";
import { streamTextFromGLM } from "@/llm/streamText";
import { aiTools } from "@/lib/ai-tools";

/**
 * POST /api/chat/[id]
 * Processes a chat message from the user, saves it, and streams the AI's response.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Authenticate the user via Better Auth
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Return 401 if the user is not logged in
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Destructure inputs: codebase ID from URL and message history from body
    const { id: codebaseId } = await params;
    const { messages } = await req.json();

    // Validate that messages exist and is an array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // 3. Ownership Verification
    // Ensure the codebase exists and the current user has permission to interact with it
    const codebase = await prisma.codebase.findUnique({
      where: { id: codebaseId },
    });

    if (!codebase || codebase.userId !== session.user.id) {
      return NextResponse.json({ error: "Codebase not found or access denied" }, { status: 404 });
    }

    // 4. Persistence: Save the user's latest message to the Postgres database
    const userMessage = messages[messages.length - 1];
    
    // We only save 'user' messages that have actual text content
    if (userMessage && userMessage.role === 'user' && userMessage.content) {
      await prisma.message.create({
        data: {
          role: "user",
          parts: [{ type: "text", text: userMessage.content }], // Stored as JSON for future extensibility
          codebaseId,
        },
      });
    }

    // 5. LLM Call Prep
    // Prepare the system prompt which defines the agent's personality and specialized tools
    const systemPrompt = {
      role: "system",
      content: CHAT_ASSISTANT_SYSTEM_PROMPT(codebase.name)
    };

    /**
     * Call the custom GLM streaming wrapper.
     * This function manages the tool-calling loop (calling search_codebase, etc.)
     * and generates a ReadableStream.
     */
    const stream = await streamTextFromGLM([systemPrompt, ...messages], {
      tools: aiTools, // Pass tools like search_codebase, get_file_content
      codebaseId
    }, req.signal); // Use request signal to allow aborting if the user closes the tab

    // 6. Response Splitting (Tee)
    // We split the stream: one goes to the user, the other is collected in the background to save the history
    const [streamToReturn, streamToCollect] = stream.tee();

    /**
     * BACKGROUND COLLECTION
     * This IIFE (Immediately Invoked Function Expression) processes the twin stream
     * asynchronously so the user receives the text immediately without waiting for DB writes.
     */
    (async () => {
      const reader = streamToCollect.getReader();
      const decoder = new TextDecoder();
      
      // Structure to capture tool results for database storage
      interface ToolCapture {
        type: "tool";
        id: string;
        tool: string;
        result: unknown;
      }

      let fullContent = "";
      const toolCaptures: ToolCapture[] = [];
      let lastSavedLength = 0;
      let lastSavedToolCount = 0;

      /**
       * Helper function to periodically save generated text and tool results to Postgres
       */
      const saveProgress = async () => {
        // Prevent redundant writes if no new data was generated
        if ((fullContent.length > lastSavedLength) || (toolCaptures.length > lastSavedToolCount)) {
          if (fullContent || toolCaptures.length > 0) {
            await prisma.message.create({
              data: {
                role: "assistant",
                parts: [
                  { type: "text", text: fullContent }, // The final built string of the AI's response
                  ...toolCaptures                     // All tools the AI called during the generation
                ] as Prisma.InputJsonValue,
                codebaseId: (await params).id,
              },
            });
            lastSavedLength = fullContent.length;
            lastSavedToolCount = toolCaptures.length;
          }
        }
      };

      try {
        // Read chunks from the stream until exhausted
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              // Parse each JSON chunk emitted by streamTextFromGLM
              const data = JSON.parse(line);
              if (data.type === "text") {
                fullContent += data.content; // Accumulate plain text
              } else if (data.type === "tool" && data.status === "success") {
                toolCaptures.push({ // Accumulate tool results
                  type: "tool",
                  id: data.id,
                  tool: data.tool,
                  result: data.result
                });
              }
            } catch {
              // Ignore non-JSON or partial chunks
            }
          }
        }
      } catch (err) {
        const error = err as Error;
        if (error.name === 'AbortError') {
          console.log("[POST] Stream collection aborted by client");
        } else {
          console.error("[COLLECT_STREAM_ERROR]", error);
        }
      } finally {
        // Final save to ensure the database is updated with the complete interaction
        await saveProgress();
        reader.releaseLock();
      }
    })();

    // 7. Return the stream to the client (Frontend)
    return new Response(streamToReturn, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("API POST /api/chat/[id] error:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}

