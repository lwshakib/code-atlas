/**
 * STREAMING CHAT ENGINE (AGI LOOP)
 * 
 * This file implements a multi-turn autonomous agent. It doesn't just stream text; 
 * it iteratively calls database tools (Neo4j, Pinecone) until it has enough info 
 * to answer the user's codebase query.
 */

import { GLM_WORKER_URL, CLOUDFLARE_API_KEY } from "@/lib/env";
import { executeTool } from "@/lib/ai-tools";

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}

/**
 * STREAM TEXT FROM GLM
 * 
 * The main high-level logic for codebase chat. Orchestrates the research loop.
 * 
 * @param messages Initial conversation history
 * @param options Includes existing codebase ID and available tools
 * @param signal AbortSignal to stop the agent if the user cancels
 * @returns A ReadableStream of JSON-objects (NDJSON)
 */
export async function streamTextFromGLM(
  messages: Message[], 
  options: { tools?: unknown[]; tool_choice?: string; codebaseId?: string } = {},
  signal?: AbortSignal
): Promise<ReadableStream> {
  const currentMessages = [...messages];

  /**
   * INITIAL REQUEST HELPER
   * Sends the starting prompt to the serverless worker.
   */
  const getInitialStream = async () => {
    const response = await fetch(GLM_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`
      },
      body: JSON.stringify({
        messages: currentMessages,
        tools: options.tools,
        tool_choice: options.tool_choice,
        stream: true
      }),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM Worker Error: ${response.status} - ${errorText}`);
    }
    return response;
  };

  const response = await getInitialStream();
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      if (!reader) {
        controller.close();
        return;
      }

      let currentReader = reader;
      let toolCalls: { id: string; type: string; function: { name: string; arguments: string } }[] = [];
      let turnCount = 0;
      let lineBuffer = "";
      const MAX_TURNS = 6; // Safety cap to prevent Infinite Research Loops

      try {
        // Enqueue a newline-delimited JSON string into the stream
        const streamJson = (obj: { type: string; [key: string]: unknown }) => {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + "\n"));
        };

        /**
         * MAIN AGENT LOOP
         * Continues processing as long as there's stream output or pending tool calls.
         */
        while (true) {
          const { done, value } = await currentReader.read();

          if (done) {
            // IF THE STREAM ENDED WITH TOOL CALLS: We must execute them and restart the stream
            if (toolCalls.length > 0 && turnCount < MAX_TURNS) {
              turnCount++;
              
              // 1. Record the assistant's request for tools in history
              const assistantMessage: Message = { role: "assistant", tool_calls: toolCalls };
              currentMessages.push(assistantMessage);

              // 2. PARALLEL TOOL EXECUTION
              // We run search_codebase and get_file_content in parallel for max performance
              const toolResults = await Promise.all(
                toolCalls.map(async (tc) => {
                  signal?.throwIfAborted();
                  // Notify UI that a tool is active
                  streamJson({ type: "tool", id: tc.id, tool: tc.function.name, status: "calling" });
                  
                  try {
                    const result = await executeTool(
                      tc.function.name, 
                      JSON.parse(tc.function.arguments),
                      options.codebaseId || "",
                      signal
                    );
                    // Notify UI of success
                    streamJson({ type: "tool", id: tc.id, tool: tc.function.name, status: "success", result });
                    return { id: tc.id, content: JSON.stringify(result) };
                  } catch (e) {
                    const errorMsg = (e as Error).message;
                    streamJson({ type: "tool", id: tc.id, tool: tc.function.name, status: "error", result: errorMsg });
                    return { id: tc.id, content: JSON.stringify({ error: errorMsg }) };
                  }
                })
              );

              // 3. Add tool responses to our conversation history
              for (const tr of toolResults) {
                currentMessages.push({
                  role: "tool",
                  tool_call_id: tr.id,
                  content: tr.content
                });
              }

              // 4. RECURSIVE CALL: Re-submit the whole history to the LLM to get the next step
              const nextRes = await fetch(GLM_WORKER_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`
                },
                body: JSON.stringify({
                  messages: currentMessages,
                  // Disable tools if we reached max turns to force a final answer
                  tools: turnCount < MAX_TURNS ? options.tools : undefined,
                  stream: true
                }),
                signal
              });

              if (!nextRes.ok) throw new Error("GLM re-fetch failed after tool call");
              
              const nextReader = nextRes.body?.getReader();
              if (!nextReader) break;
              currentReader = nextReader;
              toolCalls = []; // Reset for the next turn
              continue;
            }
            break; // No more tool calls and stream is done
          }

          // CHUNK PROCESSING (Standard SSE-like parsing)
          const chunk = decoder.decode(value, { stream: true });
          const combined = lineBuffer + chunk;
          const lines = combined.split("\n");

          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta;
                
                // Accumulate tool call arguments as they stream in
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (!toolCalls[tc.index]) {
                      toolCalls[tc.index] = { id: tc.id || `tc-${tc.index}`, type: "function", function: { name: "", arguments: "" } };
                    }
                    if (tc.id) toolCalls[tc.index].id = tc.id;
                    if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                  }
                } 
                // Forward text chunks immediately to the UI
                else if (delta?.content) {
                  streamJson({ type: "text", content: delta.content });
                }
              } catch {
                // Ignore partial JSON lines
              }
            }
          }
        }
      } catch (error: unknown) {
        if ((error as Error).name === "AbortError") {
          console.log("[GLM Stream] Aborted");
        } else {
          controller.error(error);
        }
      } finally {
        currentReader.releaseLock();
        controller.close();
      }
    }
  });
}


