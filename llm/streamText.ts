import { GLM_WORKER_URL, CLOUDFLARE_API_KEY } from "@/lib/env";
import { executeTool } from "@/lib/ai-tools";

/**
 * Creates a readable stream from the GLM-4.7-Flash worker with tool support.
 * 
 * @param messages - Array of message objects { role, content, ... }
 * @param options - tools, tool_choice, etc.
 * @param signal - AbortSignal to cancel the request
 * @returns A ReadableStream that emits text chunks
 */
export async function streamTextFromGLM(
  messages: any[], 
  options: { tools?: any[]; tool_choice?: string; codebaseId?: string } = {},
  signal?: AbortSignal
): Promise<ReadableStream> {
  const currentMessages = [...messages];

  // Logic to handle tool calls and potentially multi-turn before streaming text
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
      let toolCalls: any[] = [];
      let isFirstPass = true;

      try {
        const streamJson = (obj: any) => {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + "\n"));
        };

        while (true) {
          const { done, value } = await currentReader.read();

          if (done) {
            if (toolCalls.length > 0) {
              const assistantMessage = { role: "assistant", tool_calls: toolCalls };
              currentMessages.push(assistantMessage);

              for (const tc of toolCalls) {
                // Emit calling status
                streamJson({ type: "tool", id: tc.id, tool: tc.function.name, status: "calling" });

                try {
                  const result = await executeTool(
                    tc.function.name, 
                    JSON.parse(tc.function.arguments),
                    options.codebaseId || ""
                  );
                  currentMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify(result)
                  });

                  // Emit success status
                  streamJson({ type: "tool", id: tc.id, tool: tc.function.name, status: "success", result });
                } catch (e) {
                  currentMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify({ error: (e as Error).message })
                  });
                  streamJson({ type: "tool", id: tc.id, tool: tc.function.name, status: "error", result: (e as Error).message });
                }
              }

              const nextRes = await fetch(GLM_WORKER_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`
                },
                body: JSON.stringify({
                  messages: currentMessages,
                  tools: options.tools,
                  stream: true
                }),
                signal
              });

              if (!nextRes.ok) throw new Error("GLM re-fetch failed after tool call");
              
              const nextReader = nextRes.body?.getReader();
              if (!nextReader) break;
              currentReader = nextReader;
              toolCalls = []; 
              continue;
            }
            break; 
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta;
                
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (!toolCalls[tc.index]) {
                      toolCalls[tc.index] = { id: tc.id || `tc-${tc.index}`, type: "function", function: { name: "", arguments: "" } };
                    }
                    if (tc.id) toolCalls[tc.index].id = tc.id;
                    if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                  }
                } else if (delta?.content) {
                  streamJson({ type: "text", content: delta.content });
                }
              } catch (e) {
                console.error("Error parsing GLM stream chunk:", e, dataStr);
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

